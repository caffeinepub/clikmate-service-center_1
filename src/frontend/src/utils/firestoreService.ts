import { db } from "@/firebase";
/**
 * firestoreService.ts
 * Async Firestore data layer — replaces synchronous StorageManager.
 * All operations are async; components should await them and update state.
 */
import {
  type Unsubscribe,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

// ── Collection names ────────────────────────────────────────────────────────
export const FS_COLLECTIONS = {
  catalog: "catalog",
  categories: "categories",
  orders: "orders",
  khata: "khata",
  attendance: "attendance",
  users: "users",
  settings: "settings",
  posSales: "orders",
} as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Fetch all docs from a collection as typed array */
export async function fsGetCollection<T extends { id?: string }>(
  col: string,
): Promise<T[]> {
  const snap = await getDocs(collection(db, col));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

/** Set (create/overwrite) a document by explicit id */
export async function fsSetDoc<T extends object>(
  col: string,
  id: string,
  data: T,
): Promise<void> {
  await setDoc(doc(db, col, id), data);
}

/** Add a new document (Firestore auto-id), returns the new document id */
export async function fsAddDoc<T extends object>(
  col: string,
  data: T,
): Promise<string> {
  const ref = await addDoc(collection(db, col), data);
  return ref.id;
}

/** Partial update of an existing document by id */
export async function fsUpdateDoc<T extends object>(
  col: string,
  id: string,
  patch: Partial<T>,
): Promise<void> {
  await updateDoc(doc(db, col, id), patch as Record<string, unknown>);
}

/** Delete a document by id */
export async function fsDeleteDoc(col: string, id: string): Promise<void> {
  await deleteDoc(doc(db, col, id));
}

/**
 * Subscribe to real-time updates on a collection.
 * Returns an unsubscribe function to be called on component unmount.
 */
export function fsSubscribeCollection<T extends object>(
  col: string,
  callback: (items: T[]) => void,
): Unsubscribe {
  return onSnapshot(collection(db, col), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
    callback(items);
  });
}

/**
 * Batch write an array of items to a collection.
 * Each item must have an `id` field used as the document id.
 * Used for one-time migration from localStorage.
 */
export async function fsBatchWrite<
  // biome-ignore lint/suspicious/noExplicitAny: generic batch write
  T extends object,
>(col: string, items: T[]): Promise<number> {
  if (items.length === 0) return 0;
  const batch = writeBatch(db);
  let count = 0;
  for (const item of items) {
    // Use item.id or item.productId as document key; fall back to auto
    const docId = String(
      (item as any).id || (item as any).productId || crypto.randomUUID(),
    );
    const ref = doc(db, col, docId);
    batch.set(ref, item);
    count++;
  }
  await batch.commit();
  return count;
}

/** Get a single settings document */
export async function fsGetSettings<T extends object>(
  docId: string,
): Promise<T | null> {
  const snap = await getDocs(collection(db, FS_COLLECTIONS.settings));
  const d = snap.docs.find((x) => x.id === docId);
  return d ? (d.data() as T) : null;
}

/** Set a single settings document */
export async function fsSetSettings<T extends object>(
  docId: string,
  data: T,
): Promise<void> {
  await setDoc(doc(db, FS_COLLECTIONS.settings, docId), data);
}
