// ============================================
// LUCID Extension — Claude.ai DOM Adapter
// ============================================

import type { PlatformAdapter } from "./types";

const INPUT_SELECTORS = [
  ".ProseMirror[contenteditable='true']",
  'div[contenteditable="true"].ProseMirror',
  'fieldset div[contenteditable="true"]',
  'div[contenteditable="true"]',
] as const;

const BUTTON_AREA_SELECTORS = [
  'button[aria-label="Send Message"]',
  'button[aria-label="Send message"]',
  'fieldset button[type="button"]',
  "fieldset > div > button:last-of-type",
] as const;

export class ClaudeAdapter implements PlatformAdapter {
  readonly name = "claude" as const;
  readonly displayName = "Claude";

  detect(): boolean {
    return window.location.hostname === "claude.ai";
  }

  getInputElement(): HTMLElement | null {
    for (const selector of INPUT_SELECTORS) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) return el;
    }
    return null;
  }

  getInputText(): string {
    const el = this.getInputElement();
    if (!el) return "";
    return this.extractProseMirrorText(el);
  }

  setInputText(text: string): void {
    const el = this.getInputElement();
    if (!el) return;

    // Claude uses ProseMirror — we need to set content in a way it recognizes.
    // Clear existing content first.
    el.innerHTML = "";

    const lines = text.split("\n");
    for (const line of lines) {
      const p = document.createElement("p");
      if (line.trim() === "") {
        p.innerHTML = "<br>";
      } else {
        p.textContent = line;
      }
      el.appendChild(p);
    }

    this.triggerInputEvent();
    el.focus();
  }

  getButtonInjectionPoint(): HTMLElement | null {
    for (const selector of BUTTON_AREA_SELECTORS) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el?.parentElement) return el.parentElement;
    }

    // Fallback: find the fieldset container
    const fieldset = document.querySelector("fieldset");
    if (fieldset) {
      const buttons = fieldset.querySelectorAll("button");
      const lastButton = buttons[buttons.length - 1];
      if (lastButton?.parentElement) return lastButton.parentElement;
    }

    return null;
  }

  triggerInputEvent(): void {
    const el = this.getInputElement();
    if (!el) return;

    // ProseMirror listens for input events on the contenteditable
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    // Also dispatch a keyup to trigger any validation
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  }

  private extractProseMirrorText(el: HTMLElement): string {
    // ProseMirror stores content in <p> tags
    const paragraphs = el.querySelectorAll("p");
    if (paragraphs.length > 0) {
      return Array.from(paragraphs)
        .map((p) => p.textContent || "")
        .join("\n")
        .trim();
    }

    // Fallback: raw text content
    return el.textContent?.trim() || "";
  }
}
