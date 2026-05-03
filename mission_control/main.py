"""Self-contained FastAPI app: REST + SSE + static UI (no external web server)."""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from mission_control.metrics import NetRateState, collect_snapshot

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
def metrics() -> dict:
    global _slow_last
    now = time.time()
    include_slow = (now - _slow_last) >= SLOW_INTERVAL_SEC
    if include_slow:
        _slow_last = now
    sample = collect_snapshot(cpu_sample_interval=0.15, net_state=_net_state, include_slow=include_slow)
    return sample


@app.get("/api/stream")
async def stream(interval: float = Query(1.0, ge=0.25, le=30.0)):
    """SSE: live metrics; `interval` is seconds between snapshots (0.25–30)."""

    async def gen():
        global _slow_last
        collect_snapshot(cpu_sample_interval=0.15, net_state=_net_state, include_slow=False)
        while True:
            now = time.time()
            include_slow = (now - _slow_last) >= SLOW_INTERVAL_SEC
            if include_slow:
                _slow_last = now
            snap = collect_snapshot(
                cpu_sample_interval=None,
                net_state=_net_state,
                include_slow=include_slow,
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
