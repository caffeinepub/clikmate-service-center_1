import { ExternalBlob } from "@/backend";
import type { TypesettingQuoteRequest } from "@/backend";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/useActor";
import { useNavigate } from "@/utils/router";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  GripVertical,
  Layers,
  Loader2,
  LogOut,
  Pencil,
  Printer,
  Send,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ---- Types ----------------------------------------------------------------

type ColumnKey = "new" | "quoted" | "typesetting" | "ready";

const COLUMNS: {
  key: ColumnKey;
  label: string;
  statuses: string[];
  borderColor: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "new",
    label: "New B2B Leads",
    statuses: ["Pending Quote", "Pending"],
    borderColor: "#f59e0b",
    icon: <Clock className="w-4 h-4" />,
  },
  {
    key: "quoted",
    label: "Quote Confirmed",
    statuses: ["Quote Sent", "Confirmed"],
    borderColor: "#60a5fa",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  {
    key: "typesetting",
    label: "Typesetting in Progress",
    statuses: ["Typesetting in Progress", "Printing"],
    borderColor: "#c084fc",
    icon: <Layers className="w-4 h-4" />,
  },
  {
    key: "ready",
    label: "Ready for Print / Delivery",
    statuses: [
      "Ready for Print & Delivery",
      "Ready for Print / Delivery",
      "Ready",
    ],
    borderColor: "#4ade80",
    icon: <Truck className="w-4 h-4" />,
  },
];

const STATUS_MAP: Record<ColumnKey, string> = {
  new: "Pending Quote",
  quoted: "Quote Confirmed",
  typesetting: "Typesetting in Progress",
  ready: "Ready for Print / Delivery",
};

