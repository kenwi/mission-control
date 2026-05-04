"""Self-contained FastAPI app: REST + SSE + static UI (no external web server)."""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from mission_control.metrics import (
    DiskIoState,
    NetRateState,
    collect_block_device_detail,
    collect_docker_container_inspect,
    collect_docker_image_inspect,
    collect_docker_volume_inspect,
    collect_interface_detail,
    collect_mount_detail,
    collect_process_detail,
    collect_fan_detail,
    collect_snapshot,
    collect_thermal_detail,
    collect_zpool_detail,
)

STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(title="Mission Control", version="0.1.0")
_net_state = NetRateState()
_disk_io_state = DiskIoState()
_slow_last = 0.0
SLOW_INTERVAL_SEC = 30.0


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
 

@app.get("/api/metrics")
def metrics(
    processes: bool = Query(True),
    proc_limit: int = Query(200, ge=0, le=100_000),
    disk_io: bool = Query(True),
    docker_containers: bool = Query(True),
    docker_images: bool = Query(True),
    docker_volumes: bool = Query(True),
    compute: bool = Query(True),
    network: bool = Query(True),
    listening_ports: bool = Query(True),
    thermal: bool = Query(True),
    fans: bool = Query(True),
    operations: bool = Query(True),
    mounts: bool = Query(True),
    zfs: bool = Query(True),
) -> dict:
    global _slow_last
    now = time.time()
    include_slow = (now - _slow_last) >= SLOW_INTERVAL_SEC
    if include_slow:
        _slow_last = now
    sample = collect_snapshot(
        cpu_sample_interval=0.15,
        net_state=_net_state,
        disk_io_state=_disk_io_state,
        include_slow=include_slow,
        include_compute=compute,
        include_network=network,
        include_listening_ports=listening_ports,
        include_thermal=thermal,
        include_fans=fans,
        include_operations=operations,
        include_disk_mounts=mounts,
        include_zfs=zfs,
        include_disk_io=disk_io,
        include_processes=processes,
        process_sample_limit=proc_limit,
        include_docker_containers=docker_containers,
        include_docker_images=docker_images,
        include_docker_volumes=docker_volumes,
    )
    return sample


@app.get("/api/mount")
def mount_detail(mountpoint: str = Query(..., min_length=1)) -> dict:
    """Usage + statvfs for a mount path (URL-encoded ``mountpoint`` query)."""
    data = collect_mount_detail(mountpoint)
    if data is None:
        raise HTTPException(status_code=404, detail="Mount not available")
    return data


@app.get("/api/block/{dev_name}")
def block_device_detail(dev_name: str) -> dict:
    """Sysfs + SMART (``smartctl``) for one block device name from diskstats (e.g. ``sda``, ``nvme0n1``)."""
    if len(dev_name) > 80:
        raise HTTPException(status_code=404, detail="Block device not found")
    data = collect_block_device_detail(dev_name)
    if data is None:
        raise HTTPException(status_code=404, detail="Block device not found")
    return data


@app.get("/api/zpool/{pool_name}")
def zpool_detail(pool_name: str) -> dict:
    """ZFS pool status and ``zpool get`` output for one pool name."""
    data = collect_zpool_detail(pool_name)
    if data is None:
        raise HTTPException(status_code=404, detail="Pool not found or not available")
    return data


@app.get("/api/thermal/detail")
def thermal_detail(key: str = Query(..., min_length=4, max_length=260)) -> dict:
    """Sysfs-backed fields for one thermal zone (``zone:thermal_zoneN``) or hwmon channel."""
    data = collect_thermal_detail(key)
    if data is None:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return data


@app.get("/api/fan/detail")
def fan_detail(key: str = Query(..., min_length=8, max_length=260)) -> dict:
    """Sysfs-backed fields for one hwmon fan channel (``hwmon:hwmonN:fanM``)."""
    data = collect_fan_detail(key)
    if data is None:
        raise HTTPException(status_code=404, detail="Fan sensor not found")
    return data


