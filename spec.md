# ClikMate Service Center

## Current State
- Landing page navbar has an "Admin" link and a "Login / Sign Up" button (customer-facing)
- `/login` route renders `UnifiedLoginPage.tsx` with Mobile Number + PIN + Role dropdown (loaded from Firestore staff list)
- Role dropdown shows: Admin, [staff members from Firestore], Customer
- No dedicated "Staff Login" button in the navbar linking to `/login`

## Requested Changes (Diff)

### Add
- "Staff Login" button in the top-right of the landing page navbar (desktop + mobile menu), styled with Cyber-Glass dark theme (glassmorphism border, dark bg, cyan text), linking to `/login`
- In `UnifiedLoginPage.tsx`: a "Login with Mobile Number" checkbox toggle (unchecked by default)
- When toggle is **unchecked** (default): show "User ID" label on the first input field + show a "Select Role" dropdown below the PIN/password field
- "Select Role" dropdown options: SuperAdmin, Student, Teacher, Principal, Accountant, AdmissionStaff, Maintainance_Staff, Library_Staff, Examination_Controller, Print_Staff, Vice_Principal, Manager, Front_Office, Admin, Assistant_Teacher, Cook, Driver, Conductor, Vendor
- When toggle is **checked**: change first field label to "Enter Mobile Number", hide the "Select Role" dropdown

### Modify
- `UnifiedLoginPage.tsx` title: change to "User Login", subtitle: "Sign in to ClikMate ERP", subtext: "Enter your staff credentials to continue"
- Login page card: central modal style with Cyber-Glass Dark Mode theme (matching existing glassmorphism)
- Auth logic: when toggle unchecked, validate User ID + PIN + selected role against Firestore `users` collection; when toggle checked, validate mobile + PIN as before
- Navbar: add "Staff Login" button next to existing nav items (before or after Admin link)

### Remove
- Nothing removed

## Implementation Plan
1. Update `App.tsx` navbar: add a `<Link to="/login">` "Staff Login" button styled with `border border-cyan-500/40 bg-cyan-900/20 text-cyan-300 hover:bg-cyan-800/30` glassmorphism style in both desktop nav and mobile menu
2. Rewrite `UnifiedLoginPage.tsx`:
   - Title: "User Login", subtitle: "Sign in to ClikMate ERP", subtext: "Enter your staff credentials to continue"
   - State: `loginWithMobile: boolean` (default false)
   - Checkbox: "Login with Mobile Number" — toggles `loginWithMobile`
   - When `loginWithMobile=false`: label = "User ID", show Select Role dropdown with the 19 roles listed
   - When `loginWithMobile=true`: label = "Enter Mobile Number", hide Select Role dropdown
   - Auth: unchanged Firestore validation logic, but also map selected role from the new list to existing admin/staff/customer logic
   - Design: centered card with dark glassmorphism bg (`rgba(8,13,26,0.85)`), cyan border, backdrop blur
