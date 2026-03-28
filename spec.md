# ClikMate ERP — Final Production Polish

## Current State

- `PosPage.tsx` (3930 lines): Has 4 payment modes (Cash, UPI, Split, Khata). `phone` state is used for both Khata mobile and optional customer mobile. Khata standalone mode pushes debt to Firestore. `#pos-receipt-printable` exists for 80mm thermal receipt. ReceiptModal exists but has no WhatsApp send button.
- `AdminDashboard.tsx` (17408 lines): Has `alertBefore` in catalog items and some inline low-stock badge rendering, but NO dedicated Low Stock Alerts dashboard widget.
- `index.css` (451 lines): Global `@media print` is A4-oriented — sets `@page { size: A4; }`, shows letterhead, hides `.no-print`. This bleeds into POS thermal print, causing catalog/sidebar to print on bill.
- `PosPage.tsx` checkout modal: `phone` field is split — shown under Khata mode separately, and separately for non-Khata as optional. No universal "Amount Paid / Amount Due" split payment UI.

## Requested Changes (Diff)

### Add
- **Low Stock Alerts widget** on AdminDashboard: a red-bordered card showing all catalog products where `quantity <= (alertBefore ?? 5)`, with Item Name, Current Stock, Reorder Level columns. Each row has an "Update Stock" button that renders an inline number input (new received qty) in place, on submit updates Firestore `catalog` doc and refreshes the widget.
- **WhatsApp Send Bill button** on ReceiptModal (PosPage): Next to "Print Bill". Composes bill text (Shop Name, Bill ID, Date, Items list, Total, Amount Paid, Amount Due). Calls `window.open('https://wa.me/91' + customerMobile + '?text=' + encodeURIComponent(billText))`. If `customerMobile` is empty, show toast: "Please enter Customer Mobile number first."
- **Universal Split Payment system** in POS CheckoutModal: Replace old 4-mode grid (Cash/UPI/Split/Khata) with: Payment Method buttons (Cash | UPI | Online), then a universal "Amount Paid (₹)" input defaulting to total, auto-calculated "Amount Due (₹)" display = total − amountPaid. If amountDue > 0: Customer Name and Customer Mobile fields become mandatory (red asterisk + validation). When sale completes with amountDue > 0, push to khata collection with description: `"POS Sale - Bill #${invoiceNumber} (Total: ₹${total}, Paid: ₹${amountPaid})"`. Customer name field always visible (previously only for Khata/B2B).
- **POS Print CSS isolation**: `body.pos-print-mode` CSS class activated during POS thermal print via `document.body.classList.add('pos-print-mode')` before `window.print()` and removed in `window.onafterprint`. This mode sets `@page { size: 80mm auto; margin: 0; }` and shows ONLY `#pos-receipt-printable`, hiding everything else including the global letterhead.

### Modify
- **index.css**: Add `body.pos-print-mode @media print` block: `@page { size: 80mm auto; margin: 0; }`, hide everything via `body.pos-print-mode * { visibility: hidden; }` then show only `#pos-receipt-printable` and its children. Ensure the global A4 `@media print` block does NOT activate for POS thermal. Specifically suppress global letterhead when pos-print-mode is active.
- **PosPage CheckoutModal**: Remove standalone Khata payment mode button. Remove duplicate phone/name fields for Khata vs non-Khata. Consolidate to: single Customer Mobile (optional, mandatory if amountDue>0), single Customer Name (optional, mandatory if amountDue>0), Payment Method (Cash/UPI/Online), Amount Paid input, Amount Due display.
- **PosPage completeSale()**: Remove old `if (paymentMode === 'Khata' && phone)` khata logic. Add new logic: `if (amountDue > 0 && phone)` then push to khata with the specific description format. Pass `invoiceNumber`, `amountPaid`, `amountDue` through to receipt/onSuccess.
- **ReceiptModal**: Add "📲 Send on WhatsApp" button. Compose bill text from receipt data. If `receipt.customerMobile` is empty, show toast and abort. Otherwise open wa.me link.

### Remove
- Standalone "📒 Add to Khata" payment mode button from the 4-button grid in POS CheckoutModal.
- Old split Khata/non-Khata conditional phone and name fields in CheckoutModal.

## Implementation Plan

1. **index.css** — Add `body.pos-print-mode` print block. Ensure A4 letterhead `#clikmate-global-print-letterhead` is suppressed under pos-print-mode. Keep existing A4 `@media print` block for letterhead pages.

2. **PosPage.tsx — CheckoutModal**:
   - Replace `PaymentMode` type from `"Cash" | "UPI" | "Split" | "Khata"` to `"Cash" | "UPI" | "Online"`
   - Remove `cashAmount`, `upiAmount`, `khataCustomer` states; add `amountPaid` state (defaults to `subtotal`), `customerName` state
   - Add `amountDue = subtotal - parseFloat(amountPaid || '0')` computed value
   - Consolidate customer fields: always show Customer Mobile + Customer Name fields, mark as required when amountDue > 0
   - Update `completeSale()` validation and khata push logic
   - Pass `amountPaid`, `amountDue`, `customerName`, `invoiceNumber` in `onSuccess` call

3. **PosPage.tsx — Print buttons**: When "Print Bill" (thermal) is clicked: `document.body.classList.add('pos-print-mode'); window.print(); window.onafterprint = () => document.body.classList.remove('pos-print-mode')`

4. **PosPage.tsx — ReceiptModal**: Add WhatsApp button. Compose bill text. Handle empty mobile with toast.

5. **AdminDashboard.tsx — Low Stock Alerts widget**: Add to the Live Dashboard area. Fetch from `catalogItems` state (already loaded via onSnapshot). Filter `item.itemType === 'product' && item.quantity <= (item.alertBefore ?? 5)`. For each row, manage inline edit state `{[itemId]: boolean}` and `{[itemId]: string}` for new qty input. On submit: `fsUpdateDoc('catalog', item.productId, { quantity: item.quantity + parseInt(newQty) })` then refresh catalog.
