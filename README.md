<p align="center">
  <img src="assets/icon.png" alt="undercraw-cookie-collector icon" width="160" height="160" />
</p>

<h1 align="center">undercraw-cookie-collector</h1>

<p align="center">
  A minimal Manifest V3 Chrome extension that lets a trusted local app on <code>http://localhost:3000</code> request cookies for any URL.
</p>

<p align="center">
  <sub>Local cookie bridge for development and proxy tooling. Not intended for untrusted pages.</sub>
</p>

---

## At a glance

|                    |                                                                    |
| ------------------ | ------------------------------------------------------------------ |
| **Manifest**       | MV3 (`manifest_version: 3`)                                        |
| **Extension name** | `undercraw-cookie-collector` (v1.0)                                |
| **Bridge origin**  | `http://localhost:3000/*` (content script match)                   |
| **Request**        | `window.postMessage({ type: "UCC_REQUEST", url }, "*")`            |
| **Response**       | `{ type: "UCC_RESPONSE", cookies: string, error: string \| null }` |
| **Cookie format**  | `name=value; name2=value2` (or `""`)                               |

## What it does

Web pages cannot read cookies for other origins from JavaScript. This extension provides a narrow bridge:

1. A page on `http://localhost:3000` posts a `UCC_REQUEST` with a target URL.
2. The content script forwards the request to the background service worker.
3. The service worker reads cookies with `chrome.cookies.getAll({ url })`.
4. The result is posted back to the page as `UCC_RESPONSE`.

**Use case:** local development tools or proxies that need to attach existing browser cookies to requests for a target site (with your explicit local setup).

## How it works

### Components

| Path              | Purpose                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `manifest.json`   | Declares permissions, host access, service worker, content script injection, and icon.                      |
| `content.js`      | Runs on `http://localhost:3000/*` at `document_start`. Bridges page messages to extension runtime and back. |
| `background.js`   | MV3 service worker. Validates input, queries cookies, returns normalized results/errors.                    |
| `assets/icon.png` | Extension icon.                                                                                             |

### Flow

```text
localhost:3000 page
        │  window.postMessage({ type: "UCC_REQUEST", url }, "*")
        ▼
   content.js  ── validates url ──┐
        │                        │ invalid -> immediate UCC_RESPONSE (error: "invalid_url")
        │ valid                  │
        ▼                        │
chrome.runtime.sendMessage({ type: "GET_COOKIES", url })
        │
        ▼
   background.js (service worker)
        │  chrome.cookies.getAll({ url })
        ▼
   { cookies, error }
        │
        ▼
   content.js  ── normalizes runtime/API result
        │  window.postMessage({ type: "UCC_RESPONSE", cookies, error }, "*")
        ▼
localhost:3000 page
```

## Quick start

### Prerequisites

- Chrome, Edge, or another Chromium-based browser with extension developer mode.
- A local app served at `http://localhost:3000/*` (or update the content script `matches` in `manifest.json`).

### Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Confirm **undercraw-cookie-collector** is enabled.

> No build step is required. After editing files, click **Reload** on the extension and refresh your localhost page.

## Usage

Send a request from page JavaScript running on `http://localhost:3000`:

```js
window.postMessage(
	{
		type: "UCC_REQUEST",
		url: "https://example.com/"
	},
	"*"
);
```

Listen for the response:

```js
window.addEventListener("message", (e) => {
	if (e.data?.type !== "UCC_RESPONSE") return;

	const { cookies, error } = e.data;

	if (error) {
		console.error("Cookie bridge error:", error);
		return;
	}

	// Example: "session=abc123; csrftoken=xyz"
	console.log("Cookies:", cookies);
});
```

### Promise helper example

```js
function requestCookies(url) {
	return new Promise((resolve) => {
		function onMessage(e) {
			if (e.data?.type !== "UCC_RESPONSE") return;
			window.removeEventListener("message", onMessage);
			resolve(e.data); // { type, cookies, error }
		}

		window.addEventListener("message", onMessage);
		window.postMessage({ type: "UCC_REQUEST", url }, "*");
	});
}

const result = await requestCookies("https://example.com/");
// result => { type: "UCC_RESPONSE", cookies: "name=value; ...", error: null }
```

> **Note:** Responses do not include a request/correlation ID. If you send concurrent requests, handle them sequentially or add your own correlation layer in your app.

## API reference

### Request

