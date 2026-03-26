import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/context/CartContext";
import { Link, useNavigate } from "@/utils/router";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  FileText,
  Headphones,
  Printer,
  RefreshCw,
  Shield,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { KhataEntry, OrderRecord, ShopOrder } from "../backend.d";
import { useActor } from "../hooks/useActor";

const DONE_STATUSES = ["Completed", "Cancelled", "Delivered"];

function getStepIndex(status: string, _deliveryMethod: string): number {
  if (status === "Pending" || status === "Docs Received") return 0;
  if (
    status === "Processing/Printing" ||
    status === "Processing Application" ||
    status === "Hold/Missing Info" ||
    status === "Submitted to Portal"
  )
    return 1;
  if (
    status === "Ready for Pickup" ||
    status === "Ready for Delivery" ||
    status === "Out for Delivery"
  )
    return 2;
  if (status === "Completed" || status === "Delivered") return 3;
  return 0;
}

function getSteps(deliveryMethod: string) {
  return [
    "Order Placed",
    "Processing / Printing",
    deliveryMethod === "delivery" ? "Out for Delivery" : "Ready for Pickup",
    "Completed",
  ];
}

function OrderProgressTracker({ order }: { order: ShopOrder }) {
  const steps = getSteps(order.deliveryMethod);
  const currentStep = getStepIndex(order.status, order.deliveryMethod);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted z-0" />
        <div
          className="absolute left-0 top-4 h-0.5 bg-primary z-0 transition-all duration-500"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />
        {steps.map((step, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;
          return (
            <div
              key={step}
              className="flex flex-col items-center gap-1 z-10 flex-1"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isDone
                    ? "bg-green-500 border-green-500 text-white"
                    : isActive
                      ? "bg-primary border-primary text-white scale-110 shadow-lg"
                      : "bg-background border-muted text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isActive ? (
                  <Clock className="w-4 h-4" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </div>
              <span
                className={`text-center text-[10px] leading-tight font-medium max-w-[64px] ${
                  isDone
                    ? "text-green-600"
                    : isActive
                      ? "text-primary font-bold"
                      : "text-muted-foreground"
                }`}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "Completed":
    case "Delivered":
      return "bg-green-100 text-green-800";
    case "Cancelled":
      return "bg-red-100 text-red-800";
    case "Processing/Printing":
    case "Processing Application":
      return "bg-blue-100 text-blue-800";
    case "Ready for Pickup":
    case "Ready for Delivery":
      return "bg-purple-100 text-purple-800";
    case "Out for Delivery":
      return "bg-amber-100 text-amber-800";
    case "Hold/Missing Info":
      return "bg-orange-100 text-orange-800";
    case "Submitted to Portal":
      return "bg-indigo-100 text-indigo-800";
    default:
      return "bg-yellow-100 text-yellow-800";
  }
}

export default function VaultPage() {
  const phone = localStorage.getItem("clikmate_phone");
  const { actor, isFetching } = useActor();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [orderRecords, setOrderRecords] = useState<OrderRecord[]>([]);
  const [shopOrders, setShopOrders] = useState<ShopOrder[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [khataEntry, setKhataEntry] = useState<KhataEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actor || isFetching || !phone) return;
    async function fetchAll() {
      setLoading(true);
      try {
        const [records, allShop, wallet, khata] = await Promise.all([
          actor!.getOrdersByPhone(phone!),
          (actor as any).getAllShopOrders(),
          (actor as any).getWalletBalance(phone!),
          (actor as any).getKhataEntry(phone!),
        ]);
        setOrderRecords(records as OrderRecord[]);
        setShopOrders(
          (allShop as ShopOrder[]).filter((o) => o.phone === phone),
        );
        setWalletBalance(typeof wallet === "number" ? wallet : 0);
        // backend returns [] | [KhataEntry]
        const khataVal = Array.isArray(khata)
          ? (khata[0] ?? null)
          : (khata ?? null);
        setKhataEntry(khataVal);
      } catch (e) {
        console.error("Vault fetch error", e);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [actor, isFetching, phone]);

  const activeShopOrders = shopOrders.filter(
    (o) => !DONE_STATUSES.includes(o.status),
  );

  const printOrdersWithFiles = orderRecords.filter(
    (o) => o.fileUrl || (o.uploadedFiles && o.uploadedFiles.length > 0),
  );

  const cscOutputOrders = shopOrders.filter(
    (o) => o.cscFinalOutput && (o.cscFinalOutput as any).length > 0,
  );

  function handleReprint(order: OrderRecord) {
    addToCart({
      itemId: Number(order.id) + 90000,
      itemName: `Re-Print: ${order.serviceType}`,
      category: "Print Service",
      price: 0,
    });
    toast.success(`"${order.serviceType}" added to cart for re-print!`);
    navigate("/checkout");
  }

  if (!phone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center shadow-2xl border-0">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Login Required
            </h2>
            <p className="text-muted-foreground text-sm">
              Please login with your mobile number to access your Digital Vault.
            </p>
            <Link to="/">
              <Button className="w-full mt-2" data-ocid="vault.login.button">
                Go to Home &amp; Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-slate-900/80 border-b border-white/10 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/">
            <Button
              variant="ghost"
              size="sm"
              data-ocid="vault.back.button"
              className="text-white hover:bg-white/10 gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-8 h-8 rounded-xl bg-yellow-400/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-none">
                My Digital Vault
              </h1>
              <p className="text-white/50 text-xs mt-0.5">{phone}</p>
            </div>
          </div>
          <Link to="/support" className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 gap-1.5"
              data-ocid="vault.help_support.link"
            >
              <Headphones className="w-4 h-4" />
              <span className="hidden sm:inline">Help & Support</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* ─── Section 1: Active Orders ─── */}
        <section data-ocid="vault.active_orders.section">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-bold text-lg">Active Orders</h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-40 rounded-2xl bg-white/10" />
              ))}
            </div>
          ) : activeShopOrders.length === 0 ? (
            <div
              data-ocid="vault.active_orders.empty_state"
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8 text-center"
            >
              <ShoppingBag className="w-10 h-10 text-white/30 mx-auto mb-3" />
              <p className="text-white/60 font-medium">
                No active orders right now
              </p>
              <p className="text-white/40 text-sm mt-1">
                Your in-progress orders will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeShopOrders.map((order, idx) => (
                <div
                  key={String(order.id)}
                  data-ocid={`vault.active_orders.item.${idx + 1}`}
                  className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-white font-bold text-sm">
                        #{"SO"}-{String(order.id)}
                      </p>
                      <p className="text-white/50 text-xs mt-0.5">
                        {order.items.map((it) => it.itemName).join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(order.status)}`}
                      >
                        {order.status}
                      </span>
                      <span className="text-yellow-400 font-bold text-sm">
                        ₹{order.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <OrderProgressTracker order={order} />
                  {(order.status === "Ready for Delivery" ||
                    order.status === "Out for Delivery") &&
                    order.deliveryOtp &&
                    order.deliveryOtp !== "" && (
                      <div
                        style={{
                          marginTop: 12,
                          background:
                            "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.1))",
                          border: "1px solid rgba(245,158,11,0.4)",
                          borderRadius: 12,
                          padding: "14px 16px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ fontSize: 16 }}>🔐</span>
                          <span
                            style={{
                              color: "#f59e0b",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            Share this PIN with your Rider
                          </span>
                        </div>
                        <p
                          style={{
                            color: "#94a3b8",
                            fontSize: 11,
                            marginBottom: 10,
                          }}
                        >
                          Give this code to the delivery partner when they
                          arrive.
                        </p>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: 10,
                          }}
                        >
                          {[0, 1, 2, 3].map((pos) => {
                            const digit = order.deliveryOtp?.[pos] ?? " ";
                            return (
                              <span
                                key={`d${pos}`}
                                style={{
                                  width: 44,
                                  height: 52,
                                  borderRadius: 10,
                                  background: "#0f172a",
                                  border: "2px solid rgba(245,158,11,0.5)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 28,
                                  fontWeight: 900,
                                  color: "#f59e0b",
                                  fontFamily: "monospace",
                                }}
                              >
                                {digit}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Section 2: Wallet & Khata ─── */}
        <section data-ocid="vault.wallet.section">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-bold text-lg">
              My Wallet &amp; Khata
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Wallet Card */}
            <div
              data-ocid="vault.wallet.card"
              className="rounded-2xl p-5 bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <span className="text-white/80 font-medium text-sm">
                  ClikMate Wallet
                </span>
              </div>
              {loading ? (
                <Skeleton className="h-8 w-24 bg-white/20 rounded" />
              ) : (
                <>
                  <p className="text-3xl font-extrabold tracking-tight">
                    ₹{walletBalance.toFixed(2)}
                  </p>
                  {walletBalance === 0 && (
                    <p className="text-white/60 text-xs mt-1">
                      Top up at the store
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Khata Card */}
            {!loading && khataEntry && khataEntry.totalDue > 0 ? (
              <div
                data-ocid="vault.khata.card"
                className="rounded-2xl p-5 bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-xl"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-white/80 font-medium text-sm">
                    Outstanding Due
                  </span>
                </div>
                <p className="text-3xl font-extrabold tracking-tight">
                  ₹{khataEntry.totalDue.toFixed(2)}
                </p>
                <p className="text-white/70 text-xs mt-1">
                  Please visit the shop or call us to clear your balance.
                </p>
              </div>
            ) : (
              !loading && (
                <div className="rounded-2xl p-5 bg-white/5 border border-white/10 flex items-center justify-center text-center">
                  <div>
                    <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-white/70 text-sm font-medium">
                      No pending dues
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">
                      Your account is clear!
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        {/* ─── Section 3: Document Locker ─── */}
        <section data-ocid="vault.documents.section">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-bold text-lg">My Saved Documents</h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl bg-white/10" />
              ))}
            </div>
          ) : printOrdersWithFiles.length === 0 &&
            cscOutputOrders.length === 0 ? (
            <div
              data-ocid="vault.documents.empty_state"
              className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center"
            >
              <FileText className="w-10 h-10 text-white/30 mx-auto mb-3" />
              <p className="text-white/60 font-medium">
                Your documents will appear here
              </p>
              <p className="text-white/40 text-sm mt-1">
                Files will show up after your first print or CSC order.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Print Orders / Upload History */}
              {printOrdersWithFiles.length > 0 && (
                <div>
                  <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">
                    My Upload History (Print Orders)
                  </p>
                  <div className="space-y-3">
                    {printOrdersWithFiles.map((order, idx) => (
                      <div
                        key={String(order.id)}
                        data-ocid={`vault.documents.item.${idx + 1}`}
                        className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 flex items-center justify-between gap-3 flex-wrap"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <Printer className="w-5 h-5 text-blue-300" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-semibold text-sm truncate">
                              {order.serviceType}
                            </p>
                            <p className="text-white/40 text-xs">
                              {new Date(
                                Number(order.submittedAt) / 1_000_000,
                              ).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(order.status)}`}
                          >
                            {order.status}
                          </span>
                          {order.fileUrl && (
                            <a
                              href={order.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                data-ocid={`vault.documents.view.button.${idx + 1}`}
                                className="border-white/20 text-white hover:bg-white/10 text-xs h-8"
                              >
                                <FileText className="w-3.5 h-3.5 mr-1" />
                                View
                              </Button>
                            </a>
                          )}
                          <Button
                            size="sm"
                            data-ocid={`vault.documents.reprint.button.${idx + 1}`}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5"
                            onClick={() => handleReprint(order)}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Re-Print
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CSC Final Output */}
              {cscOutputOrders.length > 0 && (
                <div>
                  <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">
                    Admin-Delivered Documents (CSC Outputs)
                  </p>
                  <div className="space-y-3">
                    {cscOutputOrders.map((order, idx) => {
                      const blob = Array.isArray(order.cscFinalOutput)
                        ? order.cscFinalOutput[0]
                        : order.cscFinalOutput;
                      const downloadUrl = blob?.getDirectURL?.() ?? "#";
                      return (
                        <div
                          key={String(order.id)}
                          data-ocid={`vault.documents.csc.item.${idx + 1}`}
                          className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 flex items-center justify-between gap-3 flex-wrap"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                              <Download className="w-5 h-5 text-green-300" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-white font-semibold text-sm truncate">
                                {order.items[0]?.itemName ?? "CSC Service"}
                              </p>
                              <p className="text-white/40 text-xs">
                                Order #SO-{String(order.id)} &bull;{" "}
                                {new Date(
                                  Number(order.createdAt) / 1_000_000,
                                ).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(order.status)}`}
                            >
                              {order.status}
                            </span>
                            <a
                              href={downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                size="sm"
                                data-ocid={`vault.documents.download.button.${idx + 1}`}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 gap-1.5"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </Button>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="text-center py-4">
          <p className="text-white/30 text-xs">
            &copy; {new Date().getFullYear()}. Built with ❤️ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white/60"
            >
              caffeine.ai
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
