import { useEffect, useState } from "react";
import type { CatalogItem } from "../backend.d";
import {
  fsGetCollection,
  fsSubscribeCollection,
} from "../utils/firestoreService";

export function usePublishedCatalogItems() {
  const [data, setData] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = fsSubscribeCollection<any>("catalog", (items: any[]) => {
      setData(items.filter((i) => i.published));
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  return { data, isLoading };
}

export function useAllCatalogItems() {
  const [data, setData] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = fsSubscribeCollection<any>("catalog", (items: any[]) => {
      setData(items);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  return { data, isLoading };
}

export function useCatalogItem(id: bigint | null) {
  const [data, setData] = useState<CatalogItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id === null) {
      setData(null);
      setIsLoading(false);
      return;
    }
    fsGetCollection<any>("catalog")
      .then((items) => {
        setData(items.find((i) => String(i.id) === String(id)) ?? null);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [id]);

  return { data, isLoading };
}
