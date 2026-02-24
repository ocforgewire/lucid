// ============================================
// LUCID Extension — Platform Adapter Interface
// ============================================

import type { TargetModel } from "@lucid/shared";

export interface PlatformAdapter {
  /** Which AI model this adapter targets */
  readonly name: TargetModel;

  /** Human-readable platform name */
  readonly displayName: string;

  /** Check if this adapter matches the current page */
  detect(): boolean;

  /** Find the chat input element on the page */
  getInputElement(): HTMLElement | null;

  /** Read the current text from the chat input */
  getInputText(): string;

  /** Replace the chat input text with new content */
  setInputText(text: string): void;

  /** Find the DOM element near which the Lucid button should be injected */
  getButtonInjectionPoint(): HTMLElement | null;

  /** Dispatch synthetic events so the platform recognizes the text change */
  triggerInputEvent(): void;
}
