"""Collect system metrics for Linux (Mint-friendly); no root required for core signals."""

from __future__ import annotations

import os
import re
import shutil
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

    return out


def _net_io() -> dict[str, Any]:
    now = time.time()
    counters = psutil.net_io_counters(pernic=True)
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
            }
            for name, io in counters.items()
            if not name.startswith("lo")
        },
    }


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

    def with_rates(self, current: dict[str, Any]) -> dict[str, Any]:
        prev = self.last
        self.last = current
        if not prev:
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
        return {**current, "rates": rates}


_slow_metrics_cache: dict[str, Any] = {
    "systemd_failed": None,
    "apt_upgradable": None,
    "apt_upgradable_packages": None,
}


def collect_snapshot(
    cpu_sample_interval: float | None,
    net_state: NetRateState,
    *,
    include_slow: bool = False,
    include_processes: bool = True,
    process_sample_limit: int = 200,
) -> dict[str, Any]:
    """Build one metrics snapshot. cpu_sample_interval None = non-blocking (may be 0 first call)."""
    vm = psutil.virtual_memory()
    swap = psutil.swap_memory()
    cpu_count = psutil.cpu_count(logical=True) or 1
    cpu_pct = psutil.cpu_percent(interval=cpu_sample_interval, percpu=False)

    net_raw = _net_io()
    net = net_state.with_rates(net_raw)

    data: dict[str, Any] = {
        "ts": time.time(),
        "host": os.uname().nodename,
        "os": _read_os_release(),
        "uptime_sec": int(time.time() - psutil.boot_time()),
        "cpu": {
            "percent": round(cpu_pct, 1),
            "count_logical": cpu_count,
            "load_avg": list(os.getloadavg()) if hasattr(os, "getloadavg") else None,
        },
        "memory": {
            "total": vm.total,
            "available": vm.available,
            "used": vm.used,
            "percent": round(vm.percent, 1),
        },
        "swap": {
            "total": swap.total,
            "used": swap.used,
            "percent": round(swap.percent, 1) if swap.total else 0.0,
        },
        "disk": _disk_mounts(),
        "network": net,
        "processes": _top_processes(process_sample_limit) if include_processes else [],
    }

    if include_slow:
        _slow_metrics_cache["systemd_failed"] = _systemctl_failed()
        apt_list = _apt_upgradable_list()
        _slow_metrics_cache["apt_upgradable"] = (
            None if apt_list is None else len(apt_list)
        )
        _slow_metrics_cache["apt_upgradable_packages"] = apt_list

    data["systemd_failed"] = _slow_metrics_cache["systemd_failed"]
    data["apt_upgradable"] = _slow_metrics_cache["apt_upgradable"]
    data["apt_upgradable_packages"] = _slow_metrics_cache["apt_upgradable_packages"]

    return data
