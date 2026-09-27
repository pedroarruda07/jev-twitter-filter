"""Run one live classification using the root .env (consumes a small API request)."""

import asyncio

import httpx

from .main import create_app


async def main() -> None:
    app = create_app()
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app), base_url="http://127.0.0.1"
        ) as client:
            response = await client.post(
                "/api/classify",
                json={
                    "post_id": "1",
                    "text": "A new artificial intelligence model improves machine learning.",
                },
            )
    if response.status_code != 200:
        raise SystemExit(f"Live check failed ({response.status_code}): {response.json()['detail']}")
    result = response.json()
    print(f"Live Jev check passed: {result['label']} ({result['confidence']:.0%} confidence)")


if __name__ == "__main__":
    asyncio.run(main())
