import { fsGetCollection } from "@/utils/firestoreService";
import { useNavigate } from "@/utils/router";
import { ChevronDown, Loader2, Lock, Phone } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type StaffMember = {
  id?: string;
  mobile?: string;
  pin?: string;
  name?: string;
  role?: string;
};

type RoleOption = {
  value: string;
  label: string;
};

export default function UnifiedLoginPage() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [error, setError] = useState("");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([
    { value: "admin", label: "🔐 Admin" },
    { value: "customer", label: "🛍️ Customer" },
  ]);

  useEffect(() => {
    async function loadStaff() {
      try {
        const users = await fsGetCollection<StaffMember>("users");
        const staff = users.filter((u) => u.role !== "admin" && u.mobile);
        setStaffList(staff);
        const staffOptions: RoleOption[] = staff.map((s) => ({
          value: `staff_${s.mobile}`,
          label: `👤 ${s.name || s.mobile} (Staff)`,
        }));
        setRoleOptions([
          { value: "admin", label: "🔐 Admin" },
          ...staffOptions,
          { value: "customer", label: "🛍️ Customer" },
        ]);
      } catch {
        // Fallback: read from localStorage
        try {
          const raw = localStorage.getItem("clikmate_staff_members");
          const local: StaffMember[] = raw ? JSON.parse(raw) : [];
          setStaffList(local);
          const staffOptions: RoleOption[] = local
            .filter((s) => s.mobile)
            .map((s) => ({
              value: `staff_${s.mobile}`,
              label: `👤 ${s.name || s.mobile} (Staff)`,
            }));
          setRoleOptions([
            { value: "admin", label: "🔐 Admin" },
            ...staffOptions,
            { value: "customer", label: "🛍️ Customer" },
          ]);
        } catch {
          // silently ignore
        }
      } finally {
        setLoadingRoles(false);
      }
    }
    loadStaff();
  }, []);

  const isAdmin = role === "admin";
  const isCustomer = role === "customer";

  async function handleLogin() {
    if (!mobile || mobile.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!pin) {
      setError(
        isAdmin
          ? "Please enter your Admin Password / Master Key."
          : "Please enter your 4-digit PIN.",
      );
      return;
    }
    if (!isAdmin && !isCustomer && pin.length < 4) {
      setError("Please enter your 4-digit PIN.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      if (isAdmin) {
        // Check master key or Firestore admin
        const isMasterKey = pin === "CLIKMATE-ADMIN-2024";
        let isFirestoreAdmin = false;
        if (!isMasterKey) {
          try {
            const users = await fsGetCollection<
              StaffMember & { role?: string; password?: string }
            >("users");
            const adminUser = users.find(
              (u) =>
                u.role === "admin" &&
                u.mobile === mobile &&
                (u.pin === pin ||
                  (u as { password?: string }).password === pin),
            );
            isFirestoreAdmin = !!adminUser;
          } catch {
            // ignore firestore error
          }
        }
        if (isMasterKey || isFirestoreAdmin) {
          localStorage.setItem("clikmate_admin_session", "1");
          toast.success("Admin access granted!");
          navigate("/admin");
        } else {
          setError("Invalid admin credentials.");
        }
      } else if (role.startsWith("staff_")) {
        const staffMobile = role.replace("staff_", "");
        if (mobile !== staffMobile) {
          setError("Mobile number does not match selected staff account.");
          setLoading(false);
          return;
        }
        // Try Firestore first, then localStorage
        let matched: StaffMember | undefined;
        try {
          const users = await fsGetCollection<StaffMember>("users");
          matched = users.find((s) => s.mobile === mobile && s.pin === pin);
        } catch {
          matched = staffList.find((s) => s.mobile === mobile && s.pin === pin);
        }
        if (!matched) {
          const raw = localStorage.getItem("clikmate_staff_members");
          const local: StaffMember[] = raw ? JSON.parse(raw) : [];
          matched = local.find((s) => s.mobile === mobile && s.pin === pin);
        }
        if (matched) {
          localStorage.setItem(
            "staffSession",
            JSON.stringify({
              mobile,
              name: matched.name || mobile,
              loggedInAt: Date.now(),
            }),
          );
          toast.success(`Welcome back, ${matched.name || "Staff"}!`);
          navigate("/staff-dashboard");
        } else {
          setError("Invalid credentials. Contact your admin.");
        }
      } else if (isCustomer) {
        localStorage.setItem(
          "customerSession",
          JSON.stringify({ mobile, loggedInAt: Date.now() }),
        );
        toast.success("Welcome!");
        navigate("/vault");
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      data-ocid="unified_login.page"
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background:
          "linear-gradient(135deg, #080d1a 0%, #0d1533 50%, #080d1a 100%)",
      }}
    >
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,255,255,0.06) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center relative"
            style={{
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              boxShadow:
                "0 0 40px rgba(0,255,255,0.3), 0 0 80px rgba(0,255,255,0.1)",
            }}
          >
            <span className="text-3xl font-black text-gray-900">C</span>
            {/* Glow ring */}
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                border: "1px solid rgba(0,255,255,0.4)",
                boxShadow: "inset 0 0 20px rgba(0,255,255,0.1)",
              }}
            />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            ClikMate
          </h1>
          <p
            className="text-sm mt-1 font-medium"
            style={{ color: "rgba(0,255,255,0.7)" }}
          >
            Smart Online Service Center
          </p>
        </div>

        {/* Card */}
        <div
          data-ocid="unified_login.card"
          className="rounded-2xl p-8"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(0,255,255,0.2)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <h2 className="text-xl font-bold text-white mb-1 text-center">
            Sign In
          </h2>
          <p className="text-white/40 text-sm text-center mb-7">
            Enter your credentials to continue
          </p>

          <div className="space-y-5">
            {/* Role Selector */}
            <div>
              <label
                htmlFor="unified-role"
                className="block text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "rgba(0,255,255,0.6)" }}
              >
                Role
              </label>
              <div className="relative">
                <select
                  id="unified-role"
                  data-ocid="unified_login.role.select"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setError("");
                  }}
                  disabled={loadingRoles}
                  className="w-full appearance-none pr-10 pl-4 py-3 rounded-xl text-sm text-white font-medium focus:outline-none transition-colors"
                  style={{
                    background: "rgba(0,255,255,0.07)",
                    border: "1px solid rgba(0,255,255,0.25)",
                    color: "white",
                  }}
                >
                  {loadingRoles ? (
                    <option>Loading roles...</option>
                  ) : (
                    roleOptions.map((opt) => (
                      <option
                        key={opt.value}
                        value={opt.value}
                        style={{ background: "#0d1533", color: "white" }}
                      >
                        {opt.label}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{
                    width: 16,
                    height: 16,
                    color: "rgba(0,255,255,0.5)",
                  }}
                />
              </div>
            </div>

            {/* Mobile Number */}
            <div>
              <label
                htmlFor="unified-mobile"
                className="block text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "rgba(0,255,255,0.6)" }}
              >
                Mobile Number
              </label>
              <div className="relative">
                <Phone
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{
                    width: 16,
                    height: 16,
                    color: "rgba(0,255,255,0.4)",
                  }}
                />
                <input
                  id="unified-mobile"
                  data-ocid="unified_login.mobile.input"
                  type="tel"
                  maxLength={10}
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none transition-colors"
                  style={{
                    background: "rgba(0,255,255,0.05)",
                    border: "1px solid rgba(0,255,255,0.2)",
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "rgba(0,255,255,0.6)";
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "rgba(0,255,255,0.2)";
                  }}
                  placeholder="10-digit mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLogin();
                  }}
                />
              </div>
            </div>

            {/* PIN / Password */}
            <div>
              <label
                htmlFor="unified-pin"
                className="block text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "rgba(0,255,255,0.6)" }}
              >
                {isAdmin ? "Admin Password / Master Key" : "4-Digit PIN"}
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{
                    width: 16,
                    height: 16,
                    color: "rgba(0,255,255,0.4)",
                  }}
                />
                <input
                  id="unified-pin"
                  data-ocid="unified_login.pin.input"
                  type="password"
                  maxLength={isAdmin ? undefined : 4}
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none transition-colors tracking-widest"
                  style={{
                    background: "rgba(0,255,255,0.05)",
                    border: "1px solid rgba(0,255,255,0.2)",
                    letterSpacing: isAdmin ? "normal" : "0.3em",
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "rgba(0,255,255,0.6)";
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLInputElement).style.borderColor =
                      "rgba(0,255,255,0.2)";
                  }}
                  placeholder={isAdmin ? "Enter master key" : "••••"}
                  value={pin}
                  onChange={(e) => {
                    const val = isAdmin
                      ? e.target.value
                      : e.target.value.replace(/\D/g, "");
                    setPin(val);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLogin();
                  }}
                />
              </div>
              {isAdmin && (
                <p
                  className="text-xs mt-1.5"
                  style={{ color: "rgba(0,255,255,0.4)" }}
                >
                  Use master key: CLIKMATE-ADMIN-2024
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                data-ocid="unified_login.error_state"
                className="rounded-xl p-3 text-sm font-medium"
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#fca5a5",
                }}
              >
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <button
              data-ocid="unified_login.submit.primary_button"
              type="button"
              onClick={handleLogin}
              disabled={loading || loadingRoles}
              className="w-full py-3.5 rounded-full font-bold text-sm text-gray-900 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #00ffff, #0080ff)",
                boxShadow: "0 4px 24px rgba(0,255,255,0.25)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p
          className="text-center text-xs mt-6"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          © {new Date().getFullYear()} ClikMate Smart Online Service Center
        </p>
      </motion.div>
    </div>
  );
}
