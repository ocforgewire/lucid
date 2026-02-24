// ============================================
// LUCID Extension — ChatGPT DOM Adapter
// ============================================

import type { PlatformAdapter } from "./types";

const INPUT_SELECTORS = [
  "#prompt-textarea",
  'div[contenteditable="true"][id="prompt-textarea"]',
  'textarea[data-id="root"]',
  "form textarea",
  'div[contenteditable="true"]',
] as const;

const BUTTON_AREA_SELECTORS = [
  'button[data-testid="send-button"]',
  'form button[aria-label="Send prompt"]',
  'button[aria-label="Send"]',
  "form button:last-of-type",
] as const;

export class ChatGPTAdapter implements PlatformAdapter {
  readonly name = "chatgpt" as const;
  readonly displayName = "ChatGPT";

  detect(): boolean {
    const { hostname } = window.location;
    return hostname === "chatgpt.com" || hostname === "chat.openai.com";
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

    if (el instanceof HTMLTextAreaElement) {
      return el.value;
    }

    // contenteditable — get text content, preserving line breaks from <p> and <br>
    return this.extractTextFromContentEditable(el);
  }

  setInputText(text: string): void {
    const el = this.getInputElement();
    if (!el) return;

    if (el instanceof HTMLTextAreaElement) {
      // Native textarea — set value directly
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(el, text);
      } else {
        el.value = text;
      }
    } else {
      // contenteditable div — set as paragraph elements
      const lines = text.split("\n");
      el.innerHTML = lines
        .map((line) => `<p>${line || "<br>"}</p>`)
        .join("");
    }

    this.triggerInputEvent();
    el.focus();
  }

  getButtonInjectionPoint(): HTMLElement | null {
    for (const selector of BUTTON_AREA_SELECTORS) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el?.parentElement) return el.parentElement;
    }

    // Fallback: find the form and use its last child container
    const form = document.querySelector("form");
    if (form) {
      const buttons = form.querySelectorAll("button");
      const lastButton = buttons[buttons.length - 1];
      if (lastButton?.parentElement) return lastButton.parentElement;
    }

    return null;
  }

  triggerInputEvent(): void {
    const el = this.getInputElement();
    if (!el) return;

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    // React-specific: trigger on the native event handler
    const reactKey = Object.keys(el).find((k) =>
      k.startsWith("__reactProps$"),
    );
    if (reactKey) {
      const props = (el as Record<string, unknown>)[reactKey] as
        | Record<string, unknown>
        | undefined;
      if (props?.onChange && typeof props.onChange === "function") {
        props.onChange({ target: el });
      }
    }
  }

  private extractTextFromContentEditable(el: HTMLElement): string {
    const lines: string[] = [];
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        lines.push(child.textContent || "");
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = (child as HTMLElement).tagName?.toLowerCase();
        if (tag === "br") {
          lines.push("");
        } else {
          lines.push((child as HTMLElement).textContent || "");
        }
      }
    }
    return lines.join("\n").trim();
  }
}
