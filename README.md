# Mission Control

Mission Control is a small, self-contained **FastAPI** app that serves a **local web dashboard** for your Linux machine. It bundles the UI (HTML/CSS/JS) and API in one process—no separate nginx or reverse proxy required. It is aimed at everyday workstations (including Mint-style setups): CPU, memory, swap, uptime, disks, network throughput, top processes, systemd failed units, and APT upgradable packages when `apt` is available.

Core metrics work **without root**. Optional panels use `systemd` and `apt` when they are on your `PATH`.

## Requirements

- Python **3.12+** (or the version you use for the project venv)
- Linux (metrics are Linux-oriented)

## Install

From the repository root:

```bash
python3 -m venv .venv
.venv/bin/pip install -e .
```

## Run

```bash
./run.sh
```

Or:

```bash
.venv/bin/python -m mission_control
```

Defaults: **http://127.0.0.1:8765**

Bind elsewhere:

```bash
.venv/bin/python -m mission_control --host 0.0.0.0 --port 8765
```

## Usage

Open the app in a browser. The UI updates live over **Server-Sent Events** (`/api/stream`). Use the **settings** control (gear) to change theme, clock format, which sections are visible, the **SSE update interval** (0.25–30 seconds), and how the **process memory** column is shown (percent, size in MB/GB, or both).

**Slow metrics** (systemd failed units, APT upgrade count and package list) are refreshed at most about **every 30 seconds** so routine polling stays light; the UI caches the last values between those runs.

### Top processes

Filter by name, cap row count, and sort by column header (**PID**, **Name**, **CPU**, **MEM**). Memory sorting follows the configured display (percent vs RSS).

### Operations

When upgrades exist, you can expand the APT summary to list packages with **current and candidate versions**, search by package name, and sort by the **Package** column.

## API (for scripts or debugging)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Dashboard HTML |
| `GET` | `/assets/…` | Static assets |
| `GET` | `/api/health` | `{"status":"ok"}` |
| `GET` | `/api/metrics` | Single JSON snapshot (same shape as SSE payloads) |
| `GET` | `/api/stream?interval=1` | SSE stream; `interval` in seconds, **0.25–30** |

## Project layout

- `mission_control/main.py` — FastAPI app, routes, static mount
- `mission_control/metrics.py` — Snapshot collection (`psutil`, optional `systemctl` / `apt`)
- `mission_control/static/` — Browser UI
- `pyproject.toml` — Package metadata and dependencies
- `run.sh` — Run from the project venv

## License

[MIT](LICENSE)
