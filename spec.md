# ClikMate Service Center – B2B GST Invoicing Module

## Current State
- Firebase Firestore-backed POS/ERP app with Cyber-Glass Dark Mode UI
- POS checkout (`PosPage.tsx`) has `CheckoutModal` with `completeSale()` that saves orders to Firestore `orders` collection
- `ReceiptModal` shows 80mm thermal receipt and calls `window.print()`
- `AdminDashboard.tsx` has `SettingsSection` with `SettingsSection()` function that loads/saves to Firestore `settings/appConfig`; it saves `whatsappBotEnabled`, `whatsappRateTemplate`, `upiId`, `qrCodeUrl`
- `ItemFormModal` (edit + add) has `FormState` interface with `barcode` as the last field; `EMPTY_FORM` mirrors it; `handleSave` saves to Firestore `catalog`
- `ProductFormModal` and `ServiceFormModal` also exist as separate add modals
- `CsvBulkUploader.tsx` has template with headers: `Item Name,Main Category,Sub Category,Purchase Rate,Sale Rate,Initial Stock,Barcode`; maps each column by index
- GST settings: a cache key `clikmate_gst_settings` (JSON: `{enabled: boolean, shopGstNumber: string}`) will be used for cross-component reads

## Requested Changes (Diff)

### Add
- `shopGstNumber` text input and `gstEnabled` boolean toggle to `SettingsSection` in AdminDashboard; save both to Firestore `settings/appConfig`; also write cache to `localStorage.setItem('clikmate_gst_settings', JSON.stringify({enabled, shopGstNumber}))` on save
- Helper function `getGstSettings()` at top of PosPage and AdminDashboard: reads `clikmate_gst_settings` from localStorage, returns `{enabled: boolean, shopGstNumber: string}`
- `gstPercentage: string` (default `"0"`) and `hsnSac: string` (default `""`) fields to `FormState` interface and `EMPTY_FORM` in AdminDashboard
- GST fields rendered in ItemFormModal, ProductFormModal, ServiceFormModal — only when `getGstSettings().enabled === true`; `gstPercentage` is a select with options ["0","5","12","18","28"]; `hsnSac` is a text input (optional)
- Both fields saved in `handleSave` for all three modals: `gstPercentage: Number(form.gstPercentage) || 0, hsnSac: form.hsnSac || ""`
- On edit: pre-fill from `editItem.gstPercentage` and `editItem.hsnSac`
- Two new CSV columns appended to template: `GST %,HSN/SAC`; parse `cols[7]` as `gstPercentage` (number, default 0) and `cols[8]` as `hsnSac` (string); save to catalog doc
- B2B GST section in `CheckoutModal` — only shown when `getGstSettings().enabled === true`:
  - Toggle switch: "Generate B2B GST Invoice" (state: `isGstInvoice`)
  - When `isGstInvoice === true`: show `customerName` text input and `customerGstin` text input
  - Tax calculation: `totalTaxableValue = subtotal`; loop cart items to compute per-item GST based on `item.gstPercentage` from catalog; if no gstPercentage on cart item use 0; smart CGST/SGST/IGST detection: compare first 2 chars of `customerGstin` with first 2 chars of `shopGstNumber`; if match → split 50/50 CGST+SGST; if no match → 100% IGST; display tax breakdown summary in checkout UI before total
  - Grand total = subtotal + totalTax
- In `completeSale()`: add GST fields to `newSale` object: `isGstInvoice`, `customerName`, `customerGstin`, `cgstAmount`, `sgstAmount`, `igstAmount`, `grandTotal` (subtotal + tax); save to Firestore orders
- Pass GST data to `onSuccess` callback and then to `ReceiptModal` via new props
- A4 Tax Invoice in `ReceiptModal`: when `isGstInvoice === true`, render a hidden `id="pos-gst-invoice-printable"` div (and hide `id="pos-receipt-printable"`) with:
  - Header: "TAX INVOICE" in bold; shop name/address; Shop GSTIN: `shopGstNumber`; Customer GSTIN: `customerGstin`; Customer Name; invoice number and date
  - HTML `<table>` with columns: Item, HSN/SAC, Qty, Rate, Taxable Value, CGST%, CGST Amt, SGST%, SGST Amt (or single IGST% + IGST Amt if inter-state), Total
  - Summary rows: Sub-total, CGST/SGST or IGST totals, Grand Total
  - Print CSS: `@media print { #pos-receipt-printable { display:none!important; } #pos-gst-invoice-printable { display:block!important; } }` — and white background, black text for A4
  - Non-print: the A4 invoice is visually shown in the modal too (dark-mode styled) so the user can preview before printing

### Modify
- `SettingsSection` — add GST fields and localStorage cache write on save
- `FormState` interface + `EMPTY_FORM` — add gstPercentage + hsnSac
- `ItemFormModal`, `ProductFormModal`, `ServiceFormModal` `handleSave` — save new fields
- `CsvBulkUploader` `TEMPLATE_CONTENT` and `processCSV` — add two new columns
- `CheckoutModal` + `completeSale` — add B2B GST toggle, calculation, save
- `ReceiptModal` — conditional A4 Tax Invoice vs thermal receipt

### Remove
- Nothing removed

## Implementation Plan
1. Add `getGstSettings()` helper at top of both PosPage.tsx and AdminDashboard.tsx
2. Update `SettingsSection` in AdminDashboard to add `shopGstNumber` + `gstEnabled` fields, load from Firestore, save to Firestore + localStorage cache
3. Update `FormState`, `EMPTY_FORM` in AdminDashboard to add `gstPercentage` and `hsnSac`
4. Update `handleSave` in ItemFormModal, ProductFormModal, ServiceFormModal to save and pre-fill those fields
5. Add GST fields to the form UI in all three modals (conditional on gstEnabled)
6. Update CsvBulkUploader template + parser for new columns
7. Update CheckoutModal: add B2B toggle, customer fields, tax calc, grand total display
8. Update completeSale to include GST data in Firestore order doc
9. Update ReceiptModal to accept new GST props and render A4 Tax Invoice when isGstInvoice is true
10. Add print CSS to index.css for A4 invoice vs thermal print switching
