// ============================================
// LUCID Extension — Popup Logic
// ============================================

const MODE_LABELS: Record<string, string> = {
  enhance: "Enhance",
  expand: "Expand",
  refine: "Refine",
  simplify: "Simplify",
};

// --- DOM References ---

const views = {
  login: document.getElementById("view-login") as HTMLDivElement,
  dashboard: document.getElementById("view-dashboard") as HTMLDivElement,
  loading: document.getElementById("view-loading") as HTMLDivElement,
};

// Login elements
const loginForm = document.getElementById("login-form") as HTMLFormElement;
const loginEmail = document.getElementById("login-email") as HTMLInputElement;
const loginPassword = document.getElementById("login-password") as HTMLInputElement;
const loginError = document.getElementById("login-error") as HTMLDivElement;
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;

// Dashboard elements
const userName = document.getElementById("user-name") as HTMLDivElement;
const userPlan = document.getElementById("user-plan") as HTMLSpanElement;
const statEnhancements = document.getElementById("stat-enhancements") as HTMLDivElement;
const modeSelector = document.getElementById("mode-selector") as HTMLDivElement;
const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;

// --- View Management ---

function showView(name: "login" | "dashboard" | "loading") {
  for (const [key, el] of Object.entries(views)) {
    el.style.display = key === name ? "block" : "none";
  }
}

// --- Auth Check ---

async function checkAuth() {
  showView("loading");

  try {
    const response = await chrome.runtime.sendMessage({ type: "AUTH_STATUS" });

    if (response?.authenticated && response?.user) {
      renderDashboard(response.user, response.enhancementsThisMonth || 0);
      showView("dashboard");
    } else {
      showView("login");
    }
  } catch {
    // Service worker might not be ready — show login
    showView("login");
  }
}

// --- Login ---

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) return;

  // Show loading state
  loginBtn.disabled = true;
  const btnText = loginBtn.querySelector(".btn-text") as HTMLSpanElement;
  const btnSpinner = loginBtn.querySelector(".btn-spinner") as HTMLSpanElement;
  btnText.textContent = "Signing in...";
  btnSpinner.style.display = "inline-block";
  loginError.style.display = "none";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "LOGIN",
      payload: { email, password },
    });

    if (response?.error) {
      showLoginError(response.error);
      return;
    }

    if (response?.user) {
      renderDashboard(response.user, 0);
      showView("dashboard");
    } else {
      showLoginError("Unexpected response from server.");
    }
  } catch (err) {
    showLoginError("Could not connect. Is the Lucid API running?");
  } finally {
    loginBtn.disabled = false;
    btnText.textContent = "Sign In";
    btnSpinner.style.display = "none";
  }
});

function showLoginError(message: string) {
  loginError.textContent = message;
  loginError.style.display = "block";
}

// --- Dashboard ---

function renderDashboard(
  user: { name: string; plan: string; email: string },
  enhancementsThisMonth: number,
) {
  userName.textContent = user.name || user.email;
  userPlan.textContent = user.plan.toUpperCase();
  statEnhancements.textContent = String(enhancementsThisMonth);

  // Load current mode and highlight it
  chrome.storage.local.get(["lucid_mode"], (result) => {
    const currentMode = result.lucid_mode || "enhance";
    updateModeSelection(currentMode);
  });
}

// --- Mode Selector ---

modeSelector.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest(".mode-btn") as HTMLElement | null;
  if (!target?.dataset.mode) return;

  const mode = target.dataset.mode;
  chrome.storage.local.set({ lucid_mode: mode });
  updateModeSelection(mode);
});

function updateModeSelection(activeMode: string) {
  const buttons = modeSelector.querySelectorAll(".mode-btn");
  for (const btn of buttons) {
    const el = btn as HTMLElement;
    el.classList.toggle("active", el.dataset.mode === activeMode);
  }
}

// --- Logout ---

logoutBtn.addEventListener("click", async () => {
  try {
    await chrome.runtime.sendMessage({ type: "LOGOUT" });
  } catch {
    // Clear local storage as fallback
    chrome.storage.local.clear();
  }
  showView("login");
  loginEmail.value = "";
  loginPassword.value = "";
  loginError.style.display = "none";
});

// --- Detect OS for shortcut display ---

function updateShortcutDisplay() {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const shortcutEl = document.querySelector(".shortcut-display");
  if (shortcutEl && !isMac) {
    shortcutEl.innerHTML = "<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd>";
  }
}

// --- Init ---

document.addEventListener("DOMContentLoaded", () => {
  updateShortcutDisplay();
  checkAuth();
});