| Field  | Type            | Required | Description                                                                                                                 |
| ------ | --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `type` | `"UCC_REQUEST"` | Yes      | Message type handled by `content.js`.                                                                                       |
| `url`  | `string`        | Yes      | Absolute URL passed to `chrome.cookies.getAll({ url })`. Value is trimmed; empty/non-string values fail with `invalid_url`. |

### Response

| Field     | Type             | Description                                                                                                                                                               |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`    | `"UCC_RESPONSE"` | Response message type.                                                                                                                                                    |
| `cookies` | `string`         | Serialized cookie pairs: `name=value; name2=value2`, or `""` if none/error. Includes **name and value only** (no domain, path, expiry, SameSite, Secure, HttpOnly flags). |
| `error`   | `string \| null` | `null` on success; otherwise an error code or message.                                                                                                                    |

### Error behavior

| `error`                                    | When it happens                                                                                  | `cookies`                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `null`                                     | Cookies queried successfully                                                                     | Cookie string (may be `""` if no cookies match) |
| `"invalid_url"`                            | `url` is missing, not a string, or empty after trimming (caught in content script or background) | `""`                                            |
| API/runtime message (or `"cookies_error"`) | `chrome.runtime.lastError`, cookie API failure, or thrown exception                              | `""`                                            |

Always check `error` before using `cookies`.

## Permissions and privacy

| Manifest entry                                         | Purpose                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| `permissions: ["cookies"]`                             | Read cookies via the Chrome Cookies API.                     |
| `host_permissions: ["<all_urls>"]`                     | Allow cookie lookups for requested target URLs across sites. |
| `content_scripts.matches: ["http://localhost:3000/*"]` | Inject the bridge only on the configured local app pages.    |
| `background.service_worker: "background.js"`           | Handle cookie requests in an MV3 service worker.             |

**Privacy notes:** The extension returns cookie data only when a `UCC_REQUEST` is received by the injected content script. It does not store, sync, or transmit data by itself. Treat returned cookies as sensitive and handle them securely in your local tooling.

## Security notes and limitations

> **Important:** This extension grants powerful cookie access to scripts running on the matched localhost page. Use only with a trusted local application.

- **Broad cookie access:** `cookies` + `<all_urls>` allows querying cookies for arbitrary URLs (including HttpOnly cookies exposed by `chrome.cookies`).
- **Trust boundary:** Any script in the `http://localhost:3000/*` page context can request cookies for any URL.
- **No request correlation:** Responses do not include a request ID; concurrent requests are ambiguous.
- **Minimal message hardening:** `content.js` accepts `UCC_REQUEST` messages based on message shape/type and responds with `window.postMessage(..., "*")`.
- **Metadata not included:** Response is only `name=value` pairs, not full cookie attributes/metadata.
- **Fixed injection target:** The bridge is available only where the content script matches. Change `manifest.json` if your app runs on a different origin/port/path.
- **No persistence:** No global mutable state is stored in the service worker.

## Troubleshooting

| Symptom                                 | Likely cause                                                                                 | What to try                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| No `UCC_RESPONSE` received              | App not on `http://localhost:3000/*`, extension disabled, or page not refreshed after reload | Verify URL match, enable/reload extension, hard-refresh the page.                    |
| `error: "invalid_url"`                  | `url` missing, not a string, or blank                                                        | Send a full, non-empty URL string (e.g. `https://example.com/`).                     |
| `error` is set with empty `cookies`     | Cookie API/runtime failure                                                                   | Open extension details in `chrome://extensions` and inspect the service worker logs. |
| `cookies` is `""` and `error` is `null` | No cookies matched the requested URL                                                         | Confirm you are logged into the target site and the URL scope is correct.            |
| Code changes not applied                | Extension/page still running old code                                                        | Reload the unpacked extension and refresh the localhost page.                        |

## Project structure

```text
.
├─ assets/
│  └─ icon.png          # Extension icon
├─ background.js        # Service worker: cookie lookup + error handling
├─ content.js           # localhost bridge: window <-> runtime messaging
└─ manifest.json        # Extension manifest (MV3)
```

## Development notes

- **Stack:** Plain JavaScript, Chrome Extension Manifest V3 (no bundler/build step).
- **Manual checks to run after changes:**
  - Valid target URL with existing cookies: returns expected `cookies`, `error: null`.
  - Missing/blank/invalid `url`: returns `{ cookies: "", error: "invalid_url" }`.
  - Runtime/API failure path: returns a response with `cookies: ""` and non-null `error` (no silent hang).
- **When changing the local app URL/port:** update `content_scripts[0].matches` in `manifest.json`.
