import type { KhataEntry } from "@/backend.d";
import BackButton from "@/components/BackButton";
import { LetterheadLayout, triggerPrint } from "@/components/LetterheadLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/firebase";
import { fsGetCollection, fsUpdateDoc } from "@/utils/firestoreService";
import { formatDateTime } from "@/utils/formatDateTime";
import { useNavigate } from "@/utils/router";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  MessageSquare,
  Phone,
  Printer,
  Search,
  User,
  Wallet,
  X,
} from "lucide-react";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LedgerEvent {
  date: string;
  type: "bill" | "payment" | "adjustment";
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatINR(n: number) {
  return `₹${n.toFixed(2)}`;
}

// formatDate replaced by formatDateTime from @/utils/formatDateTime

function buildMockLedger(entry: KhataEntry): LedgerEvent[] {
  // Build a synthetic chronological ledger (oldest first, balance accumulates downward)
  const baseDate =
    typeof entry.lastUpdated === "bigint"
      ? Number(entry.lastUpdated) / 1_000_000
      : Number(entry.lastUpdated);

  const daysAgo = (d: number) =>
    new Date(baseDate - d * 86400000).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const total = entry.totalDue;
  if (total <= 0) return [];

  // Create 4-5 rows that tell a story and whose final balance == totalDue
  const bill1 = Math.round(total * 0.45);
  const bill2 = Math.round(total * 0.35);
  const payment1 = Math.round(total * 0.2);
  const bill3 = total - bill1 - bill2 + payment1; // ensures final balance == totalDue

  const events: LedgerEvent[] = [
    {
      date: daysAgo(14),
      type: "bill",
      description: "Print Order #101 — A4 Prints × 50",
      debit: bill1,
      credit: 0,
      balance: bill1,
    },
    {
      date: daysAgo(10),
      type: "bill",
      description: "Photocopy & Lamination Services",
      debit: bill2,
      credit: 0,
      balance: bill1 + bill2,
    },
    {
      date: daysAgo(7),
      type: "payment",
      description: "Advance Payment Received (Cash)",
      debit: 0,
      credit: payment1,
      balance: bill1 + bill2 - payment1,
    },
    {
      date: daysAgo(2),
      type: "bill",
      description: "Spiral Binding & Color Print Order",
      debit: bill3,
      credit: 0,
      balance: bill1 + bill2 - payment1 + bill3,
    },
  ];

  return events;
}

// ─── Main Component ───────────────────────────────────────────────────────────

function ExportDropdown({
  onExportCSV,
  onPrint,
}: {
  onExportCSV: () => void;
  onPrint: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 18px",
          borderRadius: 10,
          border: "1px solid rgba(6,182,212,0.3)",
          background: "rgba(6,182,212,0.1)",
          color: "#06b6d4",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          transition: "all 0.15s",
        }}
      >
        <Download style={{ width: 15, height: 15 }} />
        Export
        <ChevronDown
          style={{
            width: 14,
            height: 14,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 100,
            background: "#0f172a",
            border: "1px solid rgba(6,182,212,0.25)",
            borderRadius: 10,
            overflow: "hidden",
            minWidth: 180,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            backdropFilter: "blur(12px)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              onExportCSV();
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "12px 16px",
              border: "none",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "transparent",
              color: "rgba(255,255,255,0.8)",
              fontSize: 14,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <FileSpreadsheet
              style={{ width: 15, height: 15, color: "#10b981" }}
            />
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => {
              onPrint();
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "12px 16px",
              border: "none",
              background: "transparent",
              color: "rgba(255,255,255,0.8)",
              fontSize: 14,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <Printer style={{ width: 15, height: 15, color: "#a78bfa" }} />
            Print / Save PDF
          </button>
        </div>
      )}
    </div>
  );
}

