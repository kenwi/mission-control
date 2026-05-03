# Future feature ideas — Mission Control

Reference list of panels, metrics, and UX enhancements that fit the project’s style (live tiles + tables + detail modals, mostly `/proc`, sysfs, and common CLI tools). Nothing here is committed work—pick items as needed.

## New panels (high value)

- **Thermal & power** — CPU / package temps, fan speeds if exposed (`/sys/class/thermal`, `sensors` when available), estimated power where the kernel exposes it. Strong fit for laptops and small servers.
- **GPU** — Utilization, VRAM, power (NVIDIA via `nvidia-smi`, AMD via sysfs / ROCm where present). A minimal “GPU present / unavailable” state avoids silent gaps when tools are missing.
- **Battery** — Charge %, power (W), time remaining, health hints (`/sys/class/power_supply`). Pairs well with thermal on laptops.
- **I/O & block devices** — Per-disk read/write throughput (e.g. from `/proc/diskstats`), optional queue / activity signals. Complements storage *capacity* with *how hard disks are working*.
- **Connections & listening ports** — Summary: established count, listening sockets by port; optional “top talkers” via `ss`. Note: full socket tables may need extra privileges.
- **Recent journal / critical logs** — Bounded, rate-limited tail of `journalctl -p err..alert` or similar. Extends “systemd failed units” with *recent* narrative context.
- **Containers** — If Docker/Podman is present: running/stopped counts, one-shot CPU/memory per container (`docker stats` / `podman stats`). High value on dev machines.
- **Users & sessions** — Logged-in users, seat/session info (`who`, `loginctl`); optional security-adjacent signals (e.g. failed SSH) *only if* log parsing is an accepted tradeoff.

## Deeper insight in existing panels

- **Compute** — Steal time, context switches, run queue; **pressure stall** metrics (`/proc/pressure/cpu|memory|io`) on supported kernels.
- **Memory** — Slab / page cache, dirty / writeback, huge pages; show pressure next to “% used” where available.
- **Processes** — Extra columns or filters: start time, cgroup, I/O or network when feasible; optional process tree / parent column.
- **Network** — TCP retransmits, drops; DNS from `resolvectl` / NetworkManager; default route / gateway in the interface detail modal.
- **Storage** — Device mapper / LVM hints; mount flags summary; SMART health via `smartctl` when present (slow → cache similarly to APT-style slow metrics).

## Operational / UX

- **Thresholds & highlighting** — e.g. sustained high CPU, disk use above 85%, temperature near limit: subtle borders or pill colors without building a full alerting stack.
- **Debug bundle** — One action exports recent JSON snapshots + static OS metadata for support or bug reports.
- **Per-panel refresh cadence** — Keep a fast global stream; run heavy sources (GPU, SMART, journal, containers) on longer intervals or on-demand.

## Scope and constraints

- **Graceful degradation** — If `nvidia-smi`, sensors, D-Bus, or `smartctl` are missing, the UI should stay clean (same pattern as optional systemd / APT today).
- **Privileges** — Many ideas work rootless; full socket inventory, some cgroup views, and SMART often need root or specific group membership—document requirements in UI or README when implemented.
- **Cost** — Anything involving `journalctl`, container stats, or SMART should be **cached** and **infrequent** so the main SSE path stays light.

## Good “next implementation” candidates

- **Battery + thermal** — Usually high signal on desktop Linux with sysfs-only data.
- **Disk I/O from `/proc/diskstats`** — Strong complement to existing mount table without duplicating space-focused views.
