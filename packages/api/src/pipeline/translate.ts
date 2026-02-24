// ============================================
// LUCID API — Pipeline Layer 1: Intent Translation (Haiku)
// ============================================
// Decomposes raw user intent into a structured prompt using Claude Haiku.

import Anthropic from "@anthropic-ai/sdk";
import type {
  EnhancementMode,
  StructuredPrompt,
  PersonalizationProfile,
} from "@lucid/shared";
import {
  applyPersonalization,
  shouldApplyPersonalization,
} from "../services/personalization";

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

const MODE_SYSTEM_PROMPTS: Record<EnhancementMode, string> = {
  enhance: `You are an expert prompt engineer. Decompose the user's intent into a structured prompt with distinct components. Analyze what they're trying to accomplish and create a comprehensive, well-structured prompt that will produce excellent results.

Your job is to take a rough intent and produce a structured prompt with these fields:
- role: The ideal persona/expert the AI should adopt (null if not applicable)
- context: Background information and situation framing (null if obvious)
- task: The specific, clear instruction of what needs to be done (REQUIRED)
- format: The desired output format or structure (null if unspecified)
- constraints: Limitations, boundaries, or specific requirements (null if none)
- tone: The desired communication style (null if unspecified)`,

  expand: `You are an expert prompt engineer specializing in expansion. Take the user's brief notes or shorthand intent and expand them into a comprehensive, detailed structured prompt. Fill in implied context, add specificity, and flesh out the request into something an AI can work with excellently.

Expand the brief input into these fields:
- role: The ideal persona/expert the AI should adopt (null if not applicable)
- context: Detailed background information expanded from the brief notes (null if obvious)
- task: A thorough, specific instruction expanded from the shorthand (REQUIRED)
- format: Suggested output format that best serves the intent (null if unspecified)
- constraints: Relevant limitations or quality requirements (null if none)
- tone: Appropriate communication style for the context (null if unspecified)`,

  refine: `You are an expert prompt engineer specializing in optimization. Take the user's existing prompt and optimize it for clarity, specificity, and effectiveness. Preserve the original intent while making the prompt more likely to produce excellent results.

Refine the existing prompt into these fields:
- role: Optimized persona (null if not applicable)
- context: Clarified and focused context (null if obvious)
- task: Sharpened, more specific instruction (REQUIRED)
- format: Better-defined output format (null if unspecified)
- constraints: Clarified boundaries (null if none)
- tone: More precisely defined style (null if unspecified)`,

  simplify: `You are an expert prompt engineer specializing in distillation. Take the user's prompt and distill it to its essential elements, removing unnecessary complexity, verbosity, and redundancy. Keep only what matters for producing the desired result.

Simplify into these fields:
- role: Essential persona only (null if not needed)
- context: Only critical context (null if not needed)
- task: The core instruction, stripped to essentials (REQUIRED)
- format: Simple format directive if needed (null if obvious)
- constraints: Only critical constraints (null if none)
- tone: Only if essential to the task (null otherwise)`,
};

export async function translate(
  intent: string,
  mode: EnhancementMode,
  personalization: PersonalizationProfile | null
): Promise<StructuredPrompt> {
  const anthropic = getAnthropic();
  let systemPrompt = MODE_SYSTEM_PROMPTS[mode];

  // Apply personalization if profile meets cold start threshold
  if (personalization && shouldApplyPersonalization(personalization)) {
    systemPrompt = applyPersonalization(personalization, systemPrompt);
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: `${systemPrompt}

## Output Format
You MUST respond with valid JSON matching this exact structure:
{
  "role": "string or null",
  "context": "string or null",
  "task": "string (required)",
  "format": "string or null",
  "constraints": "string or null",
  "tone": "string or null"
}

Respond with ONLY the JSON object. No markdown fences, no explanation.`,
    messages: [
      {
        role: "user",
        content: intent,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let parsed: Record<string, string | null>;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    // Attempt to extract JSON from response if wrapped in markdown
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse structured prompt from Claude response");
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  if (!parsed.task || typeof parsed.task !== "string") {
    throw new Error("Claude response missing required 'task' field");
  }

  return {
    role: parsed.role || null,
    context: parsed.context || null,
    task: parsed.task,
    format: parsed.format || null,
    constraints: parsed.constraints || null,
    tone: parsed.tone || null,
    assembled: "", // Will be set by assemble step
  };
}
