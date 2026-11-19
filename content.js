const UCC_REQUEST = "UCC_REQUEST";
const UCC_RESPONSE = "UCC_RESPONSE";
window.addEventListener("message", (e) => {
	if (e.data?.type !== UCC_REQUEST) return;
	const url = typeof e.data?.url === "string" ? e.data.url.trim() : "";
	if (!url) {
		window.postMessage({ type: UCC_RESPONSE, cookies: "", error: "invalid_url" }, "*");
		return;
	}
	chrome.runtime.sendMessage({ type: "GET_COOKIES", url }, (res) => {
		const runtimeErr = chrome.runtime.lastError?.message || null;
		const p = res && typeof res === "object" ? res : { cookies: typeof res === "string" ? res : "", error: null };
		window.postMessage(
			{
				type: UCC_RESPONSE,
				cookies: typeof p.cookies === "string" ? p.cookies : "",
				error: runtimeErr || p.error || null
			},
			"*"
		);
	});
});
