# ClikMate Service Center

## Current State
- Catalog module exists in AdminDashboard.tsx with Products/Services tabs
- Edit button (Edit2 icon) exists per row, opens AddEditModal pre-filled via `editItem` state
- CatalogItem type has: id (bigint), name, category, description, price, itemType, quantity, purchaseRate, saleRate, reorderLevel, published, etc.
- Low stock badge shows when `quantity <= reorderLevel` (reorderLevel defaults to 5)
- POS barcode scanner matches on `String(item.id)` or `item.name.toLowerCase()`
- No `productId` (SKU) field exists yet
- No `alertBefore` field (uses `reorderLevel`)
- Low stock badge shows for ALL items including Services (no type check)
- Edit button exists but user wants confirmation it works without duplicates

## Requested Changes (Diff)

### Add
- `productId` field (string, e.g. "ITM-1001") to CatalogItem data model
- Auto-generation of productId on new item creation: find max existing ITM number, increment
- "Product ID" column in Catalog table (both Products and Services tabs), shown before Item Name
- `alertBefore` field to CatalogItem (number) -- this replaces/augments `reorderLevel`
- "Alert Before (Low Stock Level)" mandatory number input in Add/Edit form for Products
- Migration: existing items without productId get auto-assigned ITM-1001, ITM-1002, etc. on load

### Modify
- Low stock badge logic: only show if `item.itemType === 'product' && item.quantity <= item.alertBefore`
- Use `alertBefore` instead of `reorderLevel` for the badge threshold (keep `reorderLevel` in form as alias or replace form label)
- POS barcode scanner: also match against `item.productId` in addition to `String(item.id)` and `item.name`
- Catalog table headers: add "Product ID" column
- Add/Edit form: rename "Reorder Level" label to "Alert Before (Low Stock Level)", store as `alertBefore` (can also keep `reorderLevel` in sync)
- Summary cards calculation: no change
- `storageAddItem` for catalog: set productId before inserting

### Remove
- Nothing removed

## Implementation Plan
1. Update `backend.d.ts` CatalogItem interface: add `productId?: string` and `alertBefore?: number`
2. Update `utils/storage.ts`: add `generateProductId(existingItems)` helper function
3. Update `AdminDashboard.tsx`:
   a. Migration on load: items without `productId` get assigned ITM-1001+ in sequence
   b. Add/Edit form FormState: add `alertBefore: string`, remove or keep `reorderLevel` field label changed to "Alert Before"
   c. On save (new item): call `generateProductId`, set `alertBefore` from form, `reorderLevel` = same value
   d. On save (edit item): preserve `productId`, update `alertBefore`
   e. Catalog table: add "Product ID" column with cyan monospace badge style
   f. Low stock badge: change condition to `item.itemType === 'product' && (item.quantity ?? 0) <= (item.alertBefore ?? item.reorderLevel ?? 5)`
4. Update `PosPage.tsx`: in barcode match, also check `item.productId === buf`
