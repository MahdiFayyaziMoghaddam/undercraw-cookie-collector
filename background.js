chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'GET_COOKIES') return;
  const url = typeof msg.url === 'string' ? msg.url.trim() : '';
  if (!url) {
    sendResponse({ cookies: '', error: 'invalid_url' });
    return true;
  }
  try {
    chrome.cookies.getAll({ url }, cookies => {
      if (chrome.runtime.lastError) {
        sendResponse({ cookies: '', error: chrome.runtime.lastError.message || 'cookies_error' });
        return;
      }
      sendResponse({ cookies: (cookies || []).map(c => `${c.name}=${c.value}`).join('; '), error: null });
    });
  } catch (e) {
    sendResponse({ cookies: '', error: e?.message || 'cookies_error' });
  }
  return true;
});
