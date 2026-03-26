# ClikMate Service Center

## Current State
- CatalogItem type has `price: string`, `stockStatus: string` (text like 'In Stock'/'Out of Stock'), no `quantity`, `purchaseRate`, `saleRate`, `type`, or `reorderLevel` fields
- AdminDashboard.tsx has CatalogSection with 3 separate modals: EditItemModal, AddProductModal, AddServiceModal -- all using `price` field
- PosPage.tsx completeSale() records sale to localStorage but does NOT deduct stock from catalog
- Table headers: Thumbnail, Item Name, Category, Price, Stock (text status), Status, Actions
- No investment/revenue summary cards on catalog

## Requested Changes (Diff)

### Add
- New fields on CatalogItem (localStorage extension, not backend): `itemType: 'product' | 'service'`, `quantity: number`, `purchaseRate: number`, `saleRate: number`, `reorderLevel: number`
- Migration logic: on app load, auto-migrate old items where `saleRate` is missing → map `price` to `saleRate`, set `purchaseRate=0`, `quantity=0`, `reorderLevel=5`, `itemType` inferred from category (SERVICE_CAT_LIST → 'service', else 'product')
- Two new glassmorphism summary cards at top of CatalogSection: "Total Shop Investment" (SUM quantity*purchaseRate for products) and "Expected Revenue" (SUM quantity*saleRate for products)
- `reorderLevel` field in Add/Edit forms (default 5, only shown for Products)
- `itemType` dropdown (Product / Service) in all Add/Edit forms
- For Products: show quantity, purchaseRate, saleRate, reorderLevel fields
- For Services: hide quantity and purchaseRate fields, only show saleRate
- Red "Low Stock" badge in catalog table when product quantity <= reorderLevel
- Stock deduction in PosPage completeSale(): for each cart item, if matching catalog item is a Product, deduct qty sold from its quantity in localStorage

### Modify
- CatalogSection table columns: replace "Price" with "Sale Rate", add "Purchase Rate" and "Stock" (numeric) and "Margin" columns for Products tab; for Services tab keep "Sale Rate" only
- All 3 add/edit modals: replace single `price` field with the new fields
- completeSale() in PosPage: after saving sale, loop cart items, find each in catalog by name, if itemType==='product' deduct qty from localStorage
- stockStatus field becomes legacy (keep for backward compat but use quantity-based logic for Low Stock badge)

### Remove
- Old text-based `stockStatus` dropdown from Add/Edit forms (replace with quantity-based system)

## Implementation Plan
1. Update backend.d.ts CatalogItem interface to add new optional fields (quantity, purchaseRate, saleRate, itemType, reorderLevel)
2. Add migration function in AdminDashboard.tsx loadCatalog() that runs on mount
3. Update AddProductModal, AddServiceModal, EditItemModal in AdminDashboard.tsx
4. Update CatalogSection summary cards and table columns
5. Update PosPage.tsx completeSale() to deduct product stock after sale
