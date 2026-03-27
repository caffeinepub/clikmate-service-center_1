# ClikMate Service Center

## Current State
- Multiple separate login pages: AdminLoginScreen (embedded in AdminDashboard), PosLoginPage (/pos-login for staff), BulkLoginPage (/bulk-login for B2B)
- Staff login queries Firestore `users` collection for mobile+pin match
- Admin login uses master key "CLIKMATE-ADMIN-2024" or Firestore adminAuth
- BulkDashboard shows "Admin session required" warning when `localStorage.getItem("clikmate_admin_session")` is null
- Products/services add failing silently due to BigInt serialization crash in JSON.stringify
- Salary pay not updating: `newExpense` has `id: BigInt(Date.now())` which throws when JSON.stringify is called
- No single unified entry point for all login types

## Requested Changes (Diff)

### Add
- New `/login` route: UnifiedLoginPage with Mobile Number field, 4-digit PIN field, Role dropdown
- Role dropdown options: "Admin", all staff names loaded from Firestore `users` collection, "Customer"
- Login logic per role:
  - Admin: match PIN against master key "CLIKMATE-ADMIN-2024" → set `clikmate_admin_session=1` → navigate to `/admin`
  - Staff [name]: match mobile+pin against Firestore `users` → set staffSession → navigate to `/staff-dashboard`
  - Customer: match mobile+pin against localStorage customer records → navigate to `/vault` or customer dashboard
- Glassmorphism Cyber-Glass Dark Mode theme matching uploaded reference image (dark background, glowing logo, frosted glass card)
- Role dropdown dynamically loads staff list from Firestore on mount

### Modify
- Fix BigInt serialization: Replace all `BigInt(Date.now())` used as `id` or `createdAt` in objects that get JSON-stored with `Date.now()` (plain number)
- Fix `handlePaySalary`: `newExpense.id` and `newExpense.createdAt` change from BigInt to number
- Fix catalog add modals: `createdAt: BigInt(Date.now())` → `createdAt: Date.now()`
- BulkDashboard: Also accept session from unified login (staffSession or clikmate_admin_session)
- App.tsx: Add `/login` route pointing to UnifiedLoginPage; redirect `/pos-login` and `/admin` login redirects to `/login`
- AdminDashboard: When !isAdmin, redirect to `/login?role=admin` instead of showing inline AdminLoginScreen

### Remove
- Nothing removed (backward compatible)

## Implementation Plan
1. Create `src/frontend/src/pages/UnifiedLoginPage.tsx` with Mobile+PIN+Role dropdown, glassmorphism dark theme matching reference
2. Fix BigInt bugs in AdminDashboard: handlePaySalary newExpense id/createdAt, all catalog add forms' createdAt field
3. Add `/login` route in App.tsx
4. Update AdminDashboard to redirect to `/login` when !isAdmin instead of showing inline form
5. Update PosLoginPage to redirect to `/login`
6. Validate and deploy
