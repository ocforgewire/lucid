// ============================================
// LUCID Extension — UI Injector (Shadow DOM)
// ============================================

import type { EnhancementMode } from "@lucid/shared";
import type { PlatformAdapter } from "../adapters/types";

type ButtonState = "idle" | "loading" | "success" | "error";

const MODES: { value: EnhancementMode; label: string; icon: string }[] = [
  { value: "enhance", label: "Enhance", icon: "\u2728" },
  { value: "expand", label: "Expand", icon: "\u2195" },
  { value: "refine", label: "Refine", icon: "\u2692" },
  { value: "simplify", label: "Simplify", icon: "\u2702" },
];

/**
 * Inject the Lucid enhancement UI into the page using a closed Shadow DOM.
 * Returns a cleanup function to remove the injected UI.
 */
export function injectLucidUI(adapter: PlatformAdapter): (() => void) | null {
  const injectionPoint = adapter.getButtonInjectionPoint();
  if (!injectionPoint) {
    console.warn("[Lucid] Could not find button injection point.");
    return null;
  }

  // Prevent duplicate injection
  if (document.querySelector("#lucid-host")) {
    return null;
  }

  // Create shadow DOM host
  const host = document.createElement("div");
  host.id = "lucid-host";
  host.style.display = "inline-flex";
  host.style.alignItems = "center";
  host.style.position = "relative";
  host.style.zIndex = "10000";
  host.style.marginLeft = "4px";
  host.style.marginRight = "4px";

  const shadow = host.attachShadow({ mode: "closed" });

  // Load styles into shadow DOM
  const style = document.createElement("style");
  style.textContent = getInjectedStyles();
  shadow.appendChild(style);

  // Build the UI
  const container = document.createElement("div");
  container.className = "lucid-container";

  // Main enhance button
  const button = document.createElement("button");
  button.className = "lucid-btn";
  button.setAttribute("aria-label", "Enhance with Lucid");
  button.title = "Enhance with Lucid (\u2318\u21E7L)";
  button.innerHTML = '<span class="lucid-icon">\u2726</span>';

  // Loading spinner (hidden by default)
  const spinner = document.createElement("div");
  spinner.className = "lucid-spinner";
  spinner.style.display = "none";
  button.appendChild(spinner);

  // Mode selector dropdown
  const dropdown = document.createElement("div");
  dropdown.className = "lucid-dropdown";
  dropdown.style.display = "none";

  for (const mode of MODES) {
    const option = document.createElement("button");
    option.className = "lucid-dropdown-item";
    option.dataset.mode = mode.value;
    option.innerHTML = `<span class="lucid-dropdown-icon">${mode.icon}</span>${mode.label}`;
    dropdown.appendChild(option);
  }

  container.appendChild(button);
  container.appendChild(dropdown);
  shadow.appendChild(container);

  // State
  let currentState: ButtonState = "idle";
  let currentMode: EnhancementMode = "enhance";
  let dropdownVisible = false;
  let originalText = "";

  // Load saved mode preference
  chrome.storage.local.get(["lucid_mode"], (result) => {
    if (result.lucid_mode) {
      currentMode = result.lucid_mode as EnhancementMode;
    }
  });

  // --- Event Handlers ---

  function setState(state: ButtonState) {
    currentState = state;
    button.classList.remove("lucid-btn--loading", "lucid-btn--success", "lucid-btn--error");
    const iconEl = button.querySelector(".lucid-icon") as HTMLElement;

    switch (state) {
      case "loading":
        button.classList.add("lucid-btn--loading");
        if (iconEl) iconEl.style.display = "none";
        spinner.style.display = "block";
        button.disabled = true;
        break;
      case "success":
        button.classList.add("lucid-btn--success");
        if (iconEl) {
          iconEl.style.display = "inline";
          iconEl.textContent = "\u2713";
        }
        spinner.style.display = "none";
        button.disabled = false;
        setTimeout(() => {
          if (currentState === "success") setState("idle");
        }, 2000);
        break;
      case "error":
        button.classList.add("lucid-btn--error");
        if (iconEl) {
          iconEl.style.display = "inline";
          iconEl.textContent = "!";
        }
        spinner.style.display = "none";
        button.disabled = false;
        setTimeout(() => {
          if (currentState === "error") setState("idle");
        }, 3000);
        break;
      default:
        if (iconEl) {
          iconEl.style.display = "inline";
          iconEl.textContent = "\u2726";
        }
        spinner.style.display = "none";
        button.disabled = false;
    }
  }

  function toggleDropdown() {
    dropdownVisible = !dropdownVisible;
    dropdown.style.display = dropdownVisible ? "flex" : "none";
  }

  function hideDropdown() {
    dropdownVisible = false;
    dropdown.style.display = "none";
  }

  async function enhance() {
    if (currentState === "loading") return;

    const inputText = adapter.getInputText();
    if (!inputText || inputText.trim().length < 3) {
      console.log("[Lucid] Input too short to enhance.");
      return;
    }

    // Save original text for potential undo
    originalText = inputText;
    setState("loading");
    hideDropdown();

    try {
      const response = await chrome.runtime.sendMessage({
        type: "ENHANCE",
        payload: {
          intent: inputText,
          mode: currentMode,
          targetModel: adapter.name,
        },
      });

      if (response?.error) {
        console.error("[Lucid] Enhancement error:", response.error);
        setState("error");
        return;
      }

      if (response?.enhanced) {
        adapter.setInputText(response.enhanced);
        setState("success");
      } else {
        console.error("[Lucid] Unexpected response:", response);
        setState("error");
      }
    } catch (err) {
      console.error("[Lucid] Failed to enhance:", err);
      setState("error");
    }
  }

  // Click: enhance with current mode
  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    enhance();
  });

  // Right-click: show mode selector
  button.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown();
  });

  // Mode selection from dropdown
  dropdown.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest(".lucid-dropdown-item") as HTMLElement | null;
    if (!target?.dataset.mode) return;

    e.preventDefault();
    e.stopPropagation();

    currentMode = target.dataset.mode as EnhancementMode;
    chrome.storage.local.set({ lucid_mode: currentMode });

    // Update all items to reflect selection
    const items = dropdown.querySelectorAll(".lucid-dropdown-item");
    for (const item of items) {
      item.classList.toggle(
        "lucid-dropdown-item--active",
        (item as HTMLElement).dataset.mode === currentMode,
      );
    }

    hideDropdown();
    enhance();
  });

  // Close dropdown when clicking outside
  shadow.addEventListener("click", (e) => {
    if (!(e.target as HTMLElement).closest(".lucid-dropdown") && !(e.target as HTMLElement).closest(".lucid-btn")) {
      hideDropdown();
    }
  });

  // Undo: Ctrl/Cmd+Z while Lucid just replaced text
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && currentState === "success" && originalText) {
      adapter.setInputText(originalText);
      originalText = "";
      setState("idle");
    }
  });

  // Insert into page
  injectionPoint.appendChild(host);

  // Cleanup function
  return () => {
    host.remove();
  };
}

