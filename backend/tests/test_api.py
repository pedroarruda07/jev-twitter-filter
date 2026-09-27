import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from jev_backend.config import Settings
from jev_backend.main import create_app


def settings(**overrides):
    return Settings(_env_file=None, api_key="test-secret", **overrides)


def answer(choice="ai", confidence=0.91):
    return {"answers": {"topic": {"type": "choice", "choice": choice, "confidence": confidence}}}


def test_classification_contract_and_private_key():
    requests = []

    def upstream(request):
        requests.append(request)
        return httpx.Response(200, json=answer())

    app = create_app(settings(), httpx.MockTransport(upstream))
    with TestClient(app) as client:
        result = client.post("/api/classify", json={"post_id": "123", "text": "New AI model"})
        assert result.status_code == 200
        assert result.json() == {
            "post_id": "123",
            "category": "ai",
            "label": "AI",
            "confidence": 0.91,
        }
        assert "test-secret" not in result.text
        assert client.get("/health").json() == {"status": "ok"}
        assert len(client.get("/api/categories").json()) == 5
    assert len(requests) == 1
    assert str(requests[0].url) == "https://api.typesafe.ai/v1/systemone"
    assert requests[0].headers["Authorization"] == "Bearer test-secret"
    payload = json.loads(requests[0].content)
    assert payload["state"] == "New AI model"
    assert payload["questions"]["topic"]["type"] == "choice"
    assert "other" in payload["questions"]["topic"]["criteria"]


@pytest.mark.parametrize(
    "post",
    [
        {"post_id": "abc", "text": "hello"},
        {"post_id": "1", "text": "   "},
        {"post_id": "1", "text": "x" * 20001},
        {"post_id": "1", "text": "hello", "url": "https://example.com"},
    ],
)
def test_invalid_input_never_calls_jev(post):
    def upstream(request):
        pytest.fail("Invalid requests must not reach Jev")

    with TestClient(create_app(settings(), httpx.MockTransport(upstream))) as client:
        assert client.post("/api/classify", json=post).status_code == 422


@pytest.mark.parametrize("status,expected", [(401, 502), (403, 502), (429, 429), (500, 502)])
def test_upstream_errors_are_sanitized(status, expected):
    transport = httpx.MockTransport(lambda request: httpx.Response(status, text="test-secret"))
    with TestClient(create_app(settings(), transport)) as client:
        response = client.post("/api/classify", json={"post_id": "1", "text": "hello"})
    assert response.status_code == expected
    assert "test-secret" not in response.text


@pytest.mark.parametrize("payload", [answer("unknown"), answer(confidence=2), {}, {"answers": []}])
def test_invalid_provider_response(payload):
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    with TestClient(create_app(settings(), transport)) as client:
        assert client.post("/api/classify", json={"post_id": "1", "text": "hi"}).status_code == 502


@pytest.mark.parametrize(
    "error,expected", [(httpx.ReadTimeout("secret"), 504), (httpx.ConnectError("secret"), 502)]
)
def test_network_errors(error, expected):
    def upstream(request):
        raise error

    with TestClient(create_app(settings(), httpx.MockTransport(upstream))) as client:
        assert (
            client.post("/api/classify", json={"post_id": "1", "text": "hi"}).status_code
            == expected
        )


def test_browser_origin_and_host_restrictions():
    with TestClient(create_app(settings())) as client:
        assert client.get("/health", headers={"Origin": "https://evil.example"}).status_code == 403
        assert client.get("/health", headers={"Host": "evil.example"}).status_code == 400
        assert (
            client.get("/health", headers={"Origin": "chrome-extension://" + "a" * 32}).status_code
            == 200
        )


async def test_requests_overlap_and_overload_is_bounded():
    release = asyncio.Event()
    both_started = asyncio.Event()
    calls = []

    async def upstream(request):
        calls.append(json.loads(request.content)["state"])
        if len(calls) == 2:
            both_started.set()
        await release.wait()
        return httpx.Response(200, json=answer())

    app = create_app(settings(max_concurrency=2), httpx.MockTransport(upstream))
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app), base_url="http://localhost"
        ) as client:
            tasks = [
                asyncio.create_task(
                    client.post("/api/classify", json={"post_id": str(i), "text": f"post {i}"})
                )
                for i in range(2)
            ]
            try:
                await asyncio.wait_for(both_started.wait(), timeout=2)
                busy = await client.post("/api/classify", json={"post_id": "3", "text": "third"})
                assert busy.status_code == 503
            finally:
                release.set()
            results = await asyncio.gather(*tasks)
            assert all(response.status_code == 200 for response in results)
            assert sorted(calls) == ["post 0", "post 1"]
