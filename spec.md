# ClikMate Service Center

## Current State
The catalog uses a flat classification:
- `itemType: "product" | "service"` — standalone type toggle in forms
- `category: string` — independent dropdown, not visually linked to itemType
- `CategoryEntry.appliesTo: "product" | "service"` — categories ARE already parent-filtered, but the UI doesn't present this as a hierarchy
- Three separate form modals: `ProductFormModal` (Add Product), `ServiceFormModal` (Add Service), `ItemFormModal` (Edit/combined)
- `ManageCategoriesModal` already stores `appliesTo` but labels it as "Type" with unclear hierarchy
- 22 migrated items all have `itemType: "product"` (incorrect — printing/scan services need `itemType: "service"`)

## Requested Changes (Diff)

### Add
- **Smart Migration button** "Fix Migration Types" in the Catalog header (next to "Manage Categories"). On click, fetches all Firestore catalog docs, applies keyword rules (name contains "Print", "Photocopy", "Lamination", "Scan", "PVC" OR category was "Printing & Document" → set `itemType: "service"`; else keep/set `itemType: "product"`), batch-updates Firestore, refreshes local state.
- Default service sub-categories: add "Print Service", "Typesetting", "Form Fill" alongside existing ones

### Modify
- **All three form modals** (`ProductFormModal`, `ServiceFormModal`, `ItemFormModal`):
  - Rename/re-label the `itemType` field as **"Main Category"** and place it at the TOP of the form
  - Use radio buttons (styled cyan/purple) for the two fixed options: "Product" and "Service"
  - The **Sub-Category** dropdown below must dynamically filter its options based on the selected Main Category
  - When Main Category changes, reset Sub-Category to first available option for that type
  - Product-only fields (Purchase Rate, Stock Qty, Alert Before) remain conditional on Main Category = "Product"
- **`ManageCategoriesModal`**: Update UI label from "Type" to **"Parent Category"**; show "Parent: Product" or "Parent: Service" pill badge next to each listed category
- **`DEFAULT_SERVICE_CATEGORIES`** in `utils/storage.ts`: include "Print Service", "Typesetting", "Form Fill" (can keep "Printing & Scan", "Online Forms" too)

### Remove
- Nothing removed — data model field names (`itemType`, `category`) stay the same for backward compat

## Implementation Plan
1. Update `utils/storage.ts` — extend `DEFAULT_SERVICE_CATEGORIES` with new defaults
2. In `AdminDashboard.tsx`:
   a. `ProductFormModal`: add `mainCategory` state (default "product"), show radio buttons at top, derive sub-category list from `mainCategory`, reset `category` on main change, wire `itemType` = `mainCategory` on save
   b. `ServiceFormModal`: same, default "service"
   c. `ItemFormModal`: move `itemType` select to top position, relabel as "Main Category", make sub-category dropdown filter by selected itemType, reset category when itemType changes
   d. `ManageCategoriesModal`: update `newType` label to "Parent Category" with clear Product/Service radio, add parent pill badges to each category row
   e. Add `runSmartMigration` async function + "Fix Migration Types" button (orange styled) in catalog header; show success toast with count of updated items; update React state after Firestore batch
