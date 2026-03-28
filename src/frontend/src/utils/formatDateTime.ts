/**
 * Shared date-time formatting utility for ClikMate ERP.
 * Output format: "28 Mar 2026, 03:45 PM"
 */
export function formatDateTime(ts: bigint | number | string | Date): string {
  let ms: number;
  if (typeof ts === "bigint")
    ms = Number(ts) / 1_000_000; // Motoko nanoseconds
  else if (ts instanceof Date) ms = ts.getTime();
  else if (typeof ts === "string")
    ms = Number.isNaN(Number(ts)) ? new Date(ts).getTime() : Number(ts);
  else ms = ts;

  // Heuristic: if the number is > 1e15, it's nanoseconds (Motoko bigint stored as number)
  if (typeof ts === "number" && ts > 1e15) ms = ts / 1_000_000;

  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format a date-only string (YYYY-MM-DD) with time if available.
 * Returns "28 Mar 2026" for date-only strings, or full datetime if timestamp.
 */
export function formatDateOnly(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
