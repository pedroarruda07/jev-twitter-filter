# Jev X post tags

A Chrome extension that classifies newly loaded X/Twitter posts using Jev (TypeSafe AI), then puts a small topic tag beside the post timestamp. Initial categories: **Politics, AI, Gaming, Meme, Other**.

Each new text post has its own HTTP request. The extension runs up to six requests concurrently per tab; the async Python backend supports up to twelve concurrent Jev calls by default. No batching.

## Start the backend

Requires Python 3.11+ and Node.js 22+ for extension development. Run these PowerShell commands from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.lock
.\.venv\Scripts\python.exe -m pip install -e './backend[dev]'
.\.venv\Scripts\python.exe -m uvicorn jev_backend.main:app --host 127.0.0.1 --port 8000
```

The existing root `.env` is loaded automatically. It must contain `JEV_API_KEY` with a TypeSafe API key. Keep that file private; `.env.example` documents optional settings. Do not overwrite your existing `.env` with the example.

On macOS/Linux, use `.venv/bin/python` in place of `.\.venv\Scripts\python.exe`. The backend is intended to run locally on loopback, not as a public service.

- Health: http://127.0.0.1:8000/health (checks backend availability, not Jev credentials).
- Interactive API docs: http://127.0.0.1:8000/docs.
- Stop the server with Ctrl+C.

## Load the extension

In a second terminal:

```powershell
cd extension
npm.cmd ci
npm.cmd run build
```

Use `npm` instead of `npm.cmd` on macOS/Linux. On Windows, `npm.cmd` works without changing PowerShell execution policy.

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked**, then select this project's `extension/dist` directory.
3. Open or refresh an X/Twitter tab. Posts receive a `Tagging…` indicator, then a category beside their date.
4. Scroll to load more posts. Hover a tag to see Jev's confidence.

The toolbar popup shows backend connectivity and lets you pause classification across tabs. Pausing cancels queued work and hides tags; requests already sent may finish. Failures show a **Retry** tag with an explanatory tooltip; click to retry after resolving the problem. Requests are not automatically retried, avoiding unexpected duplicate API usage.

After editing extension code, rebuild, reload the extension in `chrome://extensions`, and refresh the X tab.

## Configure categories

Edit `backend/src/jev_backend/categories.json`, then restart the backend and refresh X. Each category has a stable `id`, a short display `label`, and a `description` used as Jev's classification criterion. Keep 2–20 unique categories, including `other` as a fallback. Category labels come from the backend, so adding categories needs no extension code changes.

Optional root `.env` settings:

| Setting | Default | Purpose |
| --- | --- | --- |
| `JEV_MODEL` | `jev-latest` | TypeSafe model identifier |
| `JEV_TIMEOUT_SECONDS` | `15` | Total deadline per Jev request; maximum 20 seconds |
| `JEV_MAX_CONCURRENCY` | `12` | Maximum simultaneous Jev requests per backend process |

The extension uses `http://127.0.0.1:8000`, configured in `extension/src/shared.js`. If changing the backend host, also update manifest host permissions and backend origin/host restrictions.

## Structure

```text
backend/
  src/jev_backend/
    config.py          # Environment settings and secret handling
    categories.json    # Editable category definitions
    categories.py      # Category validation and loading
    schemas.py         # API and provider data contracts
    jev.py             # Async TypeSafe adapter, limits, error translation
    main.py            # API routes and application lifespan
    smoke.py           # Optional live integration check
  tests/               # Mocked provider and concurrency tests
extension/
  src/content/         # Post extraction, DOM observation, queue, tags
  src/background/      # Validated messages and local backend requests
  src/popup.js         # Pause toggle and health indicator
  src/shared.js        # Shared protocol and validation
  public/              # Popup markup and CSS
  scripts/             # Bundling
  test/                # Queue, API, and DOM regression tests
  dist/                # Generated, unpacked Chrome extension
```

The content script watches DOM mutations and extracts each post's own text and status ID. The service worker makes local HTTP requests using Chrome host permissions. FastAPI calls TypeSafe's official `POST https://api.typesafe.ai/v1/systemone` endpoint with a single `choice` question. Only a validated category, label, confidence, and post ID return to the extension.

The extension deduplicates in-flight requests and retains the last 500 successful classifications in page memory. Keys include both the status ID and extracted text, so edited or expanded text is classified again. Results are reused when X redraws a post; stale responses cannot label an article that now represents a different post. Caches are per tab and reset on reload.

## Verification

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\ruff.exe check backend/src backend/tests
.\.venv\Scripts\ruff.exe format --check backend/src backend/tests
cd extension
npm.cmd run check
npm.cmd test
npm.cmd run build
```

Tests use a mocked Jev provider; they do not consume API credits. To make **one live request** using your `.env`, run from the root:

```powershell
.\.venv\Scripts\python.exe -m jev_backend.smoke
```

For a browser check, load the built extension, verify tags beside timestamps, scroll, navigate to a profile, pause/resume from the popup, and stop the backend to verify the retry state. X markup can change independently of this project; DOM selectors live in `extension/src/content/posts.js`.

## Data and current scope

- The Jev key stays in the Python process. It is never bundled into the extension or returned to the browser.
- Loaded post text goes to your local backend and TypeSafe AI. The post ID is sent only to your backend for response matching. No cookies, account credentials, or browsing history are collected.
- This version classifies the post's own rendered text, excluding quoted-post bodies. Images, video, linked pages, and hidden/truncated text are not fetched or analyzed. Text is limited to the first 20,000 JavaScript string units; media-only posts show **No text**.
- Posts loaded by X may be classified before they enter the viewport. Refreshing tabs and expanding posts can produce additional paid API requests.
- Backend request logging contains paths/statuses, not post bodies or credentials. There is no database or persistent classification history.
- The local API restricts browser origins and host headers. It has no user authentication and must remain bound to loopback. Overload returns a retryable error rather than growing a backend queue.
- Tags are informational; posts are not hidden or removed.

Integration references: [TypeSafe quick start](https://docs.typesafe.ai/introduction/quickstart), [TypeSafe API reference](https://docs.typesafe.ai/api), and [Chrome cross-origin requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).