@app.get("/api/net/interface/{ifname}")
def net_interface_detail(ifname: str) -> dict:
    """Per-interface addresses, link state, sysfs hints, cumulative counters, and last known rates."""
    data = collect_interface_detail(ifname)
    if data is None:
        raise HTTPException(status_code=404, detail="Interface not found")
    rates = _net_state.last_rates or {}
    rb = rates.get(ifname.strip())
    if rb:
        data["rates_bps"] = rb
    return data


@app.get("/api/docker/container")
def docker_container_detail(
    container_id: str = Query(
        ...,
        alias="id",
        min_length=12,
        max_length=64,
        description="Container ID",
    ),
) -> dict:
    data = collect_docker_container_inspect(container_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Container not found")
    return data


@app.get("/api/docker/image")
def docker_image_detail(
    ref: str = Query(..., min_length=1, max_length=512, description="Image ID or reference"),
) -> dict:
    data = collect_docker_image_inspect(ref)
    if data is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return data


@app.get("/api/docker/volume")
def docker_volume_detail(
    name: str = Query(..., min_length=1, max_length=255, description="Volume name"),
) -> dict:
    data = collect_docker_volume_inspect(name)
    if data is None:
        raise HTTPException(status_code=404, detail="Volume not found")
    return data


@app.get("/api/process/{pid}")
def process_detail(pid: int) -> dict:
    if pid < 1:
        raise HTTPException(status_code=400, detail="Invalid PID")
    data = collect_process_detail(pid)
    if data.get("error") == "no_such_process":
        raise HTTPException(status_code=404, detail="No such process")
    return data


@app.get("/api/stream")
async def stream(
    interval: float = Query(1.0, ge=0.25, le=30.0),
    processes: bool = Query(True),
    disk_io: bool = Query(True),
    docker_containers: bool = Query(True),
    docker_images: bool = Query(True),
    docker_volumes: bool = Query(True),
    compute: bool = Query(True),
    network: bool = Query(True),
    listening_ports: bool = Query(True),
    thermal: bool = Query(True),
    fans: bool = Query(True),
    operations: bool = Query(True),
    mounts: bool = Query(True),
    zfs: bool = Query(True),
    proc_limit: int = Query(
        200,
        ge=0,
        le=100_000,
        description="Top-N processes by sample heuristic; 0 = all processes.",
    ),
):
    """SSE: live metrics; `interval` is seconds between snapshots (0.25–30).

    Set query flags to ``false`` to skip collecting expensive sections (see
    ``collect_snapshot``). Docker lists are controlled independently via
    ``docker_containers``, ``docker_images``, and ``docker_volumes``.
    """

    async def gen():
        global _slow_last
        collect_snapshot(
            cpu_sample_interval=0.15,
            net_state=_net_state,
            disk_io_state=_disk_io_state,
            include_slow=False,
            include_compute=compute,
            include_network=network,
            include_listening_ports=listening_ports,
            include_thermal=thermal,
            include_fans=fans,
            include_operations=operations,
            include_disk_mounts=mounts,
            include_zfs=zfs,
            include_disk_io=disk_io,
            include_processes=processes,
            process_sample_limit=proc_limit,
            include_docker_containers=docker_containers,
            include_docker_images=docker_images,
            include_docker_volumes=docker_volumes,
        )
        while True:
            now = time.time()
            include_slow = (now - _slow_last) >= SLOW_INTERVAL_SEC
            if include_slow:
                _slow_last = now
            snap = collect_snapshot(
                cpu_sample_interval=None,
                net_state=_net_state,
                disk_io_state=_disk_io_state,
                include_slow=include_slow,
                include_compute=compute,
                include_network=network,
                include_listening_ports=listening_ports,
                include_thermal=thermal,
                include_fans=fans,
                include_operations=operations,
                include_disk_mounts=mounts,
                include_zfs=zfs,
                include_disk_io=disk_io,
                include_processes=processes,
                process_sample_limit=proc_limit,
                include_docker_containers=docker_containers,
                include_docker_images=docker_images,
                include_docker_volumes=docker_volumes,
            )
            line = "data: " + json.dumps(snap) + "\n\n"
            yield line.encode("utf-8")
            await asyncio.sleep(interval)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


app.mount("/assets", StaticFiles(directory=str(STATIC_DIR)), name="assets")
