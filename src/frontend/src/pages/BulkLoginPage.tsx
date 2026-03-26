import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActor } from "@/hooks/useActor";
import { useNavigate } from "@/utils/router";
import { ArrowLeft, Loader2, Printer, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

export default function BulkLoginPage() {
  const navigate = useNavigate();
  const { actor } = useActor();
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const bulkSession = localStorage.getItem("bulkSession");
    const adminSession = localStorage.getItem("clikmate_admin_session");
    if (bulkSession || adminSession) {
      navigate("/bulk-dashboard");
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim() || pin.length < 4) {
      setError("Please enter your mobile number and 4-digit PIN.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (!actor) {
        setError("System not ready. Please try again.");
        setLoading(false);
        return;
      }
      const ok = await actor.verifyBulkStaff(mobile.trim(), pin);
      if (ok) {
        localStorage.setItem(
          "bulkSession",
          JSON.stringify({
            mobile: mobile.trim(),
            role: "Bulk Printing Staff",
            loggedInAt: Date.now(),
          }),
        );
        navigate("/bulk-dashboard");
      } else {
        setError("Invalid credentials or insufficient role.");
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-ocid="bulk.login.page"
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{
        background:
          "linear-gradient(135deg, #0a0f1e 0%, #0f172a 60%, #1a0a2e 100%)",
      }}
    >
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(192,132,252,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(192,132,252,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div
        className="relative w-full max-w-md rounded-2xl p-8 flex flex-col gap-6"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(192,132,252,0.25)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 0 60px rgba(192,132,252,0.08)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-1"
            style={{
              background: "rgba(192,132,252,0.15)",
              border: "1px solid rgba(192,132,252,0.3)",
            }}
          >
            <Printer className="w-8 h-8" style={{ color: "#c084fc" }} />
          </div>
          <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">
            Smart Online Service Center
          </p>
          <h1 className="text-2xl font-black text-white text-center leading-tight">
            Bulk Printing Staff Portal
          </h1>
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
            style={{
              background: "rgba(192,132,252,0.12)",
              color: "#c084fc",
              border: "1px solid rgba(192,132,252,0.2)",
            }}
          >
            <ShieldCheck className="w-3 h-3" />
            Secure Access Only
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-white/60 text-sm">Mobile Number</Label>
            <Input
              data-ocid="bulk.login.input"
              type="tel"
              placeholder="Enter registered mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              maxLength={10}
              className="h-11 text-white placeholder:text-white/25"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(192,132,252,0.2)",
                borderRadius: "10px",
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-white/60 text-sm">4-Digit PIN</Label>
            <Input
              data-ocid="bulk.pin.input"
              type="password"
              placeholder="● ● ● ●"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              maxLength={4}
              className="h-11 text-white placeholder:text-white/25 tracking-widest text-center text-lg"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(192,132,252,0.2)",
                borderRadius: "10px",
              }}
            />
          </div>

          {error && (
            <div
              data-ocid="bulk.login.error_state"
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                background: "rgba(239,68,68,0.12)",
                color: "#f87171",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              {error}
            </div>
          )}

          <Button
            data-ocid="bulk.login.submit_button"
            type="submit"
            disabled={loading}
            className="h-12 font-bold text-base mt-1"
            style={{
              background: loading
                ? "rgba(192,132,252,0.3)"
                : "linear-gradient(135deg, #a855f7, #c084fc)",
              color: "white",
              border: "none",
              borderRadius: "10px",
            }}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
              </>
            ) : (
              "Access Bulk Portal"
            )}
          </Button>
        </form>

        {/* Back link */}
        <button
          type="button"
          data-ocid="bulk.login.link"
          onClick={() => navigate("/portal")}
          className="flex items-center justify-center gap-2 text-sm text-white/35 hover:text-white/60 transition-colors mx-auto mt-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Team Portal
        </button>
      </div>
    </div>
  );
}
