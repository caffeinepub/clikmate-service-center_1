# ClikMate — GST Toggle Fix & GST Reports Pipeline

## Current State
- GST toggle (`gstEnabled`) exists in `SettingsSection` inside `AdminDashboard.tsx`, buried below UPI Settings and WhatsApp Settings cards — not visually prominent.
- POS `completeSale()` saves orders to Firestore but does NOT generate a sequential `invoiceNumber` field.
- No GST Reports page exists. The `ExpenseTrackerPage` and sidebar have routes/links for expense tracking but nothing for GST reporting.

## Requested Changes (Diff)

### Add
- Sequential `invoiceNumber` generation in `completeSale()` — format `INV-YYYY-NNNN` based on current financial year + counter from Firestore (or timestamp fallback). Save explicitly in the orders document.
- New `GstReportsPage.tsx` page at `/gst-reports` route.
  - Month/Year selector (defaults to current month)
  - 4 summary cards: Total Taxable Value, Total CGST, Total SGST, Total IGST
  - Data table: Date, Invoice No, Customer Name, Customer GSTIN, Taxable Value, CGST, SGST, IGST, Total
  - "Export CSV" button — full GSTR-1 format: Date, Invoice No, Customer Name, Customer GSTIN, Shop GSTIN (static), HSN/SAC, Tax Rate %, Taxable Value, CGST, SGST, IGST, Total — with per-tax-rate row breakdown per invoice
  - "Print Report" button — A4 letterhead with filtered month summary + table
- GST Reports link in AdminDashboard sidebar under "Accounts / Khata" group — hidden if `gstEnabled === false`
- Route `<Route path="/gst-reports" element={<GstReportsPage />} />` in App.tsx

### Modify
- `SettingsSection` in `AdminDashboard.tsx`: Move GST toggle to the VERY TOP as a large, prominent card with a visual `GST Mode: ACTIVE` / `GST Mode: INACTIVE` badge. It should be the first card rendered, before UPI settings.

### Remove
- Nothing removed.

## Implementation Plan
1. In `AdminDashboard.tsx` `SettingsSection`: Restructure so the GST card is rendered first, with a large toggle (60x32px), and a colored badge (green ACTIVE / gray INACTIVE).
2. In `PosPage.tsx` `completeSale()`: Before saving, query Firestore `settings/invoiceCounter` doc to get the last counter, increment it, save `invoiceNumber: INV-{FY}-{NNNN}` in the order. Update counter doc atomically (or timestamp fallback if Firestore write fails).
3. Create `src/frontend/src/pages/GstReportsPage.tsx` — fetches orders where `isGstInvoice === true`, filters by selected month/year, renders summary cards + HTML table, CSV export with per-taxline row expansion, print-ready A4 layout.
4. Add route in `App.tsx` and import `GstReportsPage`.
5. Add NavItem in AdminDashboard sidebar inside `Accounts / Khata` group, conditionally rendered when `gstEnabled === true`.
