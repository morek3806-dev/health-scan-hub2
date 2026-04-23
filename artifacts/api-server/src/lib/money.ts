export function asInt(v: unknown, fallback = 0): number {
  if (typeof v === "number") return Math.trunc(v);
  if (typeof v === "string") return Math.trunc(Number(v) || fallback);
  if (typeof v === "bigint") return Number(v);
  return fallback;
}
