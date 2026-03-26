import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Download,
  Loader2,
  LogOut,
  Package,
  RefreshCw,
  Upload,
  User,
  Wallet,
} from "lucide-react";
import { AlertCircle, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrderRecord, ShopOrder } from "../backend";
import type { backendInterface } from "../backend.d";
import { useActor } from "../hooks/useActor";
import ReviewModal, {
  getDismissedReviews,
  getSubmittedReviews,
  markReviewSubmitted,
} from "./ReviewModal";
import { WhatsAppShareButton } from "./WhatsAppButton";

interface DashboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  onLogout: () => void;
  onUploadClick: () => void;
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  if (lower === "pending") {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">
        Pending
      </Badge>
    );
  }
  if (lower === "printing") {
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
        Printing
      </Badge>
    );
  }
  if (lower === "ready for pickup" || lower === "ready") {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
        Ready for Pickup
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

function formatDate(submittedAt: bigint): string {
  const ms = Number(submittedAt) / 1_000_000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardModal({
  open,
  onOpenChange,
  phone,
  onLogout,
  onUploadClick,
}: DashboardModalProps) {
  const { actor } = useActor();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [khataBalance, setKhataBalance] = useState<number | null>(null);

  const [shopOrders, setShopOrders] = useState<ShopOrder[]>([]);
  const [reviewModalOrder, setReviewModalOrder] = useState<ShopOrder | null>(
    null,
  );
  const [submittedReviews, setSubmittedReviews] = useState<string[]>(() =>
    getSubmittedReviews(),
  );

  useEffect(() => {
    if (open && actor && phone) {
      setLoading(true);
      setWalletLoading(true);
      Promise.all([
        actor.getOrdersByPhone(phone).catch(() => [] as OrderRecord[]),
        (actor as unknown as backendInterface)
          .getWalletBalance(phone)
          .catch(() => 0),
        (actor as unknown as { getAllShopOrders?: () => Promise<ShopOrder[]> })
          .getAllShopOrders?.()
          .then((all: ShopOrder[]) =>
            all.filter((o: ShopOrder) => o.phone === phone),
          )
          .catch(() => [] as ShopOrder[]),
        (actor as unknown as backendInterface)
          .getKhataEntry(phone)
          .catch(() => null),
      ])
        .then(([ordersData, balance, shopOrdersData, khataEntry]) => {
          setOrders(ordersData);
          setWalletBalance(balance);
          setShopOrders(shopOrdersData || []);
          setKhataBalance((khataEntry as any)?.totalDue ?? null);
        })
        .finally(() => {
          setLoading(false);
          setWalletLoading(false);
        });
    }
  }, [open, actor, phone]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-ocid="dashboard.modal"
          className="max-w-2xl w-full rounded-2xl p-0 overflow-y-auto border-0 shadow-2xl"
        >
          {/* Header */}
          <div className="hero-gradient px-8 pt-8 pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 yellow-bg rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-900" />
                </div>
                <div>
                  <DialogHeader>
                    <DialogTitle className="text-white text-xl font-bold">
                      My Digital Vault
                    </DialogTitle>
                  </DialogHeader>
                  <p className="text-blue-200 text-sm">+91 {phone}</p>
                </div>
              </div>
              <button
                type="button"
                data-ocid="dashboard.logout.button"
                onClick={onLogout}
                className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* My Wallet Section */}
            <div className="mb-6">
              <div
                data-ocid="dashboard.wallet.card"
                className="rounded-2xl p-5 text-white relative overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.25 0.1 260), oklch(0.3 0.15 280))",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.15)" }}
                    >
                      <Wallet className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-blue-200 text-xs font-medium">
                        ClikMate Wallet
                      </p>
                      <p className="text-white font-semibold text-sm">
                        My Wallet Balance
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {walletLoading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-white/60" />
                    ) : walletBalance !== null && walletBalance > 0 ? (
                      <>
                        <p className="text-3xl font-extrabold text-white">
                          ₹{walletBalance.toFixed(2)}
                        </p>
                        <p className="text-blue-200 text-xs mt-0.5">
                          Available Balance
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-extrabold text-white/60">
                          ₹0.00
                        </p>
                        <p className="text-blue-300 text-xs mt-0.5">
                          Top up at the store
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {/* Decorative circle */}
                <div
                  className="absolute -top-6 -right-6 w-24 h-24 rounded-full"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                />
              </div>
            </div>

            {/* Khata / Due Balance Section */}
            {khataBalance !== null && khataBalance > 0 && (
              <div className="mb-4">
                <div
                  data-ocid="dashboard.khata.card"
                  className="rounded-2xl p-4 flex items-start gap-3"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.08))",
                    border: "1px solid rgba(239,68,68,0.35)",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(239,68,68,0.2)" }}
                  >
                    <AlertCircle
                      className="w-5 h-5"
                      style={{ color: "#ef4444" }}
                    />
                  </div>
                  <div>
                    <p
                      className="font-bold text-sm"
                      style={{ color: "#ef4444" }}
                    >
                      Outstanding Shop Due: ₹{khataBalance.toFixed(2)}
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      You have an outstanding balance at Smart Online Service
                      Center. Please visit the shop or contact us to clear your
                      dues.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold blue-text text-base flex items-center gap-2">
                <Package className="w-5 h-5" />
                Past Orders / Uploaded Documents
              </h3>
              <Button
                data-ocid="dashboard.upload_new.primary_button"
                onClick={onUploadClick}
                className="yellow-bg text-gray-900 font-semibold rounded-xl h-9 px-4 border-0 hover:opacity-90 text-xs"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Upload New Document
              </Button>
            </div>

            {/* CSC Applications Section */}
            {shopOrders.filter(
              (o) => o.cscDocuments && o.cscDocuments.length > 0,
            ).length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold blue-text text-base flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                  CSC & Govt Applications
                </h3>
                <div className="space-y-3">
                  {shopOrders
                    .filter((o) => o.cscDocuments && o.cscDocuments.length > 0)
                    .map((order, i) => {
                      const CSC_STEPS = [
                        "Docs Received",
                        "Processing Application",
                        "Hold/Missing Info",
                        "Submitted to Portal",
                        "Completed",
                      ];
                      const currentStepIdx = CSC_STEPS.indexOf(order.status);
                      const isHold = order.status === "Hold/Missing Info";
                      return (
                        <div
                          key={String(order.id)}
                          data-ocid={`dashboard.csc_order.card.${i + 1}`}
                          className="rounded-xl border border-indigo-100 p-4"
                          style={{ background: "oklch(0.97 0.015 270)" }}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-semibold text-indigo-900 text-sm">
                                {order.items[0]?.itemName || "CSC Service"}
                              </p>
                              <p className="text-xs text-indigo-400 font-mono mt-0.5">
                                #SO-{String(order.id)}
                              </p>
                            </div>
                            {order.cscFinalOutput && (
                              <a
                                href={order.cscFinalOutput.getDirectURL()}
                                target="_blank"
                                rel="noreferrer"
                                data-ocid={`dashboard.csc_download.button.${i + 1}`}
                                className="flex items-center gap-1.5 bg-green-100 hover:bg-green-200 text-green-700 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download Final Output
                              </a>
                            )}
                          </div>
                          {/* Timeline */}
                          <div className="flex items-center gap-1 overflow-x-auto pb-1">
                            {CSC_STEPS.map((step, si) => {
                              const isActive = si === currentStepIdx;
                              const isDone = si < currentStepIdx;
                              const isWarning = isHold && isActive;
                              return (
                                <div
                                  key={step}
                                  className="flex items-center gap-1 shrink-0"
                                >
                                  <div className="flex flex-col items-center">
                                    <div
                                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                                        isWarning
                                          ? "bg-amber-400 border-amber-500 text-white"
                                          : isActive
                                            ? "bg-indigo-600 border-indigo-700 text-white"
                                            : isDone
                                              ? "bg-green-500 border-green-600 text-white"
                                              : "bg-gray-100 border-gray-300 text-gray-400"
                                      }`}
                                    >
                                      {isDone ? "✓" : si + 1}
                                    </div>
                                    <span
                                      className={`text-[9px] mt-0.5 font-medium text-center leading-tight max-w-[52px] ${
                                        isWarning
                                          ? "text-amber-600"
                                          : isActive
                                            ? "text-indigo-700"
                                            : isDone
                                              ? "text-green-600"
                                              : "text-gray-400"
                                      }`}
                                    >
                                      {step}
                                    </span>
                                  </div>
                                  {si < CSC_STEPS.length - 1 && (
                                    <div
                                      className={`h-0.5 w-4 mb-3 ${isDone ? "bg-green-400" : "bg-gray-200"}`}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {loading ? (
              <div
                data-ocid="dashboard.orders.loading_state"
                className="flex items-center justify-center py-16"
              >
                <Loader2 className="w-8 h-8 animate-spin blue-text" />
              </div>
            ) : orders.length === 0 ? (
              <div
                data-ocid="dashboard.orders.empty_state"
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "oklch(0.95 0.04 95)" }}
                >
                  <Package className="w-8 h-8 yellow-text" />
                </div>
                <p className="font-semibold blue-text mb-1">No orders yet</p>
                <p className="text-gray-400 text-sm">
                  Upload your first document above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <ScrollArea className="max-h-80">
                  <Table
                    data-ocid="dashboard.orders.table"
                    className="min-w-[560px]"
                  >
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-semibold blue-text whitespace-nowrap">
                          Order ID
                        </TableHead>
                        <TableHead className="text-xs font-semibold blue-text whitespace-nowrap">
                          Service
                        </TableHead>
                        <TableHead className="text-xs font-semibold blue-text whitespace-nowrap">
                          Date
                        </TableHead>
                        <TableHead className="text-xs font-semibold blue-text whitespace-nowrap">
                          Status
                        </TableHead>
                        <TableHead className="text-xs font-semibold blue-text whitespace-nowrap">
                          Action
                        </TableHead>
                        <TableHead className="text-xs font-semibold blue-text whitespace-nowrap">
                          Review
                        </TableHead>
                        <TableHead className="text-xs font-semibold blue-text whitespace-nowrap">
                          Share
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order, i) => (
                        <TableRow
                          key={String(order.id)}
                          data-ocid={`dashboard.orders.item.${i + 1}`}
                        >
                          <TableCell className="text-xs font-mono text-gray-500">
                            #{String(order.id)}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {order.serviceType}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {formatDate(order.submittedAt)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={order.status} />
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              data-ocid={`dashboard.reorder.button.${i + 1}`}
                              onClick={onUploadClick}
                              className="flex items-center gap-1 text-xs font-semibold blue-text hover:opacity-70 transition-opacity whitespace-nowrap"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Re-order
                            </button>
                          </TableCell>
                          <TableCell>
                            {(order.status === "Delivered" ||
                              order.status === "Completed") &&
                              !submittedReviews.includes(String(order.id)) && (
                                <button
                                  type="button"
                                  data-ocid={`dashboard.review_button.${i + 1}`}
                                  onClick={() =>
                                    setReviewModalOrder(
                                      order as unknown as ShopOrder,
                                    )
                                  }
                                  className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors whitespace-nowrap"
                                >
                                  <PenLine className="w-3.5 h-3.5" />
                                  Review
                                </button>
                              )}
                          </TableCell>
                          <TableCell>
                            <WhatsAppShareButton
                              orderId={String(order.id)}
                              label="Share"
                              className="text-xs px-2 py-1 rounded-lg"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {reviewModalOrder && (
        <ReviewModal
          order={reviewModalOrder}
          open={!!reviewModalOrder}
          customerPhone={phone}
          onDismiss={() => setReviewModalOrder(null)}
          onSubmitted={() => {
            markReviewSubmitted(String(reviewModalOrder.id));
            setSubmittedReviews(getSubmittedReviews());
            setReviewModalOrder(null);
          }}
        />
      )}
    </>
  );
}
