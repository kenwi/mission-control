"""Run embedded ASGI server: python -m mission_control"""

from __future__ import annotations

import argparse
import sys


def main() -> None:
    import uvicorn

    parser = argparse.ArgumentParser(description="Mission Control local dashboard")
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Bind address (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8765,
        help="Port (default: 8765)",
    )
    args = parser.parse_args()

    try:
        uvicorn.run(
            "mission_control.main:app",
            host=args.host,
            port=args.port,
            log_level="info",
            access_log=False,
        )
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
