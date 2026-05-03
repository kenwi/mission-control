# Mission Control

Mission Control is a small, self-contained **FastAPI** app that serves a **local web dashboard** for your Linux machine. It bundles the UI (HTML/CSS/JS) and API in one process, so no separate nginx or reverse proxy is required. It is aimed at everyday workstations (including Mint-style setups): CPU, memory, swap, uptime, disks, network throughput, top processes, systemd failed units, and APT upgradable packages when `apt` is available.

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

Open the app in a browser. The UI updates live over **Server-Sent Events** (`/api/stream`), unless you **pause live updates** in the options panel.

Click the **settings** control (gear) to open **Options**:

- **Header title**: Custom label and optional **show/hide** for the title line (host line and status stay visible).
- **Theme** and **clock** (12h / 24h).
- **Process memory column**: Percent only, RSS in MB or GB, or both; MB/GB applies when bytes are shown.
- **Visible panels**: Toggle sections; you can also **drag** section headers to reorder and use **−** / **+** to collapse.
- **Update interval**: Seconds between SSE snapshots; the UI uses fixed steps **0.25 s through 30 s** (same bounds as `/api/stream`). Values outside that range are clamped; values between steps snap to the nearest step.
- **Pause live updates**: Stops the stream (status shows **paused**); unpause reconnects with the current interval.
- **Settings backup**: **Export** all stored options as JSON or **import** a file (including a flat `mc-*` key map).

Preferences live in the browser’s **localStorage**. A full export includes keys such as theme, layout, filters, and toggles.

**Slow metrics** (systemd failed units, APT upgrade count and package list) are refreshed at most about **every 30 seconds** so routine polling stays light; the UI keeps the last values between those runs.

### Top processes

Filter by name, limit row count, and sort by column header (**PID**, **Name**, **CPU**, **MEM**). Memory sorting follows the configured display (percent vs RSS). Optionally show a **footer row** with the **sum of RSS** for the processes currently listed (toggle in Options).

### Operations

When upgrades exist, expand the APT summary to list packages with **installed and candidate versions**, **search** by name, and **sort** by the **Package** column.

## API (for scripts or debugging)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Dashboard HTML |
| `GET` | `/assets/…` | Static assets |
| `GET` | `/api/health` | `{"status":"ok"}` |
| `GET` | `/api/metrics` | Single JSON snapshot (same shape as SSE payloads) |
| `GET` | `/api/stream?interval=1` | SSE stream; `interval` in seconds, **0.25 to 30** inclusive |

## Project layout

- `mission_control/main.py`: FastAPI app, routes, static mount
- `mission_control/metrics.py`: Snapshot collection (`psutil`, optional `systemctl` / `apt`)
- `mission_control/static/`: Browser UI
- `pyproject.toml`: Package metadata and dependencies
- `run.sh`: Run from the project venv

## License

[MIT](LICENSE)
