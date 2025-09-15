// app/api/intent/route.ts - Server-side intent parsing API

import { NextResponse } from "next/server";
import { parseAiJson, validateIntentShape } from "@/lib/ai/parse";
import { validateIntent, type Intent } from "@/lib/ai/schema";
import { INTENT_SYSTEM_PROMPT, STRICT_JSON_RETRY_PROMPT } from "@/lib/ai/prompts";

class IntentParseError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "IntentParseError";
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { prompt: string };
    const prompt = body.prompt;

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "Empty prompt provided", code: "EMPTY_PROMPT" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured", code: "MISSING_API_KEY" },
        { status: 500 }
      );
    }

    try {
      // First attempt with standard prompt
      const result = await callOpenRouter(prompt, INTENT_SYSTEM_PROMPT, apiKey);
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof IntentParseError && error.code === "OFF_POLICY_JSON") {
        console.warn("First attempt failed, retrying with stricter prompt");

        try {
          // Retry with stricter instruction
          const retryResult = await callOpenRouter(prompt, STRICT_JSON_RETRY_PROMPT, apiKey);
          return NextResponse.json({ success: true, data: retryResult });
        } catch {
          // If retry also fails, return error
          return NextResponse.json(
            {
              error: 'Failed to get valid JSON after retry. Try: "transfer 0.02 ETH on base to 0x..."',
              code: "OFF_POLICY_JSON"
            },
            { status: 400 }
          );
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("Intent parsing error:", error);

    if (error instanceof IntentParseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * Internal function to call OpenRouter API
 */
async function callOpenRouter(prompt: string, systemPrompt: string, apiKey: string): Promise<Intent> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_NAME || "kentank",
      "X-Title": process.env.NEXT_PUBLIC_PROJECT_ID || "kentank",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      temperature: 0, // Deterministic output
      max_tokens: 500, // Keep responses short
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt.trim() },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new IntentParseError(
      `OpenRouter API error: ${response.status} ${errorText}`,
      "API_ERROR"
    );
  }

  const data: any = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new IntentParseError("No response from OpenRouter", "NO_RESPONSE");
  }

  const rawContent = data.choices[0].message.content;

  try {
    // Parse and sanitize the JSON
    const parsed = parseAiJson(rawContent);

    // Basic shape validation
    if (!validateIntentShape(parsed)) {
      throw new IntentParseError("Invalid response shape", "OFF_POLICY_JSON");
    }

    // Strict schema validation with Zod
    const validatedIntent = validateIntent(parsed);

    return validatedIntent;
  } catch (error) {
    if (error instanceof Error) {
      // Map specific parsing errors
      if (error.message.includes("No valid JSON")) {
        throw new IntentParseError(
          "Response was not valid JSON",
          "OFF_POLICY_JSON"
        );
      }

      if (error.message.includes("Failed to parse JSON")) {
        throw new IntentParseError(
          "Malformed JSON in response",
          "OFF_POLICY_JSON"
        );
      }
    }

    throw new IntentParseError(
      `Parse error: ${error instanceof Error ? error.message : "Unknown error"}`,
      "PARSE_ERROR"
    );
  }
}