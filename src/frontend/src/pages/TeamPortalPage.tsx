import { useNavigate } from "@/utils/router";
import { Crown, Package, Printer, ShieldCheck, Truck } from "lucide-react";
import { useState } from "react";

function PortalCard({
  icon,
  title,
  description,
  buttonLabel,
  accentColor,
  accentBg,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  accentColor: string;
  accentBg: string;
  onClick: () => void;
}) {
  return (
    <div
      className="rounded-2xl flex flex-col p-8 gap-5 transition-transform hover:-translate-y-1"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
        style={{ background: accentBg }}
      >
        {icon}
      </div>
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-white/50 text-sm leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="mt-auto w-full py-3 rounded-xl font-bold text-sm transition-opacity hover:opacity-90"
        style={{ background: accentColor, color: "#0a0f1e" }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

export default function TeamPortalPage() {
  const navigate = useNavigate();
  const [roleError, setRoleError] = useState("");

  function handleAdminAccess() {
    const staffSession = localStorage.getItem("staffSession");
    const riderSession = localStorage.getItem("riderSession");
    if (staffSession) {
      setRoleError("Access Denied: Invalid Role. You are logged in as Staff.");
      return;
    }
    if (riderSession) {
      setRoleError(
        "Access Denied: Invalid Role. You are logged in as a Delivery Partner.",
      );
      return;
    }
    setRoleError("");
    navigate("/admin");
  }

  return (
    <div
      data-ocid="portal.page"
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{
        background:
          "linear-gradient(135deg, #0a0f1e 0%, #0f172a 60%, #1e1b4b 100%)",
      }}
    >
      {/* Header */}
      <div className="text-center mb-12">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <ShieldCheck className="w-8 h-8 text-indigo-300" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
          Smart Online Team Portal
        </h1>
        <p className="text-indigo-300 text-sm font-medium">
          Authorized Personnel Only
        </p>
      </div>

      {/* Role Error */}
      {roleError && (
        <div
          data-ocid="portal.role.error_state"
          className="mb-6 w-full max-w-sm rounded-xl p-4 text-sm font-medium text-center"
          style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
          }}
        >
          🚫 {roleError}
        </div>
      )}

      {/* Cards - 2x2 grid on desktop */}
      <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <PortalCard
          icon={<Crown className="w-7 h-7" style={{ color: "#0a0f1e" }} />}
          title="Super Admin"
          description="Full platform management, catalog, reports, team & settings control"
          buttonLabel="Access Admin Panel"
          accentColor="#818cf8"
          accentBg="rgba(99,102,241,0.3)"
          onClick={handleAdminAccess}
        />
        <PortalCard
          icon={<Package className="w-7 h-7" style={{ color: "#0a0f1e" }} />}
          title="Shop Staff / POS"
          description="Counter billing, POS operations & instant digital receipts"
          buttonLabel="Staff Login"
          accentColor="#f59e0b"
          accentBg="rgba(245,158,11,0.25)"
          onClick={() => navigate("/pos-login")}
        />
        <PortalCard
          icon={<Printer className="w-7 h-7" style={{ color: "#0a0f1e" }} />}
          title="Bulk Printing Staff"
          description="Handle large B2B orders, bulk typesetting & coaching institute requests"
          buttonLabel="Bulk Staff Login"
          accentColor="#c084fc"
          accentBg="rgba(192,132,252,0.2)"
          onClick={() => navigate("/bulk-login")}
        />
        <PortalCard
          icon={<Truck className="w-7 h-7" style={{ color: "#0a0f1e" }} />}
          title="Delivery Partner"
          description="Manage assigned deliveries & confirm OTP-verified handoffs"
          buttonLabel="Rider Login"
          accentColor="#4ade80"
          accentBg="rgba(34,197,94,0.2)"
          onClick={() => navigate("/rider")}
        />
      </div>

      {/* Footer note */}
      <p className="mt-12 text-white/25 text-xs text-center">
        All activity on this portal is logged and monitored.
      </p>
    </div>
  );
}