/**
 * Set up the global keyboard shortcut listener (Cmd+Shift+L / Ctrl+Shift+L).
 */
export function setupKeyboardShortcut(adapter: PlatformAdapter) {
  document.addEventListener("keydown", (e) => {
    const isShortcut =
      (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "l";

    if (!isShortcut) return;

    e.preventDefault();
    e.stopPropagation();

    // Simulate clicking the Lucid button
    const host = document.querySelector("#lucid-host");
    if (!host?.shadowRoot) {
      // Shadow is closed, so we can't access it this way.
      // Instead, trigger enhance directly via the adapter.
      triggerEnhanceViaMessage(adapter);
      return;
    }
  });
}

async function triggerEnhanceViaMessage(adapter: PlatformAdapter) {
  const inputText = adapter.getInputText();
  if (!inputText || inputText.trim().length < 3) return;

  try {
    const mode = await new Promise<EnhancementMode>((resolve) => {
      chrome.storage.local.get(["lucid_mode"], (result) => {
        resolve((result.lucid_mode as EnhancementMode) || "enhance");
      });
    });

    const response = await chrome.runtime.sendMessage({
      type: "ENHANCE",
      payload: {
        intent: inputText,
        mode,
        targetModel: adapter.name,
      },
    });

    if (response?.enhanced) {
      adapter.setInputText(response.enhanced);
    }
  } catch (err) {
    console.error("[Lucid] Keyboard shortcut enhance failed:", err);
  }
}

// --- Inline Styles (Shadow DOM isolated) ---

function getInjectedStyles(): string {
  return `
    :host {
      all: initial;
      display: inline-flex;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .lucid-container {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    /* --- Main Button --- */
    .lucid-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%);
      color: #ffffff;
      font-size: 14px;
      position: relative;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      outline: none;
      flex-shrink: 0;
    }

    .lucid-btn:hover:not(:disabled) {
      transform: scale(1.1);
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
    }

    .lucid-btn:active:not(:disabled) {
      transform: scale(0.95);
    }

    .lucid-btn:disabled {
      cursor: wait;
      opacity: 0.8;
    }

    .lucid-icon {
      line-height: 1;
      font-size: 14px;
      pointer-events: none;
    }

    /* --- Loading State --- */
    .lucid-btn--loading {
      background: linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%);
    }

    .lucid-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: lucid-spin 0.6s linear infinite;
      position: absolute;
    }

    @keyframes lucid-spin {
      to { transform: rotate(360deg); }
    }

    /* --- Success State --- */
    .lucid-btn--success {
      background: linear-gradient(135deg, #059669 0%, #10B981 100%);
      animation: lucid-flash 0.3s ease;
    }

    @keyframes lucid-flash {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
      50% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      100% { box-shadow: none; }
    }

    /* --- Error State --- */
    .lucid-btn--error {
      background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%);
    }

    /* --- Dropdown --- */
    .lucid-dropdown {
      position: absolute;
      bottom: calc(100% + 6px);
      right: 0;
      display: flex;
      flex-direction: column;
      background: #1E1B4B;
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 8px;
      padding: 4px;
      min-width: 140px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      animation: lucid-dropdown-in 0.15s ease;
    }

    @keyframes lucid-dropdown-in {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .lucid-dropdown-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px 10px;
      border: none;
      background: transparent;
      color: #C7D2FE;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      border-radius: 4px;
      transition: background 0.1s ease, color 0.1s ease;
      text-align: left;
    }

    .lucid-dropdown-item:hover {
      background: rgba(99, 102, 241, 0.2);
      color: #ffffff;
    }

    .lucid-dropdown-item--active {
      background: rgba(99, 102, 241, 0.3);
      color: #A5B4FC;
      font-weight: 600;
    }

    .lucid-dropdown-icon {
      font-size: 13px;
      width: 16px;
      text-align: center;
      flex-shrink: 0;
    }
  `;
}
