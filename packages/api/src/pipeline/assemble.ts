// ============================================
// LUCID API — Pipeline Layer 3: Prompt Assembly
// ============================================
// Final assembly of the structured prompt. If the optimize step already
// set `assembled`, we use that. Otherwise, build a clean default format.

import type { StructuredPrompt } from "@lucid/shared";

export function assemble(prompt: StructuredPrompt): StructuredPrompt {
  // If optimize already set the assembled field, return as-is
  if (prompt.assembled && prompt.assembled.length > 0) {
    return prompt;
  }

  // Fallback: generic assembly for any case where optimize didn't run
  const parts: string[] = [];

  if (prompt.role) {
    parts.push(`You are ${prompt.role}.`);
  }

  if (prompt.context) {
    parts.push(prompt.context);
  }

  parts.push(prompt.task);

  if (prompt.constraints) {
    parts.push(`Constraints: ${prompt.constraints}`);
  }

  if (prompt.format) {
    parts.push(`Output format: ${prompt.format}`);
  }

  if (prompt.tone) {
    parts.push(`Tone: ${prompt.tone}`);
  }

  return {
    ...prompt,
    assembled: parts.join("\n\n"),
  };
}
