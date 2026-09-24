/** A history-restored document carries an old React tree and in-memory token. */
export function installSessionLifecycle() {
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) return;
    // Store an invisible document in BFCache, never an old account's screen.
    document.documentElement.style.visibility = "hidden";
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    document.documentElement.style.visibility = "hidden";
    // Bootstrap from current sessionStorage and validate /me on a fresh document.
    window.location.reload();
  });
}
