// lib/ai/parse.ts - AI JSON sanitizer utility

/**
 * Sanitizes and parses AI-generated JSON responses
 * Handles common AI output issues like code fences, prose, etc.
 */
export function parseAiJson(raw: string): any {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Invalid input: expected non-empty string');
  }

  let cleaned = raw.trim();

  // Remove common AI wrapper patterns
  // Remove markdown code fences
  cleaned = cleaned.replace(/```json\s*/gi, '');
  cleaned = cleaned.replace(/```\s*/g, '');

  // Remove any leading/trailing prose
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No valid JSON object found in response');
  }

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    // Try to fix common JSON issues
    try {
      // Fix trailing commas
      const fixed = cleaned.replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(fixed);
    } catch {
      throw new Error(`Failed to parse JSON: ${(error as Error).message}`);
    }
  }
}

/**
 * Validates that the parsed JSON matches the expected shape
 */
export function validateIntentShape(parsed: any): boolean {
  if (!parsed || typeof parsed !== 'object') return false;

  // Must have 'ok' field
  if (typeof parsed.ok !== 'boolean') return false;

  if (parsed.ok === true) {
    // Success case - must have 'intent' field
    return parsed.intent && typeof parsed.intent === 'object';
  } else {
    // Clarify case - must have 'clarify' and 'missing' fields
    return (
      typeof parsed.clarify === 'string' &&
      Array.isArray(parsed.missing)
    );
  }
}