"""Collect system metrics for Linux (Mint-friendly); no root required for core signals."""

from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psutil


def _read_os_release() -> dict[str, str]:
    path = Path("/etc/os-release")
    if not path.is_file():
        return {}
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, _, v = line.partition("=")
            v = v.strip().strip('"')
            out[k.strip()] = v
    return out


def _disk_mounts() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for part in psutil.disk_partitions(all=False):
        if part.fstype in ("squashfs", "tmpfs") and part.mountpoint != "/tmp":
            continue
        try:
            usage = psutil.disk_usage(part.mountpoint)
        except (OSError, PermissionError):
            continue
        try:
            inodes = os.statvfs(part.mountpoint)
            inode_pct = (
                round(100.0 * (1 - inodes.f_favail / max(inodes.f_files, 1)), 1)
                if inodes.f_files
                else None
            )
        except OSError:
            inode_pct = None
        rows.append(
            {
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percent": usage.percent,
                "inode_percent": inode_pct,
            }
        )
    return sorted(rows, key=lambda r: r["mountpoint"])


def collect_mount_detail(mountpoint: str) -> dict[str, Any] | None:
    """Live filesystem usage + ``statvfs`` for a mount path, or ``None`` if unavailable."""
    if not mountpoint or not isinstance(mountpoint, str):
        return None
    mp = os.path.normpath(mountpoint.strip())
    if not mp.startswith("/"):
        return None
    try:
        usage = psutil.disk_usage(mp)
    except (OSError, PermissionError, TypeError):
        return None

    part = None
    try:
        target = os.path.realpath(mp)
    except OSError:
        target = mp
    for p in psutil.disk_partitions(all=False):
        try:
            if os.path.realpath(p.mountpoint) == target:
                part = p
                break
        except OSError:
            continue

    out: dict[str, Any] = {
        "mountpoint": mp,
        "ts": time.time(),
        "device": part.device if part else None,
        "fstype": part.fstype if part else None,
        "mount_options": part.opts if part else None,
        "total": int(usage.total),
        "used": int(usage.used),
        "free": int(usage.free),
        "percent": round(float(usage.percent), 1),
    }

    try:
        sv = os.statvfs(mp)
    except OSError:
        sv = None

    if sv is not None:
        out["statvfs"] = {
            "f_bsize": sv.f_bsize,
            "f_frsize": sv.f_frsize,
            "f_blocks": sv.f_blocks,
            "f_bfree": sv.f_bfree,
            "f_bavail": sv.f_bavail,
            "f_files": sv.f_files,
            "f_ffree": sv.f_ffree,
            "f_favail": getattr(sv, "f_favail", sv.f_ffree),
            "f_namemax": sv.f_namemax,
        }
        if sv.f_files:
            out["inode_percent"] = round(
                100.0 * (1.0 - sv.f_favail / max(sv.f_files, 1)), 1
            )

    if part and getattr(part, "fstype", None) == "zfs":
        ds = _zfs_resolve_dataset(part, mp)
        if ds:
            out["zfs_dataset"] = ds
            out["zfs_pool"] = ds.split("/")[0]
            zprop = _zfs_dataset_properties(ds)
            if zprop:
                out["zfs_properties"] = zprop

    return out


_zfs_pool_status_cache: dict[str, Any] = {"ts": 0.0, "by_pool": {}}
_ZFS_STATUS_CACHE_TTL_SEC = 25.0


def _zfs_dataset_name_for_mount(mountpoint: str) -> str | None:
    """Return ``pool/dataset`` style name for a ZFS mount (``findmnt``)."""
    mp = os.path.normpath(mountpoint)
    try:
        r = subprocess.run(
            ["findmnt", "-n", "-o", "SOURCE", "--", mp],
            capture_output=True,
            text=True,
            timeout=4,
        )
        if r.returncode == 0:
            src = r.stdout.strip()
            if src and "/" in src and not src.startswith(("/", "[")):
                return src
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return None


_ZFS_DETAIL_PROPS = (
    "used,available,referenced,compressratio,compression,recordsize,atime,"
    "canmount,quota,refquota,reservation,refreservation,mounted,mountpoint,"
    "encryption,keystatus"
)


