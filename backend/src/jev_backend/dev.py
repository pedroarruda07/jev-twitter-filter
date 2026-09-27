"""Start the local backend with Python and category-file auto reload."""

from pathlib import Path

import uvicorn


def main() -> None:
    try:
        import watchfiles  # noqa: F401
    except ImportError:
        raise SystemExit(
            'Auto reload requires dev dependencies: pip install -e "./backend[dev]"'
        ) from None

    uvicorn.run(
        "jev_backend.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=[str(Path(__file__).resolve().parent)],
        reload_includes=["*.py", "*.json"],
    )


if __name__ == "__main__":
    main()
