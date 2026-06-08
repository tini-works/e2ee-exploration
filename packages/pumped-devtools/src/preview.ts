/**
 * Render any atom value to a short, safe, single-string preview. Class
 * instances (MatrixClient, Date, Map, …) collapse to `[Ctor]` so we never try
 * to JSON-stringify a live SDK object; plain data is shown as compact JSON.
 */
export function previewValue(value: unknown, maxLen = 140): string {
  const raw = stringify(value);
  return raw.length > maxLen ? `${raw.slice(0, maxLen - 1)}…` : raw;
}

function stringify(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "number" || t === "boolean" || t === "bigint") return String(value);
  if (t === "function") return `ƒ ${(value as () => void).name || "anonymous"}()`;
  if (t === "symbol") return String(value);

  if (Array.isArray(value)) {
    return `[${value.length}] ${safeJson(value)}`;
  }

  if (t === "object") {
    const ctor = (value as object).constructor?.name;
    // Anything that isn't a plain object/array is almost certainly a live
    // instance (MatrixClient, Date, Map, Set, …) — don't walk it.
    if (ctor && ctor !== "Object") {
      if (value instanceof Date) return value.toISOString();
      if (value instanceof Map) return `Map(${value.size})`;
      if (value instanceof Set) return `Set(${value.size})`;
      return `[${ctor}]`;
    }
    return safeJson(value);
  }

  return t;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, replacer) ?? String(value);
  } catch {
    return "[unserializable]";
  }
}

// Guard against the odd nested non-plain object inside otherwise-plain data.
function replacer(_key: string, val: unknown): unknown {
  if (val && typeof val === "object") {
    const ctor = (val as object).constructor?.name;
    if (ctor && ctor !== "Object" && !Array.isArray(val)) {
      if (val instanceof Date) return val.toISOString();
      return `[${ctor}]`;
    }
  }
  if (typeof val === "bigint") return `${val}n`;
  if (typeof val === "function") return "[function]";
  return val;
}
