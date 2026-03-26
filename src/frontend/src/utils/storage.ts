// StorageManager - single source of truth for all localStorage operations
// CRITICAL: Never overwrite existing data with empty arrays

export const STORAGE_KEYS = {
  catalog: "clikmate_catalog_items",
  staff: "clikmate_staff_members",
  khata: "clikmate_khata_entries",
  clockIn: "clikmate_clock_in_log",
  posSales: "clikmate_pos_sales",
  orders: "clikmate_orders",
  manualIncomes: "clikmate_manual_incomes",
  expenses: "clikmate_expenses",
  typesettingQuotes: "clikmate_typesetting_quotes",
  reviews: "clikmate_reviews",
} as const;

export function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function storageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// Add item to array in localStorage, returns new array
export function storageAddItem<T extends { id: unknown }>(
  key: string,
  item: T,
): T[] {
  const existing = storageGet<T[]>(key, []);
  const updated = [
    item,
    ...existing.filter((i) => String(i.id) !== String(item.id)),
  ];
  storageSet(key, updated);
  return updated;
}

// Update item in array by id
export function storageUpdateItem<T extends { id: unknown }>(
  key: string,
  id: unknown,
  // biome-ignore lint/suspicious/noExplicitAny: patch can be any object shape
  patch: any,
): T[] {
  const existing = storageGet<T[]>(key, []);
  const updated = existing.map((i) =>
    String(i.id) === String(id) ? { ...i, ...patch } : i,
  );
  storageSet(key, updated);
  return updated;
}

// Remove item from array by id
export function storageRemoveItem<T extends { id: unknown }>(
  key: string,
  id: unknown,
): T[] {
  const existing = storageGet<T[]>(key, []);
  const updated = existing.filter((i) => String(i.id) !== String(id));
  storageSet(key, updated);
  return updated;
}

// Generate next Mall-style SKU based on existing catalog items
export function generateProductId(
  existingItems: Array<{ productId?: string }>,
): string {
  let max = 1000;
  for (const item of existingItems) {
    if (item.productId?.startsWith("ITM-")) {
      const num = Number.parseInt(item.productId.replace("ITM-", ""), 10);
      if (!Number.isNaN(num) && num >= max) max = num + 1;
    }
  }
  return `ITM-${max}`;
}
