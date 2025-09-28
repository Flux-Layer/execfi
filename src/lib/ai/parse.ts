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
  const okField = parsed.ok;
  if (typeof okField !== 'boolean' && okField !== 'chat' && okField !== 'tokenSelection') return false;

  if (okField === true) {
    // Success case - must have 'intent' field
    return parsed.intent && typeof parsed.intent === 'object';
  } else if (okField === false) {
    // Clarify case - must have 'clarify' and 'missing' fields
    return (
      typeof parsed.clarify === 'string' &&
      Array.isArray(parsed.missing)
    );
  } else if (okField === 'chat') {
    // Chat case - must have 'response' field
    return typeof parsed.response === 'string' && parsed.response.length > 0;
  } else if (okField === 'tokenSelection') {
    // Token selection case - must have 'tokenSelection' field with message and tokens array
    return (
      parsed.tokenSelection &&
      typeof parsed.tokenSelection === 'object' &&
      typeof parsed.tokenSelection.message === 'string' &&
      Array.isArray(parsed.tokenSelection.tokens)
    );
  }

  return false;
}