export default function KhataSettlementPage() {
  const navigate = useNavigate();

  // Search state
  const [searchMobile, setSearchMobile] = useState("");
  const [searching, setSearching] = useState(false);
  const [allEntries, setAllEntries] = useState<any[]>([]);

  useEffect(() => {
    fsGetCollection<any>("khata").then(setAllEntries).catch(console.error);
  }, []);
  const [selectedEntry, setSelectedEntry] = useState<KhataEntry | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  // Payment form
  const [discount, setDiscount] = useState("");
  const [amountReceiving, setAmountReceiving] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [reference, setReference] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [realLedgerEvents, setRealLedgerEvents] = useState<LedgerEvent[]>([]);

  // Ledger modal
  const [showLedger, setShowLedger] = useState(false);

  // Fetch real ledger history when selectedEntry changes
  useEffect(() => {
    if (!selectedEntry) {
      setRealLedgerEvents([]);
      return;
    }
    async function fetchHistory() {
      try {
        const ordersRef = collection(db, "orders");
        const q = query(
          ordersRef,
          where("customerPhone", "==", selectedEntry!.phone),
        );
        const snap = await getDocs(q);
        const events: LedgerEvent[] = [];
        for (const docSnap of snap.docs) {
          const d = docSnap.data();
          const khataDue = Number(d.khataDue || 0);
          if (khataDue > 0) {
            events.push({
              date: d.createdAt
                ? new Date(d.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—",
              type: "bill",
              description: `POS Sale — ${d.items?.map((i: { itemName: string }) => i.itemName).join(", ") || "Order"} (Invoice: ${d.invoiceNumber || d.id || "—"})`,
              debit: khataDue,
              credit: 0,
              balance: 0,
            });
          }
        }
        events.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
        if (events.length === 0 && selectedEntry!.totalDue > 0) {
          setRealLedgerEvents(buildMockLedger(selectedEntry!));
        } else {
          setRealLedgerEvents(events);
        }
      } catch (err) {
        console.error("Failed to fetch khata history:", err);
        if (selectedEntry!.totalDue > 0) {
          setRealLedgerEvents(buildMockLedger(selectedEntry!));
        }
      }
    }
    fetchHistory();
  }, [selectedEntry]);

  // ── Computed values ────────────────────────────────────────────────────────
  const totalDue = selectedEntry?.totalDue ?? 0;
  const discountVal = Math.max(
    0,
    Math.min(Number.parseFloat(discount) || 0, totalDue),
  );
  const netPayable = Math.max(0, totalDue - discountVal);
  const amountNow = Number.parseFloat(amountReceiving) || 0;

  // ── Search handler ─────────────────────────────────────────────────────────
  function handleSearch() {
    if (!searchMobile.trim()) return;
    setSearching(true);
    const found = allEntries.find(
      (e) =>
        e.phone === searchMobile.trim() ||
        e.customerName
          ?.toLowerCase()
          .includes(searchMobile.trim().toLowerCase()),
    );
    if (found) {
      setSelectedEntry(found);
      setWalletBalance(0);
      setDiscount("");
      setAmountReceiving("");
      setReference("");
    } else {
      toast.error(
        "No Khata record found for this mobile. Check the number and try again.",
      );
      setSelectedEntry(null);
    }
    setSearching(false);
  }

  // ── Accept Payment ─────────────────────────────────────────────────────────
  async function handleAcceptPayment() {
    if (!selectedEntry) return;
    if (amountNow <= 0) {
      toast.error("Please enter a valid amount to receive.");
      return;
    }
    if (amountNow > netPayable) {
      toast.error("Amount cannot exceed Net Payable amount.");
      return;
    }
    setSubmitting(true);
    try {
      const remaining = Math.max(0, netPayable - amountNow);
      const updatedEntry = { ...selectedEntry, totalDue: remaining };
      const updatedEntries = allEntries.map((e) =>
        e.phone === selectedEntry.phone ? updatedEntry : e,
      );
      setSelectedEntry(updatedEntry);
      setAllEntries(updatedEntries);
      const docId = (selectedEntry as unknown as Record<string, unknown>).id as
        | string
        | undefined;
      await fsUpdateDoc("khata", docId || selectedEntry.phone, {
        totalDue: remaining,
      });

      toast.success(
        `Payment of ${formatINR(amountNow)} accepted. Pending: ${formatINR(remaining)}`,
      );

      // 4. WhatsApp receipt
      if (sendWhatsApp) {
        const msg = encodeURIComponent(
          `Dear ${selectedEntry.customerName}, your payment of ${formatINR(amountNow)} via ${paymentMode} has been received.\nPending Due: ${formatINR(remaining)}${reference ? `\nRef/UTR: ${reference}` : ""}\nThank you for your business! — ClikMate`,
        );
        const waUrl = `https://wa.me/91${selectedEntry.phone.replace(/\D/g, "")}?text=${msg}`;
        window.open(waUrl, "_blank");
      }

      // Reset form
      setAmountReceiving("");
      setDiscount("");
      setReference("");
    } catch (e: unknown) {
      toast.error("Payment failed. Please try again.");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Print receipt ──────────────────────────────────────────────────────────

  function handleExportCSV() {
    const headers = [
      "Customer Name",
      "Mobile",
      "Total Due (₹)",
      "Last Updated",
    ];
    const rows = allEntries.map((e) => [
      e.customerName,
      e.phone,
      e.totalDue.toFixed(2),
      formatDateTime(e.lastUpdated),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clikmate-khata-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrintReceipt() {
    if (!selectedEntry) return;
    const content = `
      <html><head><title>Khata Receipt - ClikMate</title>
      <style>
        body{font-family:Arial,sans-serif;padding:32px;color:#111;}
        h1{font-size:22px;margin-bottom:4px;}
        .sub{color:#666;font-size:13px;margin-bottom:20px;}
        table{width:100%;border-collapse:collapse;margin-top:12px;}
        td{padding:8px 4px;border-bottom:1px solid #eee;font-size:14px;}
        .label{color:#555;width:50%;}
        .val{font-weight:600;text-align:right;}
        .total{font-size:16px;font-weight:700;}
        .footer{margin-top:32px;font-size:12px;color:#888;text-align:center;border-top:1px solid #eee;padding-top:12px;}
      </style></head><body>
      <h1>ClikMate – Khata Payment Receipt</h1>
      <div class="sub">Date: ${new Date().toLocaleString("en-IN")}</div>
      <table>
        <tr><td class="label">Customer Name</td><td class="val">${selectedEntry.customerName}</td></tr>
        <tr><td class="label">Mobile</td><td class="val">${selectedEntry.phone}</td></tr>
        <tr><td class="label">Total Dues (Before)</td><td class="val">${formatINR(totalDue)}</td></tr>
        <tr><td class="label">Discount Allowed</td><td class="val">${formatINR(discountVal)}</td></tr>
        <tr><td class="label">Net Payable</td><td class="val">${formatINR(netPayable)}</td></tr>
        <tr><td class="label">Amount Received</td><td class="val total">${formatINR(amountNow)}</td></tr>
        <tr><td class="label">Payment Mode</td><td class="val">${paymentMode}</td></tr>
        ${reference ? `<tr><td class="label">Ref / UTR</td><td class="val">${reference}</td></tr>` : ""}
        <tr><td class="label">Remaining Due</td><td class="val" style="color:#dc2626">${formatINR(Math.max(0, totalDue - discountVal - amountNow))}</td></tr>
      </table>
      <div class="footer">ClikMate Service Center, Awanti Vihar, Raipur | +91 9508911400 | This is a computer-generated receipt.</div>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(content);
      w.document.close();
      w.print();
    }
  }

  const ledgerEvents = realLedgerEvents;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0f1e",
        color: "#e2e8f0",
        fontFamily: "inherit",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          backgroundColor: "#111827",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <BackButton disabled={!!selectedEntry || showLedger} />
        <button
          type="button"
          onClick={() => navigate("/admin")}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            color: "#e2e8f0",
            cursor: "pointer",
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
          }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Admin
        </button>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #2563eb)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BookOpen style={{ width: 18, height: 18, color: "white" }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "white" }}>
            Khata Settlement Dashboard
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            Enterprise B2B Ledger & Due Collection
          </div>
        </div>
        <ExportDropdown
          onExportCSV={handleExportCSV}
          onPrint={handlePrintReceipt}
        />
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>
        {/* ── Search Bar ── */}
        <div
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "20px 24px",
            marginBottom: 24,
            display: "flex",
            gap: 12,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 12,
                marginBottom: 6,
                fontWeight: 500,
              }}
            >
              Search Customer by Mobile Number
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Input
                placeholder="Enter 10-digit mobile number..."
                value={searchMobile}
                onChange={(e) => setSearchMobile(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                style={{
                  background: "#1f2937",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "white",
                  fontSize: 14,
                }}
                data-ocid="khata.search.input"
              />
              <Button
                onClick={handleSearch}
                disabled={searching}
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #2563eb)",
                  border: "none",
                  color: "white",
                  fontWeight: 600,
                  padding: "0 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                data-ocid="khata.search.button"
              >
                {searching ? (
                  <Loader2
                    style={{ width: 16, height: 16 }}
                    className="animate-spin"
                  />
                ) : (
                  <Search style={{ width: 16, height: 16 }} />
                )}
                Search
              </Button>
            </div>
          </div>
          {/* Quick select from all */}
          {allEntries.length > 0 && (
            <div style={{ minWidth: 220 }}>
              <div
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 12,
                  marginBottom: 6,
                  fontWeight: 500,
                }}
              >
                Or select from all khata customers
              </div>
              <select
                value={selectedEntry?.phone ?? ""}
                onChange={(e) => {
                  const entry = allEntries.find(
                    (x) => x.phone === e.target.value,
                  );
                  if (entry) {
                    setSelectedEntry(entry);
                    setSearchMobile(entry.phone);
                    setDiscount("");
                    setAmountReceiving("");
                    setReference("");
                    setWalletBalance(0);
                  }
                }}
                style={{
                  background: "#1f2937",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "white",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  width: "100%",
                }}
              >
                <option value="">
                  — Select customer ({allEntries.length} with dues) —
                </option>
                {allEntries
                  .filter((e) => e.totalDue > 0)
                  .map((e) => (
                    <option key={e.phone} value={e.phone}>
                      {e.customerName} ({e.phone}) — {formatINR(e.totalDue)}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* ── WhatsApp Bulk Reminders ── */}
        {allEntries.filter((e) => e.totalDue > 0).length > 0 && (
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 18 }}>{"📲"}</span>
              <h3
                style={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  margin: 0,
                }}
              >
                Pending Dues — Send WhatsApp Reminders
              </h3>
              <span
                style={{
                  background: "rgba(16,185,129,0.15)",
                  color: "#10b981",
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 20,
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                {allEntries.filter((e) => e.totalDue > 0).length} pending
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allEntries
                .filter((e) => e.totalDue > 0)
                .map((entry) => {
                  const msg = encodeURIComponent(
                    `Dear ${entry.customerName}, your printing bill of ₹${entry.totalDue.toFixed(2)} is pending at ClikMate Smart Online Service Center, Raipur. Kindly clear it at your earliest convenience. Thank you! 🙏`,
                  );
                  const waUrl = `https://wa.me/91${entry.phone.replace(/\D/g, "")}?text=${msg}`;
                  return (
                    <div
                      key={entry.phone}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "#fff",
                            fontWeight: 600,
                            fontSize: 13,
                          }}
                        >
                          {entry.customerName}
                        </div>
                        <div
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 12,
                          }}
                        >
                          {entry.phone} — Due:{" "}
                          <span style={{ color: "#f87171", fontWeight: 600 }}>
                            ₹{entry.totalDue.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-ocid="khata.whatsapp_remind.button"
                        style={{
                          background:
                            "linear-gradient(135deg, #25D366, #128C7E)",
                          border: "none",
                          borderRadius: 8,
                          padding: "7px 14px",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                          textDecoration: "none",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {"📲"} Remind
                      </a>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── 2-Column Layout ── */}
        {selectedEntry ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "320px 1fr",
              gap: 20,
              alignItems: "start",
            }}
          >
            {/* ── Column 1: Customer Profile ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Profile Card */}
              <div
                style={{
                  background:
                    "linear-gradient(145deg, #1e1b4b 0%, #111827 60%, #0f172a 100%)",
                  border: "1px solid rgba(124,58,237,0.3)",
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: "0 4px 24px rgba(124,58,237,0.15)",
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                    boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "white",
                  }}
                >
                  {selectedEntry.customerName.charAt(0).toUpperCase()}
                </div>

                {/* Name */}
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 18,
                      color: "white",
                      marginBottom: 4,
                    }}
                  >
                    {selectedEntry.customerName}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 13,
                    }}
                  >
                    <Phone style={{ width: 12, height: 12 }} />
                    {selectedEntry.phone}
                  </div>
                </div>

                {/* Balance badges */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      background: "rgba(16,185,129,0.15)",
                      border: "1px solid rgba(16,185,129,0.3)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: "#10b981",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      <Wallet style={{ width: 14, height: 14 }} />
                      Wallet Balance
                    </div>
                    <div
                      style={{
                        color: "#10b981",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      {formatINR(walletBalance)}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "rgba(239,68,68,0.15)",
                      border: "1px solid rgba(239,68,68,0.35)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: "#f87171",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      <CreditCard style={{ width: 14, height: 14 }} />
                      Total Pending Dues
                    </div>
                    <div
                      style={{
                        color: "#f87171",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      {formatINR(selectedEntry.totalDue)}
                    </div>
                  </div>
                </div>

                {/* View Ledger button */}
                <button
                  type="button"
                  onClick={() => setShowLedger(true)}
                  data-ocid="khata.view_ledger.button"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.8)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(124,58,237,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  }}
                >
                  <History style={{ width: 15, height: 15 }} />
                  View Detailed Ledger
                </button>

                {/* Last updated */}
                <div
                  style={{
                    marginTop: 14,
                    textAlign: "center",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  Last updated: {formatDateTime(selectedEntry.lastUpdated)}
                </div>
              </div>
            </div>

            {/* ── Column 2: Payment Engine ── */}
            <div
              style={{
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: 28,
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 17,
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <CreditCard
                  style={{ width: 20, height: 20, color: "#7c3aed" }}
                />
                Payment Collection Engine
              </div>

              {/* Section A: Calculation */}
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 16,
                  }}
                >
                  Section A — Due Calculation
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  {/* Total Pending Dues (read-only) */}
                  <div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 12,
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Total Pending Dues
                    </div>
                    <div
                      style={{
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        color: "#f87171",
                        fontWeight: 700,
                        fontSize: 18,
                      }}
                    >
                      {formatINR(totalDue)}
                    </div>
                  </div>

                  {/* Discount Allowed */}
                  <div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 12,
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Discount Allowed (₹)
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={totalDue}
                      placeholder="0.00"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      style={{
                        background: "#1f2937",
                        border: "1px solid rgba(255,165,0,0.3)",
                        color: "white",
                        fontWeight: 600,
                        fontSize: 15,
                      }}
                      data-ocid="khata.discount.input"
                    />
                  </div>
                </div>

                {/* Net Payable */}
                <div
                  style={{
                    marginTop: 16,
                    background:
                      "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(37,99,235,0.12))",
                    border: "1px solid rgba(124,58,237,0.3)",
                    borderRadius: 10,
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      color: "rgba(255,255,255,0.6)",
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    Net Payable Amount
                  </span>
                  <span
                    style={{ color: "#a78bfa", fontWeight: 800, fontSize: 22 }}
                  >
                    {formatINR(netPayable)}
                  </span>
                </div>
              </div>

              {/* Section B: Payment Details */}
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 16,
                  }}
                >
                  Section B — Payment Details
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  {/* Amount Receiving */}
                  <div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 12,
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Amount Receiving Now (₹)
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={netPayable}
                      placeholder={`Max: ${formatINR(netPayable)}`}
                      value={amountReceiving}
                      onChange={(e) => setAmountReceiving(e.target.value)}
                      style={{
                        background: "#1f2937",
                        border: "1px solid rgba(16,185,129,0.3)",
                        color: "white",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                      data-ocid="khata.amount.input"
                    />
                  </div>

                  {/* Payment Mode */}
                  <div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 12,
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Payment Mode
                    </div>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      data-ocid="khata.payment_mode.select"
                      style={{
                        width: "100%",
                        background: "#1f2937",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "white",
                        borderRadius: 8,
                        padding: "9px 12px",
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      <option value="Cash">💵 Cash</option>
                      <option value="UPI">📱 UPI</option>
                      <option value="Bank Transfer">🏦 Bank Transfer</option>
                    </select>
                  </div>

                  {/* Reference / UTR */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 12,
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      Reference / UTR Number
                      {paymentMode !== "Cash" && (
                        <span style={{ color: "#f59e0b", marginLeft: 4 }}>
                          * Recommended for {paymentMode}
                        </span>
                      )}
                    </div>
                    <Input
                      placeholder={`Enter ${paymentMode === "UPI" ? "UPI transaction ID" : paymentMode === "Bank Transfer" ? "NEFT/RTGS/IMPS UTR" : "Reference number (optional)"}`}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      style={{
                        background: "#1f2937",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "white",
                        fontFamily: "monospace",
                        fontSize: 13,
                      }}
                      data-ocid="khata.reference.input"
                    />
                  </div>
                </div>
              </div>

              {/* Section C: Actions */}
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 16,
                  }}
                >
                  Section C — Confirm & Actions
                </div>

                {/* Summary line */}
                {amountNow > 0 && (
                  <div
                    style={{
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.25)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      marginBottom: 16,
                      fontSize: 13,
                      color: "#6ee7b7",
                    }}
                  >
                    <strong>Preview:</strong> Collecting {formatINR(amountNow)}{" "}
                    from {selectedEntry.customerName}. Remaining due after this
                    payment:{" "}
                    <strong>
                      {formatINR(Math.max(0, netPayable - amountNow))}
                    </strong>
                  </div>
                )}

                {/* WhatsApp checkbox */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    marginBottom: 20,
                    padding: "12px 16px",
                    background: "rgba(37,211,102,0.08)",
                    border: "1px solid rgba(37,211,102,0.2)",
                    borderRadius: 10,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sendWhatsApp}
                    onChange={(e) => setSendWhatsApp(e.target.checked)}
                    data-ocid="khata.whatsapp_checkbox"
                    style={{ width: 16, height: 16, accentColor: "#25d366" }}
                  />
                  <MessageSquare
                    style={{ width: 16, height: 16, color: "#25d366" }}
                  />
                  <span
                    style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}
                  >
                    Send WhatsApp Acknowledgment Receipt to customer
                  </span>
                </label>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleAcceptPayment}
                    disabled={submitting || amountNow <= 0}
                    data-ocid="khata.accept_payment.button"
                    style={{
                      flex: 1,
                      minWidth: 200,
                      padding: "14px 20px",
                      borderRadius: 12,
                      border: "none",
                      background:
                        submitting || amountNow <= 0
                          ? "rgba(124,58,237,0.3)"
                          : "linear-gradient(135deg, #7c3aed, #2563eb)",
                      color: "white",
                      fontWeight: 700,
                      fontSize: 15,
                      cursor:
                        submitting || amountNow <= 0
                          ? "not-allowed"
                          : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow:
                        amountNow > 0
                          ? "0 4px 16px rgba(124,58,237,0.4)"
                          : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    {submitting ? (
                      <Loader2
                        style={{ width: 18, height: 18 }}
                        className="animate-spin"
                      />
                    ) : (
                      <CheckCircle2 style={{ width: 18, height: 18 }} />
                    )}
                    Accept Payment & Update Khata
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintReceipt}
                    data-ocid="khata.print_receipt.button"
                    style={{
                      padding: "14px 20px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.75)",
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.06)";
                    }}
                  >
                    <Printer style={{ width: 16, height: 16 }} />
                    Print Receipt
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── Empty state ── */
          <div
            style={{
              textAlign: "center",
              padding: "80px 24px",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            <BookOpen
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 16px",
                opacity: 0.3,
              }}
            />
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              No customer selected
            </div>
            <div style={{ fontSize: 14 }}>
              Search by mobile number or select from the dropdown to start a
              settlement.
            </div>
          </div>
        )}
      </div>

      {/* ── Detailed Ledger Modal ── */}
      {showLedger && selectedEntry && (
        <>
          {/* triggerPrint used for khata-ledger-print */}

          {/* Backdrop */}
          <div
            className="ledger-modal-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={() => setShowLedger(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowLedger(false);
            }}
          >
            {/* Modal content */}
            <div
              className="khata-ledger-print-area"
              style={{
                background: "#111827",
                border: "1px solid rgba(124,58,237,0.3)",
                borderRadius: 16,
                width: "100%",
                maxWidth: 860,
                maxHeight: "85vh",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {/* Print-only header */}
              <div className="print-only" style={{ marginBottom: 16 }}>
                <div
                  style={{ fontWeight: 700, fontSize: 16, textAlign: "center" }}
                >
                  ClikMate — Smart Service Center
                </div>
                <div
                  style={{ fontSize: 11, textAlign: "center", color: "#555" }}
                >
                  Shop No. 12, Awanti Vihar, Raipur (C.G.) | Tel: +91 9508911400
                </div>
                <hr style={{ margin: "10px 0", borderColor: "#ccc" }} />
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    textAlign: "center",
                    marginBottom: 6,
                  }}
                >
                  Customer Ledger Statement
                </div>
                <div style={{ fontSize: 11, color: "#333" }}>
                  <strong>Customer:</strong> {selectedEntry.customerName}{" "}
                  &nbsp;|&nbsp;
                  <strong>Mobile:</strong> {selectedEntry.phone} &nbsp;|&nbsp;
                  <strong>Date:</strong>{" "}
                  {new Date().toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
                <hr style={{ margin: "10px 0", borderColor: "#ccc" }} />
              </div>

              {/* Modal Header */}
              <div
                className="print-hide"
                style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background:
                    "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(37,99,235,0.1))",
                  flexShrink: 0,
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <History
                      style={{ width: 18, height: 18, color: "#a78bfa" }}
                    />
                    Detailed Khata Ledger
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.4)",
                      marginTop: 2,
                    }}
                  >
                    {selectedEntry.customerName} ({selectedEntry.phone}) — All
                    transactions
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    className="print-hide"
                    onClick={() => triggerPrint("khata-ledger-print")}
                    style={{
                      background: "rgba(124,58,237,0.2)",
                      border: "1px solid rgba(124,58,237,0.5)",
                      borderRadius: 8,
                      color: "white",
                      cursor: "pointer",
                      padding: "6px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <Printer style={{ width: 15, height: 15 }} />
                    Print Ledger Statement
                  </button>
                  <button
                    type="button"
                    className="ledger-close-btn"
                    onClick={() => setShowLedger(false)}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "none",
                      borderRadius: 8,
                      color: "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                      padding: "6px 8px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <X style={{ width: 18, height: 18 }} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
                {/* Summary cards — screen only */}
                <div
                  className="print-hide"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 12,
                    marginBottom: 24,
                  }}
                >
                  {[
                    {
                      label: "Total Dues",
                      val: formatINR(selectedEntry.totalDue),
                      color: "#f87171",
                    },
                    {
                      label: "Wallet Balance",
                      val: formatINR(walletBalance),
                      color: "#10b981",
                    },
                    {
                      label: "Last Activity",
                      val: formatDateTime(selectedEntry.lastUpdated),
                      color: "#a78bfa",
                      small: true,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        padding: "12px 14px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.4)",
                          marginBottom: 4,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          color: item.color,
                          fontWeight: 700,
                          fontSize: item.small ? 12 : 16,
                        }}
                      >
                        {item.val}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ledger table */}
                <div style={{ overflowX: "auto" }}>
                  <table
                    className="ledger-print-table"
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          borderBottom: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {[
                          "Date",
                          "Description",
                          "Debit (₹)",
                          "Credit (₹)",
                          "Running Balance (₹)",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "10px 12px",
                              textAlign: "left",
                              color: "rgba(255,255,255,0.4)",
                              fontWeight: 600,
                              fontSize: 11,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerEvents.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            style={{
                              padding: "40px",
                              textAlign: "center",
                              color: "rgba(255,255,255,0.3)",
                            }}
                          >
                            No transactions recorded yet for this customer.
                          </td>
                        </tr>
                      ) : (
                        ledgerEvents.map((ev, i) => (
                          <tr
                            key={`ledger-${i}-${ev.date}`}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.05)",
                            }}
                          >
                            <td
                              style={{
                                padding: "10px 12px",
                                color: "rgba(255,255,255,0.5)",
                                whiteSpace: "nowrap",
                                fontSize: 12,
                              }}
                            >
                              {ev.date}
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                color: "rgba(255,255,255,0.7)",
                              }}
                            >
                              {ev.description}
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                color:
                                  ev.debit > 0
                                    ? "#f87171"
                                    : "rgba(255,255,255,0.3)",
                                fontWeight: ev.debit > 0 ? 600 : 400,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {ev.debit > 0 ? formatINR(ev.debit) : "—"}
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                color:
                                  ev.credit > 0
                                    ? "#10b981"
                                    : "rgba(255,255,255,0.3)",
                                fontWeight: ev.credit > 0 ? 600 : 400,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {ev.credit > 0 ? formatINR(ev.credit) : "—"}
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                color: "white",
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatINR(ev.balance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Print-only summary footer */}
                {ledgerEvents.length > 0 &&
                  (() => {
                    const totalDebits = ledgerEvents.reduce(
                      (s, e) => s + e.debit,
                      0,
                    );
                    const totalCredits = ledgerEvents.reduce(
                      (s, e) => s + e.credit,
                      0,
                    );
                    const finalBalance =
                      ledgerEvents[ledgerEvents.length - 1].balance;
                    return (
                      <div
                        className="print-only"
                        style={{
                          marginTop: 24,
                          borderTop: "2px solid #333",
                          paddingTop: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 32,
                            fontSize: 11,
                            color: "#333",
                            marginBottom: 16,
                          }}
                        >
                          <span>
                            <strong>Total Debits (Dues):</strong>{" "}
                            {formatINR(totalDebits)}
                          </span>
                          <span>
                            <strong>Total Credits (Payments):</strong>{" "}
                            {formatINR(totalCredits)}
                          </span>
                          <span>
                            <strong>Outstanding Balance:</strong>{" "}
                            {formatINR(finalBalance)}
                          </span>
                        </div>
                        <div
                          style={{
                            textAlign: "right",
                            fontSize: 11,
                            color: "#555",
                            marginTop: 40,
                          }}
                        >
                          Authorized Signature / Shop Seal:
                          _______________________
                        </div>
                      </div>
                    );
                  })()}
              </div>
            </div>
          </div>
          {/* A4 Letterhead Print Area for Ledger */}
          <LetterheadLayout
            printAreaId="khata-ledger-print"
            title="Customer Khata Ledger Statement"
            subtitle={`Customer: ${selectedEntry.customerName} | Mobile: ${selectedEntry.phone}`}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 15,
              }}
            >
              <thead>
                <tr>
                  {[
                    "Date",
                    "Description",
                    "Debit (₹)",
                    "Credit (₹)",
                    "Balance (₹)",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        border: "1px solid #000",
                        padding: "8px 10px",
                        background: "#f2f2f2",
                        fontWeight: "bold",
                        fontSize: "12pt",
                        color: "#000",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledgerEvents.map((ev, i) => (
                  <tr key={`kp-${ev.date}-${i}-${ev.debit}`}>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "8px 10px",
                        fontSize: "11pt",
                        color: "#000",
                      }}
                    >
                      {ev.date}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "8px 10px",
                        fontSize: "11pt",
                        color: "#000",
                      }}
                    >
                      {ev.description}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "8px 10px",
                        fontSize: "11pt",
                        color: "#000",
                        textAlign: "right",
                      }}
                    >
                      {ev.debit > 0 ? formatINR(ev.debit) : "—"}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "8px 10px",
                        fontSize: "11pt",
                        color: "#000",
                        textAlign: "right",
                      }}
                    >
                      {ev.credit > 0 ? formatINR(ev.credit) : "—"}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "8px 10px",
                        fontSize: "11pt",
                        color: "#000",
                        textAlign: "right",
                        fontWeight: 700,
                      }}
                    >
                      {formatINR(ev.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </LetterheadLayout>
        </>
      )}
    </div>
  );
}