function formatDate(ts: bigint): string {
  return new Date(Number(ts)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Derive "LaTeX" vs "Standard PDF" badge from language field
function getTypeBadge(language: string): "LaTeX" | "Standard PDF" {
  const lang = language.toLowerCase();
  if (
    lang.includes("hindi") ||
    lang.includes("bilingual") ||
    lang.includes("noto")
  ) {
    return "LaTeX";
  }
  return "Standard PDF";
}

// Derive font name from language field
function getFontName(language: string): string {
  const lang = language.toLowerCase();
  if (lang.includes("hindi") || lang.includes("noto")) return "Noto Serif";
  if (lang.includes("bilingual")) return "Noto Serif + Times New Roman";
  if (lang.includes("times") || lang.includes("english"))
    return "Times New Roman";
  return language || "—";
}

// ---- Type badge -----------------------------------------------------------

function TypeBadge({ language }: { language: string }) {
  const type = getTypeBadge(language);
  const isLatex = type === "LaTeX";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tracking-wide"
      style={{
        background: isLatex
          ? "rgba(192,132,252,0.18)"
          : "rgba(96,165,250,0.15)",
        color: isLatex ? "#c084fc" : "#60a5fa",
        border: `1px solid ${isLatex ? "rgba(192,132,252,0.3)" : "rgba(96,165,250,0.25)"}`,
        fontSize: "10px",
        letterSpacing: "0.05em",
      }}
    >
      {type}
    </span>
  );
}

// ---- Order Card -----------------------------------------------------------

function OrderCard({
  lead,
  onClick,
  onDragStart,
}: {
  lead: TypesettingQuoteRequest;
  onClick: () => void;
  onDragStart: () => void;
}) {
  return (
    <button
      type="button"
      data-ocid="bulk.leads.card"
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="w-full text-left rounded-xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}
    >
      {/* Header row: name + drag handle */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-white font-bold text-sm leading-tight">
          {lead.name}
        </h3>
        <GripVertical className="w-4 h-4 text-white/20 group-hover:text-white/40 flex-shrink-0 mt-0.5" />
      </div>

      {/* Subject */}
      <div className="flex items-center gap-1.5 mb-2">
        <BookOpen className="w-3.5 h-3.5 text-white/40" />
        <span className="text-white/60 text-xs">{lead.subject}</span>
      </div>

      {/* Footer: date + type badge */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-white/30 text-xs">
          {formatDate(lead.submittedAt)}
        </span>
        <TypeBadge language={lead.language} />
      </div>
    </button>
  );
}

// ---- Order Detail Modal ---------------------------------------------------

function OrderDetailModal({
  lead,
  onClose,
  onUpdate,
  actor,
}: {
  lead: TypesettingQuoteRequest;
  onClose: () => void;
  onUpdate: (updated: Partial<TypesettingQuoteRequest>) => void;
  actor: any;
}) {
  const [notes, setNotes] = useState(lead.quoteNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [editingPhone, setEditingPhone] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      if (!actor) {
        toast.error("Actor not ready");
        return;
      }
      await actor.updateLeadQuoteNotes(lead.id, notes);
      onUpdate({ quoteNotes: notes });
      toast.success("Notes saved");
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleFinalPdfUpload = async (file: File) => {
    setUploadProgress(0);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const blob = ExternalBlob.fromBytes(bytes).withUploadProgress((pct) =>
        setUploadProgress(pct),
      );
      const url = blob.getDirectURL();
      if (!actor) {
        toast.error("Actor not ready");
        return;
      }
      await actor.updateLeadFinalPdf(lead.id, url);
      onUpdate({ finalPdfUrl: url });
      toast.success("Final PDF uploaded & saved permanently!");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploadProgress(null);
    }
  };

  const waMessage = encodeURIComponent(
    "Hello, your mock test paper has been typeset. Please check the proof.",
  );
  const waUrl = `https://wa.me/91${phone.replace(/\D/g, "")}?text=${waMessage}`;

  const fontName = getFontName(lead.language);
  const typeBadge = getTypeBadge(lead.language);

  return (
    <div
      data-ocid="bulk.leads.modal"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      // biome-ignore lint/a11y/useSemanticElements: dialog overlay needs div for backdrop click
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-6xl my-6 rounded-2xl flex flex-col gap-0 overflow-hidden"
        style={{
          background: "#0d1327",
          border: "1px solid rgba(192,132,252,0.2)",
        }}
      >
        {/* Close */}
        <button
          data-ocid="bulk.leads.close_button"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ── Formatting Specs Panel ── */}
        <div
          className="px-6 py-5"
          style={{
            background: "rgba(192,132,252,0.06)",
            borderBottom: "1px solid rgba(192,132,252,0.15)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: "#c084fc" }}
            />
            <span className="text-white/50 text-xs uppercase tracking-wider font-semibold">
              Formatting Specs
            </span>
            <TypeBadge language={lead.language} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Institute", value: lead.name },
              { label: "Subject", value: lead.subject },
              {
                label: "Layout",
                value: lead.format
                  ? lead.format.replace("with Vertical Line", "").trim()
                  : "—",
              },
              { label: "Font", value: fontName },
              { label: "Type", value: typeBadge },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-white/35 text-xs mb-0.5">{label}</p>
                <p className="text-white font-semibold text-sm">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quote Notes ── */}
        <div
          className="px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-xs uppercase tracking-wider font-semibold">
              Quote Notes
            </span>
            <Button
              data-ocid="bulk.leads.save_button"
              size="sm"
              onClick={saveNotes}
              disabled={savingNotes}
              className="h-7 text-xs"
              style={{
                background: "rgba(192,132,252,0.2)",
                color: "#c084fc",
                border: "1px solid rgba(192,132,252,0.3)",
              }}
            >
              {savingNotes ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "Save Notes"
              )}
            </Button>
          </div>
          <Textarea
            data-ocid="bulk.leads.textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add quote amount, special instructions, delivery timeline..."
            rows={2}
            className="text-white/80 text-sm resize-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
            }}
          />
        </div>

        {/* ── Side-by-side PDF Viewer ── */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* LEFT: Client raw uploaded file */}
          <div
            className="p-6"
            style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4" style={{ color: "#60a5fa" }} />
              <span className="text-white/60 text-sm font-semibold">
                Client&apos;s Raw Uploaded File
              </span>
              {lead.fileUrl && (
                <a
                  data-ocid="bulk.leads.link"
                  href={lead.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  <ExternalLink className="w-3 h-3" /> Open in Tab
                </a>
              )}
            </div>
            {lead.fileUrl ? (
              <iframe
                src={lead.fileUrl}
                width="100%"
                height="500"
                className="rounded-lg"
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "#1a2035",
                }}
                title="Client raw file"
              />
            ) : (
              <div
                className="h-64 rounded-lg flex flex-col items-center justify-center gap-3"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "2px dashed rgba(255,255,255,0.1)",
                }}
              >
                <BookOpen className="w-10 h-10 text-white/20" />
                <p className="text-white/30 text-sm">
                  No file uploaded by client
                </p>
              </div>
            )}
          </div>

          {/* RIGHT: Staff uploads Final Compiled PDF */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Printer className="w-4 h-4" style={{ color: "#4ade80" }} />
              <span className="text-white/60 text-sm font-semibold">
                Final Compiled PDF
              </span>
              {lead.finalPdfUrl && (
                <button
                  type="button"
                  data-ocid="bulk.leads.upload_button"
                  onClick={() => fileInputRef.current?.click()}
                  className="ml-auto text-xs text-green-400 hover:text-green-300"
                >
                  Replace PDF
                </button>
              )}
            </div>

            {lead.finalPdfUrl ? (
              <iframe
                src={lead.finalPdfUrl}
                width="100%"
                height="500"
                className="rounded-lg"
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "#1a2035",
                }}
                title="Final compiled PDF"
              />
            ) : (
              <button
                type="button"
                data-ocid="bulk.leads.dropzone"
                onClick={() => fileInputRef.current?.click()}
                className="h-[500px] w-full rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:border-green-500/40"
                style={{
                  background: "rgba(74,222,128,0.04)",
                  border: "2px dashed rgba(74,222,128,0.2)",
                }}
              >
                {uploadProgress !== null ? (
                  <>
                    <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
                    <p className="text-green-400 text-sm font-semibold">
                      Uploading... {Math.round(uploadProgress)}%
                    </p>
                    <div
                      className="w-40 h-1.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.1)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${uploadProgress}%`,
                          background: "#4ade80",
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
                      style={{ background: "rgba(74,222,128,0.1)" }}
                    >
                      <Upload
                        className="w-8 h-8"
                        style={{ color: "#4ade80" }}
                      />
                    </div>
                    <p className="text-white/50 text-sm font-semibold">
                      Upload Final Compiled PDF
                    </p>
                    <p className="text-white/25 text-xs">
                      Saved permanently to database
                    </p>
                    <p className="text-white/20 text-xs">.pdf files only</p>
                  </>
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFinalPdfUpload(file);
              }}
            />
          </div>
        </div>

        {/* ── WhatsApp Communication Hub ── */}
        <div className="px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-white/30 text-xs mb-1">
              Send WhatsApp Proof to:
            </p>
            <div className="flex items-center gap-2">
              {editingPhone ? (
                <input
                  data-ocid="bulk.leads.input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setEditingPhone(false)}
                  // biome-ignore lint/a11y/noAutofocus: intentional focus on edit mode
                  autoFocus
                  className="bg-transparent border-b border-purple-400 text-white text-sm outline-none w-44 pb-0.5"
                  placeholder="10-digit mobile number"
                />
              ) : (
                <span className="text-white/70 text-sm font-mono">
                  {phone ? `+91 ${phone}` : "No number on file"}
                </span>
              )}
              <button
                type="button"
                onClick={() => setEditingPhone(!editingPhone)}
                className="text-white/30 hover:text-white/60 transition-colors"
                title="Edit number"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <a
            data-ocid="bulk.leads.button"
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105 active:scale-100"
            style={{
              background: "linear-gradient(135deg, #25d366, #128c7e)",
              boxShadow: "0 4px 20px rgba(37,211,102,0.3)",
            }}
          >
            <Send className="w-4 h-4" />
            Send Proof via WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

// ---- Main Dashboard -------------------------------------------------------

export default function BulkDashboard() {
  const navigate = useNavigate();
  const { actor } = useActor();
  const [leads, setLeads] = useState<TypesettingQuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [noAuth, setNoAuth] = useState(false);
  const [selectedLead, setSelectedLead] =
    useState<TypesettingQuoteRequest | null>(null);
  const [draggingId, setDraggingId] = useState<bigint | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnKey | null>(null);

  // ── Route guard: only Bulk Staff or Super Admin ──
  const bulkSession = localStorage.getItem("bulkSession");
  const adminSession = localStorage.getItem("clikmate_admin_session");

  useEffect(() => {
    if (!bulkSession && !adminSession) {
      navigate("/portal");
    }
  }, [bulkSession, adminSession, navigate]);

  // ── Fetch B2B leads only ──
  useEffect(() => {
    if (!bulkSession && !adminSession) return;
    (async () => {
      setLoading(true);
      try {
        if (!actor) {
          setNoAuth(true);
          setLoading(false);
          return;
        }
        const data = await actor.getAllTypesettingQuotes();
        // Filter: only "Premium Question Paper Design" or B2B Lead orders
        setLeads(data);
      } catch {
        setNoAuth(true);
        setLeads([]);
      } finally {
        setLoading(false);
      }
    })();
    // biome-ignore lint/correctness/useExhaustiveDependencies: actor re-fetch handled by session changes
  }, [bulkSession, adminSession, actor]);

  const sessionMobile = (() => {
    try {
      return JSON.parse(bulkSession ?? "{}").mobile ?? "";
    } catch {
      return "";
    }
  })();

  const logout = () => {
    localStorage.removeItem("bulkSession");
    navigate("/portal");
  };

  // ── Drag & drop ──
  const handleDrop = async (colKey: ColumnKey) => {
    if (draggingId === null) return;
    const newStatus = STATUS_MAP[colKey];
    try {
      if (!actor) {
        toast.error("Actor not ready");
        return;
      }
      await actor.updateTypesettingQuoteStatus(draggingId, {
        status: newStatus,
      });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === draggingId ? { ...l, status: newStatus } : l,
        ),
      );
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    }
    setDraggingId(null);
    setDragOverCol(null);
  };

  const updateLead = (
    id: bigint,
    updated: Partial<TypesettingQuoteRequest>,
  ) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updated } : l)),
    );
    if (selectedLead?.id === id)
      setSelectedLead((prev) => (prev ? { ...prev, ...updated } : prev));
  };

  if (!bulkSession && !adminSession) return null;

  return (
    <div
      data-ocid="bulk.dashboard.page"
      className="min-h-screen flex flex-col"
      style={{
        background:
          "linear-gradient(160deg, #0a0f1e 0%, #0d1327 60%, #130a1e 100%)",
      }}
    >
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(192,132,252,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(192,132,252,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* ── Header ── */}
      <header
        className="relative flex items-center justify-between px-6 py-4 gap-4"
        style={{
          borderBottom: "1px solid rgba(192,132,252,0.15)",
          background: "rgba(10,15,30,0.9)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(192,132,252,0.15)" }}
          >
            <Printer className="w-5 h-5" style={{ color: "#c084fc" }} />
          </div>
          <div>
            <h1 className="text-white font-black text-lg leading-none">
              Bulk Printing &amp; Typesetting Portal
            </h1>
            {sessionMobile && (
              <p className="text-white/35 text-xs mt-0.5">
                Staff: {sessionMobile}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: "rgba(192,132,252,0.1)",
              color: "#c084fc",
              border: "1px solid rgba(192,132,252,0.2)",
            }}
          >
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: "#4ade80" }}
            />
            VIP B2B Portal
          </div>
          <Button
            data-ocid="bulk.dashboard.button"
            onClick={logout}
            size="sm"
            variant="ghost"
            className="text-white/40 hover:text-white/80 gap-1.5"
          >
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>
      </header>

      {/* No auth warning */}
      {noAuth && (
        <div
          data-ocid="bulk.dashboard.error_state"
          className="mx-6 mt-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.25)",
            color: "#fcd34d",
          }}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Admin session required to load B2B leads. Ask the Super Admin to log
          in first, or access via Admin Dashboard.
        </div>
      )}

      {/* ── Kanban Board ── */}
      <main className="relative flex-1 p-6 overflow-x-auto">
        {loading ? (
          <div
            data-ocid="bulk.dashboard.loading_state"
            className="flex items-center justify-center h-64"
          >
            <Loader2
              className="w-8 h-8 animate-spin"
              style={{ color: "#c084fc" }}
            />
          </div>
        ) : (
          <div className="flex gap-5 min-w-max pb-8">
            {COLUMNS.map((col) => {
              const colLeads = leads.filter((l) =>
                col.statuses.includes(l.status),
              );
              const isDragOver = dragOverCol === col.key;
              return (
                <div
                  key={col.key}
                  data-ocid={`bulk.${col.key}.panel`}
                  className="flex flex-col gap-3 w-72"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverCol(col.key);
                  }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={() => handleDrop(col.key)}
                >
                  {/* Column header */}
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                    style={{
                      borderLeft: `3px solid ${col.borderColor}`,
                      background: `${col.borderColor}0d`,
                    }}
                  >
                    <span style={{ color: col.borderColor }}>{col.icon}</span>
                    <span className="text-white/80 font-semibold text-sm">
                      {col.label}
                    </span>
                    <span
                      className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: `${col.borderColor}22`,
                        color: col.borderColor,
                      }}
                    >
                      {colLeads.length}
                    </span>
                  </div>

                  {/* Drop zone */}
                  <div
                    className="flex flex-col gap-3 min-h-[200px] rounded-xl p-2 transition-all"
                    style={{
                      border: isDragOver
                        ? `2px dashed ${col.borderColor}`
                        : "2px dashed transparent",
                      background: isDragOver
                        ? `${col.borderColor}08`
                        : "transparent",
                    }}
                  >
                    {colLeads.length === 0 ? (
                      <div
                        data-ocid={`bulk.${col.key}.empty_state`}
                        className="flex items-center justify-center h-24 rounded-lg"
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          border: "1px dashed rgba(255,255,255,0.07)",
                        }}
                      >
                        <p className="text-white/20 text-xs">No leads here</p>
                      </div>
                    ) : (
                      colLeads.map((lead) => (
                        <OrderCard
                          key={String(lead.id)}
                          lead={lead}
                          onClick={() => setSelectedLead(lead)}
                          onDragStart={() => setDraggingId(lead.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Detail modal */}
      {selectedLead && (
        <OrderDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={(updated) => updateLead(selectedLead.id, updated)}
          actor={actor}
        />
      )}
    </div>
  );
}
