// ============================================
// LUCID Extension — Gemini DOM Adapter
// ============================================

import type { PlatformAdapter } from "./types";

const INPUT_SELECTORS = [
  ".ql-editor[contenteditable='true']",
  'div[contenteditable="true"].ql-editor',
  'rich-textarea div[contenteditable="true"]',
  ".input-area div[contenteditable='true']",
  'div[contenteditable="true"][aria-label*="prompt"]',
  'div[contenteditable="true"]',
] as const;

const BUTTON_AREA_SELECTORS = [
  'button[aria-label="Send message"]',
  'button.send-button',
  ".input-area button[mattooltip]",
  ".input-area-container button:last-of-type",
] as const;

export class GeminiAdapter implements PlatformAdapter {
  readonly name = "gemini" as const;
  readonly displayName = "Gemini";

  detect(): boolean {
    return window.location.hostname === "gemini.google.com";
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
    return this.extractQuillText(el);
  }

  setInputText(text: string): void {
    const el = this.getInputElement();
    if (!el) return;

    // Gemini uses a Quill-like editor — set content as paragraphs
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

    // Fallback: look for the input area container
    const inputArea =
      document.querySelector(".input-area-container") ||
      document.querySelector(".input-area") ||
      document.querySelector("rich-textarea");

    if (inputArea) {
      const buttons = inputArea.querySelectorAll("button");
      const lastButton = buttons[buttons.length - 1];
      if (lastButton?.parentElement) return lastButton.parentElement;
    }

    return null;
  }

  triggerInputEvent(): void {
    const el = this.getInputElement();
    if (!el) return;

    // Dispatch standard input events
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    // Gemini may also listen for text-change on its editor
    el.dispatchEvent(new CustomEvent("text-change", { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  }

  private extractQuillText(el: HTMLElement): string {
    // Quill editors use <p> elements
    const paragraphs = el.querySelectorAll("p");
    if (paragraphs.length > 0) {
      return Array.from(paragraphs)
        .map((p) => p.textContent || "")
        .join("\n")
        .trim();
    }

    // Fallback
    return el.textContent?.trim() || "";
  }
}
