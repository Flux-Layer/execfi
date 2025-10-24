export function debugLog(...args: unknown[]) {
  if (process.env.NEXT_PUBLIC_DEBUG_LOGS === "true") {
    console.log(...args);
  }
}
