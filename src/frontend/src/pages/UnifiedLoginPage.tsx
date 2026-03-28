import { fsGetCollection } from "@/utils/firestoreService";
import { useNavigate } from "@/utils/router";
import { Loader2, Lock, Phone } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

export default function UnifiedLoginPage() {
  const navigate = useNavigate();
  const [loginWithMobile, setLoginWithMobile] = useState(false);
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!userId) {
      setError("Please enter your User ID / Mobile number.");
      return;
    }
    if (!pin) {
      setError("Please enter your password / PIN.");
      return;
    }
    if (loginWithMobile && userId.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Admin master key check (always first)
      if (pin === "CLIKMATE-ADMIN-2024") {
        localStorage.setItem("clikmate_admin_session", "1");
        toast.success("Admin access granted!");
        navigate("/admin");
        return;
      }

      // Look up user in Firestore
      let matched: any = null;
      try {
        const users = await fsGetCollection<any>("users");
        matched = users.find(
          (u: any) =>
            (u.mobile === userId || u.userId === userId) && u.pin === pin,
        );
      } catch {
        // fallback to localStorage
        const raw = localStorage.getItem("clikmate_staff_members");
        const local: any[] = raw ? JSON.parse(raw) : [];
        matched = local.find((s: any) => s.mobile === userId && s.pin === pin);
      }

      if (!matched) {
        setError("Invalid credentials. Contact your admin.");
        return;
      }

      // Normalize roles: handle both role:string and roles:string[] from Firestore
      const normalizeRoles = (u: any): string[] => {
        if (Array.isArray(u.roles) && u.roles.length > 0) return u.roles;
        if (u.role) return [u.role];
        return ["POS_Staff"];
      };

      const userRoles = normalizeRoles(matched);
      const matchedRole = (matched.role || "").toLowerCase();

      // Admin role check
      if (userRoles.includes("Admin") || matchedRole === "admin") {
        localStorage.setItem("clikmate_admin_session", "1");
        toast.success("Admin access granted!");
        navigate("/admin");
        return;
      }

      // Save session with roles array
      localStorage.setItem(
        "staffSession",
        JSON.stringify({
          mobile: matched.mobile || userId,
          name: matched.name || userId,
          roles: userRoles,
          loggedInAt: Date.now(),
        }),
      );
      toast.success(`Welcome back, ${matched.name || userId}!`);

      // Route by roles
      const lcRoles = userRoles.map((r: string) => r.toLowerCase());
      if (
        lcRoles.includes("rider") &&
        !lcRoles.some((r: string) =>
          ["pos_staff", "print_staff", "manager", "accountant"].includes(r),
        )
      ) {
        navigate("/rider-dashboard");
      } else if (
        (lcRoles.includes("bulk service") ||
          lcRoles.includes("bulk_service")) &&
        !lcRoles.some((r: string) =>
          ["pos_staff", "print_staff", "manager", "accountant"].includes(r),
        )
      ) {
        navigate("/bulk-dashboard");
      } else {
        navigate("/staff-dashboard");
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
          {/* Title section */}
          <div className="text-center mb-7">
            <h2 className="text-2xl font-bold text-white">User Login</h2>
            <p
              className="text-sm font-semibold mt-1"
              style={{ color: "rgba(0,255,255,0.7)" }}
            >
              Sign in to ClikMate ERP
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Enter your staff credentials to continue
            </p>
          </div>

          <div className="space-y-5">
            {/* Toggle: Login with Mobile Number */}
            <label
              className="flex items-center gap-3 cursor-pointer select-none"
              data-ocid="unified_login.mobile_toggle.checkbox"
            >
              <div
                className="relative w-5 h-5 rounded flex-shrink-0"
                style={{
                  background: loginWithMobile
                    ? "rgba(0,255,255,0.8)"
                    : "rgba(0,255,255,0.07)",
                  border: "1.5px solid rgba(0,255,255,0.5)",
                  transition: "background 0.2s",
                }}
              >
                <input
                  type="checkbox"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  checked={loginWithMobile}
                  onChange={(e) => {
                    setLoginWithMobile(e.target.checked);
                    setUserId("");
                    setPin("");
                    setError("");
                  }}
                />
                {loginWithMobile && (
                  <svg
                    className="absolute inset-0 w-full h-full p-0.5"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 8l4 4 6-7"
                      stroke="#0a0f1e"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                Login with Mobile Number
              </span>
            </label>

            {/* User ID / Mobile Number */}
            <div>
              <label
                htmlFor="login-userid"
                className="block text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "rgba(0,255,255,0.6)" }}
              >
                {loginWithMobile ? "Enter Mobile Number" : "User ID"}
              </label>
              <div className="relative">
                {loginWithMobile ? (
                  <Phone
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{
                      width: 16,
                      height: 16,
                      color: "rgba(0,255,255,0.4)",
                    }}
                  />
                ) : (
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold"
                    style={{ color: "rgba(0,255,255,0.4)" }}
                  >
                    @
                  </span>
                )}
                <input
                  id="login-userid"
                  data-ocid="unified_login.userid.input"
                  type={loginWithMobile ? "tel" : "text"}
                  maxLength={loginWithMobile ? 10 : undefined}
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none transition-colors"
                  style={{
                    background: "rgba(0,255,255,0.05)",
                    border: "1px solid rgba(0,255,255,0.2)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(0,255,255,0.6)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(0,255,255,0.2)";
                  }}
                  placeholder={
                    loginWithMobile
                      ? "10-digit mobile number"
                      : "Enter your user ID"
                  }
                  value={userId}
                  onChange={(e) =>
                    setUserId(
                      loginWithMobile
                        ? e.target.value.replace(/\D/g, "")
                        : e.target.value,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLogin();
                  }}
                />
              </div>
            </div>

            {/* Password / PIN */}
            <div>
              <label
                htmlFor="login-pin"
                className="block text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "rgba(0,255,255,0.6)" }}
              >
                Password
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
                  id="login-pin"
                  data-ocid="unified_login.pin.input"
                  type="password"
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none transition-colors"
                  style={{
                    background: "rgba(0,255,255,0.05)",
                    border: "1px solid rgba(0,255,255,0.2)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(0,255,255,0.6)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(0,255,255,0.2)";
                  }}
                  placeholder="Enter your password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLogin();
                  }}
                />
              </div>
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
              disabled={loading}
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
