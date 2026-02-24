// ============================================
// LUCID Extension — Content Script Entry Point
// ============================================

import { detectPlatform } from "./platform-detector";
import { injectLucidUI, setupKeyboardShortcut } from "./ui-injector";

const MAX_RETRIES = 20;
const RETRY_INTERVAL_MS = 500;
const REINJECT_DEBOUNCE_MS = 1000;

let cleanup: (() => void) | null = null;
let injected = false;

/**
 * Wait for the platform's chat input to appear in the DOM.
 * SPA pages may load their UI asynchronously, so we poll.
 */
function waitForPlatformReady(): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;

    const check = () => {
      attempts++;
      const adapter = detectPlatform();
      if (adapter && adapter.getInputElement()) {
        resolve(true);
        return;
      }
      if (attempts >= MAX_RETRIES) {
        resolve(false);
        return;
      }
      setTimeout(check, RETRY_INTERVAL_MS);
    };

    check();
  });
}

/**
 * Initialize Lucid on the detected platform.
 */
function initialize() {
  if (injected) return;

  const adapter = detectPlatform();
  if (!adapter) return;

  const inputEl = adapter.getInputElement();
  if (!inputEl) {
    console.log("[Lucid] Platform detected but input element not found yet.");
    return;
  }

  console.log(`[Lucid] Initializing on ${adapter.displayName}`);

  // Inject the UI
  cleanup = injectLucidUI(adapter);
  if (cleanup) {
    injected = true;
  }

  // Set up keyboard shortcut
  setupKeyboardShortcut(adapter);
}

/**
 * Re-inject the UI if the host element gets removed (SPA navigation).
 */
function setupReinjection() {
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver(() => {
    // If our host element was removed, re-inject
    if (injected && !document.querySelector("#lucid-host")) {
      injected = false;
      cleanup = null;

      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        console.log("[Lucid] UI removed, re-injecting...");
        initialize();
      }, REINJECT_DEBOUNCE_MS);
    }

    // If not yet injected, try again (page may have finished loading new content)
    if (!injected) {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        initialize();
      }, REINJECT_DEBOUNCE_MS);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Listen for messages from the background service worker.
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "PING") {
      sendResponse({ status: "alive", injected });
      return true;
    }

    if (message.type === "TRIGGER_ENHANCE") {
      const adapter = detectPlatform();
      if (adapter) {
        const host = document.querySelector("#lucid-host");
        if (host) {
          // Click the button programmatically
          const btn = host.querySelector(".lucid-btn") as HTMLElement | null;
          btn?.click();
        }
      }
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });
}

// --- Main Entry ---

async function main() {
  console.log("[Lucid] Content script loaded.");

  setupMessageListener();

  const ready = await waitForPlatformReady();
  if (ready) {
    initialize();
  } else {
    console.log("[Lucid] Platform UI did not appear within timeout. Will watch for changes.");
  }

  // Always set up re-injection observer for SPA navigation
  setupReinjection();
}

main().catch((err) => {
  console.error("[Lucid] Fatal error during initialization:", err);
});
