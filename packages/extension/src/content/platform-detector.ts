// ============================================
// LUCID Extension — Platform Detector
// ============================================

import type { PlatformAdapter } from "../adapters/types";
import { ChatGPTAdapter } from "../adapters/chatgpt";
import { ClaudeAdapter } from "../adapters/claude";
import { GeminiAdapter } from "../adapters/gemini";

const adapters: PlatformAdapter[] = [
  new ChatGPTAdapter(),
  new ClaudeAdapter(),
  new GeminiAdapter(),
];

/**
 * Detect which AI platform the user is on by trying each adapter's detect() method.
 * Returns the matching adapter or null if no platform is recognized.
 */
export function detectPlatform(): PlatformAdapter | null {
  for (const adapter of adapters) {
    try {
      if (adapter.detect()) {
        console.log(`[Lucid] Detected platform: ${adapter.displayName}`);
        return adapter;
      }
    } catch (err) {
      console.warn(`[Lucid] Error detecting ${adapter.displayName}:`, err);
    }
  }

  console.log("[Lucid] No supported platform detected on this page.");
  return null;
}
