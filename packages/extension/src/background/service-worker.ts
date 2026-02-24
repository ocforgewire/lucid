// ============================================
// LUCID Extension — Background Service Worker
// ============================================

const API_URL_DEFAULT = "https://api.getlucid.dev";
const API_URL_DEV = "http://localhost:3001";

// --- Storage Keys ---

const STORAGE_KEYS = {
  TOKEN: "lucid_token",
  USER: "lucid_user",
  API_URL: "lucid_api_url",
  MODE: "lucid_mode",
} as const;

// --- Types ---

interface StoredUser {
  id: string;
  email: string;
  name: string;
  plan: string;
}

interface EnhancePayload {
  intent: string;
  mode: string;
  targetModel: string;
}

// --- Helpers ---

async function getApiUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.API_URL], (result) => {
      resolve(result[STORAGE_KEYS.API_URL] || API_URL_DEFAULT);
    });
  });
}

async function getToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.TOKEN], (result) => {
      resolve(result[STORAGE_KEYS.TOKEN] || null);
    });
  });
}

async function setToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.TOKEN]: token }, resolve);
  });
}

async function clearAuth(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(
      [STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER],
      resolve,
    );
  });
}

async function setUser(user: StoredUser): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.USER]: user }, resolve);
  });
}

async function getUser(): Promise<StoredUser | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.USER], (result) => {
      resolve(result[STORAGE_KEYS.USER] || null);
    });
  });
}

// --- API Calls ---

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data?: T; error?: string; status: number }> {
  const apiUrl = await getApiUrl();
  const token = await getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      // Token expired or invalid — clear auth
      await clearAuth();
      return { error: "Authentication expired. Please log in again.", status: 401 };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Request failed" }));
      return {
        error: body.message || body.error || `Request failed (${res.status})`,
        status: res.status,
      };
    }

    const data = await res.json();
    return { data: data as T, status: res.status };
  } catch (err) {
    console.error("[Lucid] API request failed:", err);
    return {
      error: "Network error. Check your connection and try again.",
      status: 0,
    };
  }
}

// --- Message Handlers ---

async function handleEnhance(payload: EnhancePayload) {
  const token = await getToken();
  if (!token) {
    return { error: "Not logged in. Open the Lucid extension popup to sign in." };
  }

  const result = await apiRequest<{
    enhanced: string;
    structured: unknown;
    mode: string;
    targetModel: string;
    personalizationApplied: boolean;
    durationMs: number;
    enhancementId: string;
  }>("/v1/enhance", {
    method: "POST",
    body: JSON.stringify({
      intent: payload.intent,
      mode: payload.mode,
      targetModel: payload.targetModel,
    }),
  });

  if (result.error) {
    return { error: result.error };
  }

  return {
    enhanced: result.data?.enhanced,
    structured: result.data?.structured,
    mode: result.data?.mode,
    enhancementId: result.data?.enhancementId,
    durationMs: result.data?.durationMs,
  };
}

async function handleLogin(payload: { email: string; password: string }) {
  const result = await apiRequest<{
    token: string;
    user: StoredUser;
  }>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (result.error) {
    return { error: result.error };
  }

  if (result.data?.token) {
    await setToken(result.data.token);
    await setUser(result.data.user);
    return { user: result.data.user };
  }

  return { error: "Unexpected login response" };
}

async function handleLogout() {
  await clearAuth();
  return { ok: true };
}

async function handleAuthStatus() {
  const token = await getToken();
  const user = await getUser();

  if (!token || !user) {
    return { authenticated: false };
  }

  // Optionally validate token by hitting a /me endpoint
  const result = await apiRequest<{
    user: StoredUser;
    enhancementsThisMonth: number;
  }>("/v1/auth/me", { method: "GET" });

  if (result.error) {
    return { authenticated: false, error: result.error };
  }

  // Update stored user data with fresh info
  if (result.data?.user) {
    await setUser(result.data.user);
  }

  return {
    authenticated: true,
    user: result.data?.user || user,
    enhancementsThisMonth: result.data?.enhancementsThisMonth || 0,
  };
}

async function handleFeedback(payload: {
  enhancementId: string;
  signal: string;
  rating?: number;
}) {
  const result = await apiRequest("/v1/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (result.error) {
    return { error: result.error };
  }

  return { ok: true };
}

async function handleSetApiUrl(payload: { url: string }) {
  return new Promise<{ ok: boolean }>((resolve) => {
    chrome.storage.local.set(
      { [STORAGE_KEYS.API_URL]: payload.url },
      () => resolve({ ok: true }),
    );
  });
}

// --- Main Listener ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message;

  const handler = async () => {
    switch (type) {
      case "ENHANCE":
        return handleEnhance(payload);
      case "LOGIN":
        return handleLogin(payload);
      case "LOGOUT":
        return handleLogout();
      case "AUTH_STATUS":
        return handleAuthStatus();
      case "FEEDBACK":
        return handleFeedback(payload);
      case "SET_API_URL":
        return handleSetApiUrl(payload);
      default:
        return { error: `Unknown message type: ${type}` };
    }
  };

  handler()
    .then(sendResponse)
    .catch((err) => {
      console.error(`[Lucid] Error handling ${type}:`, err);
      sendResponse({ error: "Internal extension error" });
    });

  // Return true to indicate we'll call sendResponse asynchronously
  return true;
});

// --- Install / Update ---

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[Lucid] Extension installed.");
    // Set default API URL based on environment
    chrome.storage.local.set({
      [STORAGE_KEYS.API_URL]: API_URL_DEFAULT,
      [STORAGE_KEYS.MODE]: "enhance",
    });
  }

  if (details.reason === "update") {
    console.log(`[Lucid] Extension updated to ${chrome.runtime.getManifest().version}`);
  }
});
