import { useQuery } from "@tanstack/react-query";
import type { CatalogItem, backendInterface } from "../backend.d";
import { useActor } from "./useActor";

// The backendInterface in backend.d.ts includes catalog methods
// (the auto-generated backend.ts may lag behind; cast as needed)
type ActorWithCatalog = backendInterface;

export function usePublishedCatalogItems() {
  const { actor, isFetching } = useActor();
  return useQuery<CatalogItem[]>({
    queryKey: ["catalog", "published"],
    queryFn: async () => {
      if (!actor) return [];
      return (actor as unknown as ActorWithCatalog).getPublishedCatalogItems();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAllCatalogItems() {
  const { actor, isFetching } = useActor();
  return useQuery<CatalogItem[]>({
    queryKey: ["catalog", "all"],
    queryFn: async () => {
      if (!actor) return [];
      return (actor as unknown as ActorWithCatalog).getAllCatalogItems();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCatalogItem(id: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<CatalogItem | null>({
    queryKey: ["catalog", "item", id?.toString()],
    queryFn: async () => {
      if (!actor || id === null) return null;
      return (actor as unknown as ActorWithCatalog).getCatalogItem(id);
    },
    enabled: !!actor && !isFetching && id !== null,
  });
}
