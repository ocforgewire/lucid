// ============================================
// LUCID API — Pipeline Layer 2: Model-Specific Optimization (Rule Engine)
// ============================================
// Pure deterministic rules — NO LLM calls. Formats the structured prompt
// according to each target model's known preferences.

import type { StructuredPrompt, TargetModel } from "@lucid/shared";

// --- Claude Optimization ---
// Claude responds well to XML-structured prompts with context front-loaded.

function optimizeForClaude(prompt: StructuredPrompt): StructuredPrompt {
  const sections: string[] = [];

  if (prompt.role) {
    sections.push(`<role>\n${prompt.role}\n</role>`);
  }

  if (prompt.context) {
    sections.push(`<context>\n${prompt.context}\n</context>`);
  }

  sections.push(`<task>\n${prompt.task}\n</task>`);

  if (prompt.constraints) {
    sections.push(`<constraints>\n${prompt.constraints}\n</constraints>`);
  }

  if (prompt.format) {
    sections.push(`<format>\n${prompt.format}\n</format>`);
  }

  if (prompt.tone) {
    sections.push(`<tone>\n${prompt.tone}\n</tone>`);
  }

  // Add chain-of-thought for complex tasks (heuristic: task length > 200 chars)
  if (prompt.task.length > 200) {
    sections.push(
      "<instructions>\nThink step by step before providing your final answer.\n</instructions>"
    );
  }

  return {
    ...prompt,
    assembled: sections.join("\n\n"),
  };
}

// --- ChatGPT Optimization ---
// GPT models prefer numbered instructions with explicit output format.

function optimizeForChatGPT(prompt: StructuredPrompt): StructuredPrompt {
  const sections: string[] = [];
  let instructionNum = 1;

  if (prompt.role) {
    sections.push(`**Role:** ${prompt.role}`);
  }

  if (prompt.context) {
    sections.push(`**Background:** ${prompt.context}`);
  }

  sections.push(`**Instructions:**`);
  sections.push(`${instructionNum}. ${prompt.task}`);
  instructionNum++;

  if (prompt.constraints) {
    sections.push(`${instructionNum}. Constraints: ${prompt.constraints}`);
    instructionNum++;
  }

  if (prompt.tone) {
    sections.push(`${instructionNum}. Use a ${prompt.tone} tone throughout.`);
    instructionNum++;
  }

  if (prompt.format) {
    sections.push(`\n**Output Format:** ${prompt.format}`);
  }

  // Add working-through encouragement for complex tasks
  if (prompt.task.length > 200) {
    sections.push(
      `\nLet's work through this systematically.`
    );
  }

  return {
    ...prompt,
    assembled: sections.join("\n"),
  };
}

// --- Gemini Optimization ---
// Gemini prefers concise, task-first prompts with clear delimiters.

function optimizeForGemini(prompt: StructuredPrompt): StructuredPrompt {
  const sections: string[] = [];

  // Task first for Gemini
  sections.push(`TASK: ${prompt.task}`);

  if (prompt.context) {
    sections.push(`---\nCONTEXT: ${prompt.context}`);
  }

  if (prompt.role) {
    sections.push(`---\nROLE: ${prompt.role}`);
  }

  if (prompt.constraints) {
    sections.push(`---\nCONSTRAINTS: ${prompt.constraints}`);
  }

  if (prompt.format) {
    sections.push(`---\nFORMAT: ${prompt.format}`);
  }

  if (prompt.tone) {
    sections.push(`---\nTONE: ${prompt.tone}`);
  }

  return {
    ...prompt,
    assembled: sections.join("\n"),
  };
}

// --- Public API ---

const optimizers: Record<
  TargetModel,
  (prompt: StructuredPrompt) => StructuredPrompt
> = {
  claude: optimizeForClaude,
  chatgpt: optimizeForChatGPT,
  gemini: optimizeForGemini,
};

export function optimize(
  prompt: StructuredPrompt,
  targetModel: TargetModel
): StructuredPrompt {
  const optimizer = optimizers[targetModel];
  if (!optimizer) {
    throw new Error(`Unsupported target model: ${targetModel}`);
  }
  return optimizer(prompt);
}
