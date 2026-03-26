import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "@/utils/router";
import { ArrowLeft, Loader2, Lock, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function PosLoginPage() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!mobile || mobile.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!pin || pin.length < 4) {
      setError("Please enter your 4-digit PIN.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const raw = localStorage.getItem("clikmate_staff_members");
      const staffList: Array<{
        mobile: string;
        pin: string;
        name?: string;
        id?: string;
      }> = raw ? JSON.parse(raw) : [];
      const matched = staffList.find(
        (s) => s.mobile === mobile && s.pin === pin,
      );
      if (matched) {
        localStorage.setItem(
          "staffSession",
          JSON.stringify({
            mobile,
            name: matched.name || mobile,
            loggedInAt: Date.now(),
          }),
        );
        toast.success("Login successful! Welcome to POS.");
        navigate("/staff-dashboard");
      } else {
        setError("Invalid credentials. Contact admin.");
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      data-ocid="pos_login.page"
      className="min-h-screen flex flex-col items-center justify-center"
      style={{
        background:
          "linear-gradient(135deg, #0a0f1e 0%, #0f172a 50%, #1e1b4b 100%)",
      }}
    >
      {/* Logo area */}
      <div className="mb-10 text-center">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
          }}
        >
          <span className="text-2xl font-black text-gray-900">C</span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          ClikMate
        </h1>
        <p className="text-indigo-300 text-sm mt-1 font-medium">
          Shop Staff / POS Portal
        </p>
      </div>

      {/* Login Card */}
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-8"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(20px)",
        }}
      >
        <h2 className="text-xl font-bold text-white mb-1 text-center">
          Staff Login
        </h2>
        <p className="text-white/40 text-sm text-center mb-6">
          Enter your credentials to access the POS terminal
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="pos-mobile"
              className="block text-xs font-semibold text-white/50 uppercase tracking-wide mb-1.5"
            >
              Mobile Number
            </label>
            <div className="relative">
              <Phone
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                style={{ width: 16, height: 16 }}
              />
              <input
                id="pos-mobile"
                data-ocid="pos_login.mobile.input"
                type="tel"
                maxLength={10}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
                placeholder="10-digit mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="pos-pin"
              className="block text-xs font-semibold text-white/50 uppercase tracking-wide mb-1.5"
            >
              4-Digit PIN
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                style={{ width: 16, height: 16 }}
              />
              <input
                id="pos-pin"
                data-ocid="pos_login.pin.input"
                type="password"
                maxLength={4}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-indigo-500 tracking-widest text-lg"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
              />
            </div>
          </div>

          {error && (
            <div
              data-ocid="pos_login.error_state"
              className="rounded-xl p-3 text-sm font-medium"
              style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5",
              }}
            >
              {error}
            </div>
          )}

          <Button
            data-ocid="pos_login.submit.primary_button"
            className="w-full h-11 rounded-xl font-bold text-gray-900 hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Access POS Terminal"
            )}
          </Button>
        </div>
      </div>

      {/* Back link */}
      <Link
        to="/portal"
        data-ocid="pos_login.back.link"
        className="mt-6 flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Portal
      </Link>
    </div>
  );
}
