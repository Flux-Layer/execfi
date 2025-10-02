// lib/ai/intent.ts - Client-side intent parsing via API route

import { type Intent, type IntentSuccess, type IntentClarify, type IntentChat } from "./schema";

export class IntentParseError extends Error {
   constructor(
      message: string,
      public code: string,
   ) {
      super(message);
      this.name = "IntentParseError";
   }
}

/**
 * Parse natural language prompt into structured intent using server-side API
 * Returns either success intent or clarification request
 */
export async function parseIntent(prompt: string): Promise<Intent> {
   if (!prompt?.trim()) {
      throw new IntentParseError("Empty prompt provided", "EMPTY_PROMPT");
   }

   try {
      const response = await fetch("/api/intent", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
         throw new IntentParseError(
            data.error || "Failed to parse intent",
            data.code || "API_ERROR"
         );
      }

      if (!data.success || !data.data) {
         throw new IntentParseError(
            "Invalid response from intent API",
            "INVALID_RESPONSE"
         );
      }

      return data.data as Intent;
   } catch (error) {
      if (error instanceof IntentParseError) {
         throw error;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
         throw new IntentParseError(
            "Failed to connect to AI service",
            "NETWORK_ERROR"
         );
      }

      throw new IntentParseError(
         `Parse error: ${error instanceof Error ? error.message : "Unknown error"}`,
         "PARSE_ERROR"
      );
   }
}



// Export types for use in other modules
export type { Intent, IntentSuccess, IntentClarify, IntentChat };
