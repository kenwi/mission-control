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
    NetRateState,
    collect_mount_detail,
    collect_process_detail,
    collect_snapshot,
)

STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(title="Mission Control", version="0.1.0")
_net_state = NetRateState()
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
) -> dict:
    global _slow_last
    now = time.time()
    include_slow = (now - _slow_last) >= SLOW_INTERVAL_SEC
    if include_slow:
        _slow_last = now
    sample = collect_snapshot(
        cpu_sample_interval=0.15,
        net_state=_net_state,
        include_slow=include_slow,
        include_processes=processes,
        process_sample_limit=proc_limit,
    )
    return sample


@app.get("/api/mount")
def mount_detail(mountpoint: str = Query(..., min_length=1)) -> dict:
    """Usage + statvfs for a mount path (URL-encoded ``mountpoint`` query)."""
    data = collect_mount_detail(mountpoint)
    if data is None:
        raise HTTPException(status_code=404, detail="Mount not available")
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
    proc_limit: int = Query(
        200,
        ge=0,
        le=100_000,
        description="Top-N processes by sample heuristic; 0 = all processes.",
    ),
):
    """SSE: live metrics; `interval` is seconds between snapshots (0.25–30).

    Set ``processes=false`` to omit top-process collection (empty ``processes`` list).
    Use ``proc_limit=0`` to include every process in the sample (heavier).
    """

    async def gen():
        global _slow_last
        collect_snapshot(
            cpu_sample_interval=0.15,
            net_state=_net_state,
            include_slow=False,
            include_processes=processes,
            process_sample_limit=proc_limit,
        )
        while True:
            now = time.time()
            include_slow = (now - _slow_last) >= SLOW_INTERVAL_SEC
            if include_slow:
                _slow_last = now
            snap = collect_snapshot(
                cpu_sample_interval=None,
                net_state=_net_state,
                include_slow=include_slow,
                include_processes=processes,
                process_sample_limit=proc_limit,
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
