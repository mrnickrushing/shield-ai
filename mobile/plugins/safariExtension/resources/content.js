/* global browser */
// Shield AI Safari extension — content script (document_start, top frame only).
//
// Asks the background script whether this page's domain is community-flagged;
// if so, covers the page with a warning overlay before it can render. The
// user can leave (default) or explicitly continue this session.

(function () {
  const domain = location.hostname;
  if (!domain) return;

  const CONTINUE_KEY = "shieldai-override-" + domain;
  try {
    if (sessionStorage.getItem(CONTINUE_KEY) === "1") return;
  } catch (_e) {
    // sessionStorage can be unavailable (private mode edge cases) — continue checking.
  }

  browser.runtime.sendMessage({ type: "check-domain", domain }).then((response) => {
    if (!response || !response.flagged) return;
    // Stop the page from loading further while the warning is up.
    try {
      window.stop();
    } catch (_e) { /* ignore */ }
    render();
  }).catch(() => { /* fail open */ });

  function render() {
    const host = document.documentElement;
    const overlay = document.createElement("div");
    overlay.setAttribute(
      "style",
      [
        "position:fixed", "inset:0", "z-index:2147483647",
        "background:#0b0b13", "color:#e7e7ef",
        "display:flex", "flex-direction:column", "align-items:center", "justify-content:center",
        "font-family:-apple-system,system-ui,sans-serif", "padding:32px", "text-align:center",
      ].join(";")
    );

    const badge = document.createElement("div");
    badge.textContent = "⚠️";
    badge.setAttribute("style", "font-size:48px;margin-bottom:16px");

    const title = document.createElement("div");
    title.textContent = "Shield AI blocked this site";
    title.setAttribute("style", "font-size:22px;font-weight:800;margin-bottom:8px");

    const body = document.createElement("div");
    body.textContent =
      domain + " has been flagged as dangerous by the Shield AI community. " +
      "It may impersonate a real site to steal passwords or payments.";
    body.setAttribute("style", "font-size:15px;line-height:1.45;color:#a7a7bd;max-width:420px;margin-bottom:24px");

    const back = document.createElement("button");
    back.textContent = "Go back to safety";
    back.setAttribute(
      "style",
      "background:#22c55e;color:#04120a;border:0;border-radius:12px;padding:14px 22px;font-size:16px;font-weight:800;margin-bottom:12px;width:100%;max-width:420px"
    );
    back.addEventListener("click", function () {
      if (history.length > 1) history.back();
      else location.href = "about:blank";
    });

    const proceed = document.createElement("button");
    proceed.textContent = "I understand the risk — continue";
    proceed.setAttribute(
      "style",
      "background:transparent;color:#6b6b80;border:0;font-size:13px;text-decoration:underline;padding:8px"
    );
    proceed.addEventListener("click", function () {
      try {
        sessionStorage.setItem(CONTINUE_KEY, "1");
      } catch (_e) { /* ignore */ }
      location.reload();
    });

    overlay.appendChild(badge);
    overlay.appendChild(title);
    overlay.appendChild(body);
    overlay.appendChild(back);
    overlay.appendChild(proceed);

    // document.body may not exist at document_start; attach to <html>.
    host.appendChild(overlay);
  }
})();
