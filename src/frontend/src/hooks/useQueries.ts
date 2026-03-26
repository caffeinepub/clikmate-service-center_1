import type { CatalogItem } from "../backend.d";
import { STORAGE_KEYS, storageGet } from "../utils/storage";

export function usePublishedCatalogItems() {
  const items = storageGet<CatalogItem[]>(STORAGE_KEYS.catalog, []);
  const data = items.filter((i) => i.published);
  return { data, isLoading: false };
}

export function useAllCatalogItems() {
  const data = storageGet<CatalogItem[]>(STORAGE_KEYS.catalog, []);
  return { data, isLoading: false };
}

export function useCatalogItem(id: bigint | null) {
  const items = storageGet<CatalogItem[]>(STORAGE_KEYS.catalog, []);
  const data =
    id !== null
      ? (items.find((i) => String(i.id) === String(id)) ?? null)
      : null;
  return { data, isLoading: false };
}
