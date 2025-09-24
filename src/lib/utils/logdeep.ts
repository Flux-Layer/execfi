// logger.ts
type InspectOpts = {
  depth?: number; // max recursion depth
  maxEntries?: number; // max props per object / items per array
};

const DEFAULT_OPTS: Required<InspectOpts> = { depth: 6, maxEntries: 200 };

/**
 * Build a safe, plain snapshot of any value for logging.
 * - Does NOT trigger toJSON().
 * - Catches getter errors.
 * - Handles circular refs.
 * - Preserves types via readable placeholders.
 */
export function snapshotForLog(value: any, opts: InspectOpts = {}) {
  const { depth, maxEntries } = { ...DEFAULT_OPTS, ...opts };
  const seen = new WeakMap<object, string>();

  const isPlainObject = (v: any) =>
    Object.prototype.toString.call(v) === "[object Object]";

  const safeGet = (obj: any, key: PropertyKey) => {
    try {
      // Use Reflect.get to respect getters; catch if they throw
      return Reflect.get(obj, key, obj);
    } catch (e: any) {
      return `[Getter threw: ${e?.message || e}]`;
    }
  };

  const _walk = (v: any, d: number, path: string): any => {
    // Depth limit
    if (d < 0) return `[Depth limit reached at ${path}]`;

    // Primitives
    if (v === null) return null;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") return v;
    if (t === "undefined") return "[undefined]";
    if (t === "bigint") return `${v.toString()}n`;
    if (t === "symbol") return v.toString();
    if (t === "function") return `[Function: ${v.name || "anonymous"}]`;

    // Objects
    if (seen.has(v)) return `[Circular -> ${seen.get(v)}]`;
    if (v instanceof Error) {
      return {
        __type: "Error",
        name: v.name,
        message: v.message,
        stack: v.stack,
      };
    }
    if (v instanceof Date) return { __type: "Date", iso: v.toISOString() };
    if (v instanceof RegExp) return v.toString();

    // Map / Set
    if (v instanceof Map) {
      seen.set(v, path);
      const arr: any[] = [];
      let i = 0;
      for (const [k, val] of v) {
        if (i++ >= maxEntries) {
          arr.push(`[... ${v.size - maxEntries} more]`);
          break;
        }
        arr.push([
          _walk(k, d - 1, `${path}.<key>`),
          _walk(val, d - 1, `${path}.<val>`),
        ]);
      }
      return { __type: "Map", entries: arr };
    }
    if (v instanceof Set) {
      seen.set(v, path);
      const arr: any[] = [];
      let i = 0;
      for (const val of v) {
        if (i++ >= maxEntries) {
          arr.push(`[... ${v.size - maxEntries} more]`);
          break;
        }
        arr.push(_walk(val, d - 1, `${path}[]`));
      }
      return { __type: "Set", values: arr };
    }

    // Array
    if (Array.isArray(v)) {
      seen.set(v, path);
      const out: any[] = [];
      const len = Math.min(v.length, maxEntries);
      for (let i = 0; i < len; i++)
        out.push(_walk(v[i], d - 1, `${path}[${i}]`));
      if (v.length > maxEntries)
        out.push(`[... ${v.length - maxEntries} more]`);
      return out;
    }

    // Generic object (avoid calling v.toJSON on purpose)
    if (typeof v === "object") {
      seen.set(v, path);

      // Try to label known SDK instances without crawling too deep
      const ctor = (v as any)?.constructor?.name;
      const header: Record<string, any> =
        ctor && ctor !== "Object" ? { __class: ctor } : {};

      const out: Record<string, any> = { ...header };
      const keys = [
        ...Object.getOwnPropertyNames(v),
        // Symbols are often not needed for logging; skip by default
        // ...Object.getOwnPropertySymbols(v) as any,
      ];

      let count = 0;
      for (const key of keys) {
        if (count++ >= maxEntries) {
          out["[truncated]"] = `... ${keys.length - maxEntries} more props`;
          break;
        }
        const val = safeGet(v, key as any);
        out[String(key)] = _walk(val, d - 1, `${path}.${String(key)}`);
      }
      return out;
    }

    // Fallback
    try {
      return String(v);
    } catch {
      return "[Unserializable]";
    }
  };

  return _walk(value, depth, "$");
}

/** Stringify a snapshot for console/file logs. */
export function safeStringifyForLog(value: any, opts?: InspectOpts, space = 2) {
  const snap = snapshotForLog(value, opts);
  return JSON.stringify(snap, null, space);
}

/** Convenience logger */
export function logDeep(label: string, value: any, opts?: InspectOpts) {
  try {
    console.log(`${label}:`, safeStringifyForLog(value, opts));
  } catch (e) {
    console.error(`Failed to stringify ${label}:`, e);
    // As a last resort, let DevTools handle it (expandable object)
    console.dir(value, { depth: null });
  }
}
