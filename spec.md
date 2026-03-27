# ClikMate Service Center

## Current State

Full-stack POS/ERP app with a React/TypeScript frontend and Motoko backend (unused for data). All data currently stored in browser localStorage via a centralized `StorageManager` utility (`src/frontend/src/utils/storage.ts`). Key modules: AdminDashboard (15,555 lines), PosPage (2,987 lines), KhataSettlementPage (1,832 lines), StaffClockInPage, StaffDashboard, App.tsx (public landing + Rate List).

Storage keys:
- `clikmate_catalog_items` → catalog
- `clikmate_staff_members` → staff/users
- `clikmate_khata_entries` → khata
- `clikmate_clock_in_log` → attendance
- `clikmate_pos_sales` → orders
- `clikmate_categories` → categories
- `clikmate_admin_email`, `clikmate_admin_password`, `clikmate_admin_session` → admin auth
- `clikmate_whatsapp_bot_enabled`, `clikmate_whatsapp_rate_template` → settings
- `clikmate_logo_url` → settings
- `attendance_${date}` → legacy attendance per-date keys

## Requested Changes (Diff)

### Add
- `firebase` npm dependency in `src/frontend/package.json`
- `src/frontend/src/firebase.ts` — Firebase app init + Firestore db export
- `src/frontend/src/utils/firestoreService.ts` — async Firestore CRUD layer (replacement for storage.ts), exposing async equivalents: `fsGet`, `fsSet`, `fsAddItem`, `fsUpdateItem`, `fsRemoveItem`, `fsSubscribe` (onSnapshot)
- `src/frontend/src/utils/migrationUtils.ts` — reads all localStorage keys and batch-writes to Firestore collections, then clears localStorage
- "Sync to Cloud" button in Admin Settings section of AdminDashboard — triggers one-time migration

### Modify
- `src/frontend/src/utils/storage.ts` — keep as fallback/compatibility shim; redirect calls through firestoreService
- `src/frontend/src/pages/AdminDashboard.tsx` — replace all storageGet/storageSet/storageAddItem/storageUpdateItem/storageRemoveItem/localStorage calls with firestoreService async calls; add "Sync to Cloud" migration button in Admin Settings; auth credentials (admin email/password) now read/write to Firestore `settings` collection; staff PINs read/write to Firestore `users` collection; Live Dashboard uses onSnapshot for real-time metrics
- `src/frontend/src/pages/PosPage.tsx` — replace localStorage with firestoreService; use onSnapshot for catalog items (real-time inventory deduction sync); getDocs for khata on mount
- `src/frontend/src/pages/KhataSettlementPage.tsx` — replace localStorage with firestoreService getDocs on mount (no real-time)
- `src/frontend/src/pages/StaffClockInPage.tsx` — replace localStorage with firestoreService getDocs/fsAddItem for attendance
- `src/frontend/src/App.tsx` — Public Rate List catalog section uses onSnapshot for real-time updates from Firestore

### Remove
- All raw `localStorage.getItem` / `localStorage.setItem` / `localStorage.removeItem` calls across all modules (replaced by firestoreService)

## Implementation Plan

### Phase A: Infrastructure
1. Add `firebase` to `src/frontend/package.json` dependencies
2. Create `src/frontend/src/firebase.ts` with the exact config provided by user
3. Create `src/frontend/src/utils/firestoreService.ts` with async Firestore operations:
   - Collections: `catalog`, `categories`, `orders`, `khata`, `attendance`, `users`, `settings`
   - `fsGetCollection(col)` → getDocs → array
   - `fsSetDoc(col, id, data)` → setDoc
   - `fsAddDoc(col, data)` → addDoc (returns id)
   - `fsUpdateDoc(col, id, patch)` → updateDoc
   - `fsDeleteDoc(col, id)` → deleteDoc
   - `fsSubscribeCollection(col, callback)` → onSnapshot, returns unsubscribe fn
   - `fsBatchWrite(col, items[])` → batched setDoc for migration
4. Create `src/frontend/src/utils/migrationUtils.ts`:
   - Reads all legacy localStorage keys
   - Batch-writes each collection to Firestore
   - Clears localStorage keys after success
   - Returns `{ success: boolean, counts: Record<string, number> }`

### Phase B: Real-time Modules (onSnapshot)
5. **Public Catalog (App.tsx)** — Replace `storageGet(STORAGE_KEYS.catalog)` with `fsSubscribeCollection('catalog', callback)` in useEffect; unsubscribe on unmount
6. **Live Dashboard (AdminDashboard.tsx)** — Dashboard metrics (orders, sales, catalog stats) computed from Firestore onSnapshot streams
7. **POS Counter (PosPage.tsx)** — `catalogItems` loaded via onSnapshot on mount; stock deduction uses `fsUpdateDoc`

### Phase C: Standard Fetch Modules (getDocs)
8. **Khata Settlement (KhataSettlementPage.tsx)** — Load khata entries via `fsGetCollection('khata')` on mount; all mutations use fsUpdateDoc/fsAddDoc
9. **Order History (AdminDashboard.tsx)** — `fsGetCollection('orders')` on mount
10. **Attendance (StaffClockInPage.tsx + AdminDashboard.tsx)** — `fsGetCollection('attendance')` on mount; clock-in/out uses fsAddDoc/fsUpdateDoc
11. **Admin Settings (AdminDashboard.tsx)** — Settings doc in `settings/appConfig`; admin credentials in `settings/adminAuth`

### Phase D: Auth Migration
12. **Admin auth** — Read email/password from `settings/adminAuth` Firestore doc on login; fall back to defaults if doc not yet created
13. **Staff auth** — Staff members stored in `users` collection; PosLoginPage reads from Firestore

### Phase E: Migration Utility
14. Add "☁ Sync to Cloud" button in Admin Settings tab — shows progress modal, runs migrationUtils, shows success/failure counts

### Real-time vs Fetch Decision
| Module | Strategy |
|---|---|
| Public Catalog | onSnapshot |
| Live Dashboard | onSnapshot |
| POS Counter | onSnapshot |
| Khata Settlement | getDocs on mount |
| Order History | getDocs on mount |
| Attendance Report | getDocs on mount |
| Admin Settings | getDocs on mount |
| Staff Auth (users) | getDocs on mount |

### Firestore Collections
| Collection | Documents | Notes |
|---|---|---|
| `catalog` | one doc per item, id = productId | catalog items with all fields |
| `categories` | one doc per category | type field: 'product'/'service' |
| `orders` | one doc per sale | POS sales |
| `khata` | one doc per entry | phone, totalDue, etc. |
| `attendance` | one doc per clock event | staffId, in/out timestamps |
| `users` | one doc per staff | mobile, pin, name, role |
| `settings` | `appConfig` doc + `adminAuth` doc | WhatsApp toggle, admin credentials |
