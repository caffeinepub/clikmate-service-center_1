import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActor } from "@/hooks/useActor";
import {
  CheckCircle2,
  Loader2,
  LogOut,
  MapPin,
  Navigation,
  Package,
  Phone,
  RefreshCw,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type RiderOrder = {
  id: number | bigint;
  orderId: string;
  customerName: string;
  phone: string;
  deliveryAddress: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  items: Array<{ itemName: string }>;
};

export default function RiderDashboard() {
  const { actor, isFetching } = useActor();
  const [screen, setScreen] = useState<"login" | "dashboard">(() => {
    const s = localStorage.getItem("riderSession");
    const adminS = localStorage.getItem("clikmate_admin_session");
    return s === "active" || adminS === "1" ? "dashboard" : "login";
  });
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [logging, setLogging] = useState(false);
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [otpTarget, setOtpTarget] = useState<RiderOrder | null>(null);
  const [otpValue, setOtpValue] = useState("");
  const [confirmingOtp, setConfirmingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [accepting, setAccepting] = useState<string | null>(null);

  async function fetchOrders() {
    if (!actor) return;
    setLoadingOrders(true);
    try {
      const all = await (actor as any).getReadyForDeliveryOrders();
      setOrders(all as RiderOrder[]);
    } catch {
      toast.error("Failed to load deliveries.");
    } finally {
      setLoadingOrders(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchOrders
  useEffect(() => {
    if (screen === "dashboard" && actor && !isFetching) {
      fetchOrders();
    }
  }, [screen, actor, isFetching]);

  async function handleLogin() {
    if (!actor) return;
    if (mobile.length !== 10 || pin.length !== 4) {
      toast.error("Enter valid 10-digit mobile and 4-digit PIN.");
      return;
    }
    setLogging(true);
    try {
      const result = await (actor as any).verifyRider(mobile, pin);
      if (result === true || result === "ok" || result?.ok !== undefined) {
        localStorage.setItem("riderSession", "active");
        localStorage.setItem("riderMobile", mobile);
        setScreen("dashboard");
        toast.success("Welcome, Rider!");
      } else {
        toast.error("Invalid credentials. Check your mobile and PIN.");
      }
    } catch {
      toast.error("Login failed. Please try again.");
    } finally {
      setLogging(false);
    }
  }

  function handleLogout() {
    const adminS = localStorage.getItem("clikmate_admin_session");
    if (adminS === "1") {
      window.location.hash = "#/admin";
      return;
    }
    localStorage.removeItem("riderSession");
    localStorage.removeItem("riderMobile");
    setScreen("login");
    setOrders([]);
    setMobile("");
    setPin("");
  }

  async function handleAcceptDelivery(order: RiderOrder) {
    if (!actor) return;
    const key = String(order.id);
    setAccepting(key);
    try {
      await (actor as any).acceptDelivery(BigInt(order.id));
      toast.success(`Order ${order.orderId} accepted! Out for delivery.`);
      await fetchOrders();
    } catch {
      toast.error("Failed to accept delivery.");
    } finally {
      setAccepting(null);
    }
  }

  async function handleConfirmDelivery() {
    if (!actor || !otpTarget) return;
    if (otpValue.length !== 4) {
      setOtpError("Please enter the 4-digit OTP.");
      return;
    }
    setConfirmingOtp(true);
    setOtpError("");
    try {
      await (actor as any).markOrderDelivered(BigInt(otpTarget.id), otpValue);
      toast.success("Delivery confirmed! Payment recorded.");
      setOtpTarget(null);
      setOtpValue("");
      await fetchOrders();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (
        msg.toLowerCase().includes("otp") ||
        msg.toLowerCase().includes("invalid")
      ) {
        setOtpError("Incorrect OTP. Please try again.");
      } else {
        setOtpError("Failed to confirm delivery. Try again.");
      }
    } finally {
      setConfirmingOtp(false);
    }
  }

  // ── Login Screen ──────────────────────────────────────────────────────────
  if (screen === "login") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            background: "#1e293b",
            borderRadius: 16,
            padding: 32,
            width: "100%",
            maxWidth: 380,
            border: "1px solid rgba(245,158,11,0.2)",
            boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(245,158,11,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
              }}
            >
              <Truck style={{ width: 28, height: 28, color: "#f59e0b" }} />
            </div>
            <h1
              style={{
                color: "#f1f5f9",
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Rider Login
            </h1>
            <p style={{ color: "#64748b", fontSize: 13 }}>
              Smart Online Service Center
            </p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Label
              style={{
                color: "#cbd5e1",
                fontSize: 12,
                marginBottom: 6,
                display: "block",
              }}
            >
              Mobile Number
            </Label>
            <Input
              data-ocid="rider.mobile.input"
              type="tel"
              placeholder="10-digit mobile"
              maxLength={10}
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
              style={{
                background: "#0f172a",
                border: "1px solid #334155",
                color: "#f1f5f9",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <Label
              style={{
                color: "#cbd5e1",
                fontSize: 12,
                marginBottom: 6,
                display: "block",
              }}
            >
              4-Digit PIN
            </Label>
            <Input
              data-ocid="rider.pin.input"
              type="password"
              placeholder="••••"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              style={{
                background: "#0f172a",
                border: "1px solid #334155",
                color: "#f1f5f9",
              }}
            />
          </div>

          <Button
            data-ocid="rider.login.primary_button"
            onClick={handleLogin}
            disabled={logging || isFetching}
            style={{
              width: "100%",
              background: "#f59e0b",
              color: "#0f172a",
              fontWeight: 700,
              border: 0,
            }}
          >
            {logging ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </Button>

          <p
            style={{
              textAlign: "center",
              marginTop: 16,
              color: "#475569",
              fontSize: 12,
            }}
          >
            Contact admin if you forgot your PIN.
          </p>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a" }}>
      {/* Header */}
      <header
        style={{
          background: "#1e293b",
          borderBottom: "1px solid rgba(245,158,11,0.2)",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Truck style={{ width: 22, height: 22, color: "#f59e0b" }} />
          <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 16 }}>
            Delivery Dashboard
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            data-ocid="rider.refresh.button"
            variant="ghost"
            size="sm"
            onClick={fetchOrders}
            disabled={loadingOrders}
            style={{ color: "#94a3b8" }}
          >
            <RefreshCw
              style={{
                width: 15,
                height: 15,
                ...(loadingOrders
                  ? { animation: "spin 1s linear infinite" }
                  : {}),
              }}
            />
          </Button>
          <Button
            data-ocid="rider.logout.button"
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            style={{ color: "#64748b" }}
          >
            <LogOut style={{ width: 15, height: 15 }} />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "20px 16px",
        }}
      >
        {loadingOrders ? (
          <div
            data-ocid="rider.orders.loading_state"
            style={{ textAlign: "center", paddingTop: 60 }}
          >
            <Loader2
              style={{
                width: 40,
                height: 40,
                color: "#f59e0b",
                margin: "0 auto 12px",
                animation: "spin 1s linear infinite",
              }}
            />
            <p style={{ color: "#64748b" }}>Loading deliveries...</p>
          </div>
        ) : orders.length === 0 ? (
          <div
            data-ocid="rider.orders.empty_state"
            style={{ textAlign: "center", paddingTop: 80 }}
          >
            <Package
              style={{
                width: 56,
                height: 56,
                color: "#334155",
                margin: "0 auto 16px",
              }}
            />
            <p style={{ color: "#94a3b8", fontSize: 16, fontWeight: 600 }}>
              No active deliveries
            </p>
            <p style={{ color: "#475569", fontSize: 13, marginTop: 6 }}>
              Orders marked "Ready for Delivery" will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ color: "#64748b", fontSize: 13 }}>
              {orders.length} active deliver{orders.length === 1 ? "y" : "ies"}
            </p>
            {orders.map((order, idx) => {
              const isCash =
                order.paymentMethod === "Pay at Store / Cash on Delivery" ||
                order.paymentMethod === "Khata Due";
              const isOutForDelivery = order.status === "Out for Delivery";
              const isAccepting = accepting === String(order.id);
              return (
                <div
                  key={String(order.id)}
                  data-ocid={`rider.order.item.${idx + 1}`}
                  style={{
                    background: "#1e293b",
                    borderRadius: 14,
                    overflow: "hidden",
                    border: isOutForDelivery
                      ? "1px solid rgba(34,197,94,0.3)"
                      : "1px solid rgba(245,158,11,0.2)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      background: "#0f172a",
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        color: "#f1f5f9",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      {order.orderId}
                    </span>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.03em",
                        background: isOutForDelivery
                          ? "rgba(34,197,94,0.2)"
                          : "rgba(245,158,11,0.2)",
                        color: isOutForDelivery ? "#22c55e" : "#f59e0b",
                      }}
                    >
                      {isOutForDelivery
                        ? "Out for Delivery"
                        : "Awaiting Pickup"}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: "16px" }}>
                    <p
                      style={{
                        color: "#f1f5f9",
                        fontWeight: 700,
                        fontSize: 16,
                        marginBottom: 8,
                      }}
                    >
                      {order.customerName}
                    </p>

                    {order.deliveryAddress && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 6,
                          marginBottom: 12,
                        }}
                      >
                        <MapPin
                          style={{
                            width: 14,
                            height: 14,
                            color: "#64748b",
                            marginTop: 2,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: "#94a3b8", fontSize: 13 }}>
                          {order.deliveryAddress}
                        </span>
                      </div>
                    )}

                    {/* Amount */}
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: isCash
                          ? "rgba(239,68,68,0.1)"
                          : "rgba(34,197,94,0.1)",
                        border: isCash
                          ? "1px solid rgba(239,68,68,0.2)"
                          : "1px solid rgba(34,197,94,0.2)",
                        marginBottom: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: isCash ? "#fca5a5" : "#86efac",
                        }}
                      >
                        {isCash ? "COLLECT CASH" : "Pre-Paid"}
                      </span>
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: isCash ? "#ef4444" : "#22c55e",
                        }}
                      >
                        {isCash ? `₹${order.totalAmount.toFixed(2)}` : "✓"}
                      </span>
                    </div>

                    {/* Action Buttons Row */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 8,
                      }}
                    >
                      {/* Call Customer */}
                      <a
                        href={`tel:${order.phone}`}
                        data-ocid={`rider.call_button.${idx + 1}`}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "10px 8px",
                          borderRadius: 10,
                          background: "rgba(59,130,246,0.15)",
                          border: "1px solid rgba(59,130,246,0.2)",
                          textDecoration: "none",
                          gap: 4,
                        }}
                      >
                        <Phone
                          style={{ width: 16, height: 16, color: "#60a5fa" }}
                        />
                        <span
                          style={{
                            color: "#60a5fa",
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          Call
                        </span>
                      </a>

                      {/* Get Directions */}
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(order.deliveryAddress || "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-ocid={`rider.directions_button.${idx + 1}`}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "10px 8px",
                          borderRadius: 10,
                          background: "rgba(99,102,241,0.15)",
                          border: "1px solid rgba(99,102,241,0.2)",
                          textDecoration: "none",
                          gap: 4,
                        }}
                      >
                        <Navigation
                          style={{ width: 16, height: 16, color: "#818cf8" }}
                        />
                        <span
                          style={{
                            color: "#818cf8",
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          Directions
                        </span>
                      </a>

                      {/* Conditional Action */}
                      {!isOutForDelivery ? (
                        <button
                          type="button"
                          data-ocid={`rider.accept_button.${idx + 1}`}
                          onClick={() => handleAcceptDelivery(order)}
                          disabled={isAccepting}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "10px 8px",
                            borderRadius: 10,
                            background: "rgba(245,158,11,0.2)",
                            border: "1px solid rgba(245,158,11,0.3)",
                            cursor: isAccepting ? "not-allowed" : "pointer",
                            gap: 4,
                            opacity: isAccepting ? 0.6 : 1,
                          }}
                        >
                          {isAccepting ? (
                            <Loader2
                              style={{
                                width: 16,
                                height: 16,
                                color: "#f59e0b",
                                animation: "spin 1s linear infinite",
                              }}
                            />
                          ) : (
                            <Truck
                              style={{
                                width: 16,
                                height: 16,
                                color: "#f59e0b",
                              }}
                            />
                          )}
                          <span
                            style={{
                              color: "#f59e0b",
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            Accept
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-ocid={`rider.deliver_button.${idx + 1}`}
                          onClick={() => {
                            setOtpTarget(order);
                            setOtpValue("");
                            setOtpError("");
                          }}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "10px 8px",
                            borderRadius: 10,
                            background: "rgba(34,197,94,0.2)",
                            border: "1px solid rgba(34,197,94,0.3)",
                            cursor: "pointer",
                            gap: 4,
                          }}
                        >
                          <CheckCircle2
                            style={{ width: 16, height: 16, color: "#22c55e" }}
                          />
                          <span
                            style={{
                              color: "#22c55e",
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            Delivered
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* OTP Modal */}
      {otpTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            data-ocid="rider.otp.dialog"
            style={{
              background: "#1e293b",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 360,
              border: "1px solid rgba(34,197,94,0.3)",
              boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <CheckCircle2
                style={{
                  width: 40,
                  height: 40,
                  color: "#22c55e",
                  margin: "0 auto 10px",
                }}
              />
              <h3
                style={{
                  color: "#f1f5f9",
                  fontWeight: 700,
                  fontSize: 18,
                  marginBottom: 4,
                }}
              >
                Confirm Delivery
              </h3>
              <p style={{ color: "#64748b", fontSize: 13 }}>
                {otpTarget.orderId} — {otpTarget.customerName}
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Label
                style={{
                  color: "#cbd5e1",
                  fontSize: 12,
                  marginBottom: 8,
                  display: "block",
                }}
              >
                Enter 4-digit Delivery OTP from customer
              </Label>
              <Input
                data-ocid="rider.otp.input"
                type="tel"
                placeholder="0000"
                maxLength={4}
                value={otpValue}
                onChange={(e) => {
                  setOtpValue(e.target.value.replace(/\D/g, ""));
                  setOtpError("");
                }}
                style={{
                  background: "#0f172a",
                  border: otpError ? "2px solid #ef4444" : "1px solid #334155",
                  color: "#f1f5f9",
                  textAlign: "center",
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: "0.4em",
                  height: 60,
                }}
              />
              {otpError && (
                <p
                  data-ocid="rider.otp.error_state"
                  style={{
                    color: "#ef4444",
                    fontSize: 12,
                    marginTop: 6,
                    textAlign: "center",
                  }}
                >
                  {otpError}
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                data-ocid="rider.otp.cancel_button"
                onClick={() => {
                  setOtpTarget(null);
                  setOtpValue("");
                  setOtpError("");
                }}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  background: "#334155",
                  border: "none",
                  color: "#94a3b8",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                data-ocid="rider.otp.confirm_button"
                onClick={handleConfirmDelivery}
                disabled={confirmingOtp || otpValue.length !== 4}
                style={{
                  flex: 2,
                  padding: "10px 0",
                  borderRadius: 8,
                  background:
                    confirmingOtp || otpValue.length !== 4
                      ? "#334155"
                      : "#22c55e",
                  border: "none",
                  color:
                    confirmingOtp || otpValue.length !== 4
                      ? "#64748b"
                      : "#0f172a",
                  fontWeight: 700,
                  cursor:
                    confirmingOtp || otpValue.length !== 4
                      ? "not-allowed"
                      : "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {confirmingOtp ? (
                  <>
                    <Loader2
                      style={{
                        width: 15,
                        height: 15,
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    Confirming...
                  </>
                ) : (
                  "Confirm Delivery"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
