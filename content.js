window.addEventListener('message', e => {
  if (e.source !== window || e.data?.type !== 'PROXY_COOKIES_REQUEST') return;
  const requestId = e.data.requestId ?? null;
  const url = typeof e.data.url === 'string' ? e.data.url.trim() : '';
  if (!url) {
    window.postMessage({ type: 'PROXY_COOKIES_RESPONSE', requestId, cookies: '', error: 'invalid_url' }, '*');
    return;
  }
  chrome.runtime.sendMessage({ type: 'GET_COOKIES', url }, res => {
    const runtimeErr = chrome.runtime.lastError?.message || null;
    const p = res && typeof res === 'object' ? res : { cookies: typeof res === 'string' ? res : '', error: null };
    window.postMessage({
      type: 'PROXY_COOKIES_RESPONSE',
      requestId,
      cookies: typeof p.cookies === 'string' ? p.cookies : '',
      error: runtimeErr || p.error || null
    }, '*');
  });
});