def _zfs_dataset_properties(dataset: str) -> dict[str, str]:
    props: dict[str, str] = {}
    try:
        r = subprocess.run(
            [
                "zfs",
                "get",
                "-H",
                "-o",
                "property,value",
                _ZFS_DETAIL_PROPS,
                dataset,
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if r.returncode != 0:
            return props
        for line in r.stdout.splitlines():
            line = line.strip()
            if not line or "\t" not in line:
                continue
            k, _, v = line.partition("\t")
            props[k.strip()] = v.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        pass
    return props


def _zfs_zpool_status_by_pool() -> dict[str, dict[str, str]]:
    now = time.time()
    global _zfs_pool_status_cache
    if now - float(_zfs_pool_status_cache["ts"]) < _ZFS_STATUS_CACHE_TTL_SEC:
        cached = _zfs_pool_status_cache["by_pool"]
        if isinstance(cached, dict):
            return dict(cached)

    by_pool: dict[str, dict[str, str]] = {}
    try:
        r = subprocess.run(
            ["zpool", "status"],
            capture_output=True,
            text=True,
            timeout=18,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        _zfs_pool_status_cache = {"ts": now, "by_pool": by_pool}
        return by_pool

    if r.returncode != 0:
        _zfs_pool_status_cache = {"ts": now, "by_pool": by_pool}
        return by_pool

    current: str | None = None
    for raw in r.stdout.splitlines():
        line = raw.rstrip()
        m = re.match(r"\s*pool:\s*(.+)\s*$", line)
        if m:
            current = m.group(1).strip()
            by_pool.setdefault(current, {})
            continue
        if current is None:
            continue
        m = re.match(r"\s*state:\s*(.+)\s*$", line)
        if m:
            by_pool[current]["state"] = m.group(1).strip()
            continue
        m = re.match(r"\s*status:\s*(.+)\s*$", line)
        if m and "state" not in by_pool[current]:
            by_pool[current]["state"] = m.group(1).strip()
            continue
        m = re.match(r"\s*scan:\s*(.+)\s*$", line)
        if m:
            by_pool[current]["scan"] = m.group(1).strip()
            continue
        m = re.match(r"\s*errors:\s*(.+)\s*$", line)
        if m:
            by_pool[current]["errors"] = m.group(1).strip()
            continue

    _zfs_pool_status_cache = {"ts": now, "by_pool": by_pool}
    return by_pool


def _zfs_pool_summaries() -> list[dict[str, Any]]:
    """One row per imported pool (``zpool list`` + cached ``zpool status`` fields)."""
    rows: list[dict[str, Any]] = []
    try:
        r = subprocess.run(
            [
                "zpool",
                "list",
                "-H",
                "-p",
                "-o",
                "name,size,allocated,free,capacity,health,fragmentation",
            ],
            capture_output=True,
            text=True,
            timeout=8,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return rows

    if r.returncode != 0 or not r.stdout.strip():
        return rows

    status_map = _zfs_zpool_status_by_pool()

    def int_or_none(s: str) -> int | None:
        s = s.strip()
        if not s or s == "-":
            return None
        try:
            return int(s)
        except ValueError:
            return None

    def pct_or_none(s: str) -> float | None:
        s = s.strip().rstrip("%")
        if not s or s == "-":
            return None
        try:
            return round(float(s), 1)
        except ValueError:
            return None

    for line in r.stdout.strip().splitlines():
        parts = line.split("\t")
        if len(parts) < 7:
            continue
        name, size, alloc, free, cap, health, frag = parts[:7]
        st = status_map.get(name, {})
        rows.append(
            {
                "name": name,
                "size": int_or_none(size),
                "allocated": int_or_none(alloc),
                "free": int_or_none(free),
                "capacity_percent": pct_or_none(cap),
                "health": health.strip() if health else None,
                "fragmentation_percent": pct_or_none(frag),
                "state": st.get("state"),
                "scan": st.get("scan"),
                "errors": st.get("errors"),
            }
        )

    return rows


_POOL_NAME_SAFE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.\-+]{0,199}$")


def collect_zpool_detail(pool_name: str) -> dict[str, Any] | None:
    """Live ZFS pool summary, ``zpool status`` output, and pool properties."""
    raw = (pool_name or "").strip()
    if not raw or not _POOL_NAME_SAFE.match(raw):
        return None

    def int_or_none(s: str) -> int | None:
        s = s.strip()
        if not s or s == "-":
            return None
        try:
            return int(s)
        except ValueError:
            return None

    def pct_or_none(s: str) -> float | None:
        s = s.strip().rstrip("%")
        if not s or s == "-":
            return None
        try:
            return round(float(s), 1)
        except ValueError:
            return None

    try:
        lr = subprocess.run(
            [
                "zpool",
                "list",
                "-H",
                "-p",
                "-o",
                "name,size,allocated,free,capacity,health,fragmentation",
                raw,
            ],
            capture_output=True,
            text=True,
            timeout=8,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None

    if lr.returncode != 0 or not lr.stdout.strip():
        return None

    parts = lr.stdout.strip().split("\t")
    if len(parts) < 7 or parts[0] != raw:
        return None

    size, alloc, free, cap, health, frag = parts[1:7]
    st = _zfs_zpool_status_by_pool().get(raw, {})

    status_text = ""
    try:
        sr = subprocess.run(
            ["zpool", "status", raw],
            capture_output=True,
            text=True,
            timeout=20,
        )
        if sr.returncode == 0:
            status_text = sr.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        pass

    props: dict[str, str] = {}
    try:
        pr = subprocess.run(
            ["zpool", "get", "-H", "-o", "property,value", "all", raw],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if pr.returncode == 0:
            for line in pr.stdout.splitlines():
                line = line.strip()
                if not line or "\t" not in line:
                    continue
                k, _, v = line.partition("\t")
                props[k.strip()] = v.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        pass

    return {
        "pool": raw,
        "ts": time.time(),
        "size": int_or_none(size),
        "allocated": int_or_none(alloc),
        "free": int_or_none(free),
        "capacity_percent": pct_or_none(cap),
        "health": health.strip() if health else None,
        "fragmentation_percent": pct_or_none(frag),
        "state": st.get("state"),
        "scan": st.get("scan"),
        "errors": st.get("errors"),
        "status_text": status_text or None,
        "properties": props or None,
    }


def _zfs_resolve_dataset(part: Any | None, mountpoint: str) -> str | None:
    ds = _zfs_dataset_name_for_mount(mountpoint)
    if ds:
        return ds
    if part is not None and getattr(part, "fstype", None) == "zfs":
        dev = getattr(part, "device", None)
        if dev and isinstance(dev, str) and "/" in dev and not dev.startswith("/"):
            return dev
    return None


def _iface_ip_display(ifname: str, addrs_map: dict[str, list[Any]]) -> str:
    """Comma-separated IPv4s for table column; else shortened global IPv6; else empty."""
    rows = addrs_map.get(ifname) or []
    v4: list[str] = []
    v6: list[str] = []
    for a in rows:
        fam = _json_enumish(getattr(a, "family", None))
        addr = (a.address or "").strip()
        if not addr:
            continue
        if fam in ("AF_INET", "2", 2):  # psutil.AddressFamily.AF_INET
            v4.append(addr)
        elif fam in ("AF_INET6", "10", 10):
            al = addr.lower().split("%")[0]
            if al.startswith("fe80:"):
                continue
            v6.append(addr.split("%")[0])
    if v4:
        return ", ".join(v4)
    if v6:
        return ", ".join(v6[:4]) + ("…" if len(v6) > 4 else "")
    return ""


def _net_io() -> dict[str, Any]:
    now = time.time()
    counters = psutil.net_io_counters(pernic=True)
    addrs_map = psutil.net_if_addrs()
    # Store rates requires previous sample; caller passes cache via module-level is ugly.
    # We return raw counters + timestamp; frontend can compute delta or we do two-phase in stream.
    return {
        "ts": now,
        "interfaces": {
            name: {
                "bytes_sent": io.bytes_sent,
                "bytes_recv": io.bytes_recv,
                "packets_sent": io.packets_sent,
                "packets_recv": io.packets_recv,
                "errin": io.errin,
                "errout": io.errout,
                "dropin": io.dropin,
                "dropout": io.dropout,
                "ip": _iface_ip_display(name, addrs_map),
            }
            for name, io in counters.items()
            if not name.startswith("lo")
        },
    }


def _conn_laddr_ip_port(c: Any) -> tuple[str | None, int | None]:
    la = getattr(c, "laddr", None)
    if not la:
        return None, None
    if hasattr(la, "ip"):
        ip, port = la.ip, la.port
    elif isinstance(la, (tuple, list)) and len(la) >= 2:
        ip, port = la[0], la[1]
    else:
        return None, None
    ip_s = str(ip).strip() if ip is not None and str(ip).strip() else ""
    if not ip_s:
        ip_s = "*"
    try:
        port_i = int(port)
    except (TypeError, ValueError):
        return None, None
    return ip_s, port_i


def _conn_raddr_port(c: Any) -> int | None:
    ra = getattr(c, "raddr", None)
    if not ra:
        return None
    if hasattr(ra, "port"):
        p = ra.port
    elif isinstance(ra, (tuple, list)) and len(ra) >= 2:
        p = ra[1]
    else:
        return None
    try:
        return int(p)
    except (TypeError, ValueError):
        return None


def _listening_ports() -> dict[str, Any]:
    """TCP listeners and bound UDP sockets from ``psutil.net_connections``."""
    ts = time.time()
    out: dict[str, Any] = {"ts": ts, "rows": [], "note": None}
    try:
        conns = psutil.net_connections(kind="inet")
    except psutil.AccessDenied:
        out["note"] = (
            "Access denied listing sockets — run with privileges to see all listeners."
        )
        return out
    except (PermissionError, OSError, RuntimeError) as e:
        out["note"] = str(e)[:240]
        return out

    rows: list[dict[str, Any]] = []
    seen: set[tuple[Any, ...]] = set()
    pid_names: dict[int, str] = {}

    def process_label(pid: int | None) -> str | None:
        if pid is None:
            return None
        if pid in pid_names:
            return pid_names[pid]
        try:
            pid_names[pid] = psutil.Process(pid).name()
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pid_names[pid] = "—"
        return pid_names[pid]

    listen_status = getattr(psutil, "CONN_LISTEN", "LISTEN")

    for c in conns:
        if c.type == socket.SOCK_STREAM:
            if c.status != listen_status:
                continue
        elif c.type == socket.SOCK_DGRAM:
            rp = _conn_raddr_port(c)
            if rp is not None and rp > 0:
                continue
        else:
            continue

        lip, port = _conn_laddr_ip_port(c)
        if port is None or port <= 0:
            continue

        proto = "tcp" if c.type == socket.SOCK_STREAM else "udp"
        if c.family == socket.AF_INET6:
            family_s = "ipv6"
        elif c.family == socket.AF_INET:
            family_s = "ipv4"
        else:
            family_s = "other"

        fd_val = getattr(c, "fd", None)
        fd_i: int | None
        if fd_val is None or fd_val == -1:
            fd_i = None
        else:
            try:
                fd_i = int(fd_val)
            except (TypeError, ValueError):
                fd_i = None

        fd_key = fd_i if fd_i is not None else -1
        key = (proto, family_s, lip or "", port, c.pid, fd_key)
        if key in seen:
            continue
        seen.add(key)

        rows.append(
            {
                "proto": proto,
                "family": family_s,
                "local_ip": lip or "*",
                "local_port": port,
                "pid": c.pid,
                "process": process_label(c.pid),
                "fd": fd_i,
            }
        )

    rows.sort(
        key=lambda r: (
            r["local_port"],
            r["proto"],
            r["family"],
            r["local_ip"] or "",
            r["pid"] if r["pid"] is not None else -1,
        )
    )
    out["rows"] = rows
    return out


_IFNAME_RE = re.compile(r"^[a-zA-Z0-9._@-]{1,64}$")


def _json_enumish(x: Any) -> Any:
    if x is None:
        return None
    if isinstance(x, (bool, int, float, str)):
        return x
    if isinstance(x, bytes):
        return x.decode("utf-8", errors="replace")
    name = getattr(x, "name", None)
    if isinstance(name, str):
        return name
    return str(x)


def _net_sysfs_reader(ifname: str) -> dict[str, str]:
    """Best-effort sysfs snapshot for ``/sys/class/net/<ifname>``."""
    out: dict[str, str] = {}
    base = Path("/sys/class/net") / ifname
    if not base.is_dir():
        return out
    for rel in (
        "operstate",
        "carrier",
        "carrier_changes",
        "address",
        "address_assign_type",
        "type",
        "speed",
        "duplex",
        "mtu",
    ):
        fp = base / rel
        if fp.is_file():
            try:
                out[rel] = fp.read_text(encoding="utf-8", errors="replace").strip()
            except OSError:
                pass
    return out


def collect_interface_detail(ifname: str) -> dict[str, Any] | None:
    """Addresses, link stats, cumulative I/O counters, and sysfs hints for one interface."""
    name = (ifname or "").strip()
    if not _IFNAME_RE.match(name):
        return None

    counters_map = psutil.net_io_counters(pernic=True)
    addrs_map = psutil.net_if_addrs()
    stats_map = psutil.net_if_stats()

    io = counters_map.get(name)
    if io is None and name not in addrs_map and name not in stats_map:
        return None

    out: dict[str, Any] = {
        "ifname": name,
        "ts": time.time(),
    }

    if io is not None:
        out["io_counters"] = {
            "bytes_sent": io.bytes_sent,
            "bytes_recv": io.bytes_recv,
            "packets_sent": io.packets_sent,
            "packets_recv": io.packets_recv,
            "errin": io.errin,
            "errout": io.errout,
            "dropin": io.dropin,
            "dropout": io.dropout,
        }

    addrs = addrs_map.get(name) or []
    out["addresses"] = [
        {
            "family": _json_enumish(getattr(a, "family", None)),
            "address": a.address or "",
            "netmask": a.netmask or "",
            "broadcast": a.broadcast or "",
            "ptp": getattr(a, "ptp", None) or "",
        }
        for a in addrs
    ]

    stats = stats_map.get(name)
    if stats is not None:
        st_flags = getattr(stats, "flags", None)
        out["stats"] = {
            "isup": stats.isup,
            "duplex": _json_enumish(stats.duplex),
            "speed": stats.speed,
            "mtu": stats.mtu,
            "flags": _json_enumish(st_flags) if st_flags is not None else None,
        }

    sysfs = _net_sysfs_reader(name)
    if sysfs:
        out["sysfs"] = sysfs

    return out


def _top_processes(limit: int = 12) -> list[dict[str, Any]]:
    n_cpu = psutil.cpu_count(logical=True) or 1
    candidates: list[psutil.Process] = []
    for p in psutil.process_iter(["pid", "name"]):
        try:
            p.cpu_percent(interval=None)
            candidates.append(p)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    time.sleep(0.08)
    scored: list[tuple[float, float, psutil.Process]] = []
    for p in candidates:
        try:
            cpu = float(p.cpu_percent(interval=None) or 0.0)
            mem = float(p.memory_percent() or 0.0)
            scored.append((cpu, mem, p))
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    scored.sort(key=lambda t: (t[0] + t[1] * 2), reverse=True)
    take = scored if limit <= 0 else scored[:limit]
    out: list[dict[str, Any]] = []
    for cpu, mem, p in take:
        try:
            with p.oneshot():
                name = p.name()
                rss = int(p.memory_info().rss or 0)
            cpu_machine = round(cpu / n_cpu, 1)
            out.append(
                {
                    "pid": p.pid,
                    "name": name,
                    "cpu_percent": round(cpu, 1),
                    "cpu_percent_machine": cpu_machine,
                    "memory_percent": round(mem, 1),
                    "memory_rss": rss,
                }
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return out


def _jsonable_process_value(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (bool, int, float, str)):
        return val
    if isinstance(val, bytes):
        return val.decode("utf-8", errors="replace")
    if isinstance(val, (list, tuple)):
        return [_jsonable_process_value(x) for x in val]
    if hasattr(val, "_asdict"):
        return {k: _jsonable_process_value(v) for k, v in val._asdict().items()}
    if isinstance(val, dict):
        return {str(k): _jsonable_process_value(v) for k, v in val.items()}
    return str(val)


_PROCESS_DETAIL_ATTRS: tuple[str, ...] = (
    "ppid",
    "name",
    "exe",
    "cmdline",
    "cwd",
    "status",
    "username",
    "create_time",
    "terminal",
    "nice",
    "ionice",
    "cpu_num",
    "cpu_affinity",
    "cpu_percent",
    "cpu_times",
    "memory_info",
    "memory_full_info",
    "memory_percent",
    "num_threads",
    "threads",
    "num_ctx_switches",
    "num_fds",
    "io_counters",
)


def collect_process_detail(pid: int) -> dict[str, Any]:
    """Return JSON-friendly fields for a live PID, or ``{"error": "no_such_process"}``."""
    out: dict[str, Any] = {"pid": int(pid), "ts": time.time()}
    try:
        proc = psutil.Process(pid)
    except psutil.NoSuchProcess:
        out["error"] = "no_such_process"
        return out

    try:
        proc.cpu_percent(interval=None)
    except psutil.NoSuchProcess:
        out["error"] = "no_such_process"
        return out
    except (psutil.AccessDenied, PermissionError):
        pass

    try:
        raw = proc.as_dict(attrs=list(_PROCESS_DETAIL_ATTRS), ad_value=None)
    except psutil.NoSuchProcess:
        out["error"] = "no_such_process"
        return out

    for key, val in raw.items():
        out[key] = _jsonable_process_value(val)

    limit = 80
    for label, getter in (
        ("open_files", lambda: proc.open_files()),
        ("connections", lambda: proc.connections(kind="inet")),
    ):
        try:
            items = list(getter())
            out[f"{label}_count"] = len(items)
            out[label] = _jsonable_process_value(items[:limit])
            if len(items) > limit:
                out[f"{label}_truncated"] = True
        except (psutil.AccessDenied, psutil.ZombieProcess):
            out[label] = None
            out[f"{label}_count"] = None
        except NotImplementedError:
            out[f"{label}_error"] = "not_implemented"
        except Exception as err:
            out[f"{label}_error"] = type(err).__name__

    try:
        ch = proc.children(recursive=False)
        out["children"] = [{"pid": c.pid, "name": c.name()} for c in ch[:50]]
        out["children_count"] = len(ch)
        if len(ch) > 50:
            out["children_truncated"] = True
    except (psutil.AccessDenied, psutil.NoSuchProcess):
        out["children"] = None
        out["children_count"] = None
    except Exception:
        out["children_error"] = "unavailable"

    try:
        parent = proc.parent()
        if parent is not None:
            out["parent"] = {"pid": parent.pid, "name": parent.name()}
    except (psutil.AccessDenied, psutil.NoSuchProcess):
        out["parent"] = None
    except Exception:
        out["parent"] = None

    for attr in ("uids", "gids"):
        try:
            out[attr] = _jsonable_process_value(getattr(proc, attr)())
        except Exception:
            pass

    n_cpu = psutil.cpu_count(logical=True) or 1
    cpu_p = out.get("cpu_percent")
    if isinstance(cpu_p, (int, float)):
        out["cpu_percent_machine"] = round(float(cpu_p) / n_cpu, 1)

    return out


def _resolve_systemctl() -> str | None:
    """PATH is often minimal when the app is started from a desktop/IDE; try well-known paths."""
    candidates: list[str] = []
    w = shutil.which("systemctl")
    if w:
        candidates.append(w)
    for p in ("/usr/bin/systemctl", "/bin/systemctl"):
        if p not in candidates:
            candidates.append(p)
    for path in candidates:
        if path and os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    return None


def _systemctl_failed() -> list[str] | None:
    systemctl = _resolve_systemctl()
    if not systemctl:
        return None

    def run_cmd(args: list[str]) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=8,
            env={
                **os.environ,
                "PATH": os.environ.get("PATH", "") + ":/usr/bin:/bin:/sbin:/usr/sbin",
            },
        )

    try:
        r = run_cmd([systemctl, "--failed", "--no-legend", "--plain", "--no-pager"])
    except (subprocess.TimeoutExpired, FileNotFoundError, PermissionError):
        return None

    def should_retry_user(err_out: str) -> bool:
        el = err_out.lower()
        return any(
            phrase in el
            for phrase in (
                "failed to connect to bus",
                "connect to bus",
            )
        )

    combined = (r.stderr or "") + (r.stdout or "")
    # Retry user session only if system call had nothing to parse (avoid losing good system stdout)
    if (
        not (r.stdout or "").strip()
        and should_retry_user(r.stderr or "")
    ):
        try:
            r = run_cmd(
                [systemctl, "--user", "--failed", "--no-legend", "--plain", "--no-pager"]
            )
        except (subprocess.TimeoutExpired, FileNotFoundError, PermissionError):
            return None
        combined = (r.stderr or "") + (r.stdout or "")

    lines = [ln.strip() for ln in r.stdout.splitlines() if ln.strip()]
    units: list[str] = []
    for ln in lines:
        parts = ln.split(None, 1)
        if parts:
            units.append(parts[0])

    if units:
        return units

    err_l = combined.lower()
    if any(
        phrase in err_l
        for phrase in (
            "failed to connect to bus",
            "connect to bus",
            "running in chroot",
            "no systemd user session",
        )
    ):
        return None

    if r.returncode not in (0, 1, 3) and not r.stdout.strip():
        return None

    return []


_APT_UPGRADE_LINE = re.compile(
    r"^([^/]+)/\S+\s+(\S+)\s+\S+\s+\[upgradable from:\s*(.+?)\]\s*$"
)


def _apt_upgradable_list() -> list[dict[str, str]] | None:
    """Run ``apt list --upgradable``; return package rows or None if apt is unavailable."""
    apt = shutil.which("apt")
    if not apt:
        return None
    try:
        r = subprocess.run(
            [apt, "list", "--upgradable"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if r.returncode != 0:
            return None
        packages: list[dict[str, str]] = []
        for ln in r.stdout.splitlines():
            ln = ln.strip()
            if ln.startswith("Listing") or not ln or "/" not in ln:
                continue
            m = _APT_UPGRADE_LINE.match(ln)
            if not m:
                continue
            packages.append(
                {
                    "name": m.group(1),
                    "candidate": m.group(2),
                    "current": m.group(3).strip(),
                }
            )
        return packages
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


@dataclass
class NetRateState:
    last: dict[str, Any] | None = None
    last_rates: dict[str, dict[str, float]] | None = None

    def with_rates(self, current: dict[str, Any]) -> dict[str, Any]:
        prev = self.last
        self.last = current
        if not prev:
            self.last_rates = {}
            return {**current, "rates": {}}
        dt = max(current["ts"] - prev["ts"], 1e-6)
        rates: dict[str, dict[str, float]] = {}
        cur_if = current.get("interfaces", {})
        prev_if = prev.get("interfaces", {})
        for name in cur_if:
            if name not in prev_if:
                continue
            c, p = cur_if[name], prev_if[name]
            rates[name] = {
                "recv_bps": max(0, (c["bytes_recv"] - p["bytes_recv"]) / dt),
                "sent_bps": max(0, (c["bytes_sent"] - p["bytes_sent"]) / dt),
            }
        self.last_rates = rates
        return {**current, "rates": rates}


_DISKSTATS_SKIP_PREFIX = ("loop", "ram", "fd", "sr")


def _read_diskstats() -> dict[str, Any]:
    """Parse ``/proc/diskstats`` into cumulative read/write bytes (sectors × 512)."""
    now = time.time()
    devices: dict[str, dict[str, int]] = {}
    path = Path("/proc/diskstats")
    if not path.is_file():
        return {"ts": now, "devices": {}}
    sector_b = 512
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return {"ts": now, "devices": {}}
    for line in text.splitlines():
        parts = line.split()
        if len(parts) < 11:
            continue
        dev_name = parts[2]
        if dev_name.startswith(_DISKSTATS_SKIP_PREFIX):
            continue
        try:
            read_sectors = int(parts[5])
            write_sectors = int(parts[9])
        except ValueError:
            continue
        devices[dev_name] = {
            "read_bytes": read_sectors * sector_b,
            "write_bytes": write_sectors * sector_b,
        }
    return {"ts": now, "devices": devices}


_BLOCK_DEV_OK = re.compile(r"^[a-z0-9][a-z0-9._+-]*$", re.I)


def _normalize_block_dev_name(raw: str) -> str | None:
    s = (raw or "").strip()
    if not s or len(s) > 80 or "/" in s or s.startswith("-") or ".." in s:
        return None
    if not _BLOCK_DEV_OK.match(s):
        return None
    return s


def _read_int_sysfs(path: Path) -> int | None:
    try:
        return int((path.read_text(encoding="utf-8", errors="replace") or "").split()[0])
    except (OSError, ValueError, IndexError):
        return None


def _parent_disk_for_smart(devname: str) -> str:
    """Whole-disk name for SMART (partitions query ``lsblk`` pkname)."""
    try:
        r = subprocess.run(
            ["lsblk", "-no", "pkname", f"/dev/{devname}"],
            capture_output=True,
            text=True,
            timeout=4,
        )
        lines = [ln.strip() for ln in (r.stdout or "").splitlines() if ln.strip()]
        pk = lines[0] if lines else ""
        if pk and _BLOCK_DEV_OK.match(pk):
            return pk
    except (OSError, subprocess.TimeoutExpired, IndexError):
        pass
    return devname


def _collect_sysfs_for_block(devname: str) -> dict[str, Any]:
    base = Path("/sys/block") / devname
    if not base.is_dir():
        return {}
    out: dict[str, Any] = {}
    sz = _read_int_sysfs(base / "size")
    if sz is not None:
        out["size_sectors"] = sz
        out["size_bytes"] = sz * 512
    for rel, key in (
        ("ro", "read_only"),
        ("removable", "removable"),
        ("queue/rotational", "rotational"),
        ("queue/logical_block_size", "logical_block_size"),
        ("queue/physical_block_size", "physical_block_size"),
        ("dev", "dev_maj_min"),
    ):
        p = base / rel
        if p.is_file():
            try:
                t = p.read_text(encoding="utf-8", errors="replace").strip()
                if t:
                    out[key] = t[:500]
            except OSError:
                pass
    for mf in ("device/model", "device/vendor", "device/serial"):
        p = base / mf
        if p.is_file():
            try:
                t = p.read_text(encoding="utf-8", errors="replace").strip()
                if t:
                    out[mf.replace("/", "_")] = t
            except OSError:
                pass
    part = base / "partition"
    if part.is_file():
        out["is_partition"] = True
        try:
            out["partition_index"] = int(part.read_text(encoding="utf-8", errors="replace").strip())
        except ValueError:
            pass
    else:
        out["is_partition"] = False
    return out


def _ata_attributes_excerpt(j: dict[str, Any]) -> str | None:
    ata = j.get("ata_smart_attributes")
    if not isinstance(ata, dict):
        return None
    table = ata.get("table")
    if not isinstance(table, list):
        return None
    lines: list[str] = []
    for row in table[:48]:
        if not isinstance(row, dict):
            continue
        rid = row.get("id")
        name = row.get("name")
        val = row.get("value")
        rawv = row.get("raw")
        if isinstance(rawv, dict):
            rawv = rawv.get("string") or rawv.get("value")
        lines.append(f"{rid} {name}: value={val} raw={rawv}")
    if not lines:
        return None
    return "\n".join(lines)


def _smart_summary_from_json(j: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    ss = j.get("smart_status")
    if isinstance(ss, dict):
        if "passed" in ss:
            out["health_passed"] = bool(ss["passed"])
        nested = ss.get("nvme")
        if isinstance(nested, dict) and "passed" in nested and out.get("health_passed") is None:
            out["health_passed"] = bool(nested["passed"])
    for k in ("model_name", "serial_number", "firmware_version"):
        v = j.get(k)
        if v:
            out[k] = str(v)[:240]
    t = j.get("temperature")
    if isinstance(t, dict):
        cur = t.get("current")
        if cur is not None:
            try:
                out["temperature_c"] = round(float(cur), 1)
            except (TypeError, ValueError):
                pass
    pot = j.get("power_on_time")
    if isinstance(pot, dict) and pot.get("hours") is not None:
        try:
            out["power_on_hours"] = int(pot["hours"])
        except (TypeError, ValueError):
            pass
    nv = j.get("nvme_smart_health_information_log")
    if isinstance(nv, dict):
        if nv.get("temperature") is not None:
            try:
                out["temperature_c"] = round(float(nv["temperature"]), 1)
            except (TypeError, ValueError):
                pass
        if nv.get("critical_warning") is not None:
            try:
                cw = int(nv["critical_warning"])
                out["nvme_critical_warning"] = cw
            except (TypeError, ValueError):
                cw = -1
            else:
                if out.get("health_passed") is None:
                    if cw == 0:
                        out["health_passed"] = True
                    elif cw > 0:
                        out["health_passed"] = False
        sp = nv.get("smart_status")
        if isinstance(sp, dict) and "passed" in sp:
            out["health_passed"] = bool(sp["passed"])
    uc = j.get("user_capacity")
    if isinstance(uc, dict) and uc.get("bytes") is not None:
        try:
            out["user_capacity_bytes"] = int(uc["bytes"])
        except (TypeError, ValueError):
            pass
    return out


def _smartctl_json_messages(j: dict[str, Any]) -> list[str]:
    sc = j.get("smartctl")
    if not isinstance(sc, dict):
        return []
    msgs = sc.get("messages")
    if not isinstance(msgs, list):
        return []
    out: list[str] = []
    for m in msgs:
        if isinstance(m, dict):
            s = m.get("string")
            if s:
                out.append(str(s))
        elif isinstance(m, str):
            out.append(m)
    return out


def _json_has_usable_smart_payload(j: dict[str, Any]) -> bool:
    if j.get("smart_status") is not None:
        return True
    if j.get("nvme_smart_health_information_log"):
        return True
    if j.get("ata_smart_attributes"):
        return True
    if j.get("ata_smart_data"):
        return True
    if j.get("scsi_sense"):
        return True
    if j.get("model_name"):
        return True
    return False


def _permission_denied_hint(msgs: list[str]) -> str:
    joined = " ".join(msgs).lower()
    if "permission denied" in joined or "operation not permitted" in joined:
        return (
            "The server process cannot open raw block devices. Run Mission Control with a user "
            "that can read /dev/sd* and /dev/nvme* (often root), or add that user to the `disk` "
            "group and restart the session."
        )
    return ""


def _run_smartctl(devpath: str | None) -> dict[str, Any]:
    base: dict[str, Any] = {
        "smartctl_found": bool(shutil.which("smartctl")),
        "health_passed": None,
        "message": None,
    }
    if not devpath or not Path(devpath).exists():
        base["message"] = "No whole-disk device path for SMART (or missing /dev node)."
        return base
    smartctl = shutil.which("smartctl")
    if not smartctl:
        base["message"] = "smartctl not on PATH (install smartmontools for SMART data)."
        return base

    json_payload: dict[str, Any] | None = None
    for args in ([smartctl, "-x", "-j", devpath], [smartctl, "-a", "-j", devpath]):
        try:
            proc = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=18,
            )
            raw = (proc.stdout or "").strip()
            if raw.startswith("{") or raw.startswith("["):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict):
                        json_payload = parsed
                        break
                except json.JSONDecodeError:
                    pass
        except (OSError, subprocess.TimeoutExpired):
            continue

    if json_payload:
        sc_block = json_payload.get("smartctl")
        if isinstance(sc_block, dict):
            es = sc_block.get("exit_status")
            if es is not None:
                try:
                    base["exit_status"] = int(es)
                except (TypeError, ValueError):
                    pass

        err_msgs = _smartctl_json_messages(json_payload)
        usable = _json_has_usable_smart_payload(json_payload)

        if err_msgs and not usable:
            msg = "; ".join(err_msgs)
            hint = _permission_denied_hint(err_msgs)
            if hint:
                msg = f"{msg}\n{hint}"
            base["message"] = msg[:4000]
            return base

        base.update(_smart_summary_from_json(json_payload))
        if err_msgs and base.get("health_passed") is None and not base.get("message"):
            if isinstance(sc_block, dict) and sc_block.get("exit_status") not in (None, 0, 4):
                base["message"] = "; ".join(err_msgs)[:2000]

        atx = _ata_attributes_excerpt(json_payload)
        if atx:
            base["attributes_excerpt"] = atx[:12_000]
        return base

    try:
        proc = subprocess.run(
            [smartctl, "-i", "-H", "-A", devpath],
            capture_output=True,
            text=True,
            timeout=18,
        )
        txt = proc.stdout or ""
        if proc.stderr:
            txt += "\n" + proc.stderr
        if txt.strip():
            base["raw_excerpt"] = txt.strip()[:12_000]
            for line in txt.splitlines():
                lu = line.upper()
                if (
                    "SMART OVERALL-HEALTH" in lu
                    or "SMART HEALTH STATUS" in lu
                    or "OVERALL-HEALTH SELF-ASSESSMENT" in lu
                    or "SELF-ASSESSMENT TEST RESULT" in lu
                    or "SMART OVERALL HEALTH" in lu
                ):
                    if "PASSED" in lu:
                        base["health_passed"] = True
                    elif "FAILED" in lu:
                        base["health_passed"] = False
                    break
            if base.get("health_passed") is None and (
                "PERMISSION DENIED" in txt.upper() or "OPERATION NOT PERMITTED" in txt.upper()
            ):
                hint = _permission_denied_hint([txt])
                base["message"] = (txt.strip()[:2500] + (f"\n{hint}" if hint else ""))[:4000]
        else:
            err = (proc.stderr or "").strip() or f"exit {proc.returncode}"
            base["message"] = err[:2000]
    except OSError:
        base["message"] = "Could not run smartctl."
    except subprocess.TimeoutExpired:
        base["message"] = "smartctl timed out."
    return base


def collect_block_device_detail(devname: str) -> dict[str, Any] | None:
    """Sysfs fields, optional diskstats counters, and SMART via ``smartctl`` when available."""
    name = _normalize_block_dev_name(devname)
    if not name:
        return None
    sys_p = Path("/sys/block") / name
    if not sys_p.is_dir():
        return None
    devpath = f"/dev/{name}"
    devpath_ok = Path(devpath).exists()
    smart_name = _parent_disk_for_smart(name)
    smart_path = f"/dev/{smart_name}"
    if not Path(smart_path).exists():
        smart_path = devpath if devpath_ok else None

    ds = _read_diskstats()
    dev_snap = (ds.get("devices") or {}).get(name)

    return {
        "devname": name,
        "devpath": devpath if devpath_ok else None,
        "smart_target_devname": smart_name,
        "smart_devpath": smart_path,
        "ts": time.time(),
        "sysfs": _collect_sysfs_for_block(name),
        "diskstats": dev_snap,
        "smart": _run_smartctl(smart_path),
    }


def _hwmon_detail_key(chip: str, label: str) -> str | None:
    """Map psutil chip + label to ``hwmon:hwmonN:tempM`` for sysfs detail lookup."""
    chip_s = (chip or "").strip()
    label_s = (label or "").strip()
    root = Path("/sys/class/hwmon")
    if not root.is_dir():
        return None
    for hw in sorted(root.glob("hwmon*")):
        name_f = hw / "name"
        if not name_f.is_file():
            continue
        try:
            hwname = name_f.read_text(encoding="utf-8", errors="replace").strip()
        except OSError:
            continue
        if chip_s and hwname != chip_s and chip_s not in hwname and hwname not in chip_s:
            continue
        for inp in sorted(hw.glob("temp*_input")):
            stem = inp.name.replace("_input", "")
            label_f = hw / f"{stem}_label"
            file_lbl = ""
            if label_f.is_file():
                try:
                    file_lbl = label_f.read_text(encoding="utf-8", errors="replace").strip()
                except OSError:
                    pass
            if label_s:
                if file_lbl != label_s:
                    continue
            elif file_lbl:
                continue
            return f"hwmon:{hw.name}:{stem}"
    return None


_DETAIL_THERMAL_ZONE = re.compile(r"^zone:(thermal_zone\d+)$")
_DETAIL_HWMON = re.compile(r"^hwmon:(hwmon\d+):(temp\d+)$")


def collect_thermal_detail(detail_key: str) -> dict[str, Any] | None:
    """Live sysfs fields for one thermal zone or hwmon temp channel."""
    raw = (detail_key or "").strip()
    if not raw:
        return None
    ts = time.time()
    m = _DETAIL_THERMAL_ZONE.match(raw)
    if m:
        zname = m.group(1)
        base = Path("/sys/class/thermal") / zname
        if not base.is_dir():
            return None
        out: dict[str, Any] = {
            "kind": "thermal_zone",
            "detail_key": raw,
            "path": str(base),
            "ts": ts,
            "fields": {},
        }
        try:
            for p in sorted(base.iterdir()):
                if not p.is_file():
                    continue
                if p.name in ("uevent",):
                    continue
                try:
                    txt = p.read_text(encoding="utf-8", errors="replace").strip()
                except OSError:
                    continue
                if len(txt) > 4000:
                    txt = txt[:4000] + "…"
                out["fields"][p.name] = txt
        except OSError:
            pass
        return out
    m = _DETAIL_HWMON.match(raw)
    if m:
        hwname, tempidx = m.group(1), m.group(2)
        base = Path("/sys/class/hwmon") / hwname
        if not base.is_dir():
            return None
        out = {
            "kind": "hwmon",
            "detail_key": raw,
            "path": str(base),
            "ts": ts,
            "fields": {},
        }
        for fn in (
            f"{tempidx}_input",
            f"{tempidx}_label",
            f"{tempidx}_max",
            f"{tempidx}_min",
            f"{tempidx}_crit",
            f"{tempidx}_lcrit",
            f"{tempidx}_emergency",
            f"{tempidx}_offset",
        ):
            fp = base / fn
            if fp.is_file():
                try:
                    out["fields"][fn] = fp.read_text(encoding="utf-8", errors="replace").strip()
                except OSError:
                    pass
        nf = base / "name"
        if nf.is_file():
            try:
                out["hwmon_chip_name"] = nf.read_text(encoding="utf-8", errors="replace").strip()
            except OSError:
                pass
        return out
    return None


_DETAIL_FAN = re.compile(r"^hwmon:(hwmon\d+):(fan\d+)$")


def collect_fan_detail(detail_key: str) -> dict[str, Any] | None:
    """Live sysfs fields for one hwmon fan channel (RPM and related attributes)."""
    raw = (detail_key or "").strip()
    m = _DETAIL_FAN.match(raw)
    if not m:
        return None
    hwname, fanidx = m.group(1), m.group(2)
    base = Path("/sys/class/hwmon") / hwname
    if not base.is_dir():
        return None
    ts = time.time()
    out: dict[str, Any] = {
        "kind": "hwmon_fan",
        "detail_key": raw,
        "path": str(base),
        "ts": ts,
        "fields": {},
    }
    nf = base / "name"
    if nf.is_file():
        try:
            out["hwmon_chip_name"] = nf.read_text(encoding="utf-8", errors="replace").strip()
        except OSError:
            pass
    try:
        for p in sorted(base.glob(f"{fanidx}_*")):
            if not p.is_file():
                continue
            try:
                txt = p.read_text(encoding="utf-8", errors="replace").strip()
            except OSError:
                continue
            if len(txt) > 4000:
                txt = txt[:4000] + "…"
            out["fields"][p.name] = txt
    except OSError:
        pass
    return out


_RE_FAN_INPUT = re.compile(r"^(fan\d+)_input$", re.I)


def _hwmon_fan_detail_key(chip: str, label: str) -> str | None:
    """Map psutil chip + label to ``hwmon:hwmonN:fanM`` for sysfs detail lookup."""
    chip_s = (chip or "").strip()
    label_s = (label or "").strip()
    root = Path("/sys/class/hwmon")
    if not root.is_dir():
        return None
    for hw in sorted(root.glob("hwmon*")):
        name_f = hw / "name"
        if not name_f.is_file():
            continue
        try:
            hwname = name_f.read_text(encoding="utf-8", errors="replace").strip()
        except OSError:
            continue
        if chip_s and hwname != chip_s and chip_s not in hwname and hwname not in chip_s:
            continue
        for inp in sorted(hw.glob("fan*_input")):
            m = _RE_FAN_INPUT.match(inp.name)
            if not m:
                continue
            stem = m.group(1)
            label_f = hw / f"{stem}_label"
            file_lbl = ""
            if label_f.is_file():
                try:
                    file_lbl = label_f.read_text(encoding="utf-8", errors="replace").strip()
                except OSError:
                    pass
            if label_s:
                if file_lbl != label_s:
                    continue
            elif file_lbl:
                continue
            return f"hwmon:{hw.name}:{stem}"
    return None


def _thermal_sensors() -> dict[str, Any]:
    """Temperatures from psutil hwmon and ``/sys/class/thermal`` zones."""
    ts = time.time()
    out: dict[str, Any] = {"ts": ts, "chips": {}, "zones": []}
    try:
        temps = psutil.sensors_temperatures()  # type: ignore[attr-defined]
    except (AttributeError, NotImplementedError, OSError, RuntimeError):
        temps = None
    if temps:
        for chip, entries in temps.items():
            readings: list[dict[str, Any]] = []
            for e in entries or []:
                try:
                    cur = e.current
                except AttributeError:
                    continue
                if cur is None:
                    continue
                row: dict[str, Any] = {
                    "label": getattr(e, "label", "") or "",
                    "current_c": round(float(cur), 1),
                }
                high = getattr(e, "high", None)
                crit = getattr(e, "critical", None)
                if high is not None:
                    row["high_c"] = round(float(high), 1)
                if crit is not None:
                    row["critical_c"] = round(float(crit), 1)
                dk = _hwmon_detail_key(str(chip), row["label"])
                if dk:
                    row["detail_key"] = dk
                readings.append(row)
            if readings:
                out["chips"][str(chip)] = readings
    try:
        tz_root = Path("/sys/class/thermal")
        if tz_root.is_dir():
            for z in sorted(tz_root.glob("thermal_zone*")):
                tfile = z / "temp"
                if not tfile.is_file():
                    continue
                try:
                    raw = int(tfile.read_text().strip())
                except ValueError:
                    continue
                typ = z / "type"
                tname = (
                    typ.read_text(encoding="utf-8", errors="replace").strip()
                    if typ.is_file()
                    else z.name
                )
                out["zones"].append(
                    {
                        "name": tname,
                        "current_c": round(raw / 1000.0, 1),
                        "detail_key": f"zone:{z.name}",
                    }
                )
    except OSError:
        pass
    return out


def _fan_sensors() -> dict[str, Any]:
    """Fan speeds from psutil and, if needed, ``/sys/class/hwmon`` ``fan*_input`` (RPM)."""
    ts = time.time()
    out: dict[str, Any] = {"ts": ts, "chips": {}}
    try:
        fans = psutil.sensors_fans()  # type: ignore[attr-defined]
    except (AttributeError, NotImplementedError, OSError, RuntimeError):
        fans = None
    if fans:
        for chip, entries in fans.items():
            readings: list[dict[str, Any]] = []
            for e in entries or []:
                try:
                    rpm = e.current
                except AttributeError:
                    continue
                if rpm is None:
                    continue
                try:
                    rpm_i = int(round(float(rpm)))
                except (TypeError, ValueError):
                    continue
                lbl = (getattr(e, "label", "") or "").strip()
                row: dict[str, Any] = {
                    "label": lbl,
                    "rpm": rpm_i,
                }
                dk = _hwmon_fan_detail_key(str(chip), lbl)
                if dk:
                    row["detail_key"] = dk
                readings.append(row)
            if readings:
                out["chips"][str(chip)] = readings
    if not out["chips"]:
        root = Path("/sys/class/hwmon")
        if root.is_dir():
            for hw in sorted(root.glob("hwmon*")):
                chip_name = hw.name
                nf = hw / "name"
                if nf.is_file():
                    try:
                        chip_name = nf.read_text(
                            encoding="utf-8", errors="replace"
                        ).strip() or chip_name
                    except OSError:
                        pass
                readings = []
                for inp in sorted(hw.glob("fan*_input")):
                    m = _RE_FAN_INPUT.match(inp.name)
                    if not m:
                        continue
                    stem = m.group(1)
                    try:
                        raw = int(inp.read_text(encoding="utf-8", errors="replace").strip())
                    except (OSError, ValueError):
                        continue
                    lbl_f = hw / f"{stem}_label"
                    label = ""
                    if lbl_f.is_file():
                        try:
                            label = lbl_f.read_text(
                                encoding="utf-8", errors="replace"
                            ).strip()
                        except OSError:
                            pass
                    readings.append(
                        {
                            "label": label,
                            "rpm": raw,
                            "detail_key": f"hwmon:{hw.name}:{stem}",
                        }
                    )
                if readings:
                    out["chips"][chip_name] = readings
    return out


@dataclass
class DiskIoState:
    last: dict[str, Any] | None = None
    last_rates: dict[str, dict[str, float]] | None = None

    def with_rates(self, current: dict[str, Any]) -> dict[str, Any]:
        prev = self.last
        self.last = current
        if not prev:
            self.last_rates = {}
            return {**current, "rates": {}}
        dt = max(current["ts"] - prev["ts"], 1e-6)
        rates: dict[str, dict[str, float]] = {}
        cur_d = current.get("devices", {})
        prev_d = prev.get("devices", {})
        for name in cur_d:
            if name not in prev_d:
                continue
            c, p = cur_d[name], prev_d[name]
            rates[name] = {
                "read_bps": max(0, (c["read_bytes"] - p["read_bytes"]) / dt),
                "write_bps": max(0, (c["write_bytes"] - p["write_bytes"]) / dt),
            }
        self.last_rates = rates
        return {**current, "rates": rates}


_DOCKER_CONTAINER_ID_RE = re.compile(r"^[a-fA-F0-9]{12,64}$")
_DOCKER_VOLUME_NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.\-]{0,253}$")


def _docker_run_capture(
    argv: list[str], timeout: float = 25.0
) -> tuple[str, str | None]:
    """Run docker CLI; return (stdout, error_message)."""
    try:
        p = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False,
        )
    except FileNotFoundError:
        return "", "Docker executable not found"
    except subprocess.TimeoutExpired:
        return "", "Docker command timed out"
    except OSError as e:
        return "", str(e)[:240]

    out = p.stdout or ""
    if p.returncode != 0:
        err = (p.stderr or p.stdout or "").strip()[:500]
        return "", err or f"docker exited with code {p.returncode}"
    return out, None


def _docker_ndjson_rows(argv: list[str], timeout: float = 25.0) -> tuple[list[dict[str, Any]], str | None]:
    """Parse one JSON object per line from a docker --format '{{json .}}' command."""
    raw, err = _docker_run_capture(argv, timeout=timeout)
    if err:
        return [], err
    rows: list[dict[str, Any]] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows, None


def _docker_first_name(names_field: Any) -> str:
    if isinstance(names_field, list) and names_field:
        n = str(names_field[0])
    elif isinstance(names_field, str):
        n = names_field
    else:
        return ""
    n = n.strip()
    if n.startswith("/"):
        n = n[1:]
    return n.split("/")[-1] if n else ""


def _normalize_docker_container_rows(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for r in raw:
        cid = str(r.get("ID") or "").strip()
        if not cid:
            continue
        short = cid[:12] if len(cid) >= 12 else cid
        out.append(
            {
                "id": cid,
                "id_short": short,
                "name": _docker_first_name(r.get("Names")),
                "image": str(r.get("Image") or ""),
                "state": str(r.get("State") or ""),
                "status": str(r.get("Status") or ""),
                "ports": str(r.get("Ports") or ""),
                "running_for": str(r.get("RunningFor") or ""),
                "created": str(r.get("CreatedAt") or ""),
            }
        )
    return out


def _normalize_docker_image_rows(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for r in raw:
        rid = str(r.get("ID") or "").strip()
        if not rid:
            continue
        short = rid[:12] if len(rid) >= 12 else rid
        repo = str(r.get("Repository") or "")
        tag = str(r.get("Tag") or "")
        out.append(
            {
                "id": rid,
                "id_short": short,
                "repository": repo,
                "tag": tag,
                "size": str(r.get("Size") or ""),
                "created": str(r.get("CreatedAt") or r.get("CreatedSince") or ""),
                "inspect_ref": rid,
            }
        )
    return out


def _normalize_docker_volume_rows(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for r in raw:
        name = str(r.get("Name") or "").strip()
        if not name:
            continue
        out.append(
            {
                "name": name,
                "driver": str(r.get("Driver") or ""),
            }
        )
    return out


def collect_docker_snapshot(
    *,
    include_containers: bool = True,
    include_images: bool = True,
    include_volumes: bool = True,
) -> dict[str, Any] | None:
    """Containers, images, and volumes via ``docker`` CLI (JSON line format).

    When every ``include_*`` flag is false, returns ``None``.
    """
    if not (include_containers or include_images or include_volumes):
        return None

    notes: list[str] = []
    containers: list[dict[str, Any]] = []
    images: list[dict[str, Any]] = []
    volumes: list[dict[str, Any]] = []

    if not shutil.which("docker"):
        return {
            "ts": time.time(),
            "containers": [] if include_containers else [],
            "images": [] if include_images else [],
            "volumes": [] if include_volumes else [],
            "note": "Docker CLI not found on PATH.",
        }

    if include_containers:
        c_raw, c_err = _docker_ndjson_rows(
            ["docker", "container", "ls", "-a", "--no-trunc", "--format", "{{json .}}"]
        )
        if c_err:
            notes.append(c_err)
        else:
            containers = _normalize_docker_container_rows(c_raw)

    if include_images:
        i_raw, i_err = _docker_ndjson_rows(
            ["docker", "image", "ls", "-a", "--no-trunc", "--format", "{{json .}}"]
        )
        if i_err:
            notes.append(f"images: {i_err}")
        else:
            images = _normalize_docker_image_rows(i_raw)

    if include_volumes:
        v_raw, v_err = _docker_ndjson_rows(
            ["docker", "volume", "ls", "--format", "{{json .}}"]
        )
        if v_err:
            notes.append(f"volumes: {v_err}")
        else:
            volumes = _normalize_docker_volume_rows(v_raw)

    note = "; ".join(notes) if notes else None
    return {
        "ts": time.time(),
        "containers": containers,
        "images": images,
        "volumes": volumes,
        "note": note,
    }


def collect_docker_container_inspect(container_id: str) -> dict[str, Any] | None:
    cid = (container_id or "").strip()
    if not _DOCKER_CONTAINER_ID_RE.match(cid):
        return None
    raw, err = _docker_run_capture(
        ["docker", "container", "inspect", cid],
        timeout=30.0,
    )
    if err or not raw.strip():
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if isinstance(data, list):
        return data[0] if data else None
    if isinstance(data, dict):
        return data
    return None


def _safe_docker_image_ref(ref: str) -> bool:
    r = (ref or "").strip()
    if not r or len(r) > 512 or r.startswith("-"):
        return False
    if any(c in r for c in "\n\r\x00;|&`"):
        return False
    return True


def collect_docker_image_inspect(ref: str) -> dict[str, Any] | None:
    if not _safe_docker_image_ref(ref):
        return None
    r = ref.strip()
    raw, err = _docker_run_capture(["docker", "image", "inspect", r], timeout=30.0)
    if err or not raw.strip():
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if isinstance(data, list):
        return data[0] if data else None
    if isinstance(data, dict):
        return data
    return None


def collect_docker_volume_inspect(name: str) -> dict[str, Any] | None:
    n = (name or "").strip()
    if not _DOCKER_VOLUME_NAME_RE.match(n):
        return None
    raw, err = _docker_run_capture(["docker", "volume", "inspect", n], timeout=30.0)
    if err or not raw.strip():
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if isinstance(data, list):
        return data[0] if data else None
    if isinstance(data, dict):
        return data
    return None


_slow_metrics_cache: dict[str, Any] = {
    "systemd_failed": None,
    "apt_upgradable": None,
    "apt_upgradable_packages": None,
}


def collect_snapshot(
    cpu_sample_interval: float | None,
    net_state: NetRateState,
    disk_io_state: DiskIoState,
    *,
    include_slow: bool = False,
    include_compute: bool = True,
    include_network: bool = True,
    include_listening_ports: bool = True,
    include_thermal: bool = True,
    include_fans: bool = True,
    include_operations: bool = True,
    include_disk_mounts: bool = True,
    include_zfs: bool = True,
    include_disk_io: bool = True,
    include_processes: bool = True,
    process_sample_limit: int = 200,
    include_docker_containers: bool = True,
    include_docker_images: bool = True,
    include_docker_volumes: bool = True,
) -> dict[str, Any]:
    """Build one metrics snapshot. cpu_sample_interval None = non-blocking (may be 0 first call).

    Skip expensive work by setting the matching ``include_*`` flag to ``False``; omitted
    sections are returned as ``null`` (or ``[]`` for processes). Slow systemd/APT refresh
    runs only when both ``include_slow`` and ``include_operations`` are true.
    """
    data: dict[str, Any] = {
        "ts": time.time(),
        "host": os.uname().nodename,
        "os": _read_os_release(),
    }

    if include_compute:
        vm = psutil.virtual_memory()
        swap = psutil.swap_memory()
        cpu_count = psutil.cpu_count(logical=True) or 1
        cpu_pct = psutil.cpu_percent(interval=cpu_sample_interval, percpu=False)
        data["uptime_sec"] = int(time.time() - psutil.boot_time())
        data["cpu"] = {
            "percent": round(cpu_pct, 1),
            "count_logical": cpu_count,
            "load_avg": list(os.getloadavg()) if hasattr(os, "getloadavg") else None,
        }
        data["memory"] = {
            "total": vm.total,
            "available": vm.available,
            "used": vm.used,
            "percent": round(vm.percent, 1),
        }
        data["swap"] = {
            "total": swap.total,
            "used": swap.used,
            "percent": round(swap.percent, 1) if swap.total else 0.0,
        }
    else:
        data["uptime_sec"] = None
        data["cpu"] = None
        data["memory"] = None
        data["swap"] = None

    if include_network:
        net_raw = _net_io()
        net = net_state.with_rates(net_raw)
    else:
        net = None

    if include_listening_ports:
        listening_ports = _listening_ports()
    else:
        listening_ports = None

    if include_disk_io:
        disk_raw = _read_diskstats()
        disk_io = disk_io_state.with_rates(disk_raw)
    else:
        disk_io_state.last = None
        disk_io_state.last_rates = {}
        disk_io = None

    data["disk"] = _disk_mounts() if include_disk_mounts else None
    data["zfs_pools"] = _zfs_pool_summaries() if include_zfs else None
    data["network"] = net
    data["listening_ports"] = listening_ports
    data["disk_io"] = disk_io
    data["thermal"] = _thermal_sensors() if include_thermal else None
    data["fans"] = _fan_sensors() if include_fans else None
    data["processes"] = (
        _top_processes(process_sample_limit) if include_processes else []
    )

    want_docker = (
        include_docker_containers
        or include_docker_images
        or include_docker_volumes
    )
    data["docker"] = (
        collect_docker_snapshot(
            include_containers=include_docker_containers,
            include_images=include_docker_images,
            include_volumes=include_docker_volumes,
        )
        if want_docker
        else None
    )

    if include_slow and include_operations:
        _slow_metrics_cache["systemd_failed"] = _systemctl_failed()
        apt_list = _apt_upgradable_list()
        _slow_metrics_cache["apt_upgradable"] = (
            None if apt_list is None else len(apt_list)
        )
        _slow_metrics_cache["apt_upgradable_packages"] = apt_list

    if include_operations:
        data["systemd_failed"] = _slow_metrics_cache["systemd_failed"]
        data["apt_upgradable"] = _slow_metrics_cache["apt_upgradable"]
        data["apt_upgradable_packages"] = _slow_metrics_cache[
            "apt_upgradable_packages"
        ]
    else:
        data["systemd_failed"] = None
        data["apt_upgradable"] = None
        data["apt_upgradable_packages"] = None

    return data
