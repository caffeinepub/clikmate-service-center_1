# ClikMate ERP — Universal A4 Print Architecture

## Current State

The app has NO standalone `<LetterheadLayout>` React component. Each page has its own isolated, inconsistent print CSS and hardcoded shop info:

- **AdminDashboard.tsx** (17,669 lines): Has 3 print areas:
  - `#catalog-stock-print-area` — hidden div, uses `position: fixed; inset: 0` approach (causes overlap bugs). Hardcoded shop name/address.
  - `#live-dashboard-print-area` — uses `visibility: hidden` + `position: absolute` (body-wide), has its own `#print-report-header`. Hardcoded.
  - `.print-only-table` — Attendance report, same approach. Hardcoded.
- **KhataSettlementPage.tsx** (1,834 lines): Print CSS injected inline as `<style>` tag in modal. Uses `position: fixed; inset: 0`. Has own hardcoded `print-only` header inside modal.
- **ExpenseTrackerPage.tsx** (855 lines): Injects `expense-print-styles` style tag. Uses `visibility: hidden` + `#expense-print-area`. Data likely prints blank due to visibility bug.
- **GstReportsPage.tsx** (829 lines): Has its own `.gst-print-area` CSS. **Exclude from LetterheadLayout (user confirmed — GST Tax Invoice is standalone).**
- **PosPage.tsx** (4,251 lines): `#pos-receipt-printable` (80mm thermal) + `#pos-gst-invoice-printable` (A4 GST). **Both excluded from LetterheadLayout.**
- **SettingsSection in AdminDashboard**: No `shopName`, `shopAddress`, `shopPhone`, or `proprietorName` fields. Only has GST settings. Business info is hardcoded everywhere as "ClikMate Smart Online Service Center" / "Shop No. 12, Awanti Vihar, Raipur (C.G.) | Tel: +91 9508911400".

## Requested Changes (Diff)

### Add
- `src/frontend/src/components/LetterheadLayout.tsx` — New reusable React component.
  - Accepts props: `printAreaId: string`, `title: string`, `subtitle?: string`, `children: ReactNode`
  - On screen: renders `display: none` wrapper (invisible)
  - On print (when the correct printAreaId is being printed): shows full A4 page with letterhead + children + signature block
  - Fetches `settings/businessProfile` from Firestore once (module-level cache). Falls back to reasonable defaults if not set.
  - Header: Shop Name (large, bold), Shop Address, Phone, optional GSTIN
  - Divider: double border line
  - Report title (left) + "Printed: DD Month YYYY" (right)
  - Children: the data table in the middle
  - Signature block (bottom-right): blank line `________________________`, "Authorized Signatory", "For [shopName]"
- Business Profile card in `SettingsSection` of AdminDashboard — **at the very top** of the settings page
  - Fields: Shop Name, Shop Address, Shop Phone, Proprietor Name (maps to Authorized Signatory label)
  - Saves to Firestore `settings/businessProfile` doc
  - shopGstNumber stays in the existing GST card but also updates `businessProfile` doc so LetterheadLayout can read a single source

### Modify
- **AdminDashboard.tsx — Catalog Stock Report print area** (`#catalog-stock-print-area`):
  - Replace hardcoded letterhead header inside the div with `<LetterheadLayout printAreaId="catalog-stock-print" title="Stock Report — Catalog Inventory">`
  - Fix print trigger: inject CSS that shows only `#catalog-stock-print` and hides everything else; add afterprint cleanup
  - Remove `position: fixed; inset: 0` hack from catalog print area CSS (causes overlap)
- **AdminDashboard.tsx — Live Dashboard print area** (`#live-dashboard-print-area`):
  - Replace hardcoded `#print-report-header` with `<LetterheadLayout printAreaId="live-dashboard-print" title="Daily Operations Dashboard">`
  - Update injected `clikmate-print-styles` to only show `#live-dashboard-print` on print
- **AdminDashboard.tsx — Attendance print area** (`.print-only-table`):
  - Replace hardcoded header with `<LetterheadLayout printAreaId="attendance-print" title="Attendance Report">`
  - Fix visibility approach: use `display: none / block` not `visibility: hidden`
- **AdminDashboard.tsx — Order History section**:
  - Add a hidden `<LetterheadLayout printAreaId="order-history-print" title="Order History Report">` with an HTML table of orders
  - Wire the existing `onPrint` callback to trigger it correctly
- **KhataSettlementPage.tsx — Khata ledger print area**:
  - The `.khata-ledger-print-area` modal becomes the LetterheadLayout print area
  - Replace hardcoded `.print-only` header inside the modal with LetterheadLayout component
  - Keep the modal UX intact on screen; only the print view changes
- **ExpenseTrackerPage.tsx — Expense print area**:
  - Replace the `#expense-print-area` approach with LetterheadLayout wrapping the expense table
  - Fix the visibility bug (currently `visibility: hidden` means the table likely doesn't print)
- **index.css**:
  - Add clean universal `@media print` rule for `#a4-letterhead-print-*` pattern
  - Remove or neutralize the broken `#clikmate-global-print-letterhead` fixed-position block that causes overlaps
  - POS thermal `#pos-receipt-printable` and GST invoice `#pos-gst-invoice-printable` rules remain completely untouched

### Remove
- All hardcoded shop name/address/phone strings from print areas (replaced by dynamic LetterheadLayout)
- The broken `position: fixed; inset: 0` CSS on `#catalog-stock-print-area` in index.css
- The broken `visibility: hidden` body-wide approach in expense and dashboard print CSS (replaced by `display:none/block` approach)

## Implementation Plan

1. **Create `LetterheadLayout.tsx`**:
   - Module-level cache: `let _businessProfile: BusinessProfile | null = null`
   - `useEffect` fetches once from Firestore `doc(db, 'settings', 'businessProfile')` and caches
   - Renders: `<div id={printAreaId} className="a4-letterhead-wrapper">` which is `display:none` on screen
   - On print (controlled by the calling page's print CSS): displays as white A4 page
   - Bottom of component always has signature block: `_________________________` line, "Authorized Signatory", "For {shopName}"

2. **Business Profile in SettingsSection**:
   - Add state: `shopName`, `shopAddress`, `shopPhone`, `proprietorName`
   - Load from `getDoc(doc(db, 'settings', 'businessProfile'))`
   - Save button writes to `setDoc(doc(db, 'settings', 'businessProfile'), {...})`
   - Card placed ABOVE the GST card

3. **Print mechanism (per page)**:
   - Each print button injects a one-time `<style>` tag:
     ```
     @media print {
       body > * { display: none !important; }
       #[printAreaId] { display: block !important; }
       @page { size: A4 portrait; margin: 15mm; }
     }
     ```
   - Then calls `window.print()`
   - On `window.afterprint` event: remove the injected style tag
   - This pattern is clean and reliable across all browsers

4. **Fix blank data bugs**:
   - The root cause is `visibility: hidden` + `visibility: visible` pattern: on some browsers, table cells inside a `visibility: visible` container can still inherit the hidden state if the container is `position: absolute`
   - Fix: use `display: none/block` approach consistently across all print areas
   - Remove all `position: absolute; left: 0; top: 0; width: 100%` hacks — LetterheadLayout renders as normal block element
   - Ensure `page-break-inside: avoid` on table rows

5. **Wire to 6 pages** (AdminDashboard has 4, KhataSettlement has 1, ExpenseTracker has 1)

6. **Validate and deploy**
