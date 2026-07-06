/* global browser */
// Shield AI Safari extension — background script.
//
// Content scripts can't talk to the native handler directly; this relays
// domain-check requests to SafariWebExtensionHandler.swift, which answers
// from the on-device snapshot (no network, no browsing history sent anywhere).
// Verdicts are memoized per session so repeat visits cost nothing.

const verdictCache = new Map();

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "check-domain" || !message.domain) {
    sendResponse({ flagged: false });
    return true;
  }
  const domain = String(message.domain).toLowerCase();

  if (verdictCache.has(domain)) {
    sendResponse({ flagged: verdictCache.get(domain) });
    return true;
  }

  browser.runtime
    .sendNativeMessage("application.id", { type: "check-domain", domain })
    .then((response) => {
      const flagged = Boolean(response && response.flagged);
      verdictCache.set(domain, flagged);
      sendResponse({ flagged });
    })
    .catch(() => {
      // Fail open: never break browsing because the handler was unavailable.
      sendResponse({ flagged: false });
    });
  return true; // async sendResponse
});
