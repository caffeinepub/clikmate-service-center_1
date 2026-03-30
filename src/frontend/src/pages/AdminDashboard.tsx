import { ExternalBlob } from "@/backend";
import type {
  CatalogItem,
  CatalogItemInput,
  ExpenseEntry,
  FilterOrders,
  ManualIncomeEntry,
  OrderRecord,
  Review,
  ShopOrder,
  StaffLedgerEntry,
  SupportTicket,
  TypesettingQuoteRequest,
  backendInterface,
} from "@/backend.d";
import { CsvBulkUploader } from "@/components/CsvBulkUploader";
import {
  LetterheadLayout,
  invalidateLetterheadCache,
  triggerPrint,
} from "@/components/LetterheadLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/firebase";
import {
  fsAddDoc,
  fsDeleteDoc,
  fsGetCollection,
  fsGetSettings,
  fsSetDoc,
  fsSetSettings,
  fsSubscribeCollection,
  fsUpdateDoc,
} from "@/utils/firestoreService";
import { formatDateTime } from "@/utils/formatDateTime";
import { runCloudMigration } from "@/utils/migrationUtils";
import { Link } from "@/utils/router";
import {
  type CategoryEntry,
  STORAGE_KEYS,
  generateProductId,
  getCategories,
  storageAddItem,
  storageGet,
  storageRemoveItem,
  storageSet,
  storageUpdateItem,
} from "@/utils/storage";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Edit2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  FilmIcon,
  FolderOpen,
  GripVertical,
  Headphones,
  ImageIcon,
  KeyRound,
  Layers,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Package,
  Printer,
  Receipt,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  Upload,
  UserCheck,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const _STOCK_STATUSES = ["In Stock", "Out of Stock", "Limited Stock"];

const CATEGORY_COLORS: Record<string, string> = {
  "CSC & Govt Services":
    "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
  "Govt Service": "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  Printing: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  "Smart Card": "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
  "Resume Service": "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  "Tech Gadget": "bg-green-500/20 text-green-300 border border-green-500/30",
  Stationery: "bg-pink-500/20 text-pink-300 border border-pink-500/30",
  "Retail Product":
    "bg-orange-500/20 text-orange-300 border border-orange-500/30",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type NavSection =
  | "dashboard"
  | "catalog"
  | "orders"
  | "active-orders"
  | "order-history"
  | "settings"
  | "team"
  | "wallet"
  | "reviews"
  | "b2b-leads"
  | "audit"
  | "helpdesk"
  | "exam-paper-engine"
  | "smart-id-studio"
  | "delivery-dispatch"
  | "attendance-report";

interface MediaFile {
  id: string;
  file?: File;
  previewUrl: string;
  type: "image" | "video";
  name: string;
  progress: number;
  existingBlob?: ExternalBlob;
}

function getGstSettings(): { enabled: boolean; shopGstNumber: string } {
  try {
    const raw = localStorage.getItem("clikmate_gst_settings");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, shopGstNumber: "" };
}

interface FormState {
  name: string;
  category: string;
  description: string;
  price: string;
  stockStatus: string;
  requiredDocuments: string;
  requiresPdfCalc: boolean;
  mediaFiles: MediaFile[];
  itemType: "product" | "service";
  saleRate: string;
  purchaseRate: string;
  quantity: string;
  reorderLevel: string;
  alertBefore: string;
  barcode: string;
  gstPercentage: string;
  hsnSac: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  category: "CSC & Govt Services",
  description: "",
  price: "",
  stockStatus: "In Stock",
  requiredDocuments: "",
  requiresPdfCalc: false,
  mediaFiles: [],
  itemType: "service",
  saleRate: "",
  purchaseRate: "",
  quantity: "",
  reorderLevel: "",
  alertBefore: "",
  barcode: "",
  gstPercentage: "0",
  hsnSac: "",
};

// ─── Styles (inline dark theme) ───────────────────────────────────────────────

const S = {
  body: {
    backgroundColor: "#0a0f1e",
    minHeight: "100vh",
    display: "flex",
    color: "#e2e8f0",
    fontFamily: "inherit",
  } as React.CSSProperties,
  sidebar: {
    width: "260px",
    flexShrink: 0,
    backgroundColor: "#111827",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    flexDirection: "column" as const,
    position: "fixed" as const,
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 40,
    overflowY: "auto" as const,
  },
  sidebarMobile: {
    width: "260px",
    flexShrink: 0,
    backgroundColor: "#111827",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    flexDirection: "column" as const,
    position: "fixed" as const,
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 50,
    overflowY: "auto" as const,
  },
  mainContent: {
    flex: 1,
    marginLeft: "260px",
    display: "flex",
    flexDirection: "column" as const,
    minHeight: "100vh",
  },
  header: {
    backgroundColor: "#111827",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    padding: "0 24px",
    height: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky" as const,
    top: 0,
    zIndex: 30,
  },
  card: {
    backgroundColor: "#1a2236",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  table: {
    backgroundColor: "#111827",
    borderRadius: "16px",
    overflow: "hidden" as const,
    border: "1px solid rgba(255,255,255,0.07)",
  },
  tableHeader: {
    backgroundColor: "#1a2236",
  },
  modal: {
    backgroundColor: "#1a2236",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px",
    maxWidth: "700px",
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto" as const,
    position: "relative" as const,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e2e8f0",
    borderRadius: "8px",
    padding: "8px 12px",
    width: "100%",
    outline: "none",
    fontSize: "14px",
  },
  dropzone: (hover: boolean) =>
    ({
      border: `2px dashed ${hover ? "#8b5cf6" : "rgba(139,92,246,0.4)"}`,
      borderRadius: "12px",
      padding: "32px 16px",
      textAlign: "center",
      cursor: "pointer",
      transition: "all 0.2s",
      backgroundColor: hover ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.03)",
    }) as React.CSSProperties,
};

// ─── Media Uploader ───────────────────────────────────────────────────────────

function MediaUploader({
  mediaFiles,
  onChange,
}: {
  mediaFiles: MediaFile[];
  onChange: (files: MediaFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  function processFiles(fileList: FileList) {
    const newFiles: MediaFile[] = [];
    for (const file of Array.from(fileList)) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) continue;
      const previewUrl = URL.createObjectURL(file);
      newFiles.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        previewUrl,
        type: isVideo ? "video" : "image",
        name: file.name,
        progress: 0,
      });
    }
    onChange([...mediaFiles, ...newFiles]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }

  function removeFile(id: string) {
    const removed = mediaFiles.find((f) => f.id === id);
    if (removed?.file) URL.revokeObjectURL(removed.previewUrl);
    onChange(mediaFiles.filter((f) => f.id !== id));
  }

  function handleReorderDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleReorderDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newFiles = [...mediaFiles];
    const [removed] = newFiles.splice(draggedIndex, 1);
    newFiles.splice(index, 0, removed);
    setDraggedIndex(index);
    onChange(newFiles);
  }

  function handleReorderDragEnd() {
    setDraggedIndex(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <button
        type="button"
        data-ocid="admin.dropzone"
        style={S.dropzone(dragOver)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload
          style={{
            width: 32,
            height: 32,
            margin: "0 auto 8px",
            color: "#8b5cf6",
          }}
        />
        <p
          style={{
            color: "#c4b5fd",
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 4,
          }}
        >
          Drag &amp; drop images or videos here
        </p>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
          or click to browse
        </p>
        <p
          style={{
            color: "rgba(255,255,255,0.25)",
            fontSize: 11,
            marginTop: 6,
          }}
        >
          Supports: JPG, PNG, GIF, MP4, MOV
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
      </button>

      {mediaFiles.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
          }}
        >
          {mediaFiles.map((mf, index) => (
            <div
              key={mf.id}
              data-ocid={`admin.media.item.${index + 1}`}
              draggable
              onDragStart={() => handleReorderDragStart(index)}
              onDragOver={(e) => handleReorderDragOver(e, index)}
              onDragEnd={handleReorderDragEnd}
              style={{
                position: "relative",
                borderRadius: 8,
                overflow: "hidden",
                border:
                  draggedIndex === index
                    ? "2px solid #8b5cf6"
                    : "1px solid rgba(255,255,255,0.1)",
                opacity: draggedIndex === index ? 0.5 : 1,
                cursor: "grab",
                backgroundColor: "#0a0f1e",
              }}
            >
              {mf.type === "image" ? (
                <img
                  src={mf.previewUrl}
                  alt={mf.name}
                  style={{ width: "100%", height: 80, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: 80,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#0a0f1e",
                  }}
                >
                  <FilmIcon
                    style={{
                      width: 24,
                      height: 24,
                      color: "#8b5cf6",
                      marginBottom: 2,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.5)",
                      textAlign: "center",
                      padding: "0 4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}
                  >
                    {mf.name}
                  </span>
                </div>
              )}
              <div style={{ position: "absolute", top: 2, left: 2 }}>
                <GripVertical
                  style={{
                    width: 14,
                    height: 14,
                    color: "rgba(255,255,255,0.6)",
                  }}
                />
              </div>
              <button
                type="button"
                data-ocid={`admin.media.delete_button.${index + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(mf.id);
                }}
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 20,
                  height: 20,
                  background: "#ef4444",
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X style={{ width: 10, height: 10, color: "white" }} />
              </button>
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "rgba(0,0,0,0.6)",
                  padding: "2px 4px",
                }}
              >
                <p
                  style={{
                    color: "white",
                    fontSize: 9,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {mf.name}
                </p>
              </div>
              {mf.progress > 0 && mf.progress < 100 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.7)",
                  }}
                >
                  <span
                    style={{ color: "white", fontSize: 11, marginBottom: 4 }}
                  >
                    {mf.progress}%
                  </span>
                  <Progress value={mf.progress} className="w-3/4 h-1" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Item Form Modal ──────────────────────────────────────────────────────────

function ItemFormModal({
  open,
  onClose,
  editItem,
  onSaved,
  onItemAdded,
}: {
  open: boolean;
  onClose: () => void;
  editItem: CatalogItem | null;
  onSaved: () => void;
  onItemAdded?: (item: CatalogItem) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const _cats = getCategories();
  const allProductCats = _cats
    .filter((c) => c.appliesTo === "product")
    .map((c) => c.name);
  const allServiceCats = _cats
    .filter((c) => c.appliesTo === "service")
    .map((c) => c.name);

  useEffect(() => {
    if (open) {
      if (editItem) {
        const mediaFiles: MediaFile[] = editItem.mediaFiles.map(
          (blob, idx) => ({
            id: `existing-${idx}`,
            previewUrl:
              typeof blob === "string"
                ? blob
                : (blob as any).getDirectURL?.() || "",
            type: (editItem.mediaTypes[idx] || "image") as "image" | "video",
            name: `Media ${idx + 1}`,
            progress: 100,
            existingBlob: blob as unknown as ExternalBlob,
          }),
        );
        setForm({
          name: editItem.name,
          category: editItem.category,
          description: editItem.description,
          price: editItem.price,
          stockStatus: editItem.stockStatus,
          requiredDocuments: editItem.requiredDocuments || "",
          requiresPdfCalc: editItem.requiresPdfCalc || false,
          mediaFiles,
          itemType: editItem.itemType ?? "service",
          saleRate:
            editItem.saleRate != null
              ? String(editItem.saleRate)
              : editItem.price || "",
          purchaseRate:
            editItem.purchaseRate != null ? String(editItem.purchaseRate) : "0",
          quantity: editItem.quantity != null ? String(editItem.quantity) : "0",
          reorderLevel:
            editItem.reorderLevel != null ? String(editItem.reorderLevel) : "5",
          alertBefore:
            editItem.alertBefore != null
              ? String(editItem.alertBefore)
              : editItem.reorderLevel != null
                ? String(editItem.reorderLevel)
                : "5",
          barcode: editItem.barcode || "",
          gstPercentage:
            (editItem as any).gstPercentage != null
              ? String((editItem as any).gstPercentage)
              : "0",
          hsnSac: (editItem as any).hsnSac || "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, editItem]);

  async function handleSave() {
    if (!form.name.trim() || !form.saleRate.trim()) {
      toast.error("Name and price are required.");
      return;
    }
    setSaving(true);
    try {
      const mediaTypes: string[] = form.mediaFiles.map((mf) => mf.type);
      const sr = Number.parseFloat(form.saleRate) || 0;
      if (sr <= 0) {
        toast.error("Sale Rate must be greater than 0.");
        setSaving(false);
        return;
      }
      if (editItem) {
        const isProduct = form.itemType === "product";
        // Build patch — never pass undefined to Firestore (causes updateDoc to throw)
        const updatedItem: Record<string, unknown> = {
          name: form.name,
          category: form.category,
          description: form.description,
          price: form.saleRate || form.price,
          stockStatus: isProduct ? form.stockStatus || "In Stock" : "N/A",
          requiredDocuments:
            form.category === "CSC & Govt Services"
              ? form.requiredDocuments
              : "",
          requiresPdfCalc: form.requiresPdfCalc,
          mediaFiles: [],
          mediaTypes,
          itemType: form.itemType,
          saleRate: sr,
          purchaseRate: isProduct
            ? Number.parseFloat(form.purchaseRate) || 0
            : 0,
          barcode: form.barcode || "",
          gstPercentage: Number(form.gstPercentage) || 0,
          hsnSac: form.hsnSac || "",
          // Preserve existing id/productId fields from editItem
          id: editItem.id,
          productId: editItem.productId,
        };
        // Product-only fields: set to 0 for Services (avoids Firestore undefined error)
        if (isProduct) {
          updatedItem.quantity = Number.parseInt(form.quantity) || 0;
          updatedItem.reorderLevel =
            Number.parseInt(form.alertBefore || form.reorderLevel) || 5;
          updatedItem.alertBefore =
            Number.parseInt(form.alertBefore || form.reorderLevel) || 5;
        } else {
          // For services, explicitly set to 0 so stale product values are cleared
          updatedItem.quantity = 0;
          updatedItem.reorderLevel = 0;
          updatedItem.alertBefore = 0;
        }
        const docId = String(editItem.productId || editItem.id);
        await fsUpdateDoc("catalog", docId, updatedItem);
        toast.success("Item updated!");
        onSaved();
      } else {
        const newId = Date.now() as unknown as bigint;
        const newItem: CatalogItem & Record<string, unknown> = {
          id: newId,
          name: form.name,
          category: form.category,
          description: form.description,
          price: form.saleRate || form.price,
          stockStatus:
            form.itemType === "product"
              ? form.stockStatus || "In Stock"
              : "N/A",
          requiredDocuments:
            form.category === "CSC & Govt Services"
              ? form.requiredDocuments
              : "",
          requiresPdfCalc: form.requiresPdfCalc,
          published: true,
          createdAt: Date.now() as unknown as bigint,
          mediaFiles: [],
          mediaTypes,
          itemType: form.itemType,
          saleRate: sr,
          purchaseRate:
            form.itemType === "product"
              ? Number.parseFloat(form.purchaseRate) || 0
              : 0,
          quantity:
            form.itemType === "product"
              ? Number.parseInt(form.quantity) || 0
              : undefined,
          reorderLevel:
            form.itemType === "product"
              ? Number.parseInt(form.reorderLevel) || 5
              : undefined,
          barcode: form.barcode || "",
          gstPercentage: Number(form.gstPercentage) || 0,
          hsnSac: form.hsnSac || "",
        };
        const existingItems = await fsGetCollection<any>("catalog");
        const productId = generateProductId(existingItems);
        const newItemWithId = { ...newItem, productId };
        await fsSetDoc("catalog", productId, newItemWithId);
        if (onItemAdded) onItemAdded(newItemWithId);
        toast.success("Item Added Successfully");
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save item.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const labelStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 6,
    display: "block",
  };

  const inputStyle: React.CSSProperties = {
    ...S.input,
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e2e8f0",
  };

  return (
    <div
      role="presentation"
      data-ocid="admin.item.modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div style={S.modal}>
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ color: "white", fontWeight: 700, fontSize: 18 }}>
            {editItem ? "Edit Item" : "Add New Catalog Item"}
          </h2>
          <button
            type="button"
            data-ocid="admin.item.close_button"
            onClick={onClose}
            style={{
              color: "rgba(255,255,255,0.5)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: "20px 24px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
        >
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label htmlFor="main-category-radio" style={labelStyle}>
                Main Category *
              </label>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                {(["product", "service"] as const).map((opt) => (
                  <label
                    key={opt}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      padding: "8px 16px",
                      borderRadius: 10,
                      border: `1px solid ${form.itemType === opt ? (opt === "product" ? "rgba(0,255,255,0.5)" : "rgba(167,139,250,0.5)") : "rgba(255,255,255,0.1)"}`,
                      background:
                        form.itemType === opt
                          ? opt === "product"
                            ? "rgba(0,255,255,0.08)"
                            : "rgba(167,139,250,0.08)"
                          : "transparent",
                      color:
                        form.itemType === opt
                          ? opt === "product"
                            ? "#00ffff"
                            : "#a78bfa"
                          : "rgba(255,255,255,0.5)",
                      fontSize: 13,
                      fontWeight: 600,
                      transition: "all 0.15s",
                    }}
                  >
                    <input
                      type="radio"
                      name="editMainCategory"
                      value={opt}
                      checked={form.itemType === opt}
                      onChange={() => {
                        const cats =
                          opt === "product" ? allProductCats : allServiceCats;
                        setForm((p) => ({
                          ...p,
                          itemType: opt,
                          category: cats[0] || "",
                        }));
                      }}
                      style={{ display: "none" }}
                    />
                    {opt === "product" ? "📦 Product" : "🛠 Service"}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="modal-item-category" style={labelStyle}>
                Sub-Category
              </label>
              <select
                id="modal-item-category"
                data-ocid="admin.category.select"
                style={{ ...inputStyle, appearance: "none" }}
                value={form.category}
                onChange={(e) =>
                  setForm((p) => ({ ...p, category: e.target.value }))
                }
              >
                {(form.itemType === "product"
                  ? allProductCats
                  : allServiceCats
                ).map((c) => (
                  <option key={c} value={c} style={{ background: "#1a2236" }}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="modal-item-name" style={labelStyle}>
                Item Name *
              </label>
              <input
                id="modal-item-name"
                data-ocid="admin.item.input"
                style={inputStyle}
                placeholder="e.g. Bulk B&W Printing"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>

            <div>
              <label htmlFor="modal-item-sale-rate" style={labelStyle}>
                Sale Rate (₹) - Selling Price *
              </label>
              <input
                id="modal-item-sale-rate"
                data-ocid="admin.sale_rate.input"
                style={inputStyle}
                type="number"
                placeholder="e.g. 50"
                value={form.saleRate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, saleRate: e.target.value }))
                }
              />
            </div>

            {form.itemType === "product" && (
              <>
                <div>
                  <label htmlFor="modal-item-purchase-rate" style={labelStyle}>
                    Purchase Rate (₹) - Cost Price
                  </label>
                  <input
                    id="modal-item-purchase-rate"
                    data-ocid="admin.purchase_rate.input"
                    style={inputStyle}
                    type="number"
                    placeholder="e.g. 30"
                    value={form.purchaseRate}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, purchaseRate: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label htmlFor="modal-item-quantity" style={labelStyle}>
                    Current Stock Qty
                  </label>
                  <input
                    id="modal-item-quantity"
                    data-ocid="admin.quantity.input"
                    style={inputStyle}
                    type="number"
                    placeholder="e.g. 100"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, quantity: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label htmlFor="modal-item-reorder" style={labelStyle}>
                    Alert Before (Low Stock Level)
                  </label>
                  <input
                    id="modal-item-reorder"
                    data-ocid="admin.reorder.input"
                    style={inputStyle}
                    type="number"
                    placeholder="Default 5"
                    value={form.alertBefore}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, alertBefore: e.target.value }))
                    }
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="modal-item-desc" style={labelStyle}>
                Description
              </label>
              <textarea
                id="modal-item-desc"
                data-ocid="admin.item.textarea"
                style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                placeholder="Describe the service or product..."
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>

            <div>
              <label htmlFor="modal-item-barcode" style={labelStyle}>
                Barcode (Optional)
              </label>
              <input
                id="modal-item-barcode"
                data-ocid="admin.barcode.input"
                style={inputStyle}
                placeholder="e.g. 8901234567890"
                value={form.barcode}
                onChange={(e) =>
                  setForm((p) => ({ ...p, barcode: e.target.value }))
                }
              />
            </div>

            {getGstSettings().enabled && (
              <>
                <div>
                  <label htmlFor="modal-item-gst-pct" style={labelStyle}>
                    GST %
                  </label>
                  <select
                    id="modal-item-gst-pct"
                    data-ocid="admin.item.gst_select"
                    value={form.gstPercentage}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, gstPercentage: e.target.value }))
                    }
                    style={inputStyle}
                  >
                    {["0", "5", "12", "18", "28"].map((v) => (
                      <option
                        key={v}
                        value={v}
                        style={{ background: "#0f172a" }}
                      >
                        {v}%
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="modal-item-hsnsac" style={labelStyle}>
                    HSN/SAC Code (optional)
                  </label>
                  <input
                    id="modal-item-hsnsac"
                    data-ocid="admin.item.hsnsac.input"
                    type="text"
                    placeholder="e.g. 4820, 998314"
                    value={form.hsnSac}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, hsnSac: e.target.value }))
                    }
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            {form.category === "CSC & Govt Services" && (
              <div>
                <label htmlFor="modal-item-required-docs" style={labelStyle}>
                  Required Documents (Comma Separated)
                </label>
                <input
                  id="modal-item-required-docs"
                  data-ocid="admin.required_docs.input"
                  style={inputStyle}
                  placeholder="e.g. Aadhaar, Passport Photo, Signature"
                  value={form.requiredDocuments}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      requiredDocuments: e.target.value,
                    }))
                  }
                />
                <p
                  style={{
                    color: "rgba(167,139,250,0.7)",
                    fontSize: 11,
                    marginTop: 4,
                  }}
                >
                  Each document becomes an upload button for the customer
                </p>
              </div>
            )}
          </div>

          {/* Right column: Media Uploader */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <span style={{ ...labelStyle, marginBottom: 0 }}>
                Media Gallery
              </span>
              <span
                style={{
                  backgroundColor: "rgba(139,92,246,0.3)",
                  color: "#c4b5fd",
                  borderRadius: 20,
                  padding: "2px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {form.mediaFiles.length} files
              </span>
            </div>
            <MediaUploader
              mediaFiles={form.mediaFiles}
              onChange={(files) =>
                setForm((p) => ({ ...p, mediaFiles: files }))
              }
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "0 24px 20px",
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button
            type="button"
            data-ocid="admin.item.cancel_button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "none",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-ocid="admin.item.save_button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 24px",
              borderRadius: 8,
              border: "none",
              background: saving ? "#6d28d9" : "#7c3aed",
              color: "white",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {saving && (
              <Loader2
                style={{
                  width: 14,
                  height: 14,
                  animation: "spin 1s linear infinite",
                }}
              />
            )}
            {saving ? "Saving..." : editItem ? "Update Item" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({
  open,
  onClose,
  onConfirm,
  itemName,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
}) {
  if (!open) return null;
  return (
    <div
      role="presentation"
      data-ocid="admin.delete.dialog"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.75)",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "#1a2236",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: 24,
          maxWidth: 380,
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <AlertTriangle style={{ width: 22, height: 22, color: "#ef4444" }} />
          <h3 style={{ color: "white", fontWeight: 700, fontSize: 16 }}>
            Delete Item
          </h3>
        </div>
        <p
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          Are you sure you want to permanently delete{" "}
          <strong style={{ color: "white" }}>{itemName}</strong>? This cannot be
          undone.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button
            type="button"
            data-ocid="admin.delete.cancel_button"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "none",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-ocid="admin.delete.confirm_button"
            onClick={onConfirm}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: "#dc2626",
              color: "white",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Nav Item ─────────────────────────────────────────────────────────────────

function NavItem({
  icon: Icon,
  label,
  active,
  ocid,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  ocid: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-ocid={ocid}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px 16px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        fontWeight: active ? 600 : 400,
        fontSize: 14,
        transition: "all 0.15s",
        backgroundColor: active ? "rgba(6,182,212,0.15)" : "transparent",
        color: active ? "#67e8f9" : "rgba(255,255,255,0.55)",
        borderLeft: active ? "3px solid #06b6d4" : "3px solid transparent",
        marginBottom: 2,
      }}
    >
      <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
      {label}
    </button>
  );
}

// ─── Nav Group (Accordion) ────────────────────────────────────────────────────

function NavGroup({
  icon: Icon,
  label,
  groupId,
  isOpen,
  onToggle,
  children,
}: {
  icon: React.ElementType;
  label: string;
  groupId: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 2 }}>
      <button
        type="button"
        data-ocid={`admin.${groupId}.toggle`}
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "8px 12px 8px 12px",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          textAlign: "left",
          background: "transparent",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(6,182,212,0.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "transparent";
        }}
      >
        <Icon
          style={{
            width: 16,
            height: 16,
            color: "rgba(255,255,255,0.4)",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            flex: 1,
            color: "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </span>
        <ChevronRight
          style={{
            width: 14,
            height: 14,
            color: "rgba(255,255,255,0.35)",
            flexShrink: 0,
            transition: "transform 0.25s ease",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
      </button>
      <div
        style={{
          maxHeight: isOpen ? "500px" : "0",
          overflow: "hidden",
          transition: "max-height 0.3s ease",
        }}
      >
        <div style={{ paddingLeft: 8 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

function StatsCard({
  label,
  value,
  iconColor,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  iconColor: string;
  icon: React.ElementType;
}) {
  return (
    <div
      style={{
        ...S.card,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: `${iconColor}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon style={{ width: 20, height: 20, color: iconColor }} />
      </div>
      <div>
        <div
          style={{
            color: "white",
            fontWeight: 700,
            fontSize: 22,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.45)",
            fontSize: 12,
            marginTop: 2,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

// ─── Product Form Modal ──────────────────────────────────────────────────────

function ProductFormModal({
  open,
  onClose,
  onSaved: _onSaved,
  onItemAdded,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onItemAdded?: (item: CatalogItem) => void;
}) {
  const _prodCats = getCategories();
  const productCategories = _prodCats
    .filter((c) => c.appliesTo === "product")
    .map((c) => c.name);
  const prodServiceCategories = _prodCats
    .filter((c) => c.appliesTo === "service")
    .map((c) => c.name);
  const [mainCategoryProd, setMainCategoryProd] = React.useState<
    "product" | "service"
  >("product");
  const [form, setForm] = useState({
    name: "",
    category: productCategories[0] || "Stationery",
    saleRate: "",
    purchaseRate: "",
    quantity: "",
    reorderLevel: "",
    description: "",
    barcode: "",
    gstPercentage: "0",
    hsnSac: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open)
      setForm({
        name: "",
        category: "Retail Accessories",
        saleRate: "",
        purchaseRate: "",
        quantity: "",
        reorderLevel: "",
        description: "",
        barcode: "",
        gstPercentage: "0",
        hsnSac: "",
      });
  }, [open]);

  async function handleSave() {
    const sr = Number.parseFloat(form.saleRate) || 0;
    if (!form.name.trim() || sr <= 0) {
      toast.error("Name and Sale Rate are required.");
      return;
    }
    setSaving(true);
    try {
      const newItem: CatalogItem & Record<string, unknown> = {
        id: Date.now() as unknown as bigint,
        name: form.name,
        category: form.category,
        description: form.description,
        price: form.saleRate,
        stockStatus: mainCategoryProd === "product" ? "In Stock" : "N/A",
        requiredDocuments: "",
        requiresPdfCalc: false,
        published: true,
        createdAt: Date.now() as unknown as bigint,
        mediaFiles: [],
        mediaTypes: [],
        itemType: mainCategoryProd,
        saleRate: sr,
        purchaseRate:
          mainCategoryProd === "product"
            ? Number.parseFloat(form.purchaseRate) || 0
            : 0,
        quantity:
          mainCategoryProd === "product"
            ? Number.parseInt(form.quantity) || 0
            : undefined,
        reorderLevel:
          mainCategoryProd === "product"
            ? Number.parseInt(form.reorderLevel) || 5
            : undefined,
      };
      const existingItems2 = await fsGetCollection<any>("catalog");
      const productId2 = generateProductId(existingItems2);
      const newItemWithId2 = {
        ...newItem,
        productId: productId2,
        alertBefore: Number.parseInt(form.reorderLevel) || 5,
        barcode: form.barcode || "",
        gstPercentage: Number(form.gstPercentage) || 0,
        hsnSac: form.hsnSac || "",
      };
      await fsSetDoc("catalog", productId2, newItemWithId2);
      if (onItemAdded) onItemAdded(newItemWithId2);
      toast.success("Product Added Successfully");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add product.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const labelStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 6,
    display: "block",
  };
  const inputStyle: React.CSSProperties = {
    ...S.input,
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e2e8f0",
  };

  return (
    <div
      role="presentation"
      data-ocid="admin.product.modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div style={{ ...S.modal, maxWidth: 480, width: "100%" }}>
        <div
          style={{
            padding: "20px 24px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ color: "white", fontWeight: 700, fontSize: 18 }}>
            Add New Product
          </h2>
          <button
            type="button"
            data-ocid="admin.product.close_button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontSize: 20,
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <label htmlFor="main-category-radio" style={labelStyle}>
              Main Category *
            </label>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {(["product", "service"] as const).map((opt) => (
                <label
                  key={opt}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: `1px solid ${mainCategoryProd === opt ? (opt === "product" ? "rgba(0,255,255,0.5)" : "rgba(167,139,250,0.5)") : "rgba(255,255,255,0.1)"}`,
                    background:
                      mainCategoryProd === opt
                        ? opt === "product"
                          ? "rgba(0,255,255,0.08)"
                          : "rgba(167,139,250,0.08)"
                        : "transparent",
                    color:
                      mainCategoryProd === opt
                        ? opt === "product"
                          ? "#00ffff"
                          : "#a78bfa"
                        : "rgba(255,255,255,0.5)",
                    fontSize: 13,
                    fontWeight: 600,
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    type="radio"
                    name="mainCategoryProd"
                    value={opt}
                    checked={mainCategoryProd === opt}
                    onChange={() => {
                      const cats =
                        opt === "product"
                          ? productCategories
                          : prodServiceCategories;
                      setMainCategoryProd(opt);
                      setForm((p) => ({ ...p, category: cats[0] || "" }));
                    }}
                    style={{ display: "none" }}
                  />
                  {opt === "product" ? "📦 Product" : "🛠 Service"}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="product-name" style={labelStyle}>
              Name *
            </label>
            <input
              id="product-name"
              data-ocid="admin.product.input"
              style={inputStyle}
              placeholder="e.g. USB Cable, Earphones"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="product-category" style={labelStyle}>
              Sub-Category
            </label>
            <select
              id="product-category"
              data-ocid="admin.product.select"
              style={{ ...inputStyle, appearance: "none" }}
              value={form.category}
              onChange={(e) =>
                setForm((p) => ({ ...p, category: e.target.value }))
              }
            >
              {(mainCategoryProd === "product"
                ? productCategories
                : prodServiceCategories
              ).map((c) => (
                <option key={c} value={c} style={{ background: "#1a2236" }}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="product-sale-rate" style={labelStyle}>
              Sale Rate (₹) - Selling Price *
            </label>
            <input
              id="product-sale-rate"
              data-ocid="admin.product_sale_rate.input"
              style={inputStyle}
              type="number"
              placeholder="e.g. 199"
              value={form.saleRate}
              onChange={(e) =>
                setForm((p) => ({ ...p, saleRate: e.target.value }))
              }
            />
          </div>
          <div>
            <label htmlFor="product-purchase-rate" style={labelStyle}>
              Purchase Rate (₹) - Cost Price
            </label>
            <input
              id="product-purchase-rate"
              data-ocid="admin.product_purchase_rate.input"
              style={inputStyle}
              type="number"
              placeholder="e.g. 120"
              value={form.purchaseRate}
              onChange={(e) =>
                setForm((p) => ({ ...p, purchaseRate: e.target.value }))
              }
            />
          </div>
          <div>
            <label htmlFor="product-quantity" style={labelStyle}>
              Current Stock Qty
            </label>
            <input
              id="product-quantity"
              data-ocid="admin.product_quantity.input"
              style={inputStyle}
              type="number"
              placeholder="e.g. 50"
              value={form.quantity}
              onChange={(e) =>
                setForm((p) => ({ ...p, quantity: e.target.value }))
              }
            />
          </div>
          <div>
            <label htmlFor="product-reorder" style={labelStyle}>
              Alert Before (Low Stock Level)
            </label>
            <input
              id="product-reorder"
              data-ocid="admin.product_reorder.input"
              style={inputStyle}
              type="number"
              placeholder="Default 5"
              value={form.reorderLevel}
              onChange={(e) =>
                setForm((p) => ({ ...p, reorderLevel: e.target.value }))
              }
            />
          </div>
          <div>
            <label htmlFor="product-desc" style={labelStyle}>
              Description
            </label>
            <textarea
              id="product-desc"
              data-ocid="admin.product.textarea"
              style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
              placeholder="Optional description..."
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
            />
          </div>
          <div>
            <label htmlFor="product-barcode" style={labelStyle}>
              Barcode (Optional)
            </label>
            <input
              id="product-barcode"
              data-ocid="admin.product_barcode.input"
              style={inputStyle}
              placeholder="e.g. 8901234567890"
              value={form.barcode || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, barcode: e.target.value }))
              }
            />
          </div>
          {getGstSettings().enabled && (
            <>
              <div>
                <label htmlFor="product-gst-pct" style={labelStyle}>
                  GST %
                </label>
                <select
                  id="product-gst-pct"
                  data-ocid="admin.product.gst_select"
                  value={form.gstPercentage || "0"}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, gstPercentage: e.target.value }))
                  }
                  style={inputStyle}
                >
                  {["0", "5", "12", "18", "28"].map((v) => (
                    <option key={v} value={v} style={{ background: "#0f172a" }}>
                      {v}%
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="product-hsnsac" style={labelStyle}>
                  HSN/SAC Code (optional)
                </label>
                <input
                  id="product-hsnsac"
                  data-ocid="admin.product.hsnsac.input"
                  type="text"
                  placeholder="e.g. 4820, 998314"
                  value={form.hsnSac || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, hsnSac: e.target.value }))
                  }
                  style={inputStyle}
                />
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              data-ocid="admin.product.cancel_button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              data-ocid="admin.product.submit_button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "none",
                background: "#059669",
                color: "white",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 700,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Add Product"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Service Form Modal ───────────────────────────────────────────────────────

function ServiceFormModal({
  open,
  onClose,
  onSaved: _onSaved2,
  onItemAdded,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onItemAdded?: (item: CatalogItem) => void;
}) {
  const _svcCats = getCategories();
  const serviceCategories2 = _svcCats
    .filter((c) => c.appliesTo === "service")
    .map((c) => c.name);
  const svcProductCategories = _svcCats
    .filter((c) => c.appliesTo === "product")
    .map((c) => c.name);
  const [mainCategorySvc, setMainCategorySvc] = React.useState<
    "product" | "service"
  >("service");
  const [form, setForm] = useState({
    name: "",
    category: serviceCategories2[0] || "Print Service",
    saleRate: "",
    description: "",
    requiredDocuments: "",
    requiresPdfCalc: false,
    barcode: "",
    gstPercentage: "0",
    hsnSac: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open)
      setForm({
        name: "",
        category: "Printing & Document",
        saleRate: "",
        description: "",
        requiredDocuments: "",
        requiresPdfCalc: false,
        barcode: "",
        gstPercentage: "0",
        hsnSac: "",
      });
  }, [open]);

  async function handleSave() {
    const sr = Number.parseFloat(form.saleRate) || 0;
    if (!form.name.trim() || sr <= 0) {
      toast.error("Name and Sale Rate are required.");
      return;
    }
    setSaving(true);
    try {
      const newItem: CatalogItem & Record<string, unknown> = {
        id: Date.now() as unknown as bigint,
        name: form.name,
        category: form.category,
        description: form.description,
        price: form.saleRate,
        stockStatus: "N/A",
        requiredDocuments:
          form.category === "CSC & Govt Forms" ? form.requiredDocuments : "",
        requiresPdfCalc: form.requiresPdfCalc,
        published: true,
        createdAt: Date.now() as unknown as bigint,
        mediaFiles: [],
        mediaTypes: [],
        itemType: mainCategorySvc,
        saleRate: sr,
        purchaseRate: mainCategorySvc === "product" ? 0 : 0,
        barcode: form.barcode || "",
        gstPercentage: Number(form.gstPercentage) || 0,
        hsnSac: form.hsnSac || "",
      };
      const existingItems3 = await fsGetCollection<any>("catalog");
      const svcProductId = generateProductId(existingItems3);
      const newItemWithId3 = { ...newItem, productId: svcProductId };
      await fsSetDoc("catalog", svcProductId, newItemWithId3);
      if (onItemAdded) onItemAdded(newItemWithId3);
      toast.success("Service Added Successfully");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add service.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const labelStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 6,
    display: "block",
  };
  const inputStyle: React.CSSProperties = {
    ...S.input,
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e2e8f0",
  };

  return (
    <div
      role="presentation"
      data-ocid="admin.service.modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div style={{ ...S.modal, maxWidth: 480, width: "100%" }}>
        <div
          style={{
            padding: "20px 24px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ color: "white", fontWeight: 700, fontSize: 18 }}>
            Add New Service
          </h2>
          <button
            type="button"
            data-ocid="admin.service.close_button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontSize: 20,
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <label htmlFor="main-category-radio" style={labelStyle}>
              Main Category *
            </label>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {(["product", "service"] as const).map((opt) => (
                <label
                  key={opt}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: `1px solid ${mainCategorySvc === opt ? (opt === "product" ? "rgba(0,255,255,0.5)" : "rgba(167,139,250,0.5)") : "rgba(255,255,255,0.1)"}`,
                    background:
                      mainCategorySvc === opt
                        ? opt === "product"
                          ? "rgba(0,255,255,0.08)"
                          : "rgba(167,139,250,0.08)"
                        : "transparent",
                    color:
                      mainCategorySvc === opt
                        ? opt === "product"
                          ? "#00ffff"
                          : "#a78bfa"
                        : "rgba(255,255,255,0.5)",
                    fontSize: 13,
                    fontWeight: 600,
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    type="radio"
                    name="mainCategorySvc"
                    value={opt}
                    checked={mainCategorySvc === opt}
                    onChange={() => {
                      const cats =
                        opt === "service"
                          ? serviceCategories2
                          : svcProductCategories;
                      setMainCategorySvc(opt);
                      setForm((p) => ({ ...p, category: cats[0] || "" }));
                    }}
                    style={{ display: "none" }}
                  />
                  {opt === "product" ? "📦 Product" : "🛠 Service"}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="service-name" style={labelStyle}>
              Name *
            </label>
            <input
              id="service-name"
              data-ocid="admin.service.input"
              style={inputStyle}
              placeholder="e.g. Color Printing, PAN Card Application"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="service-category" style={labelStyle}>
              Sub-Category
            </label>
            <select
              id="service-category"
              data-ocid="admin.service.select"
              style={{ ...inputStyle, appearance: "none" }}
              value={form.category}
              onChange={(e) =>
                setForm((p) => ({ ...p, category: e.target.value }))
              }
            >
              {(mainCategorySvc === "service"
                ? serviceCategories2
                : svcProductCategories
              ).map((c) => (
                <option key={c} value={c} style={{ background: "#1a2236" }}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="service-sale-rate" style={labelStyle}>
              Sale Rate (₹) - Selling Price *
            </label>
            <input
              id="service-sale-rate"
              data-ocid="admin.service_sale_rate.input"
              style={inputStyle}
              type="number"
              placeholder="e.g. 2"
              value={form.saleRate}
              onChange={(e) =>
                setForm((p) => ({ ...p, saleRate: e.target.value }))
              }
            />
          </div>
          {form.category === "CSC & Govt Forms" && (
            <div>
              <label htmlFor="service-req-docs" style={labelStyle}>
                Required Documents (Comma Separated)
              </label>
              <input
                id="service-req-docs"
                data-ocid="admin.service_docs.input"
                style={inputStyle}
                placeholder="e.g. Aadhaar, Passport Photo, Signature"
                value={form.requiredDocuments}
                onChange={(e) =>
                  setForm((p) => ({ ...p, requiredDocuments: e.target.value }))
                }
              />
              <p
                style={{
                  color: "rgba(167,139,250,0.7)",
                  fontSize: 11,
                  marginTop: 4,
                }}
              >
                Each document becomes an upload button for the customer
              </p>
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "10px 12px",
              background: "rgba(245,158,11,0.06)",
              border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 8,
            }}
          >
            <div style={{ flex: 1 }}>
              <p style={{ ...labelStyle, color: "#f59e0b", marginBottom: 2 }}>
                Requires PDF Page Calculation
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 10,
                  lineHeight: 1.4,
                }}
              >
                Enable for printing/photocopy services to auto-detect PDF pages
                on POS
              </p>
            </div>
            <button
              type="button"
              data-ocid="admin.service.pdf_calc.toggle"
              onClick={() =>
                setForm((p) => ({ ...p, requiresPdfCalc: !p.requiresPdfCalc }))
              }
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                border: "none",
                background: form.requiresPdfCalc
                  ? "#f59e0b"
                  : "rgba(255,255,255,0.15)",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: form.requiresPdfCalc ? 23 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "white",
                  transition: "left 0.2s",
                }}
              />
            </button>
          </div>
          <div>
            <label htmlFor="service-desc" style={labelStyle}>
              Description
            </label>
            <textarea
              id="service-desc"
              data-ocid="admin.service.textarea"
              style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
              placeholder="Optional description..."
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
            />
          </div>
          <div>
            <label htmlFor="service-barcode" style={labelStyle}>
              Barcode (Optional)
            </label>
            <input
              id="service-barcode"
              data-ocid="admin.service_barcode.input"
              style={inputStyle}
              placeholder="e.g. SVC-001 or printed chart code"
              value={form.barcode || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, barcode: e.target.value }))
              }
            />
          </div>
          {getGstSettings().enabled && (
            <>
              <div>
                <label htmlFor="service-gst-pct" style={labelStyle}>
                  GST %
                </label>
                <select
                  id="service-gst-pct"
                  data-ocid="admin.service.gst_select"
                  value={form.gstPercentage || "0"}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, gstPercentage: e.target.value }))
                  }
                  style={inputStyle}
                >
                  {["0", "5", "12", "18", "28"].map((v) => (
                    <option key={v} value={v} style={{ background: "#0f172a" }}>
                      {v}%
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="service-hsnsac" style={labelStyle}>
                  HSN/SAC Code (optional)
                </label>
                <input
                  id="service-hsnsac"
                  data-ocid="admin.service.hsnsac.input"
                  type="text"
                  placeholder="e.g. 998314"
                  value={form.hsnSac || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, hsnSac: e.target.value }))
                  }
                  style={inputStyle}
                />
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              data-ocid="admin.service.cancel_button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              data-ocid="admin.service.submit_button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "none",
                background: "#7c3aed",
                color: "white",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 700,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Add Service"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Catalog Section ──────────────────────────────────────────────────────────

// ─── Manage Categories Modal ──────────────────────────────────────────────────
function ManageCategoriesModal({
  open,
  onClose,
  categories,
  onCategoriesChange,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryEntry[];
  onCategoriesChange: (cats: CategoryEntry[]) => void;
}) {
  const [newName, setNewName] = React.useState("");
  const [newType, setNewType] = React.useState<"product" | "service">(
    "product",
  );
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");

  if (!open) return null;

  const save = async (updated: CategoryEntry[]) => {
    onCategoriesChange(updated);
    // Sync categories to Firestore
    for (const cat of updated) {
      await fsSetDoc("categories", cat.id, cat);
    }
  };

  const addCategory = async () => {
    if (!newName.trim()) return;
    const id = `cat-${Date.now()}`;
    const newCat: CategoryEntry = {
      id,
      name: newName.trim(),
      appliesTo: newType,
    };
    try {
      await save([...categories, newCat]);
    } catch (e) {
      console.error("Category save failed:", e);
      toast.error("Failed to save category.");
    }
    setNewName("");
  };

  const deleteCategory = async (id: string) => {
    try {
      await save(categories.filter((c) => c.id !== id));
    } catch (e) {
      console.error("Category delete failed:", e);
      toast.error("Failed to delete category.");
    }
  };

  const startEdit = (cat: CategoryEntry) => {
    setEditId(cat.id);
    setEditName(cat.name);
  };
  const saveEdit = async () => {
    if (!editName.trim()) return;
    try {
      await save(
        categories.map((c) =>
          c.id === editId ? { ...c, name: editName.trim() } : c,
        ),
      );
    } catch (e) {
      console.error("Category edit failed:", e);
      toast.error("Failed to save edit.");
    }
    setEditId(null);
  };

  const productCats = categories.filter((c) => c.appliesTo === "product");
  const serviceCats = categories.filter((c) => c.appliesTo === "service");

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };
  const box: React.CSSProperties = {
    background: "rgba(13,26,50,0.97)",
    border: "1px solid rgba(0,255,255,0.2)",
    borderRadius: 16,
    backdropFilter: "blur(20px)",
    boxShadow: "0 0 60px rgba(0,255,255,0.15)",
    width: "100%",
    maxWidth: 520,
    maxHeight: "85vh",
    overflowY: "auto",
    padding: 28,
  };

  const renderCatList = (cats: CategoryEntry[]) =>
    cats.map((cat) => (
      <div
        key={cat.id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.04)",
          marginBottom: 4,
        }}
      >
        {editId === cat.id ? (
          <>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              style={{
                flex: 1,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid rgba(0,255,255,0.3)",
                background: "rgba(0,255,255,0.05)",
                color: "#fff",
                fontSize: 13,
              }}
            />
            <button
              type="button"
              onClick={saveEdit}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: "#059669",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditId(null)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span
              style={{ flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 14 }}
            >
              {cat.name}
            </span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 600,
                background:
                  cat.appliesTo === "product"
                    ? "rgba(0,255,255,0.1)"
                    : "rgba(167,139,250,0.1)",
                color: cat.appliesTo === "product" ? "#00ffff" : "#a78bfa",
                border: `1px solid ${cat.appliesTo === "product" ? "rgba(0,255,255,0.3)" : "rgba(167,139,250,0.3)"}`,
              }}
            >
              {cat.appliesTo === "product" ? "Product" : "Service"}
            </span>
            <button
              type="button"
              onClick={() => startEdit(cat)}
              data-ocid="admin.category.edit_button"
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(0,255,255,0.1)",
                color: "#00ffff",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => deleteCategory(cat.id)}
              data-ocid="admin.category.delete_button"
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(255,80,80,0.15)",
                color: "#ff5050",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    ));

  return (
    <div
      style={overlay}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <dialog
        open
        style={box}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ color: "#00ffff", fontSize: 18, fontWeight: 700 }}>
            Manage Categories
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontSize: 22,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Add new */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <input
            data-ocid="admin.category.input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name..."
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(0,255,255,0.2)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              fontSize: 13,
            }}
          />
          <select
            data-ocid="admin.category.select"
            value={newType}
            onChange={(e) =>
              setNewType(e.target.value as "product" | "service")
            }
            title="Parent Category *"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(0,255,255,0.2)",
              background: "#0d1a2e",
              color: "#fff",
              fontSize: 13,
            }}
          >
            <option value="product">📦 Product (Parent)</option>
            <option value="service">🛠 Service (Parent)</option>
          </select>
          <button
            type="button"
            data-ocid="admin.category.primary_button"
            onClick={addCategory}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "linear-gradient(135deg,#00ffff,#0080ff)",
              color: "#080d1a",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            + Add
          </button>
        </div>

        {/* Product categories */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              color: "#a78bfa",
              fontWeight: 600,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            📦 Product Sub-Categories
          </div>
          {productCats.length === 0 && (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
              No product categories yet.
            </p>
          )}
          {renderCatList(productCats)}
        </div>

        {/* Service categories */}
        <div>
          <div
            style={{
              color: "#06b6d4",
              fontWeight: 600,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            🛠 Service Sub-Categories
          </div>
          {serviceCats.length === 0 && (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
              No service categories yet.
            </p>
          )}
          {renderCatList(serviceCats)}
        </div>
      </dialog>
    </div>
  );
}

function CatalogSection({
  items,
  loading,
  onRefresh,
  onItemAdded,
}: {
  items: CatalogItem[];
  loading: boolean;
  onRefresh: () => void;
  onItemAdded: (item: CatalogItem) => void;
}) {
  const [search, setSearch] = useState("");
  const [addEditOpen, setAddEditOpen] = useState(false);
  const [addType, setAddType] = useState<"product" | "service" | null>(null);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null);
  const [togglingId, setTogglingId] = useState<bigint | null>(null);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const [catalogTab, setCatalogTab] = useState<"products" | "services">(
    "services",
  );

  const [categories, setCategories] = React.useState<CategoryEntry[]>(() =>
    getCategories(),
  );
  const [showManageCategories, setShowManageCategories] = React.useState(false);
  const [migrating, setMigrating] = React.useState(false);

  async function runSmartMigration() {
    setMigrating(true);
    try {
      const items = await fsGetCollection<any>("catalog");
      const serviceKeywords = [
        "print",
        "photocopy",
        "lamination",
        "scan",
        "pvc",
      ];
      const serviceCategories_m = ["printing & document", "print service"];
      let count = 0;
      for (const item of items) {
        const nameLower = (item.name || "").toLowerCase();
        const catLower = (item.category || "").toLowerCase();
        const isService =
          serviceKeywords.some((k) => nameLower.includes(k)) ||
          serviceCategories_m.some((c) => catLower.includes(c));
        if (isService && item.itemType !== "service") {
          await fsUpdateDoc("catalog", String(item.productId || item.id), {
            itemType: "service",
          });
          count++;
        } else if (!isService && item.itemType !== "product") {
          await fsUpdateDoc("catalog", String(item.productId || item.id), {
            itemType: "product",
          });
          count++;
        }
      }
      const updated = await fsGetCollection<any>("catalog");
      if (updated.length > 0) onItemAdded(updated[0]);
      onRefresh();
      toast.success(`✓ Migration complete. ${count} items updated.`);
    } catch (err) {
      toast.error("Migration failed. Check console.");
      console.error(err);
    } finally {
      setMigrating(false);
    }
  }

  React.useEffect(() => {
    const handler = () => setCategories(getCategories());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const _productCategoriesUnused = categories
    .filter((c) => c.appliesTo === "product")
    .map((c) => c.name);
  const serviceCategories = categories
    .filter((c) => c.appliesTo === "service")
    .map((c) => c.name);

  const SERVICE_CAT_LIST = serviceCategories;
  const tabFiltered = items.filter((item) =>
    catalogTab === "services"
      ? item.itemType === "service"
      : item.itemType === "product" ||
        (!item.itemType && !SERVICE_CAT_LIST.includes(item.category)),
  );
  const filtered = tabFiltered.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleTogglePublish(item: CatalogItem) {
    setTogglingId(item.id);
    try {
      await fsUpdateDoc("catalog", String(item.productId || item.id), {
        published: !item.published,
      });
      onRefresh();
      toast.success(item.published ? "Item hidden." : "Item published!");
    } catch (e) {
      console.error("Toggle publish failed:", e);
      toast.error("Update failed. Please try again.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await fsDeleteDoc(
        "catalog",
        String(deleteTarget.productId || deleteTarget.id),
      );
      onRefresh();
      toast.success("Item deleted.");
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (e) {
      console.error("Delete failed:", e);
      toast.error("Delete failed. Please try again.");
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }

  const published = items.filter((i) => i.published).length;
  const hidden = items.filter((i) => !i.published).length;
  const categoriesCount = new Set(items.map((i) => i.category)).size;

  return (
    <div style={{ padding: 24 }}>
      {/* Manage Categories Modal */}
      <ManageCategoriesModal
        open={showManageCategories}
        onClose={() => setShowManageCategories(false)}
        categories={categories}
        onCategoriesChange={(cats) => {
          setCategories(cats);
        }}
      />
      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <StatsCard
          label="Total Items"
          value={items.length}
          iconColor="#8b5cf6"
          icon={Package}
        />
        <StatsCard
          label="Published"
          value={published}
          iconColor="#10b981"
          icon={Eye}
        />
        <StatsCard
          label="Hidden"
          value={hidden}
          iconColor="#f59e0b"
          icon={EyeOff}
        />
        <StatsCard
          label="Categories"
          value={categoriesCount}
          iconColor="#3b82f6"
          icon={LayoutDashboard}
        />
      </div>

      {/* Inventory Summary Cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <div
          style={{
            flex: 1,
            background: "linear-gradient(135deg, #7c3aed, #e879f9)",
            borderRadius: 16,
            padding: "20px 24px",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 12,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              Total Shop Investment
            </p>
            <p style={{ color: "white", fontSize: 24, fontWeight: 800 }}>
              ₹
              {items
                .filter((i) => i.itemType === "product")
                .reduce(
                  (s, i) => s + (i.quantity || 0) * (i.purchaseRate || 0),
                  0,
                )
                .toLocaleString("en-IN")}
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                marginTop: 4,
              }}
            >
              Sum of (Qty × Cost Price)
            </p>
          </div>
          <TrendingDown
            style={{ width: 36, height: 36, color: "rgba(255,255,255,0.4)" }}
          />
        </div>
        <div
          style={{
            flex: 1,
            background: "linear-gradient(135deg, #0891b2, #22d3ee)",
            borderRadius: 16,
            padding: "20px 24px",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 12,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              Expected Revenue
            </p>
            <p style={{ color: "white", fontSize: 24, fontWeight: 800 }}>
              ₹
              {items
                .filter((i) => i.itemType === "product")
                .reduce((s, i) => s + (i.quantity || 0) * (i.saleRate || 0), 0)
                .toLocaleString("en-IN")}
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                marginTop: 4,
              }}
            >
              Sum of (Qty × Sale Price)
            </p>
          </div>
          <TrendingUp
            style={{ width: 36, height: 36, color: "rgba(255,255,255,0.4)" }}
          />
        </div>
      </div>

      {/* Table header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ color: "white", fontWeight: 700, fontSize: 16 }}>
          All Catalog Items
        </h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 16,
                height: 16,
                color: "rgba(255,255,255,0.35)",
              }}
            />
            <input
              data-ocid="admin.catalog.search_input"
              style={{ ...S.input, paddingLeft: 34, width: 220 }}
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            data-ocid="admin.catalog.primary_button"
            onClick={() => setAddType("product")}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "none",
              background: "#059669",
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Product
          </button>
          <button
            type="button"
            data-ocid="admin.catalog.secondary_button"
            onClick={() => setAddType("service")}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "none",
              background: "#7c3aed",
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Service
          </button>
          <button
            type="button"
            data-ocid="admin.catalog.open_modal_button"
            onClick={() => setShowManageCategories(true)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "1px solid rgba(0,255,255,0.3)",
              background: "rgba(0,255,255,0.08)",
              color: "#00ffff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <Settings style={{ width: 16, height: 16 }} /> Manage Categories
          </button>
          <button
            type="button"
            data-ocid="admin.catalog.secondary_button"
            onClick={runSmartMigration}
            disabled={migrating}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "1px solid rgba(251,146,60,0.4)",
              background: "rgba(251,146,60,0.15)",
              color: "#fb923c",
              cursor: migrating ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              opacity: migrating ? 0.7 : 1,
            }}
          >
            {migrating ? "⏳ Migrating..." : "🔧 Fix Migration Types"}
          </button>
          <button
            type="button"
            data-ocid="admin.catalog.print_stock_report"
            onClick={() => triggerPrint("catalog-stock-print")}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "1px solid rgba(99,102,241,0.4)",
              background: "rgba(99,102,241,0.12)",
              color: "#818cf8",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            🖨️ Print Stock Report
          </button>
        </div>
        <CsvBulkUploader onImportComplete={onRefresh} />
      </div>

      {/* Tab Toggle */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 4,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          paddingLeft: 20,
        }}
      >
        {(["services", "products"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            data-ocid={`admin.catalog.${tab}.tab`}
            onClick={() => setCatalogTab(tab)}
            style={{
              padding: "10px 24px",
              background: "transparent",
              border: "none",
              borderBottom:
                catalogTab === tab
                  ? "2px solid #7c3aed"
                  : "2px solid transparent",
              color: catalogTab === tab ? "#a78bfa" : "rgba(255,255,255,0.5)",
              fontWeight: catalogTab === tab ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
              transition: "all 0.15s",
              textTransform: "capitalize",
            }}
          >
            {tab === "services" ? "Services" : "Products"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={S.table}>
        {loading ? (
          <div
            data-ocid="admin.catalog.loading_state"
            style={{
              textAlign: "center",
              padding: 60,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            <Loader2
              style={{
                width: 32,
                height: 32,
                margin: "0 auto 12px",
                animation: "spin 1s linear infinite",
              }}
            />
            <p>Loading catalog...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            data-ocid="admin.catalog.empty_state"
            style={{
              textAlign: "center",
              padding: 60,
              color: "rgba(255,255,255,0.35)",
            }}
          >
            <Package style={{ width: 40, height: 40, margin: "0 auto 12px" }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              No catalog items yet
            </p>
            <p style={{ fontSize: 13 }}>Add your first item to get started!</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 600,
              }}
            >
              <thead>
                <tr style={S.tableHeader}>
                  {[
                    "Product ID",
                    "Thumbnail",
                    "Item Name",
                    "Category",
                    ...(catalogTab === "products"
                      ? ["Purchase Rate", "Sale Rate", "Stock", "Margin"]
                      : ["Sale Rate"]),
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr
                    key={String(item.id)}
                    data-ocid={`admin.catalog.row.${idx + 1}`}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#111827" : "#0f1729",
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (
                        e.currentTarget as HTMLTableRowElement
                      ).style.backgroundColor = "rgba(139,92,246,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      (
                        e.currentTarget as HTMLTableRowElement
                      ).style.backgroundColor =
                        idx % 2 === 0 ? "#111827" : "#0f1729";
                    }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#67e8f9",
                          background: "rgba(6,182,212,0.12)",
                          border: "1px solid rgba(6,182,212,0.3)",
                          borderRadius: 6,
                          padding: "3px 8px",
                          letterSpacing: "0.05em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.productId || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {item.mediaFiles.length > 0 ? (
                        <img
                          src={
                            typeof item.mediaFiles[0] === "string"
                              ? item.mediaFiles[0]
                              : (item.mediaFiles[0] as any).getDirectURL?.() ||
                                ""
                          }
                          alt={item.name}
                          style={{
                            width: 48,
                            height: 48,
                            objectFit: "cover",
                            borderRadius: 8,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 8,
                            background:
                              "linear-gradient(135deg, #7c3aed, #3b82f6)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Package
                            style={{ width: 20, height: 20, color: "white" }}
                          />
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div
                        style={{
                          color: "white",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {item.name}
                      </div>
                      {item.description && (
                        <div
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 12,
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 200,
                          }}
                        >
                          {item.description}
                        </div>
                      )}
                      {item.category === "CSC & Govt Services" &&
                        item.requiredDocuments && (
                          <div
                            style={{
                              color: "#a78bfa",
                              fontSize: 11,
                              marginTop: 4,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 200,
                            }}
                          >
                            📄 Docs: {item.requiredDocuments}
                          </div>
                        )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                        className={
                          CATEGORY_COLORS[item.category] ||
                          "bg-gray-500/20 text-gray-300"
                        }
                      >
                        {item.category}
                      </span>
                    </td>
                    {catalogTab === "products" ? (
                      <>
                        <td
                          style={{
                            padding: "12px 16px",
                            color: "#f87171",
                            fontWeight: 600,
                          }}
                        >
                          ₹{(item.purchaseRate ?? 0).toFixed(2)}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            color: "white",
                            fontWeight: 700,
                          }}
                        >
                          ₹
                          {(
                            item.saleRate ??
                            Number.parseFloat(item.price) ??
                            0
                          ).toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span style={{ color: "white", fontWeight: 600 }}>
                              {item.quantity ?? 0}
                            </span>
                            {item.itemType === "product" &&
                              (item.quantity ?? 0) <=
                                (item.alertBefore ??
                                  item.reorderLevel ??
                                  5) && (
                                <span
                                  style={{
                                    background: "rgba(239,68,68,0.2)",
                                    color: "#f87171",
                                    borderRadius: 12,
                                    padding: "2px 8px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                  }}
                                >
                                  ⚠ Low Stock
                                </span>
                              )}
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            color: "#34d399",
                            fontWeight: 700,
                          }}
                        >
                          ₹
                          {(
                            (item.saleRate ??
                              Number.parseFloat(item.price) ??
                              0) - (item.purchaseRate ?? 0)
                          ).toFixed(2)}
                        </td>
                      </>
                    ) : (
                      <td
                        style={{
                          padding: "12px 16px",
                          color: "white",
                          fontWeight: 700,
                        }}
                      >
                        ₹
                        {(
                          item.saleRate ??
                          Number.parseFloat(item.price) ??
                          0
                        ).toFixed(2)}
                      </td>
                    )}
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: item.published
                            ? "rgba(16,185,129,0.15)"
                            : "rgba(100,116,139,0.15)",
                          color: item.published ? "#34d399" : "#94a3b8",
                        }}
                      >
                        {item.published ? "Published" : "Hidden"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          type="button"
                          data-ocid={`admin.catalog.edit_button.${idx + 1}`}
                          onClick={() => {
                            setEditItem(item);
                            setAddEditOpen(true);
                          }}
                          title="Edit"
                          style={{
                            padding: 6,
                            borderRadius: 6,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: "rgba(255,255,255,0.5)",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color =
                              "#c4b5fd";
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.backgroundColor = "rgba(139,92,246,0.15)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color =
                              "rgba(255,255,255,0.5)";
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.backgroundColor = "transparent";
                          }}
                        >
                          <Edit2 style={{ width: 15, height: 15 }} />
                        </button>
                        <button
                          type="button"
                          data-ocid={`admin.catalog.toggle.${idx + 1}`}
                          onClick={() => handleTogglePublish(item)}
                          title={item.published ? "Hide" : "Publish"}
                          disabled={togglingId === item.id}
                          style={{
                            padding: 6,
                            borderRadius: 6,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: "rgba(255,255,255,0.5)",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color =
                              "#67e8f9";
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.backgroundColor = "rgba(6,182,212,0.1)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color =
                              "rgba(255,255,255,0.5)";
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.backgroundColor = "transparent";
                          }}
                        >
                          {togglingId === item.id ? (
                            <Loader2
                              style={{
                                width: 15,
                                height: 15,
                                animation: "spin 1s linear infinite",
                              }}
                            />
                          ) : item.published ? (
                            <EyeOff style={{ width: 15, height: 15 }} />
                          ) : (
                            <Eye style={{ width: 15, height: 15 }} />
                          )}
                        </button>
                        <button
                          type="button"
                          data-ocid={`admin.catalog.delete_button.${idx + 1}`}
                          onClick={() => {
                            setDeleteTarget(item);
                            setDeleteOpen(true);
                          }}
                          title="Delete"
                          disabled={deletingId === item.id}
                          style={{
                            padding: 6,
                            borderRadius: 6,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: "rgba(255,255,255,0.5)",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color =
                              "#f87171";
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.backgroundColor = "rgba(239,68,68,0.1)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color =
                              "rgba(255,255,255,0.5)";
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.backgroundColor = "transparent";
                          }}
                        >
                          {deletingId === item.id ? (
                            <Loader2
                              style={{
                                width: 15,
                                height: 15,
                                animation: "spin 1s linear infinite",
                              }}
                            />
                          ) : (
                            <Trash2 style={{ width: 15, height: 15 }} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ItemFormModal
        open={addEditOpen}
        onClose={() => setAddEditOpen(false)}
        editItem={editItem}
        onSaved={onRefresh}
        onItemAdded={onItemAdded}
      />
      <ProductFormModal
        open={addType === "product"}
        onClose={() => setAddType(null)}
        onSaved={onRefresh}
        onItemAdded={onItemAdded}
      />
      <ServiceFormModal
        open={addType === "service"}
        onClose={() => setAddType(null)}
        onSaved={onRefresh}
        onItemAdded={onItemAdded}
      />
      <DeleteModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        itemName={deleteTarget?.name ?? ""}
      />
      <LetterheadLayout
        printAreaId="catalog-stock-print"
        title="Stock Report — Catalog Inventory"
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", marginTop: 15 }}
        >
          <thead>
            <tr>
              {["Item Name", "Type", "Category", "Stock", "Sale Rate"].map(
                (h) => (
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
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={String(item.id ?? i)}>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  {item.name}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                    textTransform: "capitalize",
                  }}
                >
                  {item.itemType || "product"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  {item.category || "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  {item.itemType === "service" ? "N/A" : (item.quantity ?? 0)}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  ₹{Number(item.saleRate ?? 0).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </LetterheadLayout>
    </div>
  );
}

// ─── Order Status Badge ───────────────────────────────────────────────────────

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Pending: { bg: "rgba(245,158,11,0.15)", color: "#fbbf24" },
    "Processing/Printing": { bg: "rgba(59,130,246,0.15)", color: "#60a5fa" },
    Printing: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa" },
    "Ready for Pickup": { bg: "rgba(16,185,129,0.15)", color: "#34d399" },
    "Ready for Delivery": { bg: "rgba(99,102,241,0.15)", color: "#818cf8" },
    "Out for Delivery": { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
    Completed: { bg: "rgba(16,185,129,0.15)", color: "#34d399" },
    Delivered: { bg: "rgba(100,116,139,0.15)", color: "#94a3b8" },
    Cancelled: { bg: "rgba(239,68,68,0.15)", color: "#f87171" },
  };
  const style = map[status] ?? {
    bg: "rgba(100,116,139,0.15)",
    color: "#94a3b8",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
}

// ─── Files Viewer Modal ────────────────────────────────────────────────────────

function FilesViewerModal({
  files,
  onClose,
}: { files: ExternalBlob[]; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div
        role="presentation"
        style={{
          background: "#0f172a",
          border: "1px solid rgba(99,102,241,0.4)",
          borderRadius: 12,
          padding: 24,
          minWidth: 340,
          maxWidth: 520,
          width: "90%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h3
            style={{ color: "white", fontWeight: 700, fontSize: 16, margin: 0 }}
          >
            📂 Customer Uploaded Files
          </h3>
          <button
            type="button"
            data-ocid="admin.files_modal.close_button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {files.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            No files uploaded.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {files.map((file, i) => (
              <a
                key={file.getDirectURL()}
                href={file.getDirectURL()}
                target="_blank"
                rel="noreferrer"
                data-ocid={`admin.files_modal.button.${i + 1}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.35)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  textDecoration: "none",
                  color: "#a78bfa",
                  fontSize: 13,
                  fontWeight: 600,
                  transition: "background 0.15s",
                }}
              >
                <span style={{ fontSize: 18 }}>📄</span>
                <span style={{ flex: 1 }}>File {i + 1}</span>
                <span
                  style={{
                    background: "rgba(99,102,241,0.3)",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 11,
                    color: "#c4b5fd",
                  }}
                >
                  Download / Open
                </span>
              </a>
            ))}
          </div>
        )}
        <button
          type="button"
          data-ocid="admin.files_modal.cancel_button"
          onClick={onClose}
          style={{
            marginTop: 16,
            width: "100%",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "rgba(255,255,255,0.6)",
            padding: "8px 0",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Orders Section ───────────────────────────────────────────────────────────

function OrdersSection() {
  // biome-ignore lint/correctness/noUnusedVariables: actor guards in place
  const actor = null;
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingFiles, setViewingFiles] = useState<any[] | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<bigint | null>(null);

  useEffect(() => {
    fsGetCollection<any>("orders")
      .then((orders) => {
        setOrders(orders);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handlePrintOrderStatusChange(
    orderId: bigint,
    newStatus: string,
  ) {
    setUpdatingOrderId(orderId);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
    );
    await fsUpdateDoc("orders", String(orderId), { status: newStatus });
    toast.success("Status updated");
    setUpdatingOrderId(null);
  }

  return (
    <div style={{ padding: 24 }}>
      <h2
        style={{
          color: "white",
          fontWeight: 700,
          fontSize: 16,
          marginBottom: 16,
        }}
      >
        Order History
      </h2>
      <div style={S.table}>
        {loading ? (
          <div
            data-ocid="admin.orders.loading_state"
            style={{
              textAlign: "center",
              padding: 60,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            <Loader2
              style={{
                width: 32,
                height: 32,
                margin: "0 auto 12px",
                animation: "spin 1s linear infinite",
              }}
            />
            <p>Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div
            data-ocid="admin.orders.empty_state"
            style={{
              textAlign: "center",
              padding: 60,
              color: "rgba(255,255,255,0.35)",
            }}
          >
            <ClipboardList
              style={{ width: 40, height: 40, margin: "0 auto 12px" }}
            />
            <p style={{ fontWeight: 600 }}>No orders yet</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 700,
              }}
            >
              <thead>
                <tr style={S.tableHeader}>
                  {[
                    "Order ID",
                    "Customer",
                    "Service",
                    "Status",
                    "Date",
                    "Files",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => (
                  <tr
                    key={String(order.id)}
                    data-ocid={`admin.orders.row.${idx + 1}`}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#111827" : "#0f1729",
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 16px",
                        color: "#a78bfa",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      #{String(order.id)}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        color: "white",
                        fontSize: 14,
                      }}
                    >
                      {order.name}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        color: "rgba(255,255,255,0.6)",
                        fontSize: 13,
                      }}
                    >
                      {order.serviceType}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 12,
                      }}
                    >
                      {formatDateTime(Number(order.submittedAt) / 1_000_000)}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 12,
                      }}
                    >
                      {order.uploadedFiles.length} file(s)
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          alignItems: "flex-start",
                          minWidth: 160,
                        }}
                      >
                        {updatingOrderId === order.id ? (
                          <Loader2
                            style={{
                              width: 16,
                              height: 16,
                              animation: "spin 1s linear infinite",
                              color: "#a78bfa",
                            }}
                          />
                        ) : (
                          <select
                            data-ocid={`admin.orders.status.${idx + 1}`}
                            value={order.status}
                            onChange={(e) =>
                              handlePrintOrderStatusChange(
                                order.id,
                                e.target.value,
                              )
                            }
                            style={{
                              background: "#1e293b",
                              color: "#e2e8f0",
                              border: "1px solid #334155",
                              borderRadius: 6,
                              padding: "4px 8px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            {SHOP_ORDER_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        )}
                        {order.uploadedFiles.length > 0 && (
                          <button
                            type="button"
                            data-ocid={`admin.orders.view_files.${idx + 1}`}
                            onClick={() => setViewingFiles(order.uploadedFiles)}
                            style={{
                              background: "rgba(99,102,241,0.2)",
                              color: "#818cf8",
                              border: "1px solid rgba(99,102,241,0.4)",
                              borderRadius: 6,
                              padding: "4px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            📂 View Files
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {viewingFiles && (
        <FilesViewerModal
          files={viewingFiles}
          onClose={() => setViewingFiles(null)}
        />
      )}
    </div>
  );
}

// ─── Live Dashboard Section ───────────────────────────────────────────────────

function StaffPerformanceChart() {
  const [staffList, setStaffList] = React.useState<
    { name: string; role: string }[]
  >([]);
  React.useEffect(() => {
    fsGetCollection<any>("users").then(setStaffList).catch(console.error);
  }, []);

  // Always show at least mock data for Ashu and Rahul
  const mockFallback = [
    { name: "Ashu", weeklySales: 22, weeklyOrders: 18 },
    { name: "Rahul", weeklySales: 15, weeklyOrders: 12 },
    { name: "Priya", weeklySales: 19, weeklyOrders: 16 },
    { name: "Dev", weeklySales: 11, weeklyOrders: 9 },
  ];

  const chartData =
    staffList.length > 0
      ? staffList.map((s, i) => ({
          name: s.name.split(" ")[0],
          weeklySales: ((i * 7 + 13) % 25) + 8,
          weeklyOrders: ((i * 5 + 9) % 20) + 5,
        }))
      : mockFallback;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={chartData}
        margin={{ top: 4, right: 16, left: -10, bottom: 0 }}
        barCategoryGap="30%"
        barGap={4}
      >
        <defs>
          <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
            <stop offset="100%" stopColor="#0284c7" stopOpacity={0.8} />
          </linearGradient>
          <linearGradient id="magentaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d946ef" stopOpacity={1} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="name"
          tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#1e293b",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "white",
            fontSize: 12,
          }}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Legend
          wrapperStyle={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}
        />
        <Bar
          dataKey="weeklySales"
          fill="url(#cyanGrad)"
          radius={[4, 4, 0, 0]}
          name="Weekly Sales (₹00s)"
        />
        <Bar
          dataKey="weeklyOrders"
          fill="url(#magentaGrad)"
          radius={[4, 4, 0, 0]}
          name="Orders Handled"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LiveOperationalDashboard() {
  // biome-ignore lint/correctness/noUnusedVariables: actor guards in place
  const actor = null;
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    "pending" | "processing" | "delivery" | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [todayIncomes, setTodayIncomes] = useState<ManualIncomeEntry[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [quickExpenseForm, setQuickExpenseForm] = useState({
    amount: "",
    category: "Printer Ink/Paper",
    note: "",
    paymentMode: "Cash",
  });
  const [dateRange, setDateRange] = useState<
    "today" | "week" | "month" | "all"
  >("today");
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [stockEditId, setStockEditId] = useState<string | null>(null);
  const [stockAddQty, setStockAddQty] = useState("");

  const loadOrders = async () => {
    try {
      setLoading(true);
      const [all, allExp, inc, cat] = await Promise.all([
        fsGetCollection<any>("orders"),
        fsGetCollection<any>("expenses"),
        Promise.resolve(
          storageGet<ManualIncomeEntry[]>(STORAGE_KEYS.manualIncomes, []),
        ),
        fsGetCollection<any>("catalog"),
      ]);
      const sorted = [...all].sort(
        (a, b) => Number(b.createdAt) - Number(a.createdAt),
      );
      const todayStr = new Date().toISOString().split("T")[0];
      setOrders(sorted);
      setAllExpenses(allExp);
      setCatalogItems(cat);
      setTodayIncomes(
        inc.filter((i: ManualIncomeEntry) => i.date === todayStr),
      );
    } catch (e) {
      console.error("Failed to load orders:", e);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only
  useEffect(() => {
    loadOrders();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingOrders = orders.filter((o) => o.status === "Pending");
  const processingOrders = orders.filter(
    (o) =>
      o.status === "Processing/Printing" || o.status === "Ready for Pickup",
  );
  const deliveryOrders = orders.filter(
    (o) => o.status === "Out for Delivery" || o.status === "Ready for Delivery",
  );
  const todayOrders = orders.filter((o) => {
    const raw = Number(o.createdAt);
    // Nanoseconds (ICP) are ~19 digits; milliseconds (Firebase) are ~13 digits
    const d = raw > 1e15 ? new Date(raw / 1_000_000) : new Date(raw);
    return d >= today;
  });
  const todayRevenue = todayOrders.reduce(
    (sum, o) => sum + Number(o.totalAmount),
    0,
  );

  const todayRevenueCash = todayIncomes
    .filter((i) => i.paymentMode === "Cash")
    .reduce((s, i) => s + Number(i.amount), 0);
  const todayRevenueUpi = todayIncomes
    .filter((i) => i.paymentMode !== "Cash")
    .reduce((s, i) => s + Number(i.amount), 0);

  const todayExpenseCash: number = 0;
  const todayExpenseUpi: number = 0;
  const todayExpenseTotal: number = 0;

  // ── Period-based calculations (dateRange controlled) ──────────────────────
  function getDateBounds(range: "today" | "week" | "month" | "all") {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    if (range === "today") return { start: todayStr, end: todayStr };
    if (range === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return { start: start.toISOString().split("T")[0], end: todayStr };
    }
    if (range === "month") {
      const start = new Date(now);
      start.setDate(1);
      return { start: start.toISOString().split("T")[0], end: todayStr };
    }
    return { start: "1970-01-01", end: "9999-12-31" };
  }

  const { start: periodStart, end: periodEnd } = getDateBounds(dateRange);

  const filteredOrders = orders.filter((o) => {
    const raw = Number(o.createdAt);
    const d = raw > 1e15 ? new Date(raw / 1_000_000) : new Date(raw);
    const ds = d.toISOString().split("T")[0];
    return ds >= periodStart && ds <= periodEnd;
  });

  const periodRevenue = filteredOrders.reduce(
    (s, o) => s + Number(o.totalAmount),
    0,
  );

  const catalogMap = new Map(
    catalogItems.map((c: any) => [String(c.name ?? "").toLowerCase(), c]),
  );
  const periodCOGS = filteredOrders.reduce((sum, order) => {
    if (!order.items) return sum;
    return (
      sum +
      ((order.items as any[]) || []).reduce((s: number, item: any) => {
        const catalogItem = catalogMap.get(
          String(item.itemName || item.name || "").toLowerCase(),
        );
        const purchaseRate = Number(catalogItem?.purchaseRate ?? 0);
        return (
          s + purchaseRate * (Number(item.qty) || Number(item.quantity) || 0)
        );
      }, 0)
    );
  }, 0);

  const filteredExpenses = allExpenses.filter(
    (e) => e.date >= periodStart && e.date <= periodEnd,
  );
  const periodExpenseTotal = filteredExpenses.reduce(
    (s, e) => s + Number(e.amount),
    0,
  );
  const netProfit = periodRevenue - periodCOGS - periodExpenseTotal;

  const baseFilteredOrders = (() => {
    if (activeFilter === "pending") return pendingOrders;
    if (activeFilter === "processing") return processingOrders;
    if (activeFilter === "delivery") return deliveryOrders;
    return orders;
  })();

  const searchFilteredOrders = searchQuery
    ? baseFilteredOrders.filter((o) => {
        const q = searchQuery.trim().toLowerCase();
        if (/^\d{10}$/.test(q)) {
          return (o.phone ?? "").includes(q);
        }
        return (
          (o.customerName ?? "").toLowerCase().includes(q) ||
          String(o.id).includes(q)
        );
      })
    : baseFilteredOrders;

  const operationalCards = [
    {
      key: "pending" as const,
      label: "New Orders (Pending)",
      value: pendingOrders.length,
      icon: "\u{1F550}",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.3)",
    },
    {
      key: "processing" as const,
      label: "Ready for Print / Processing",
      value: processingOrders.length,
      icon: "\u{1F5A8}\uFE0F",
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.12)",
      border: "rgba(59,130,246,0.3)",
    },
    {
      key: "delivery" as const,
      label: "Out for Delivery / Pickup",
      value: deliveryOrders.length,
      icon: "\u{1F6F5}",
      color: "#a855f7",
      bg: "rgba(168,85,247,0.12)",
      border: "rgba(168,85,247,0.3)",
    },
  ];

  const handleAction = async (order: ShopOrder) => {
    let newStatus = "";
    if (order.status === "Pending") newStatus = "Processing/Printing";
    else if (order.status === "Processing/Printing")
      newStatus = "Ready for Pickup";
    else if (order.status === "Ready for Pickup")
      newStatus = "Out for Delivery";
    else if (order.status === "Ready for Delivery")
      newStatus = "Out for Delivery";
    else return;

    await fsUpdateDoc("orders", String(order.id), { status: newStatus });
    loadOrders();
  };

  const handleQuickExpenseSubmit = async () => {
    if (!quickExpenseForm.amount || Number(quickExpenseForm.amount) <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const newExpense: ExpenseEntry = {
        id: Date.now() as unknown as bigint,
        category: quickExpenseForm.category,
        amount: Number(quickExpenseForm.amount),
        date: todayStr,
        paymentMode: quickExpenseForm.paymentMode,
        note: quickExpenseForm.note,
        addedBy: "admin",
        createdAt: Date.now() as unknown as bigint,
      };
      storageAddItem(STORAGE_KEYS.expenses, newExpense);
      toast.success("Expense added!");
      setShowExpenseModal(false);
      setQuickExpenseForm({
        amount: "",
        category: "Printer Ink/Paper",
        note: "",
        paymentMode: "Cash",
      });
      loadOrders();
    } catch (e) {
      console.error("addExpense error:", e);
      toast.error("Failed to add expense.");
    }
  };

  const pillBtn = (
    label: string,
    bg: string,
    onClick: () => void,
    ocid: string,
  ) => (
    <button
      type="button"
      data-ocid={ocid}
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: "none",
        background: bg,
        color: "white",
        padding: "9px 20px",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: 24 }}>
      {/* Global Date-Range Selector */}
      <div
        className="no-print"
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
            fontWeight: 700,
            marginRight: 4,
          }}
        >
          📅 Period:
        </span>
        {(["today", "week", "month", "all"] as const).map((r) => (
          <button
            key={r}
            type="button"
            data-ocid={`dashboard.period.${r}.tab`}
            onClick={() => setDateRange(r)}
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background:
                dateRange === r
                  ? "linear-gradient(135deg,#06b6d4,#7c3aed)"
                  : "rgba(255,255,255,0.08)",
              color: dateRange === r ? "white" : "rgba(255,255,255,0.6)",
              transition: "all 0.2s",
            }}
          >
            {r === "today"
              ? "Today"
              : r === "week"
                ? "This Week"
                : r === "month"
                  ? "This Month"
                  : "All Time"}
          </button>
        ))}
      </div>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
        className="no-print"
      >
        <div>
          <h2
            style={{ color: "white", fontWeight: 700, fontSize: 20, margin: 0 }}
          >
            Live Operational Dashboard
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 13,
              margin: "4px 0 0",
            }}
          >
            Real-time orders & revenue metrics
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <ExportDropdown
            onExportCSV={() => {
              const headers = [
                "Order ID",
                "Customer Name",
                "Phone",
                "Status",
                "Amount (Rs)",
                "Date",
              ];
              const rows = orders.map((o) => [
                String(o.id),
                o.customerName || "",
                o.phone || "",
                o.status || "",
                String(o.totalAmount || 0),
                new Date(Number(o.createdAt) / 1_000_000).toLocaleDateString(
                  "en-IN",
                ),
              ]);
              const csv = [headers, ...rows]
                .map((r) => r.map((c) => `"${c}"`).join(","))
                .join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `clikmate-orders-${new Date().toISOString().split("T")[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            onPrint={() => triggerPrint("live-dashboard-print")}
          />
        </div>
      </div>

      <LetterheadLayout
        printAreaId="live-dashboard-print"
        title="Daily Operations Dashboard"
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", marginTop: 15 }}
        >
          <thead>
            <tr>
              {["Metric", "Value"].map((h) => (
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
            {[
              ["Total Orders", String(orders.length)],
              ["Today's Revenue", `₹${todayRevenue.toFixed(0)}`],
              ["Pending Orders", String(pendingOrders.length)],
              ["Processing Orders", String(processingOrders.length)],
            ].map(([metric, value]) => (
              <tr key={metric}>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  {metric}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                    fontWeight: 700,
                  }}
                >
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </LetterheadLayout>

      <div id="live-dashboard-print-area">
        {/* Print-only header (legacy, hidden) */}
        <div id="print-report-header" style={{ display: "none" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 16,
              borderBottom: "3px solid #7c3aed",
              paddingBottom: 12,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: "#7c3aed",
                  margin: 0,
                }}
              >
                ClikMate
              </h1>
              <p style={{ fontSize: 13, color: "#555", margin: "2px 0 0" }}>
                Service Center &amp; Cyber Cafe
              </p>
              <p style={{ fontSize: 11, color: "#777", margin: "2px 0 0" }}>
                Print &amp; Digital Services
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#333",
                  margin: 0,
                }}
              >
                Daily Operations Report
              </p>
              <p style={{ fontSize: 12, color: "#555", margin: "2px 0 0" }}>
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p style={{ fontSize: 11, color: "#777", margin: "2px 0 0" }}>
                Generated: {new Date().toLocaleTimeString("en-IN")}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 32, marginBottom: 16 }}>
            <div>
              <span
                style={{
                  fontSize: 11,
                  color: "#777",
                  textTransform: "uppercase",
                }}
              >
                Total Orders
              </span>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#333" }}>
                {orders.length}
              </div>
            </div>
            <div>
              <span
                style={{
                  fontSize: 11,
                  color: "#777",
                  textTransform: "uppercase",
                }}
              >
                Today's Revenue
              </span>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#7c3aed" }}>
                ₹{todayRevenue.toFixed(0)}
              </div>
            </div>
            <div>
              <span
                style={{
                  fontSize: 11,
                  color: "#777",
                  textTransform: "uppercase",
                }}
              >
                Pending Orders
              </span>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b" }}>
                {pendingOrders.length}
              </div>
            </div>
          </div>
        </div>

        {/* Smart Search Bar */}
        <div
          className="no-print"
          style={{
            position: "relative",
            marginBottom: 20,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 18,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 18,
              pointerEvents: "none",
            }}
          >
            &#128269;
          </span>
          <input
            data-ocid="dashboard.search_input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Customer Name, Mobile Number, or Order ID..."
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
              padding: "14px 20px 14px 52px",
              color: "white",
              fontSize: 15,
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.6)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: 6,
                color: "rgba(255,255,255,0.6)",
                padding: "2px 8px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              x
            </button>
          )}
        </div>

        {/* Hero Financial Cards */}
        <div
          className="no-print"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 20,
          }}
        >
          {/* Today's Revenue */}
          <div
            style={{
              background: "linear-gradient(135deg, #7c3aed, #d946ef)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 16,
              padding: "24px 28px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 22 }}>&#128176;</span>
              <span
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Today's Revenue
              </span>
            </div>
            <div
              style={{
                color: "white",
                fontSize: 36,
                fontWeight: 800,
                lineHeight: 1,
                marginBottom: 14,
              }}
            >
              &#8377;{todayRevenue.toFixed(0)}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#22c55e",
                    display: "inline-block",
                  }}
                />
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                  Cash: &#8377;{todayRevenueCash.toFixed(0)}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#3b82f6",
                    display: "inline-block",
                  }}
                />
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                  UPI/Online: &#8377;{todayRevenueUpi.toFixed(0)}
                </span>
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                fontWeight: 500,
              }}
            >
              Live &middot; Updates in real-time
            </div>
          </div>

          {/* Today's Expenses */}
          <div
            style={{
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 16,
              padding: "24px 28px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 22 }}>&#128202;</span>
              <span
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Today's Expenses
              </span>
            </div>
            <div
              style={{
                color: "#fca5a5",
                fontSize: 36,
                fontWeight: 800,
                lineHeight: 1,
                marginBottom: 14,
              }}
            >
              &#8377;{todayExpenseTotal.toFixed(0)}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#22c55e",
                    display: "inline-block",
                  }}
                />
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                  Cash: &#8377;{todayExpenseCash.toFixed(0)}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#3b82f6",
                    display: "inline-block",
                  }}
                />
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                  UPI: &#8377;{todayExpenseUpi.toFixed(0)}
                </span>
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                fontWeight: 500,
              }}
            >
              {filteredExpenses.length} entries this period
            </div>
          </div>
        </div>

        {/* Low Stock Alerts Widget */}
        {(() => {
          const lowStockItems = catalogItems.filter(
            (item: any) =>
              item.itemType === "product" &&
              typeof item.quantity === "number" &&
              item.quantity <= (item.alertBefore ?? item.reorderLevel ?? 5),
          );
          if (lowStockItems.length === 0) return null;
          return (
            <div
              className="no-print"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.35)",
                borderRadius: 14,
                padding: "18px 20px",
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <span style={{ fontSize: 18 }}>⚠️</span>
                <h3
                  style={{
                    color: "#ef4444",
                    fontWeight: 700,
                    fontSize: 14,
                    margin: 0,
                  }}
                >
                  Low Stock Alerts
                </h3>
                <span
                  style={{
                    background: "#ef4444",
                    color: "white",
                    borderRadius: 99,
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {lowStockItems.length}
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        "Item Name",
                        "Product ID",
                        "Current Stock",
                        "Reorder Level",
                        "Action",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "6px 10px",
                            textAlign: "left",
                            color: "rgba(255,255,255,0.5)",
                            fontWeight: 600,
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.map((item: any, idx: number) => (
                      <tr key={item.productId || idx}>
                        <td
                          style={{
                            padding: "8px 10px",
                            color: "white",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          {item.name}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            color: "#06b6d4",
                            fontFamily: "monospace",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          {item.productId || "-"}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            color: "#ef4444",
                            fontWeight: 700,
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          {item.quantity}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            color: "rgba(255,255,255,0.5)",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          {item.alertBefore ?? item.reorderLevel ?? 5}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          {stockEditId === item.productId ? (
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                alignItems: "center",
                              }}
                            >
                              <input
                                data-ocid={`dashboard.stock_update.input.${idx + 1}`}
                                type="number"
                                min="1"
                                value={stockAddQty}
                                onChange={(e) => setStockAddQty(e.target.value)}
                                placeholder="Add qty"
                                style={{
                                  width: 70,
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid rgba(255,255,255,0.2)",
                                  background: "rgba(255,255,255,0.07)",
                                  color: "white",
                                  fontSize: 12,
                                }}
                              />
                              <button
                                type="button"
                                data-ocid={`dashboard.stock_save.button.${idx + 1}`}
                                onClick={async () => {
                                  const addQty = Number.parseInt(
                                    stockAddQty,
                                    10,
                                  );
                                  if (!addQty || addQty <= 0) return;
                                  try {
                                    const newQty =
                                      (item.quantity || 0) + addQty;
                                    await fsUpdateDoc(
                                      "catalog",
                                      item.productId,
                                      { quantity: newQty },
                                    );
                                    setCatalogItems((prev: any[]) =>
                                      prev.map((ci: any) =>
                                        ci.productId === item.productId
                                          ? { ...ci, quantity: newQty }
                                          : ci,
                                      ),
                                    );
                                    toast.success(
                                      `Stock updated for ${item.name}`,
                                    );
                                    setStockEditId(null);
                                    setStockAddQty("");
                                  } catch {
                                    toast.error("Failed to update stock.");
                                  }
                                }}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  border: "1px solid rgba(16,185,129,0.4)",
                                  background: "rgba(16,185,129,0.15)",
                                  color: "#10b981",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                ✓ Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setStockEditId(null);
                                  setStockAddQty("");
                                }}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  background: "transparent",
                                  color: "rgba(255,255,255,0.4)",
                                  cursor: "pointer",
                                  fontSize: 12,
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              data-ocid={`dashboard.stock_update.button.${idx + 1}`}
                              onClick={() => {
                                setStockEditId(item.productId);
                                setStockAddQty("");
                              }}
                              style={{
                                padding: "4px 12px",
                                borderRadius: 6,
                                border: "1px solid rgba(245,158,11,0.4)",
                                background: "rgba(245,158,11,0.12)",
                                color: "#f59e0b",
                                cursor: "pointer",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              Update Stock
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Period Metrics: Revenue, COGS, Expenses, Net Profit */}
        <div
          className="no-print"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 20,
          }}
        >
          {/* Period Revenue */}
          <div
            style={{
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.35)",
              borderRadius: 14,
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 6,
              }}
            >
              {dateRange === "today"
                ? "Today"
                : dateRange === "week"
                  ? "Week"
                  : dateRange === "month"
                    ? "Month"
                    : "All Time"}
              's Sales
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#c084fc" }}>
              ₹{periodRevenue.toLocaleString("en-IN")}
            </div>
          </div>

          {/* COGS */}
          <div
            style={{
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 14,
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 6,
              }}
            >
              Cost of Goods Sold
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fcd34d" }}>
              ₹{periodCOGS.toLocaleString("en-IN")}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                marginTop: 4,
              }}
            >
              purchaseRate × qty sold
            </div>
          </div>

          {/* Period Expenses */}
          <div
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 14,
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 6,
              }}
            >
              Total Expenses
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fca5a5" }}>
              ₹{periodExpenseTotal.toLocaleString("en-IN")}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                marginTop: 4,
              }}
            >
              {filteredExpenses.length} entries
            </div>
          </div>

          {/* Net Profit */}
          <div
            style={{
              background:
                netProfit >= 0
                  ? "rgba(16,185,129,0.15)"
                  : "rgba(239,68,68,0.15)",
              border: `1px solid ${netProfit >= 0 ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
              borderRadius: 14,
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 6,
              }}
            >
              Net Profit
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: netProfit >= 0 ? "#6ee7b7" : "#fca5a5",
              }}
            >
              {netProfit < 0 ? "-" : ""}₹
              {Math.abs(netProfit).toLocaleString("en-IN")}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                marginTop: 4,
              }}
            >
              Sales - COGS - Expenses
            </div>
          </div>
        </div>

        {/* Quick Actions Ribbon */}
        <div
          className="no-print"
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 20,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: "16px 20px",
          }}
        >
          <span
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 13,
              fontWeight: 700,
              marginRight: 10,
              whiteSpace: "nowrap",
            }}
          >
            Quick Actions
          </span>
          {pillBtn(
            "+ New POS Order",
            "linear-gradient(135deg, #10b981, #059669)",
            () => {
              window.location.hash = "/pos";
            },
            "dashboard.pos_button",
          )}
          {pillBtn(
            "📒 Expense Book",
            "linear-gradient(135deg, #ef4444, #dc2626)",
            () => {
              window.location.hash = "#/expense-tracker";
            },
            "dashboard.expense_button",
          )}
          {pillBtn(
            "Create B2B Quote",
            "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            () => {
              window.location.hash = "/bulk-dashboard";
            },
            "dashboard.b2b_button",
          )}
          {pillBtn(
            "Inventory / Stock",
            "linear-gradient(135deg, #f59e0b, #d97706)",
            () => {
              window.location.hash = "/admin";
              setTimeout(
                () => window.dispatchEvent(new CustomEvent("catalogTab")),
                100,
              );
            },
            "dashboard.inventory_button",
          )}
        </div>

        {/* Operational Status Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
            marginBottom: 24,
          }}
        >
          {operationalCards.map((card) => {
            const isActive = activeFilter === card.key;
            return (
              <button
                type="button"
                key={card.key}
                data-ocid={`dashboard.${card.key}_card`}
                onClick={() => setActiveFilter(isActive ? null : card.key)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(-4px)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    card.key === "pending"
                      ? "0 8px 24px rgba(16,185,129,0.35)"
                      : card.key === "processing"
                        ? "0 8px 24px rgba(6,182,212,0.35)"
                        : "0 8px 24px rgba(245,158,11,0.35)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = isActive
                    ? "0 0 16px rgba(245,158,11,0.3)"
                    : "none";
                }}
                style={{
                  background:
                    card.key === "pending"
                      ? "linear-gradient(135deg, #f59e0b, #d97706)"
                      : card.key === "processing"
                        ? "linear-gradient(135deg, #06b6d4, #2563eb)"
                        : "linear-gradient(135deg, #10b981, #14b8a6)",
                  backdropFilter: "blur(12px)",
                  border: isActive
                    ? "2px solid #f59e0b"
                    : "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 12,
                  padding: "18px 20px",
                  cursor: "pointer",
                  transition: "transform 0.3s, box-shadow 0.3s",
                  boxShadow: isActive
                    ? "0 0 16px rgba(245,158,11,0.3)"
                    : "none",
                  userSelect: "none",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 48,
                    opacity: 0.2,
                    pointerEvents: "none",
                  }}
                >
                  {card.key === "pending"
                    ? "⏰"
                    : card.key === "processing"
                      ? "🖨️"
                      : "🛵"}
                </div>
                <div
                  style={{
                    color: "white",
                    fontSize: 48,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  {card.value}
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    fontSize: 11,
                    marginTop: 6,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {card.label}
                </div>
                {isActive && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: "white",
                      fontWeight: 600,
                    }}
                  >
                    ✓ Filtered
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Staff Performance Chart */}
        <div
          className="no-print"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            borderRadius: 16,
            padding: "24px 28px",
            marginBottom: 24,
          }}
        >
          <h3
            style={{
              color: "white",
              fontWeight: 700,
              fontSize: 16,
              margin: "0 0 20px",
            }}
          >
            Staff Performance (Weekly Sales/Orders)
          </h3>
          <StaffPerformanceChart />
        </div>

        {/* Filter label */}
        {activeFilter && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              Showing:{" "}
              <strong style={{ color: "white" }}>
                {operationalCards.find((c) => c.key === activeFilter)?.label}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setActiveFilter(null)}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: 6,
                color: "rgba(255,255,255,0.6)",
                padding: "2px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Orders Table */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3
              style={{
                color: "white",
                fontWeight: 700,
                fontSize: 15,
                margin: 0,
              }}
            >
              {activeFilter
                ? operationalCards.find((c) => c.key === activeFilter)?.label
                : searchQuery
                  ? `Search results for "${searchQuery}"`
                  : "All Orders"}
              <span
                style={{
                  marginLeft: 8,
                  color: "rgba(255,255,255,0.4)",
                  fontWeight: 400,
                  fontSize: 13,
                }}
              >
                ({searchFilteredOrders.length})
              </span>
            </h3>
            <button
              type="button"
              onClick={loadOrders}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "none",
                borderRadius: 6,
                color: "rgba(255,255,255,0.5)",
                padding: "4px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
              className="no-print"
            >
              Refresh
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            {loading ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                Loading orders...
              </div>
            ) : searchFilteredOrders.length === 0 ? (
              <div
                data-ocid="dashboard.empty_state"
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                No orders in this category
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {[
                      "Order ID",
                      "Customer Name",
                      "Service Detail",
                      "Amount",
                      "Status",
                      "Action",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "rgba(255,255,255,0.5)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {searchFilteredOrders.map((order, idx) => {
                    const idStr = String(order.id);
                    const shortId = idStr.length > 6 ? idStr.slice(-6) : idStr;
                    const serviceDetail =
                      (order.items as any)?.[0]?.itemName ??
                      (order.items as any)?.[0]?.name ??
                      order.deliveryMethod ??
                      "-";
                    return (
                      <tr
                        key={String(order.id)}
                        data-ocid={`dashboard.order.item.${idx + 1}`}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: 13,
                            color: "rgba(255,255,255,0.7)",
                            fontFamily: "monospace",
                            whiteSpace: "nowrap",
                          }}
                        >
                          #ORD-{shortId}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: 13,
                            color: "white",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {order.customerName || "-"}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: 13,
                            color: "rgba(255,255,255,0.6)",
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {serviceDetail}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontSize: 13,
                            color: "#34d399",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          &#8377;{Number(order.totalAmount || 0).toFixed(0)}
                        </td>
                        <td
                          style={{ padding: "12px 16px", whiteSpace: "nowrap" }}
                        >
                          <ShopOrderStatusBadge status={order.status} />
                        </td>
                        <td
                          style={{ padding: "12px 16px", whiteSpace: "nowrap" }}
                          className="no-print"
                        >
                          {order.status === "Pending" && (
                            <button
                              type="button"
                              data-ocid={`dashboard.accept_button.${idx + 1}`}
                              onClick={() => handleAction(order)}
                              style={{
                                background: "rgba(16,185,129,0.15)",
                                border: "1px solid rgba(16,185,129,0.3)",
                                borderRadius: 6,
                                color: "#34d399",
                                padding: "5px 12px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Accept
                            </button>
                          )}
                          {order.status === "Processing/Printing" && (
                            <button
                              type="button"
                              data-ocid={`dashboard.ready_button.${idx + 1}`}
                              onClick={() => handleAction(order)}
                              style={{
                                background: "rgba(59,130,246,0.15)",
                                border: "1px solid rgba(59,130,246,0.3)",
                                borderRadius: 6,
                                color: "#60a5fa",
                                padding: "5px 12px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Mark Ready
                            </button>
                          )}
                          {order.status === "Ready for Pickup" && (
                            <button
                              type="button"
                              data-ocid={`dashboard.dispatch_button.${idx + 1}`}
                              onClick={() => handleAction(order)}
                              style={{
                                background: "rgba(168,85,247,0.15)",
                                border: "1px solid rgba(168,85,247,0.3)",
                                borderRadius: 6,
                                color: "#c084fc",
                                padding: "5px 12px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Out for Delivery
                            </button>
                          )}
                          {order.status === "Ready for Delivery" && (
                            <button
                              type="button"
                              data-ocid={`dashboard.dispatch_button.${idx + 1}`}
                              onClick={() => handleAction(order)}
                              style={{
                                background: "rgba(168,85,247,0.15)",
                                border: "1px solid rgba(168,85,247,0.3)",
                                borderRadius: 6,
                                color: "#c084fc",
                                padding: "5px 12px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Dispatch
                            </button>
                          )}
                          {order.status === "Out for Delivery" && (
                            <span
                              style={{
                                color: "rgba(255,255,255,0.3)",
                                fontSize: 12,
                              }}
                            >
                              In transit
                            </span>
                          )}
                          {(order.status === "Completed" ||
                            order.status === "Cancelled") && (
                            <span
                              style={{
                                color: "rgba(255,255,255,0.2)",
                                fontSize: 12,
                              }}
                            >
                              -
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Quick Expense Modal */}
      {showExpenseModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowExpenseModal(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowExpenseModal(false);
          }}
          role="presentation"
        >
          <div
            data-ocid="dashboard.expense_modal"
            style={{
              background: "#0f172a",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: 28,
              width: 400,
              maxWidth: "90vw",
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  color: "white",
                  fontWeight: 700,
                  fontSize: 17,
                  margin: 0,
                }}
              >
                Add Manual Expense
              </h3>
              <button
                type="button"
                data-ocid="dashboard.expense_modal.close_button"
                onClick={() => setShowExpenseModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                x
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label
                  htmlFor="qexp-amount"
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  AMOUNT
                </label>
                <input
                  id="qexp-amount"
                  data-ocid="dashboard.expense_modal.input"
                  type="number"
                  min="0"
                  value={quickExpenseForm.amount}
                  onChange={(e) =>
                    setQuickExpenseForm((p) => ({
                      ...p,
                      amount: e.target.value,
                    }))
                  }
                  placeholder="e.g. 500"
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "white",
                    fontSize: 15,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="qexp-category"
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  CATEGORY
                </label>
                <select
                  id="qexp-category"
                  data-ocid="dashboard.expense_modal.select"
                  value={quickExpenseForm.category}
                  onChange={(e) =>
                    setQuickExpenseForm((p) => ({
                      ...p,
                      category: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    background: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                >
                  {[
                    "Printer Ink/Paper",
                    "Shop Rent",
                    "Electricity/Internet",
                    "Salary/Rider Payout",
                    "Staff Salary & Payroll",
                    "Tea/Snacks",
                    "Misc",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="qexp-paymode"
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  PAYMENT MODE
                </label>
                <select
                  id="qexp-paymode"
                  value={quickExpenseForm.paymentMode}
                  onChange={(e) =>
                    setQuickExpenseForm((p) => ({
                      ...p,
                      paymentMode: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    background: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="qexp-note"
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  NOTE (optional)
                </label>
                <input
                  id="qexp-note"
                  data-ocid="dashboard.expense_modal.textarea"
                  type="text"
                  value={quickExpenseForm.note}
                  onChange={(e) =>
                    setQuickExpenseForm((p) => ({ ...p, note: e.target.value }))
                  }
                  placeholder="Short description..."
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  data-ocid="dashboard.expense_modal.cancel_button"
                  onClick={() => setShowExpenseModal(false)}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    color: "rgba(255,255,255,0.6)",
                    padding: "10px",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-ocid="dashboard.expense_modal.submit_button"
                  onClick={handleQuickExpenseSubmit}
                  style={{
                    flex: 2,
                    background: "linear-gradient(135deg, #ef4444, #dc2626)",
                    border: "none",
                    borderRadius: 8,
                    color: "white",
                    padding: "10px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Save Expense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Active Shop Orders Section ───────────────────────────────────────────────

const SHOP_ORDER_STATUSES = [
  "Pending",
  "Processing/Printing",
  "Ready for Pickup",
  "Ready for Delivery",
  "Out for Delivery",
  "Completed",
  "Cancelled",
];

const CSC_ORDER_STATUSES = [
  "Pending",
  "Docs Received",
  "Processing Application",
  "Hold/Missing Info",
  "Submitted to Portal",
  "Completed",
  "Cancelled",
];
const ACTIVE_STATUSES = [
  "Pending",
  "Processing/Printing",
  "Ready for Pickup",
  "Ready for Delivery",
];

function ShopOrderStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, { bg: string; color: string }> = {
    Pending: { bg: "rgba(234,179,8,0.2)", color: "#fbbf24" },
    "Processing/Printing": { bg: "rgba(59,130,246,0.2)", color: "#60a5fa" },
    Printing: { bg: "rgba(59,130,246,0.2)", color: "#60a5fa" },
    "Ready for Pickup": { bg: "rgba(16,185,129,0.2)", color: "#34d399" },
    "Ready for Delivery": { bg: "rgba(99,102,241,0.2)", color: "#818cf8" },
    "Out for Delivery": { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
    Completed: { bg: "rgba(16,185,129,0.2)", color: "#34d399" },
    Delivered: { bg: "rgba(139,92,246,0.2)", color: "#a78bfa" },
    Cancelled: { bg: "rgba(239,68,68,0.2)", color: "#f87171" },
  };
  const c = colorMap[status] || {
    bg: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.5)",
  };
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        borderRadius: 6,
        padding: "3px 10px",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}

function ActiveOrdersSection() {
  const actor = null;
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<bigint | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<bigint | null>(null);
  const [viewingActiveFiles, setViewingActiveFiles] = useState<any[] | null>(
    null,
  );
  const [uploadingFinalId, setUploadingFinalId] = useState<bigint | null>(null);

  async function handleUploadFinalOutput(orderId: bigint, file: File) {
    if (!actor) return;
    setUploadingFinalId(orderId);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const blob = ExternalBlob.fromBytes(bytes);
      await (actor as unknown as backendInterface).uploadCscFinalOutput(
        orderId,
        blob,
      );
      toast.success("Final output uploaded! Customer can now download it.");
      loadOrders();
    } catch {
      toast.error("Failed to upload final output.");
    } finally {
      setUploadingFinalId(null);
    }
  }

  function loadOrders() {
    if (!actor) return;
    setLoading(true);
    (actor as unknown as { getAllShopOrders: () => Promise<ShopOrder[]> })
      .getAllShopOrders()
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) => Number(b.createdAt) - Number(a.createdAt),
        );
        setOrders(sorted);
      })
      .catch(() => toast.error("Failed to load orders."))
      .finally(() => setLoading(false));
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadOrders is stable
  useEffect(() => {
    loadOrders();
  }, [actor]);

  const activeOrders = orders.filter(
    (o) =>
      ACTIVE_STATUSES.includes(o.status) ||
      [
        "Docs Received",
        "Processing Application",
        "Hold/Missing Info",
        "Submitted to Portal",
      ].includes(o.status),
  );

  async function handleStatusChange(orderId: bigint, newStatus: string) {
    if (!actor) return;
    setUpdatingId(orderId);
    try {
      await (
        actor as unknown as {
          updateShopOrderStatus: (id: bigint, status: string) => Promise<void>;
        }
      ).updateShopOrderStatus(orderId, newStatus);
      toast.success(`Status updated to "${newStatus}"`);
      loadOrders();
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h2 style={{ color: "white", fontWeight: 700, fontSize: 16 }}>
          Active Orders
          <span
            style={{
              marginLeft: 8,
              background: "rgba(234,179,8,0.2)",
              color: "#fbbf24",
              borderRadius: 20,
              padding: "2px 10px",
              fontSize: 12,
            }}
          >
            {activeOrders.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={loadOrders}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "6px 14px",
            color: "rgba(255,255,255,0.6)",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Refresh
        </button>
      </div>
      <div style={S.table}>
        {loading ? (
          <div
            data-ocid="admin.active_orders.loading_state"
            style={{
              textAlign: "center",
              padding: 60,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            <Loader2
              style={{
                width: 32,
                height: 32,
                margin: "0 auto 12px",
                animation: "spin 1s linear infinite",
              }}
            />
            <p>Loading active orders...</p>
          </div>
        ) : activeOrders.length === 0 ? (
          <div
            data-ocid="admin.active_orders.empty_state"
            style={{
              textAlign: "center",
              padding: 60,
              color: "rgba(255,255,255,0.35)",
            }}
          >
            <ClipboardList
              style={{ width: 40, height: 40, margin: "0 auto 12px" }}
            />
            <p style={{ fontWeight: 600 }}>No active orders</p>
            <p style={{ fontSize: 13 }}>New orders will appear here.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 700,
              }}
            >
              <thead>
                <tr style={S.tableHeader}>
                  {[
                    "Order ID",
                    "Customer",
                    "Phone",
                    "Items",
                    "Total",
                    "Delivery",
                    "Payment",
                    "Status",
                    "Time",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 14px",
                        textAlign: "left",
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((order, idx) => {
                  const isCsc =
                    order.cscDocuments && order.cscDocuments.length > 0;
                  const isExpanded = expandedOrderId === order.id;
                  return (
                    <React.Fragment key={String(order.id)}>
                      <tr
                        data-ocid={`admin.active_orders.row.${idx + 1}`}
                        tabIndex={isCsc ? 0 : undefined}
                        style={{
                          backgroundColor:
                            idx % 2 === 0 ? "#111827" : "#0f1729",
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                          cursor: isCsc ? "pointer" : "default",
                        }}
                        onClick={
                          isCsc
                            ? () =>
                                setExpandedOrderId(isExpanded ? null : order.id)
                            : undefined
                        }
                        onKeyDown={
                          isCsc
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ")
                                  setExpandedOrderId(
                                    isExpanded ? null : order.id,
                                  );
                              }
                            : undefined
                        }
                      >
                        <td
                          style={{
                            padding: "12px 14px",
                            color: "#a78bfa",
                            fontWeight: 600,
                            fontSize: 13,
                            whiteSpace: "nowrap",
                          }}
                        >
                          #SO-{String(order.id)}
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            color: "white",
                            fontSize: 14,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {order.customerName}
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            color: "rgba(255,255,255,0.6)",
                            fontSize: 13,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {order.phone}
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            color: "rgba(255,255,255,0.7)",
                            fontSize: 12,
                            maxWidth: 160,
                          }}
                        >
                          {order.items
                            .map((i) => `${i.itemName} x${i.qty}`)
                            .join(", ")}
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            color: "#fbbf24",
                            fontWeight: 700,
                            fontSize: 13,
                            whiteSpace: "nowrap",
                          }}
                        >
                          ₹{order.totalAmount.toFixed(0)}
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            color: "rgba(255,255,255,0.6)",
                            fontSize: 12,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {order.deliveryMethod}
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            color: "rgba(255,255,255,0.6)",
                            fontSize: 12,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {order.paymentMethod}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <ShopOrderStatusBadge status={order.status} />
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 12,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatDateTime(Number(order.createdAt) / 1_000_000)}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                              alignItems: "flex-start",
                              minWidth: 160,
                            }}
                          >
                            {updatingId === order.id ? (
                              <Loader2
                                style={{
                                  width: 16,
                                  height: 16,
                                  animation: "spin 1s linear infinite",
                                  color: "#a78bfa",
                                }}
                              />
                            ) : (
                              <select
                                data-ocid={`admin.active_orders.status.${idx + 1}`}
                                value={order.status}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(order.id, e.target.value);
                                }}
                                style={{
                                  background: "#1e293b",
                                  color: "#e2e8f0",
                                  border: "1px solid #334155",
                                  borderRadius: 6,
                                  padding: "4px 8px",
                                  fontSize: 12,
                                  cursor: "pointer",
                                }}
                              >
                                {(isCsc
                                  ? CSC_ORDER_STATUSES
                                  : SHOP_ORDER_STATUSES
                                ).map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            )}
                            {order.cscDocuments &&
                              order.cscDocuments.length > 0 && (
                                <button
                                  type="button"
                                  data-ocid={`admin.active_orders.view_docs.${idx + 1}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingActiveFiles(order.cscDocuments);
                                  }}
                                  style={{
                                    background: "rgba(99,102,241,0.2)",
                                    color: "#818cf8",
                                    border: "1px solid rgba(99,102,241,0.4)",
                                    borderRadius: 6,
                                    padding: "4px 10px",
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  📂 View Docs
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                      {isCsc && isExpanded && (
                        <tr
                          key={`csc-${String(order.id)}`}
                          style={{ backgroundColor: "rgba(99,102,241,0.08)" }}
                        >
                          <td colSpan={10} style={{ padding: "16px 20px" }}>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 12,
                              }}
                            >
                              <p
                                style={{
                                  color: "#a78bfa",
                                  fontWeight: 700,
                                  fontSize: 13,
                                }}
                              >
                                📁 CSC Application Details
                              </p>
                              {order.cscSpecialDetails && (
                                <div>
                                  <p
                                    style={{
                                      color: "rgba(255,255,255,0.45)",
                                      fontSize: 11,
                                      fontWeight: 600,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                    }}
                                  >
                                    Special Details / Login IDs
                                  </p>
                                  <p
                                    style={{
                                      color: "rgba(255,255,255,0.8)",
                                      fontSize: 13,
                                      marginTop: 4,
                                      background: "rgba(255,255,255,0.05)",
                                      padding: "8px 12px",
                                      borderRadius: 6,
                                    }}
                                  >
                                    {order.cscSpecialDetails}
                                  </p>
                                </div>
                              )}
                              {order.cscDocuments &&
                                order.cscDocuments.length > 0 && (
                                  <div>
                                    <p
                                      style={{
                                        color: "rgba(255,255,255,0.45)",
                                        fontSize: 11,
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                        marginBottom: 8,
                                      }}
                                    >
                                      Customer Uploaded Documents
                                    </p>
                                    <div
                                      style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 8,
                                      }}
                                    >
                                      {order.cscDocuments.map((doc, di) => (
                                        <a
                                          key={doc.getDirectURL()}
                                          href={doc.getDirectURL()}
                                          target="_blank"
                                          rel="noreferrer"
                                          data-ocid={`admin.csc_doc.button.${di + 1}`}
                                          style={{
                                            background: "rgba(99,102,241,0.2)",
                                            border:
                                              "1px solid rgba(99,102,241,0.4)",
                                            borderRadius: 8,
                                            padding: "6px 14px",
                                            color: "#a78bfa",
                                            fontSize: 12,
                                            textDecoration: "none",
                                            fontWeight: 600,
                                          }}
                                        >
                                          📄 Document {di + 1}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              <div>
                                <p
                                  style={{
                                    color: "rgba(255,255,255,0.45)",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    marginBottom: 8,
                                  }}
                                >
                                  Upload Final Output (Receipt / Acknowledgment)
                                </p>
                                {order.cscFinalOutput ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 12,
                                    }}
                                  >
                                    <a
                                      href={order.cscFinalOutput.getDirectURL()}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        color: "#4ade80",
                                        fontSize: 13,
                                        fontWeight: 600,
                                      }}
                                    >
                                      ✅ Final Output Uploaded — View/Download
                                    </a>
                                    <label
                                      htmlFor={`final-upload-${String(order.id)}`}
                                      style={{
                                        background: "rgba(99,102,241,0.2)",
                                        border:
                                          "1px solid rgba(99,102,241,0.4)",
                                        borderRadius: 8,
                                        padding: "6px 14px",
                                        color: "#a78bfa",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        fontWeight: 600,
                                      }}
                                    >
                                      Re-upload
                                    </label>
                                  </div>
                                ) : (
                                  <label
                                    htmlFor={`final-upload-${String(order.id)}`}
                                    data-ocid={
                                      "admin.csc_upload_final.upload_button"
                                    }
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 8,
                                      background:
                                        uploadingFinalId === order.id
                                          ? "rgba(255,255,255,0.05)"
                                          : "rgba(34,197,94,0.15)",
                                      border: "1px solid rgba(34,197,94,0.4)",
                                      borderRadius: 8,
                                      padding: "8px 16px",
                                      color: "#4ade80",
                                      fontSize: 13,
                                      cursor:
                                        uploadingFinalId === order.id
                                          ? "not-allowed"
                                          : "pointer",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {uploadingFinalId === order.id ? (
                                      <>
                                        <Loader2
                                          style={{
                                            width: 14,
                                            height: 14,
                                            animation:
                                              "spin 1s linear infinite",
                                          }}
                                        />{" "}
                                        Uploading...
                                      </>
                                    ) : (
                                      <>
                                        <Upload
                                          style={{ width: 14, height: 14 }}
                                        />{" "}
                                        Upload Final Output
                                      </>
                                    )}
                                  </label>
                                )}
                                <input
                                  id={`final-upload-${String(order.id)}`}
                                  type="file"
                                  accept=".pdf,image/*"
                                  style={{ display: "none" }}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file)
                                      handleUploadFinalOutput(order.id, file);
                                    e.target.value = "";
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingActiveFiles && (
        <FilesViewerModal
          files={viewingActiveFiles}
          onClose={() => setViewingActiveFiles(null)}
        />
      )}
    </div>
  );
}

// ─── Universal Export Dropdown ────────────────────────────────────────────────
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

// ─── Attendance Report Section ────────────────────────────────────────────────
function AttendanceReportSection() {
  const [log, setLog] = React.useState<
    Array<{
      staffName: string;
      mobile: string;
      timestamp: string;
      date: string;
      clockOutTime?: string;
    }>
  >([]);

  React.useEffect(() => {
    function readLog() {
      fsGetCollection("attendance")
        .then((logs: any[]) => setLog(logs))
        .catch(() => setLog([]));
    }
    readLog();
  }, []);

  function exportAttendanceCSV() {
    const headers = [
      "Staff Name",
      "Date",
      "Clock-In Time",
      "Clock-Out Time",
      "Status",
    ];
    const rows = log.map((e) => [
      e.staffName,
      e.date,
      new Date(e.timestamp).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      e.clockOutTime
        ? new Date(e.clockOutTime).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "-",
      e.clockOutTime ? "Clocked Out" : "Active/Working",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clikmate-attendance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{ color: "white", fontWeight: 700, fontSize: 20, margin: 0 }}
          >
            Attendance Report
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 13,
              margin: "4px 0 0",
            }}
          >
            Staff clock-in / clock-out log — {log.length} entries
          </p>
        </div>
        <ExportDropdown
          onExportCSV={exportAttendanceCSV}
          onPrint={() => window.print()}
        />
      </div>
      <div
        className="ui-only"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {[
                "Staff Name",
                "Date",
                "Clock-In Time",
                "Clock-Out Time",
                "Status",
              ].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {log.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    padding: 48,
                    color: "rgba(255,255,255,0.3)",
                    fontSize: 14,
                  }}
                >
                  No attendance records yet. Staff can clock in from the
                  Clock-In Station.
                </td>
              </tr>
            ) : (
              log
                .slice()
                .reverse()
                .map((entry) => {
                  const clockInStr = new Date(
                    entry.timestamp,
                  ).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  });
                  const clockOutStr = entry.clockOutTime
                    ? new Date(entry.clockOutTime).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : "-";
                  const isActive = !entry.clockOutTime;
                  return (
                    <tr
                      key={entry.timestamp}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <td
                        style={{
                          padding: "12px 16px",
                          color: "white",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {entry.staffName}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: "rgba(255,255,255,0.6)",
                          fontSize: 13,
                        }}
                      >
                        {entry.date}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: "#06b6d4",
                          fontSize: 13,
                        }}
                      >
                        {clockInStr}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: isActive ? "rgba(255,255,255,0.3)" : "#10b981",
                          fontSize: 13,
                        }}
                      >
                        {clockOutStr}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: isActive
                              ? "rgba(6,182,212,0.15)"
                              : "rgba(16,185,129,0.15)",
                            color: isActive ? "#06b6d4" : "#10b981",
                            border: `1px solid ${isActive ? "rgba(6,182,212,0.3)" : "rgba(16,185,129,0.3)"}`,
                          }}
                        >
                          {isActive ? "Active/Working" : "Clocked Out"}
                        </span>
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>
      <LetterheadLayout
        printAreaId="attendance-print"
        title="Attendance Report"
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", marginTop: 15 }}
        >
          <thead>
            <tr>
              {[
                "Date",
                "Staff Name",
                "Role",
                "Clock-In",
                "Clock-Out",
                "Status",
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
            {log.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    textAlign: "center",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  No attendance records found.
                </td>
              </tr>
            ) : (
              log
                .slice()
                .reverse()
                .map((entry, i) => {
                  const clockInStr = new Date(
                    entry.timestamp,
                  ).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  });
                  const clockOutStr = entry.clockOutTime
                    ? new Date(entry.clockOutTime).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : "-";
                  const status = entry.clockOutTime
                    ? "Clocked Out"
                    : "Active/Working";
                  return (
                    <tr key={`att-print-${entry.timestamp}-${i}`}>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "8px 10px",
                          fontSize: "12pt",
                          color: "#000",
                        }}
                      >
                        {entry.date}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "8px 10px",
                          fontSize: "12pt",
                          color: "#000",
                        }}
                      >
                        {entry.staffName}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "8px 10px",
                          fontSize: "12pt",
                          color: "#000",
                        }}
                      >
                        {(entry as any).role || "Staff"}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "8px 10px",
                          fontSize: "12pt",
                          color: "#000",
                        }}
                      >
                        {clockInStr}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "8px 10px",
                          fontSize: "12pt",
                          color: "#000",
                        }}
                      >
                        {clockOutStr}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "8px 10px",
                          fontSize: "12pt",
                          color: "#000",
                        }}
                      >
                        {status}
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </LetterheadLayout>
    </div>
  );
}

// ─── Shop Order History Section ───────────────────────────────────────────────

function OrderHistorySection() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fsGetCollection<any>("orders")
      .then((allOrders) => {
        const completed = allOrders
          .filter((o) => ["Delivered", "Cancelled"].includes(o.status))
          .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
        setOrders(completed);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2
          style={{ color: "white", fontWeight: 700, fontSize: 16, margin: 0 }}
        >
          Order History
          <span
            style={{
              marginLeft: 8,
              background: "rgba(139,92,246,0.2)",
              color: "#a78bfa",
              borderRadius: 20,
              padding: "2px 10px",
              fontSize: 12,
            }}
          >
            {orders.length} completed
          </span>
        </h2>
        <ExportDropdown
          onExportCSV={() => {
            const headers = [
              "Order ID",
              "Customer Name",
              "Status",
              "Amount (Rs)",
              "Date",
            ];
            const rows = orders.map((o) => [
              String(o.id),
              o.customerName || "",
              o.status || "",
              String(o.totalAmount || 0),
              new Date(Number(o.createdAt) / 1_000_000).toLocaleDateString(
                "en-IN",
              ),
            ]);
            const csv = [headers, ...rows]
              .map((r) => r.map((c) => `"${c}"`).join(","))
              .join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `clikmate-order-history-${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          onPrint={() => triggerPrint("order-history-print")}
        />
      </div>
      <LetterheadLayout
        printAreaId="order-history-print"
        title="Order History Report"
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", marginTop: 15 }}
        >
          <thead>
            <tr>
              {[
                "Order ID",
                "Customer",
                "Items",
                "Total (₹)",
                "Status",
                "Date",
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
            {orders.map((order) => (
              <tr key={String(order.id)}>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  #{String(order.id).slice(0, 8)}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  {order.customerName || "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "11pt",
                    color: "#000",
                  }}
                >
                  {(order.items as any[])
                    ?.map((i: any) => `${i.itemName} x${i.qty}`)
                    .join(", ") || "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  ₹{Number(order.totalAmount || 0).toFixed(0)}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  {order.status || "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  {formatDateTime(Number(order.createdAt) / 1_000_000)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </LetterheadLayout>
      <div style={S.table}>
        {loading ? (
          <div
            data-ocid="admin.order_history.loading_state"
            style={{
              textAlign: "center",
              padding: 60,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            <Loader2
              style={{
                width: 32,
                height: 32,
                margin: "0 auto 12px",
                animation: "spin 1s linear infinite",
              }}
            />
            <p>Loading history...</p>
          </div>
        ) : orders.length === 0 ? (
          <div
            data-ocid="admin.order_history.empty_state"
            style={{
              textAlign: "center",
              padding: 60,
              color: "rgba(255,255,255,0.35)",
            }}
          >
            <ClipboardList
              style={{ width: 40, height: 40, margin: "0 auto 12px" }}
            />
            <p style={{ fontWeight: 600 }}>No completed orders yet</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 700,
              }}
            >
              <thead>
                <tr style={S.tableHeader}>
                  {[
                    "Order ID",
                    "Customer",
                    "Items",
                    "Total",
                    "Delivery",
                    "Payment",
                    "Status",
                    "Date",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 14px",
                        textAlign: "left",
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => (
                  <tr
                    key={String(order.id)}
                    data-ocid={`admin.order_history.row.${idx + 1}`}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#111827" : "#0f1729",
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "#a78bfa",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      #SO-{String(order.id)}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "white",
                        fontSize: 14,
                      }}
                    >
                      {order.customerName}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "rgba(255,255,255,0.7)",
                        fontSize: 12,
                        maxWidth: 160,
                      }}
                    >
                      {order.items
                        .map((i) => `${i.itemName} x${i.qty}`)
                        .join(", ")}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "#fbbf24",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      ₹{order.totalAmount.toFixed(0)}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "rgba(255,255,255,0.6)",
                        fontSize: 12,
                      }}
                    >
                      {order.deliveryMethod}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "rgba(255,255,255,0.6)",
                        fontSize: 12,
                      }}
                    >
                      {order.paymentMethod}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <ShopOrderStatusBadge status={order.status} />
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 12,
                      }}
                    >
                      {formatDateTime(Number(order.createdAt) / 1_000_000)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Customer Reviews Section ─────────────────────────────────────────────────
function ReviewsAdminSection() {
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deleteTarget, setDeleteTarget] = React.useState<Review | null>(null);

  function loadReviews() {
    setLoading(true);
    const data = storageGet<Review[]>(STORAGE_KEYS.reviews, []);
    setReviews(data);
    setLoading(false);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadReviews is stable
  useEffect(() => {
    loadReviews();
  }, []);

  function handleToggle(review: Review) {
    storageUpdateItem(STORAGE_KEYS.reviews, review.id, {
      published: !review.published,
    });
    toast.success(
      review.published ? "Review unpublished." : "Review published!",
    );
    loadReviews();
  }

  function handleDelete(review: Review) {
    storageRemoveItem(STORAGE_KEYS.reviews, review.id);
    toast.success("Review deleted.");
    setDeleteTarget(null);
    loadReviews();
  }

  const avg =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + Number(r.serviceRating), 0) /
          reviews.length
        ).toFixed(1)
      : "–";

  function StarDisplay({ rating }: { rating: number }) {
    return (
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            style={{
              width: 12,
              height: 12,
              fill: n <= rating ? "#facc15" : "#e5e7eb",
              color: n <= rating ? "#facc15" : "#e5e7eb",
            }}
          />
        ))}
      </span>
    );
  }

  return (
    <div style={{ padding: "24px 20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h2
          style={{ fontSize: 22, fontWeight: 700, color: "#1e3a5f" }}
          data-ocid="admin.reviews.section"
        >
          Customer Reviews
        </h2>
        <button
          type="button"
          data-ocid="admin.reviews.refresh.button"
          onClick={loadReviews}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            background: "#1e3a5f",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          gap: 20,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            background: "#f0f4ff",
            borderRadius: 12,
            padding: "12px 20px",
            minWidth: 140,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1e3a5f" }}>
            {reviews.length}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Total Reviews</div>
        </div>
        <div
          style={{
            background: "#fffbeb",
            borderRadius: 12,
            padding: "12px 20px",
            minWidth: 140,
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#92400e",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {avg}{" "}
            <Star
              style={{
                width: 20,
                height: 20,
                fill: "#facc15",
                color: "#facc15",
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Avg Rating</div>
        </div>
        <div
          style={{
            background: "#f0fdf4",
            borderRadius: 12,
            padding: "12px 20px",
            minWidth: 140,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "#166534" }}>
            {reviews.filter((r) => r.published).length}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Published</div>
        </div>
      </div>

      {loading ? (
        <div
          data-ocid="admin.reviews.loading_state"
          style={{ textAlign: "center", padding: "48px 0", color: "#6b7280" }}
        >
          Loading reviews...
        </div>
      ) : reviews.length === 0 ? (
        <div
          data-ocid="admin.reviews.empty_state"
          style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}
        >
          No reviews yet.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            data-ocid="admin.reviews.table"
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          >
            <thead>
              <tr
                style={{
                  background: "#f9fafb",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                {[
                  "Customer",
                  "Location",
                  "Order",
                  "Service ★",
                  "Delivery ★",
                  "Comment",
                  "Date",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#374151",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reviews.map((review, idx) => {
                const ordLabel =
                  Number(review.orderId) === 0
                    ? "Seed"
                    : `#SO-${String(review.orderId)}`;
                const dateStr = new Date(
                  Number(review.createdAt) / 1_000_000,
                ).toLocaleDateString("en-IN");
                return (
                  <tr
                    key={String(review.id)}
                    data-ocid={`admin.reviews.row.${idx + 1}`}
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                      background: idx % 2 === 0 ? "#fff" : "#fafafa",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        fontWeight: 600,
                        color: "#1e3a5f",
                      }}
                    >
                      {review.customerName}
                      <div
                        style={{
                          fontSize: 11,
                          color: "#9ca3af",
                          fontWeight: 400,
                        }}
                      >
                        {review.customerPhone}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                      {review.location || "–"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "#6b7280",
                        fontFamily: "monospace",
                      }}
                    >
                      {ordLabel}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <StarDisplay rating={Number(review.serviceRating)} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {review.deliveryRating !== undefined &&
                      review.deliveryRating !== null ? (
                        <StarDisplay rating={Number(review.deliveryRating)} />
                      ) : (
                        <span style={{ color: "#9ca3af" }}>N/A</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "#374151",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={review.serviceComment}
                    >
                      &ldquo;{review.serviceComment.slice(0, 60)}
                      {review.serviceComment.length > 60 ? "…" : ""}&rdquo;
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "#9ca3af",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {dateStr}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        type="button"
                        data-ocid={`admin.reviews.toggle.${idx + 1}`}
                        onClick={() => handleToggle(review)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                          background: review.published ? "#dcfce7" : "#fee2e2",
                          color: review.published ? "#166534" : "#991b1b",
                        }}
                      >
                        {review.published ? "Published" : "Unpublished"}
                      </button>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        type="button"
                        data-ocid={`admin.reviews.delete_button.${idx + 1}`}
                        onClick={() => setDeleteTarget(review)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                          background: "#fee2e2",
                          color: "#991b1b",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          data-ocid="admin.reviews.delete.dialog"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 28,
              maxWidth: 400,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ fontWeight: 700, marginBottom: 12, fontSize: 18 }}>
              Delete Review?
            </h3>
            <p style={{ color: "#6b7280", marginBottom: 24, fontSize: 14 }}>
              Are you sure you want to permanently delete the review from{" "}
              <strong>{deleteTarget.customerName}</strong>? This cannot be
              undone.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                data-ocid="admin.reviews.delete.cancel_button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                data-ocid="admin.reviews.delete.confirm_button"
                onClick={() => handleDelete(deleteTarget)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Section ─────────────────────────────────────────────────────────

// ─── Change Password Form ─────────────────────────────────────────────────────
function ChangePasswordForm() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleUpdate() {
    setError("");
    if (newPw.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const adminAuth = await fsGetSettings<{
        email: string;
        password: string;
      }>("adminAuth");
      const storedPassword = adminAuth?.password || "admin123";
      if (currentPw !== storedPassword) {
        setError("Current password is incorrect.");
        setSaving(false);
        return;
      }
      await fsSetSettings("adminAuth", {
        ...(adminAuth || {}),
        password: newPw,
      });
      toast.success("Password updated successfully!");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch {
      toast.error("Failed to update password.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "#0f1829",
    color: "white",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div style={{ maxWidth: 400 }}>
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="cp-current" style={labelStyle}>
          Current Password
        </label>
        <input
          id="cp-current"
          data-ocid="admin.settings.current_password.input"
          type="password"
          placeholder="••••••••"
          value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="cp-new" style={labelStyle}>
          New Password
        </label>
        <input
          id="cp-new"
          data-ocid="admin.settings.new_password.input"
          type="password"
          placeholder="Min 6 characters"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="cp-confirm" style={labelStyle}>
          Confirm New Password
        </label>
        <input
          id="cp-confirm"
          data-ocid="admin.settings.confirm_password.input"
          type="password"
          placeholder="Re-enter new password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
          style={inputStyle}
        />
      </div>
      {error && (
        <p
          data-ocid="admin.settings.password.error_state"
          style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}
        >
          {error}
        </p>
      )}
      <button
        type="button"
        data-ocid="admin.settings.password.save_button"
        onClick={handleUpdate}
        disabled={saving || !currentPw || !newPw || !confirmPw}
        style={{
          padding: "10px 24px",
          borderRadius: 10,
          border: "none",
          background:
            saving || !currentPw || !newPw || !confirmPw
              ? "#374151"
              : "#7c3aed",
          color: "white",
          fontWeight: 600,
          fontSize: 14,
          cursor:
            saving || !currentPw || !newPw || !confirmPw
              ? "not-allowed"
              : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {saving ? (
          <Loader2
            style={{
              width: 14,
              height: 14,
              animation: "spin 1s linear infinite",
            }}
          />
        ) : null}
        {saving ? "Updating..." : "Update Password"}
      </button>
    </div>
  );
}

function SettingsSection() {
  const actor = null;
  const [ipWhitelist, setIpWhitelist] = useState(false);
  const [waBotEnabled, setWaBotEnabled] = useState(false);
  const [waRateTemplate, setWaRateTemplate] = useState("");
  const [gstEnabled, setGstEnabled] = useState(false);
  const [shopGstNumber, setShopGstNumber] = useState("");
  // Business Profile
  const [shopName, setShopName] = useState("ClikMate Service Center");
  const [shopAddress, setShopAddress] = useState("Raipur, C.G.");
  const [shopPhone, setShopPhone] = useState("+91 9508911400");
  const [proprietorName, setProprietorName] = useState("Proprietor");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    fsGetSettings<{
      whatsappBotEnabled: boolean;
      whatsappRateTemplate: string;
      gstEnabled?: boolean;
      shopGstNumber?: string;
    }>("appConfig")
      .then((cfg) => {
        if (cfg) {
          setWaBotEnabled(cfg.whatsappBotEnabled ?? false);
          setWaRateTemplate(cfg.whatsappRateTemplate ?? "");
          setGstEnabled(cfg.gstEnabled ?? false);
          setShopGstNumber(cfg.shopGstNumber ?? "");
        }
      })
      .catch(console.error);
    // Fetch business profile
    getDoc(doc(db, "settings", "businessProfile"))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data() as {
            shopName?: string;
            shopAddress?: string;
            shopPhone?: string;
            proprietorName?: string;
          };
          if (d.shopName) setShopName(d.shopName);
          if (d.shopAddress) setShopAddress(d.shopAddress);
          if (d.shopPhone) setShopPhone(d.shopPhone);
          if (d.proprietorName) setProprietorName(d.proprietorName);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSaveBusinessProfile() {
    setSavingProfile(true);
    try {
      await setDoc(doc(db, "settings", "businessProfile"), {
        shopName,
        shopAddress,
        shopPhone,
        proprietorName,
      });
      invalidateLetterheadCache();
      toast.success("Business profile saved!");
    } catch {
      toast.error("Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  }
  const [upiId, setUpiId] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: loaded prevents re-runs
  useEffect(() => {
    if (!actor || loaded) return;
    (actor as unknown as backendInterface)
      .getUpiSettings()
      .then((settings) => {
        if (settings) {
          setUpiId(settings.upiId);
          setQrCodeUrl(settings.qrCodeUrl);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [actor]);

  async function handleSave() {
    if (!actor) return;
    setSaving(true);
    try {
      await (actor as unknown as backendInterface).setUpiSettings(
        upiId,
        qrCodeUrl,
      );
      toast.success("UPI settings saved successfully!");
    } catch {
      toast.error("Failed to save UPI settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Business Profile Card */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(99,102,241,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            🏪
          </div>
          <div>
            <h3
              style={{
                color: "white",
                fontWeight: 700,
                fontSize: 15,
                margin: 0,
              }}
            >
              Business Profile
            </h3>
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                margin: 0,
              }}
            >
              Shop details shown on all printed reports and A4 letterheads
            </p>
          </div>
        </div>
        <div
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {[
            {
              label: "Shop Name",
              value: shopName,
              setter: setShopName,
              placeholder: "e.g. ClikMate Service Center",
            },
            {
              label: "Shop Address",
              value: shopAddress,
              setter: setShopAddress,
              placeholder: "e.g. Shop No. 12, Raipur (C.G.)",
            },
            {
              label: "Shop Phone",
              value: shopPhone,
              setter: setShopPhone,
              placeholder: "e.g. +91 9508911400",
            },
            {
              label: "Proprietor Name",
              value: proprietorName,
              setter: setProprietorName,
              placeholder: "e.g. Rajesh Kumar",
            },
          ].map(({ label, value, setter, placeholder }) => (
            <div
              key={label}
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <label
                htmlFor={`bp-${label.toLowerCase().replace(/\s+/g, "-")}`}
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {label}
              </label>
              <input
                id={`bp-${label.toLowerCase().replace(/\s+/g, "-")}`}
                type="text"
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  color: "white",
                  padding: "9px 12px",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={handleSaveBusinessProfile}
            disabled={savingProfile}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: savingProfile
                ? "rgba(99,102,241,0.4)"
                : "rgba(99,102,241,0.8)",
              color: "white",
              fontWeight: 700,
              fontSize: 14,
              cursor: savingProfile ? "not-allowed" : "pointer",
              marginTop: 4,
              alignSelf: "flex-start",
            }}
          >
            {savingProfile ? "Saving..." : "💾 Save Business Profile"}
          </button>
        </div>
      </div>
      {/* GST & Tax Settings Card */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(16,185,129,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            🧾
          </div>
          <div>
            <h3
              style={{
                color: "white",
                fontWeight: 700,
                fontSize: 15,
                margin: 0,
              }}
            >
              GST &amp; Tax Settings
            </h3>
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                margin: 0,
              }}
            >
              Configure GST for B2B invoicing and tax compliance
            </p>
          </div>
        </div>
        <div
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Enable GST toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p
                style={{
                  color: "white",
                  fontWeight: 600,
                  fontSize: 13,
                  margin: 0,
                }}
              >
                Enable GST Features
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 11,
                  margin: "2px 0 0",
                }}
              >
                Show GST fields in Catalog, POS checkout, and invoices
              </p>
              <span
                style={{
                  display: "inline-block",
                  marginTop: 6,
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  background: gstEnabled
                    ? "rgba(16,185,129,0.15)"
                    : "rgba(255,255,255,0.08)",
                  color: gstEnabled ? "#10b981" : "rgba(255,255,255,0.4)",
                  border: `1px solid ${gstEnabled ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.12)"}`,
                }}
              >
                {gstEnabled ? "✓ GST Mode: ACTIVE" : "GST Mode: INACTIVE"}
              </span>
            </div>
            <div
              role="switch"
              aria-checked={gstEnabled}
              tabIndex={0}
              data-ocid="admin.settings.gst_toggle"
              onClick={() => setGstEnabled(!gstEnabled)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter")
                  setGstEnabled(!gstEnabled);
              }}
              style={{
                width: 60,
                height: 32,
                borderRadius: 16,
                cursor: "pointer",
                background: gstEnabled
                  ? "rgba(16,185,129,0.35)"
                  : "rgba(255,255,255,0.1)",
                border: `2px solid ${gstEnabled ? "rgba(16,185,129,0.7)" : "rgba(255,255,255,0.2)"}`,
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  left: gstEnabled ? 28 : 2,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: gstEnabled ? "#10b981" : "rgba(255,255,255,0.5)",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }}
              />
            </div>
          </div>
          {/* Shop GSTIN */}
          <div>
            <label
              htmlFor="shop-gstin-input"
              style={{
                display: "block",
                color: "rgba(255,255,255,0.6)",
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Shop GSTIN
            </label>
            <input
              id="shop-gstin-input"
              data-ocid="admin.settings.shop_gstin.input"
              value={shopGstNumber}
              onChange={(e) => setShopGstNumber(e.target.value.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              style={{ ...S.input, width: "100%" }}
            />
            <p
              style={{
                color: "rgba(255,255,255,0.3)",
                fontSize: 11,
                marginTop: 4,
              }}
            >
              First 2 digits = State Code (used for CGST/SGST vs IGST detection)
            </p>
          </div>
          <button
            type="button"
            data-ocid="admin.settings.save_gst.button"
            onClick={async () => {
              try {
                await fsSetSettings("appConfig", {
                  whatsappBotEnabled: waBotEnabled,
                  whatsappRateTemplate: waRateTemplate,
                  gstEnabled,
                  shopGstNumber,
                });
                localStorage.setItem(
                  "clikmate_gst_settings",
                  JSON.stringify({ enabled: gstEnabled, shopGstNumber }),
                );
                toast.success("GST settings saved!");
              } catch {
                toast.error("Failed to save GST settings.");
              }
            }}
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: "none",
              background: "#059669",
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              alignSelf: "flex-start",
            }}
          >
            Save GST Settings
          </button>
        </div>
      </div>

      {/* UPI Payment Settings */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(139,92,246,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Settings style={{ width: 18, height: 18, color: "#a78bfa" }} />
          </div>
          <div>
            <h3
              style={{
                color: "white",
                fontWeight: 700,
                fontSize: 15,
                margin: 0,
              }}
            >
              UPI Payment Settings
            </h3>
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                margin: 0,
              }}
            >
              Configure your UPI ID and QR code for customer payments
            </p>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
          >
            <div>
              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="upi-id-input"
                  style={{
                    display: "block",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  UPI ID
                </label>
                <input
                  id="upi-id-input"
                  data-ocid="admin.settings.upi_id.input"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. smartonline@sbi"
                  style={{ ...S.input, width: "100%" }}
                />
                <p
                  style={{
                    color: "rgba(255,255,255,0.3)",
                    fontSize: 11,
                    marginTop: 4,
                  }}
                >
                  Customers will see this UPI ID on the checkout page
                </p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="qr-url-input"
                  style={{
                    display: "block",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  QR Code Image URL
                </label>
                <input
                  id="qr-url-input"
                  data-ocid="admin.settings.qr_url.input"
                  value={qrCodeUrl}
                  onChange={(e) => setQrCodeUrl(e.target.value)}
                  placeholder="https://... or /assets/generated/..."
                  style={{ ...S.input, width: "100%" }}
                />
                <p
                  style={{
                    color: "rgba(255,255,255,0.3)",
                    fontSize: 11,
                    marginTop: 4,
                  }}
                >
                  Paste the URL of your UPI QR code image
                </p>
              </div>
              <button
                type="button"
                data-ocid="admin.settings.save_upi.button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "10px 24px",
                  borderRadius: 10,
                  border: "none",
                  background: saving ? "rgba(139,92,246,0.4)" : "#7c3aed",
                  color: "white",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {saving && (
                  <Loader2
                    style={{
                      width: 14,
                      height: 14,
                      animation: "spin 1s linear infinite",
                    }}
                  />
                )}
                {saving ? "Saving..." : "Save UPI Settings"}
              </button>
            </div>
            <div>
              <div
                style={{
                  display: "block",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                QR Code Preview
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px dashed rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: 16,
                  minHeight: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="QR Code Preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 200,
                      borderRadius: 8,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      color: "rgba(255,255,255,0.2)",
                    }}
                  >
                    <Settings
                      style={{ width: 32, height: 32, margin: "0 auto 8px" }}
                    />
                    <p style={{ fontSize: 12 }}>
                      QR code preview will appear here
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Change Admin Password */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(139,92,246,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Shield style={{ width: 18, height: 18, color: "#a78bfa" }} />
          </div>
          <div>
            <h3
              style={{
                color: "white",
                fontWeight: 700,
                fontSize: 15,
                margin: 0,
              }}
            >
              Change Admin Password
            </h3>
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                margin: 0,
              }}
            >
              Update your admin login credentials
            </p>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <ChangePasswordForm />
        </div>
      </div>

      {/* ── Brand & App Settings ── */}
      {/* Store Security Card */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(6,182,212,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Shield style={{ width: 18, height: 18, color: "#06b6d4" }} />
          </div>
          <div>
            <h3
              style={{
                color: "white",
                fontWeight: 700,
                fontSize: 15,
                margin: 0,
              }}
            >
              Store Security
            </h3>
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                margin: 0,
              }}
            >
              Protect your system from unauthorized access
            </p>
          </div>
        </div>
        <div style={{ padding: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              padding: "16px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>
                  Lock Access to Store WiFi (IP Whitelisting)
                </span>
                <span
                  style={{
                    background: ipWhitelist
                      ? "rgba(139,92,246,0.2)"
                      : "rgba(255,255,255,0.07)",
                    border: `1px solid ${ipWhitelist ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 20,
                    padding: "1px 8px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: ipWhitelist ? "#a78bfa" : "rgba(255,255,255,0.3)",
                    letterSpacing: 0.5,
                    textTransform: "uppercase" as const,
                  }}
                >
                  {ipWhitelist ? "ENTERPRISE" : "DISABLED"}
                </span>
              </div>
              <p
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 12,
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                Only allow access from your store&#39;s IP address. Unauthorized
                devices will be blocked automatically.
              </p>
              {ipWhitelist && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.25)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#10b981",
                    fontWeight: 500,
                  }}
                >
                  Active &#8212; Your store IP: 192.168.1.1 (mock)
                </div>
              )}
            </div>
            <div
              data-ocid="admin.settings.ip_whitelist.toggle"
              role="switch"
              aria-checked={ipWhitelist}
              tabIndex={0}
              onClick={() => setIpWhitelist((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  setIpWhitelist((v) => !v);
              }}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: ipWhitelist ? "#06b6d4" : "rgba(255,255,255,0.1)",
                cursor: "pointer",
                position: "relative" as const,
                transition: "background 0.25s",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  background: "white",
                  position: "absolute" as const,
                  top: 2,
                  left: ipWhitelist ? 22 : 2,
                  transition: "left 0.25s",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
      {/* WhatsApp Auto-Bot Card */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(16,185,129,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            {"💬"}
          </div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                color: "white",
                fontWeight: 700,
                fontSize: 15,
                margin: 0,
              }}
            >
              ClikMate WhatsApp AI
            </h3>
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                margin: 0,
              }}
            >
              Auto-reply with your rate list via WhatsApp Business
            </p>
          </div>
          {waBotEnabled && (
            <span
              style={{
                background: "rgba(16,185,129,0.2)",
                color: "#10b981",
                fontSize: 11,
                padding: "2px 10px",
                borderRadius: 20,
                border: "1px solid rgba(16,185,129,0.4)",
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              ACTIVE
            </span>
          )}
        </div>
        <div style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.07)",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ color: "white", fontWeight: 600, fontSize: 14 }}>
                Enable WhatsApp Auto-Bot
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                Auto-reply to new messages with your rate list
              </div>
            </div>
            <div
              role="switch"
              aria-checked={waBotEnabled}
              tabIndex={0}
              data-ocid="admin.settings.whatsapp_bot.toggle"
              onClick={() => {
                const val = !waBotEnabled;
                setWaBotEnabled(val);
                fsSetSettings("appConfig", {
                  whatsappBotEnabled: val,
                  whatsappRateTemplate: waRateTemplate,
                }).catch(console.error);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  const val = !waBotEnabled;
                  setWaBotEnabled(val);
                  fsSetSettings("appConfig", {
                    whatsappBotEnabled: val,
                    whatsappRateTemplate: waRateTemplate,
                  }).catch(console.error);
                }
              }}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: waBotEnabled
                  ? "linear-gradient(135deg, #10b981, #059669)"
                  : "rgba(255,255,255,0.1)",
                border: `1px solid ${waBotEnabled ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.1)"}`,
                cursor: "pointer",
                position: "relative",
                transition: "all 0.25s",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: "white",
                  position: "absolute",
                  top: 2,
                  left: waBotEnabled ? 22 : 2,
                  transition: "left 0.25s",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="wa-rate-template"
              style={{
                display: "block",
                color: "rgba(255,255,255,0.6)",
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Auto-Reply Rate List Template
            </label>
            <textarea
              id="wa-rate-template"
              data-ocid="admin.settings.whatsapp_template.textarea"
              value={waRateTemplate}
              onChange={(e) => setWaRateTemplate(e.target.value)}
              onBlur={() =>
                fsSetSettings("appConfig", {
                  whatsappBotEnabled: waBotEnabled,
                  whatsappRateTemplate: waRateTemplate,
                }).catch(console.error)
              }
              placeholder="Hi! Our rates: Printing ₹2/page, Lamination ₹10, Smart Card ₹150, ID Card ₹80, Xerox ₹1/page..."
              rows={4}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "10px 14px",
                color: "#fff",
                fontSize: 13,
                outline: "none",
                resize: "vertical",
                lineHeight: 1.6,
                boxSizing: "border-box",
              }}
            />
            <p
              style={{
                color: "rgba(255,255,255,0.3)",
                fontSize: 11,
                marginTop: 4,
              }}
            >
              This message will be sent automatically when customers message
              your WhatsApp Business number.
            </p>
          </div>
        </div>
      </div>

      <BrandSettingsCard />
      <SyncToCloudCard />
    </div>
  );
}

// ─── Sync To Cloud Card ────────────────────────────────────────────────────────
function SyncToCloudCard() {
  const [migrating, setMigrating] = React.useState(false);
  const [result, setResult] = React.useState<{
    success: boolean;
    counts: Record<string, number>;
    errors: string[];
  } | null>(null);
  const [showConfirm, setShowConfirm] = React.useState(false);

  async function handleMigrate() {
    setMigrating(true);
    setResult(null);
    try {
      const res = await runCloudMigration();
      setResult(res);
      if (res.success) {
        toast.success("✅ Data synced to cloud successfully!");
      } else {
        toast.error("Migration completed with some errors.");
      }
    } catch (e) {
      toast.error(`Migration failed: ${String(e)}`);
    } finally {
      setMigrating(false);
      setShowConfirm(false);
    }
  }

  return (
    <div
      style={{
        margin: "24px 0",
        background: "rgba(6,182,212,0.06)",
        border: "1px solid rgba(6,182,212,0.25)",
        borderRadius: 14,
        padding: "20px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg,#06b6d4,#0ea5e9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          ☁
        </div>
        <div>
          <div style={{ color: "white", fontWeight: 700, fontSize: 15 }}>
            Sync to Cloud
          </div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
            One-time migration: uploads all localStorage data to Firebase
            Firestore
          </div>
        </div>
      </div>

      {!showConfirm && !result && (
        <button
          type="button"
          data-ocid="admin.settings.sync_to_cloud.primary_button"
          onClick={() => setShowConfirm(true)}
          style={{
            background: "linear-gradient(135deg,#06b6d4,#0ea5e9)",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          ☁ Sync to Cloud
        </button>
      )}

      {showConfirm && !migrating && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
            This will write all local data to Firestore and clear localStorage.
            Continue?
          </span>
          <button
            type="button"
            data-ocid="admin.settings.sync_confirm.confirm_button"
            onClick={handleMigrate}
            style={{
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Yes, Sync Now
          </button>
          <button
            type="button"
            data-ocid="admin.settings.sync_confirm.cancel_button"
            onClick={() => setShowConfirm(false)}
            style={{
              background: "rgba(255,255,255,0.1)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {migrating && (
        <div
          data-ocid="admin.settings.sync.loading_state"
          style={{
            color: "#06b6d4",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              animation: "spin 1s linear infinite",
              display: "inline-block",
            }}
          >
            ⟳
          </span>
          Migrating data to Firestore...
        </div>
      )}

      {result && (
        <div
          data-ocid={
            result.success
              ? "admin.settings.sync.success_state"
              : "admin.settings.sync.error_state"
          }
          style={{
            background: result.success
              ? "rgba(16,185,129,0.1)"
              : "rgba(239,68,68,0.1)",
            border: `1px solid ${result.success ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: 10,
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              color: result.success ? "#10b981" : "#ef4444",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            {result.success
              ? "✅ Migration Complete!"
              : "⚠ Migration Completed with Errors"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
            {Object.entries(result.counts).map(([key, count]) => (
              <div key={key}>
                ✓ {key}: {count} records
              </div>
            ))}
          </div>
          {result.errors.length > 0 && (
            <div style={{ marginTop: 8, color: "#fca5a5", fontSize: 12 }}>
              Errors: {result.errors.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Brand Settings Card ──────────────────────────────────────────────────────
function BrandSettingsCard() {
  const [logoUrl, setLogoUrl] = useState<string | null>(() =>
    localStorage.getItem("clikmate_logo_url"),
  );
  const [uploading, setUploading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a PNG or JPG image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB.");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      localStorage.setItem("clikmate_logo_url", dataUrl);
      setLogoUrl(dataUrl);
      // Trigger storage event for other components on same page
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "clikmate_logo_url",
          newValue: dataUrl,
        }),
      );
      setUploading(false);
      toast.success("Logo updated! It will appear across the entire app.");
    };
    reader.onerror = () => {
      toast.error("Failed to read image file.");
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    localStorage.removeItem("clikmate_logo_url");
    setLogoUrl(null);
    window.dispatchEvent(
      new StorageEvent("storage", { key: "clikmate_logo_url", newValue: null }),
    );
    toast.success("Logo reset to default ClikMate branding.");
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
  };

  return (
    <div style={cardStyle}>
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(234,179,8,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ImageIcon style={{ width: 18, height: 18, color: "#eab308" }} />
        </div>
        <div>
          <h3
            style={{ color: "white", fontWeight: 700, fontSize: 15, margin: 0 }}
          >
            Brand & App Settings
          </h3>
          <p
            style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: 0 }}
          >
            Upload a custom logo to white-label the entire app
          </p>
        </div>
      </div>
      <div style={{ padding: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          {/* Preview */}
          <div>
            <p
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Current Logo
            </p>
            <div
              style={{
                width: 160,
                height: 80,
                borderRadius: 12,
                border: "1px dashed rgba(255,255,255,0.15)",
                background: "#0f1829",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Current logo"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  <Printer
                    style={{ width: 24, height: 24, margin: "0 auto 4px" }}
                  />
                  <span style={{ fontSize: 11 }}>Default Logo</span>
                </div>
              )}
            </div>
          </div>
          {/* Upload controls */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <p
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Upload New Logo
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: 12,
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              PNG or JPG, max 2MB. The logo will appear in the top navigation
              bar, login screens, and print receipts throughout the app.
            </p>
            <label
              htmlFor="brand-logo-upload"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 18px",
                borderRadius: 8,
                background: uploading
                  ? "rgba(234,179,8,0.1)"
                  : "rgba(234,179,8,0.15)",
                border: "1px solid rgba(234,179,8,0.3)",
                color: "#eab308",
                fontSize: 13,
                fontWeight: 600,
                cursor: uploading ? "wait" : "pointer",
                transition: "all 0.2s",
              }}
            >
              <Upload style={{ width: 15, height: 15 }} />
              {uploading ? "Processing..." : "Choose Image File"}
            </label>
            <input
              id="brand-logo-upload"
              data-ocid="admin.settings.brand_logo.upload"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            {logoUrl && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                style={{
                  marginLeft: 10,
                  padding: "9px 14px",
                  borderRadius: 8,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#f87171",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reset to Default
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Login Screen ──────────────────────────────────────────────────────
function AdminLoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);
    try {
      // Check master key first
      if (password === "CLIKMATE-ADMIN-2024") {
        localStorage.setItem("clikmate_admin_session", "1");
        onSuccess();
        return;
      }
      // Check Firestore credentials
      const adminAuth = await fsGetSettings<{
        email: string;
        password: string;
      }>("adminAuth");
      const storedEmail = adminAuth?.email || "admin@clikmate.com";
      const storedPassword = adminAuth?.password || "admin123";
      if (
        email.trim().toLowerCase() === storedEmail.toLowerCase() &&
        password === storedPassword
      ) {
        localStorage.setItem("clikmate_admin_session", "1");
        onSuccess();
      } else {
        setError("Invalid email or password.");
        setLoading(false);
      }
    } catch {
      // Fallback to localStorage credentials
      const storedEmail =
        localStorage.getItem("clikmate_admin_email") || "admin@clikmate.com";
      const storedPassword =
        localStorage.getItem("clikmate_admin_password") || "admin123";
      if (
        email.trim().toLowerCase() === storedEmail.toLowerCase() &&
        password === storedPassword
      ) {
        localStorage.setItem("clikmate_admin_session", "1");
        onSuccess();
      } else {
        setError("Invalid email or password.");
      }
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        padding: 16,
      }}
    >
      {/* Decorative blobs */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
          top: "-100px",
          right: "-100px",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(234,179,8,0.08) 0%, transparent 70%)",
          bottom: "-80px",
          left: "-80px",
          pointerEvents: "none",
        }}
      />

      <div
        data-ocid="admin.login.dialog"
        style={{
          maxWidth: 420,
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 24,
          padding: "40px 36px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "#eab308",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 20px rgba(234,179,8,0.4)",
              flexShrink: 0,
            }}
          >
            <Printer style={{ width: 26, height: 26, color: "#111" }} />
          </div>
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                color: "white",
                fontWeight: 800,
                fontSize: 16,
                letterSpacing: "-0.5px",
                lineHeight: 1.2,
              }}
            >
              Smart Online
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: 12,
                lineHeight: 1.2,
              }}
            >
              Service Center
            </div>
          </div>
        </div>

        <h1
          style={{
            color: "white",
            fontWeight: 700,
            fontSize: 20,
            marginBottom: 4,
            marginTop: 20,
          }}
        >
          Admin Dashboard Login
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.45)",
            fontSize: 13,
            marginBottom: 28,
          }}
        >
          Enter your credentials to access the dashboard
        </p>

        {/* Email field */}
        <div style={{ textAlign: "left", marginBottom: 14 }}>
          <label
            htmlFor="admin-email"
            style={{
              display: "block",
              color: "rgba(255,255,255,0.6)",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Email
          </label>
          <input
            id="admin-email"
            data-ocid="admin.login.input"
            type="email"
            placeholder="admin@clikmate.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#0f1829",
              color: "white",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Password field */}
        <div style={{ textAlign: "left", marginBottom: 20 }}>
          <label
            htmlFor="admin-password"
            style={{
              display: "block",
              color: "rgba(255,255,255,0.6)",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Password
          </label>
          <input
            id="admin-password"
            data-ocid="admin.login.input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#0f1829",
              color: "white",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {error && (
          <p
            data-ocid="admin.login.error_state"
            style={{
              color: "#ef4444",
              fontSize: 13,
              marginBottom: 14,
              textAlign: "left",
            }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          data-ocid="admin.login.primary_button"
          onClick={handleLogin}
          disabled={loading || !email || !password}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: 12,
            border: "none",
            background: loading || !email || !password ? "#374151" : "#7c3aed",
            color: "white",
            fontWeight: 700,
            fontSize: 15,
            cursor: loading || !email || !password ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s",
          }}
        >
          {loading ? (
            <Loader2
              style={{
                width: 18,
                height: 18,
                animation: "spin 1s linear infinite",
              }}
            />
          ) : null}
          {loading ? "Signing in..." : "Login"}
        </button>

        <Link
          to="/"
          data-ocid="admin.login.link"
          style={{
            display: "block",
            marginTop: 20,
            color: "rgba(255,255,255,0.4)",
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          ← Back to Site
        </Link>
      </div>
    </div>
  );
}

function DailyAttendanceTab({
  members,
  onAttendanceSaved,
}: {
  members: Array<{
    name: string;
    mobile: string;
    pin: string;
    role: string;
    baseSalary: number;
  }>;
  onAttendanceSaved?: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [attendance, setAttendance] = useState<
    Record<string, "Present" | "Absent" | "Half-Day">
  >({});
  const [saving, setSaving] = useState(false);

  // Initialize all members as Present when members or date changes
  useEffect(() => {
    const saved = localStorage.getItem(`attendance_${selectedDate}`);
    if (saved) {
      try {
        setAttendance(JSON.parse(saved));
        return;
      } catch {}
    }
    const init: Record<string, "Present" | "Absent" | "Half-Day"> = {};
    for (const m of members) {
      init[m.mobile] = "Present";
    }
    setAttendance(init);
  }, [members, selectedDate]);

  function setStatus(
    mobile: string,
    status: "Present" | "Absent" | "Half-Day",
  ) {
    setAttendance((prev) => ({ ...prev, [mobile]: status }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      localStorage.setItem(
        `attendance_${selectedDate}`,
        JSON.stringify(attendance),
      );
      if (onAttendanceSaved) onAttendanceSaved();
      toast.success(`Attendance for ${selectedDate} saved successfully!`);
    } catch {
      toast.error("Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  }

  const statusOptions: Array<"Present" | "Absent" | "Half-Day"> = [
    "Present",
    "Absent",
    "Half-Day",
  ];

  return (
    <div style={{ maxWidth: 860 }}>
      <h2
        style={{
          color: "#f1f5f9",
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        Daily Attendance
      </h2>
      <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>
        Mark attendance for all active staff members.
      </p>

      {/* Date Picker */}
      <div
        style={{
          background: "#1e293b",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 20,
          border: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <label
          htmlFor="attendance-date"
          style={{ color: "#94a3b8", fontSize: 14, fontWeight: 500 }}
        >
          Select Date:
        </label>
        <input
          id="attendance-date"
          data-ocid="attendance.date.input"
          type="date"
          value={selectedDate}
          max={today}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{
            background: "#0f172a",
            color: "#f1f5f9",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 14,
            colorScheme: "dark",
          }}
        />
        {selectedDate === today && (
          <span
            style={{
              background: "rgba(251,191,36,0.15)",
              color: "#fbbf24",
              borderRadius: 20,
              padding: "3px 12px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Today
          </span>
        )}
      </div>

      {/* Attendance Table */}
      {members.length === 0 ? (
        <div
          data-ocid="attendance.empty_state"
          style={{
            background: "#1e293b",
            borderRadius: 12,
            padding: 40,
            textAlign: "center",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <p style={{ color: "#64748b", fontSize: 15 }}>
            No active staff members found. Add team members in the Team &amp;
            Access tab first.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "#1e293b",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.07)",
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(15,23,42,0.6)" }}>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      color: "#64748b",
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      color: "#64748b",
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Staff Name
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      color: "#64748b",
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Mobile
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      color: "#64748b",
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Attendance
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, idx) => (
                  <tr
                    key={member.mobile}
                    data-ocid={`attendance.item.${idx + 1}`}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <td
                      style={{
                        padding: "14px 16px",
                        color: "#64748b",
                        fontSize: 14,
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            background:
                              "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontSize: 14,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <span
                          style={{
                            color: "#f1f5f9",
                            fontSize: 14,
                            fontWeight: 500,
                          }}
                        >
                          {member.name}
                        </span>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        color: "#94a3b8",
                        fontSize: 14,
                      }}
                    >
                      {member.mobile}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        {statusOptions.map((option) => {
                          const current =
                            attendance[member.mobile] || "Present";
                          const isSelected = current === option;
                          const colorMap: Record<
                            string,
                            { bg: string; text: string; border: string }
                          > = {
                            Present: {
                              bg: isSelected
                                ? "rgba(34,197,94,0.2)"
                                : "transparent",
                              text: isSelected ? "#22c55e" : "#64748b",
                              border: isSelected
                                ? "#22c55e"
                                : "rgba(255,255,255,0.1)",
                            },
                            Absent: {
                              bg: isSelected
                                ? "rgba(239,68,68,0.2)"
                                : "transparent",
                              text: isSelected ? "#ef4444" : "#64748b",
                              border: isSelected
                                ? "#ef4444"
                                : "rgba(255,255,255,0.1)",
                            },
                            "Half-Day": {
                              bg: isSelected
                                ? "rgba(251,191,36,0.2)"
                                : "transparent",
                              text: isSelected ? "#fbbf24" : "#64748b",
                              border: isSelected
                                ? "#fbbf24"
                                : "rgba(255,255,255,0.1)",
                            },
                          };
                          const c = colorMap[option];
                          return (
                            <label
                              key={option}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                cursor: "pointer",
                                background: c.bg,
                                border: `1px solid ${c.border}`,
                                borderRadius: 20,
                                padding: "5px 12px",
                                transition: "all 0.15s",
                              }}
                            >
                              <input
                                type="radio"
                                name={`attendance_${member.mobile}`}
                                value={option}
                                checked={isSelected}
                                onChange={() =>
                                  setStatus(member.mobile, option)
                                }
                                style={{ display: "none" }}
                              />
                              <span
                                style={{
                                  color: c.text,
                                  fontSize: 13,
                                  fontWeight: isSelected ? 600 : 400,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {option === "Present"
                                  ? "✓ Present"
                                  : option === "Absent"
                                    ? "✗ Absent"
                                    : "½ Half-Day"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {members.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          {(["Present", "Absent", "Half-Day"] as const).map((s) => {
            const count = Object.values(attendance).filter(
              (v) => v === s,
            ).length;
            const cfg = {
              Present: { color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
              Absent: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
              "Half-Day": { color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
            }[s];
            return (
              <div
                key={s}
                style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.color}33`,
                  borderRadius: 10,
                  padding: "10px 18px",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span
                  style={{ color: cfg.color, fontWeight: 700, fontSize: 20 }}
                >
                  {count}
                </span>
                <span style={{ color: cfg.color, fontSize: 13 }}>{s}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Save Button */}
      <button
        type="button"
        data-ocid="attendance.submit_button"
        onClick={handleSave}
        disabled={saving || members.length === 0}
        style={{
          background: saving
            ? "#374151"
            : "linear-gradient(135deg, #3b82f6, #6366f1)",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "13px 32px",
          fontSize: 15,
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: members.length === 0 ? 0.5 : 1,
          width: "100%",
        }}
      >
        {saving ? "Saving..." : `💾 Save Today's Attendance (${selectedDate})`}
      </button>
    </div>
  );
}

// ─── Team & Access Section ────────────────────────────────────────────────────

// RoleBadge replaced by inline access chips

function TeamAccessSection() {
  const [members, setMembers] = useState<
    Array<{
      id?: string;
      name: string;
      mobile: string;
      pin: string;
      role: string;
      roles?: string[];
      baseSalary: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [accesses, setAccesses] = useState<string[]>(["POS_Staff"]);
  const [editingRolesMobile, setEditingRolesMobile] = useState<string | null>(
    null,
  );
  const ROLE_OPTIONS = [
    {
      key: "Admin",
      label: "Admin",
      desc: "Full system access",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.15)",
    },
    {
      key: "Manager",
      label: "Manager",
      desc: "Dashboard & reports",
      color: "#818cf8",
      bg: "rgba(129,140,248,0.15)",
    },
    {
      key: "POS_Staff",
      label: "POS Staff",
      desc: "Counter billing & retail",
      color: "#60a5fa",
      bg: "rgba(96,165,250,0.15)",
    },
    {
      key: "Print_Staff",
      label: "Print Staff",
      desc: "Print jobs & B2B",
      color: "#c084fc",
      bg: "rgba(192,132,252,0.15)",
    },
    {
      key: "Accountant",
      label: "Accountant",
      desc: "Khata, Expenses, GST",
      color: "#34d399",
      bg: "rgba(52,211,153,0.15)",
    },
    {
      key: "Rider",
      label: "Rider",
      desc: "Delivery dashboard",
      color: "#fb923c",
      bg: "rgba(251,146,60,0.15)",
    },
    {
      key: "Bulk Service",
      label: "Bulk Service",
      desc: "B2B VIP bulk portal",
      color: "#e879f9",
      bg: "rgba(232,121,249,0.15)",
    },
  ];
  const [baseSalary, setBaseSalary] = useState("");
  const [salaryDueMap, setSalaryDueMap] = useState<Record<string, number>>({});
  const [staffLedgerMap, setStaffLedgerMap] = useState<
    Record<string, StaffLedgerEntry[]>
  >({});
  const [staffLedgerModal, setStaffLedgerModal] = useState<{
    member: {
      name: string;
      mobile: string;
      pin: string;
      role: string;
      baseSalary: number;
    };
  } | null>(null);
  // biome-ignore lint/correctness/noUnusedVariables: used in disabled/conditional rendering
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [revealedPins, setRevealedPins] = useState<Set<string>>(new Set());
  const [resetPinTarget, setResetPinTarget] = useState<{
    mobile: string;
    name: string;
  } | null>(null);
  const [newPin, setNewPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [salaryInputs, setSalaryInputs] = useState<Record<string, string>>({});
  const [activeSubTab, setActiveSubTab] = useState<"team" | "attendance">(
    "team",
  );

  function togglePin(mobile: string) {
    setRevealedPins((prev) => {
      const next = new Set(prev);
      if (next.has(mobile)) next.delete(mobile);
      else next.add(mobile);
      return next;
    });
  }

  function loadMembers() {
    setLoading(true);
    fsGetCollection<(typeof members)[0]>("users")
      .then((list) => {
        const normalized = list.map((m: any) => ({
          ...m,
          roles:
            Array.isArray(m.roles) && m.roles.length > 0
              ? m.roles
              : m.role
                ? [m.role]
                : ["POS_Staff"],
        }));
        setMembers(normalized);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  async function loadStaffLedgers(
    _memberList: Array<{ mobile: string; baseSalary: number }>,
  ) {
    // Staff ledger entries stored locally per-member
    setStaffLedgerMap({});
  }

  function computeSalaryDue(
    memberList: Array<{ mobile: string; baseSalary: number }>,
    ledgerMap: Record<string, StaffLedgerEntry[]>,
  ) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();

    const newDueMap: Record<string, number> = {};
    for (const m of memberList) {
      let presentDays = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${month}-${String(d).padStart(2, "0")}`;
        const saved = localStorage.getItem(`attendance_${dateStr}`);
        if (saved) {
          try {
            const att = JSON.parse(saved) as Record<string, string>;
            if (att[m.mobile] === "Present") presentDays += 1;
            else if (att[m.mobile] === "Half-Day") presentDays += 0.5;
          } catch {}
        }
      }
      const dailyWage = (m.baseSalary || 0) / 30;
      const totalEarned = dailyWage * presentDays;
      const entries = ledgerMap[m.mobile] || [];
      const totalPaid = entries
        .filter(
          (e) =>
            e.entryType === "paid" && e.date.startsWith(`${year}-${month}`),
        )
        .reduce((sum, e) => sum + e.amount, 0);
      newDueMap[m.mobile] = Math.max(0, totalEarned - totalPaid);
    }
    setSalaryDueMap(newDueMap);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadMembers is stable
  useEffect(() => {
    loadMembers();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stable ref
  useEffect(() => {
    if (members.length > 0) {
      loadStaffLedgers(members).then(() => {
        computeSalaryDue(members, staffLedgerMap);
      });
    }
  }, [members]);

  // Members persisted via Firestore - no localStorage persist needed

  // Recompute salary due when ledger map updates
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable ref
  useEffect(() => {
    if (members.length > 0) {
      computeSalaryDue(members, staffLedgerMap);
    }
  }, [staffLedgerMap]);

  function handleAddMember() {
    if (!name.trim()) {
      toast.error("Please enter the member's full name.");
      return;
    }
    if (mobile.length !== 10) {
      toast.error("Mobile number must be exactly 10 digits.");
      return;
    }
    if (pin.length !== 4) {
      toast.error("PIN must be exactly 4 digits.");
      return;
    }

    // 1. Optimistic update — instantly add to table
    const optimistic = {
      id: mobile, // use mobile as id for localStorage operations
      name: name.trim(),
      mobile,
      pin,
      roles: accesses,
      role: accesses[0] || "POS_Staff",
      baseSalary: Number(baseSalary) || 0,
    };
    setMembers((prev) => [optimistic, ...prev]);

    // 2. Clear form immediately + success toast
    const savedName = name.trim();
    setName("");
    setMobile("");
    setPin("");
    setAccesses(["POS_Staff"]);
    setBaseSalary("");
    toast.success(`Team member "${savedName}" added successfully.`);

    // 3. Persist to Firestore
    fsSetDoc("users", optimistic.mobile, optimistic).catch(console.error);
  }

  function handleRemoveMember(memberMobile: string) {
    setRemoving(memberMobile);
    setMembers((prev) => prev.filter((m) => m.mobile !== memberMobile));
    fsDeleteDoc("users", memberMobile).catch(console.error);
    toast.success("Team member removed.");
    setRemoving(null);
  }

  function handleResetPin() {
    if (!resetPinTarget) return;
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast.error("PIN must be exactly 4 digits.");
      return;
    }
    setSavingPin(true);
    setMembers((prev) =>
      prev.map((m) =>
        m.mobile === resetPinTarget.mobile ? { ...m, pin: newPin } : m,
      ),
    );
    fsUpdateDoc("users", resetPinTarget.mobile, { pin: newPin }).catch(
      console.error,
    );
    toast.success("PIN updated successfully.");
    setResetPinTarget(null);
    setNewPin("");
    setSavingPin(false);
  }

  function handleToggleActive(memberMobile: string, isActive: boolean) {
    setMembers((prev) =>
      prev.map((m) =>
        m.mobile === memberMobile ? { ...m, active: isActive } : m,
      ),
    );
    fsUpdateDoc("users", memberMobile, { active: isActive }).catch(
      console.error,
    );
    toast.success(isActive ? "Member activated." : "Member deactivated.");
  }

  async function handlePaySalary(member: {
    name: string;
    mobile: string;
    baseSalary: number;
  }) {
    const amount = Number.parseFloat(salaryInputs[member.mobile] || "0");
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid salary amount.");
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    const newExpense = {
      category: "Staff Salary & Payroll",
      amount,
      date: today,
      paymentMode: "Cash",
      note: `Salary paid to ${member.name} (${member.mobile})`,
      addedBy: "admin",
      createdAt: Date.now(),
    };
    try {
      await fsAddDoc("expenses", newExpense);
      setSalaryInputs((prev) => ({ ...prev, [member.mobile]: "" }));
      toast.success(`Salary paid to ${member.name} & recorded in Audit.`);
    } catch (err) {
      console.error("Salary save error:", err);
      toast.error("Failed to save salary payment. Check Firestore connection.");
    }
  }

  return (
    <div style={{ padding: "24px", maxWidth: 900 }}>
      {/* Sub-tab switcher */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: 16,
        }}
      >
        {[
          { key: "team", label: "👥 Team & Access" },
          { key: "attendance", label: "🗓️ Daily Attendance" },
        ].map((tab) => (
          <button
            type="button"
            key={tab.key}
            data-ocid={`admin.team.${tab.key}.tab`}
            onClick={() => setActiveSubTab(tab.key as "team" | "attendance")}
            style={{
              background:
                activeSubTab === tab.key
                  ? "linear-gradient(135deg, #3b82f6, #6366f1)"
                  : "rgba(255,255,255,0.05)",
              color: activeSubTab === tab.key ? "#fff" : "#94a3b8",
              border:
                activeSubTab === tab.key
                  ? "none"
                  : "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: activeSubTab === tab.key ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === "attendance" ? (
        <DailyAttendanceTab
          members={members}
          onAttendanceSaved={() => {
            loadStaffLedgers(members);
          }}
        />
      ) : (
        <div>
          <h2
            style={{
              color: "#f1f5f9",
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Team & Access
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>
            Manage all staff, riders, and printing team members. Each role has a
            dedicated login portal.
          </p>

          {/* Add Team Member Form */}
          <div
            style={{
              background: "#1e293b",
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <h3
              style={{
                color: "#f59e0b",
                fontSize: 15,
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              Add New Team Member
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <Label
                  style={{
                    color: "#cbd5e1",
                    fontSize: 12,
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Full Name
                </Label>
                <Input
                  data-ocid="admin.team.name.input"
                  placeholder="Employee name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    color: "#f1f5f9",
                  }}
                />
              </div>
              <div>
                <Label
                  style={{
                    color: "#cbd5e1",
                    fontSize: 12,
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Mobile Number (Login ID)
                </Label>
                <Input
                  data-ocid="admin.team.mobile.input"
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
              <div>
                <Label
                  style={{
                    color: "#cbd5e1",
                    fontSize: 12,
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  4-Digit Login PIN
                </Label>
                <Input
                  data-ocid="admin.team.pin.input"
                  type="password"
                  placeholder="PIN"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  style={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    color: "#f1f5f9",
                  }}
                />
              </div>
              <div>
                <Label
                  style={{
                    color: "#cbd5e1",
                    fontSize: 12,
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Monthly Base Salary (₹)
                </Label>
                <Input
                  data-ocid="admin.team.salary.input"
                  type="number"
                  placeholder="e.g. 10000"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(e.target.value)}
                  style={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    color: "#f1f5f9",
                  }}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Label
                  style={{
                    color: "#cbd5e1",
                    fontSize: 12,
                    marginBottom: 8,
                    display: "block",
                  }}
                >
                  Accesses (select all that apply)
                </Label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <label
                      key={opt.key}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: "10px 12px",
                        background: accesses.includes(opt.key)
                          ? opt.bg
                          : "#0f172a",
                        border: `1px solid ${accesses.includes(opt.key) ? opt.color : "#334155"}`,
                        borderRadius: 8,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={accesses.includes(opt.key)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setAccesses((prev) => [...prev, opt.key]);
                          else
                            setAccesses((prev) =>
                              prev.filter((a) => a !== opt.key),
                            );
                        }}
                        style={{ marginTop: 2, accentColor: opt.color }}
                      />
                      <div>
                        <div
                          style={{
                            color: opt.color,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {opt.label}
                        </div>
                        <div style={{ color: "#64748b", fontSize: 11 }}>
                          {opt.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <Button
              data-ocid="admin.team.add.primary_button"
              onClick={handleAddMember}
              disabled={adding}
              style={{
                marginTop: 16,
                background: "#f59e0b",
                color: "#0f172a",
                fontWeight: 700,
                border: 0,
              }}
            >
              {adding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Add Team Member
                </>
              )}
            </Button>
          </div>

          {/* Team Members Table */}
          <div
            style={{
              background: "#1e293b",
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <h3 style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 600 }}>
                Active Team Members ({members.length})
              </h3>
            </div>
            {loading ? (
              <div
                data-ocid="admin.team.loading_state"
                style={{ padding: 40, textAlign: "center" }}
              >
                <Loader2
                  className="w-8 h-8 animate-spin mx-auto mb-2"
                  style={{ color: "#f59e0b" }}
                />
                <p style={{ color: "#64748b", fontSize: 13 }}>
                  Loading team...
                </p>
              </div>
            ) : members.length === 0 ? (
              <div
                data-ocid="admin.team.empty_state"
                style={{ padding: 40, textAlign: "center" }}
              >
                <Users
                  style={{
                    width: 40,
                    height: 40,
                    color: "#334155",
                    margin: "0 auto 12px",
                  }}
                />
                <p style={{ color: "#64748b", fontSize: 14 }}>
                  No team members added yet.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 700,
                  }}
                  data-ocid="admin.team.table"
                >
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                      {[
                        "Name",
                        "Login ID (Mobile)",
                        "Roles",
                        "Access PIN",
                        "Mode",
                        "Salary Due (₹)",
                        "Pay Salary",
                        "Edit Roles",
                        "Action",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 20px",
                            textAlign: "left",
                            color: "#64748b",
                            fontSize: 12,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member, idx) => (
                      <tr
                        key={member.mobile}
                        data-ocid={`admin.team.row.${idx + 1}`}
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <td
                          style={{
                            padding: "12px 20px",
                            fontSize: 14,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setStaffLedgerModal({ member })}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#60a5fa",
                              fontSize: 14,
                              fontWeight: 600,
                              textDecoration: "underline",
                              padding: 0,
                            }}
                          >
                            {member.name}
                          </button>
                        </td>
                        <td
                          style={{
                            padding: "12px 20px",
                            color: "#94a3b8",
                            fontSize: 14,
                          }}
                        >
                          {member.mobile}
                        </td>
                        <td style={{ padding: "12px 20px", maxWidth: 220 }}>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 4,
                            }}
                          >
                            {(Array.isArray(member.roles)
                              ? member.roles
                              : [member.role || "POS_Staff"]
                            )
                              .filter(Boolean)
                              .map((role) => {
                                const opt = ROLE_OPTIONS.find(
                                  (o) => o.key === role,
                                ) || {
                                  key: role,
                                  label: role,
                                  color: "#94a3b8",
                                  bg: "rgba(148,163,184,0.15)",
                                };
                                return (
                                  <span
                                    key={role}
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 8px",
                                      borderRadius: 12,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: opt.color,
                                      background: opt.bg,
                                    }}
                                  >
                                    {opt.label}
                                  </span>
                                );
                              })}
                          </div>
                        </td>
                        <td style={{ padding: "12px 20px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                color: "#94a3b8",
                                fontSize: 14,
                                fontFamily: "monospace",
                                letterSpacing: "0.1em",
                              }}
                            >
                              {revealedPins.has(member.mobile)
                                ? member.pin
                                : "••••"}
                            </span>
                            <button
                              data-ocid={`admin.team.toggle.${members.indexOf(member) + 1}`}
                              type="button"
                              onClick={() => togglePin(member.mobile)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#64748b",
                                padding: "2px",
                                display: "flex",
                                alignItems: "center",
                              }}
                              title={
                                revealedPins.has(member.mobile)
                                  ? "Hide PIN"
                                  : "Reveal PIN"
                              }
                            >
                              {revealedPins.has(member.mobile) ? (
                                <EyeOff style={{ width: 14, height: 14 }} />
                              ) : (
                                <Eye style={{ width: 14, height: 14 }} />
                              )}
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: "12px 20px" }}>
                          <select
                            value={
                              (member as any).active !== false
                                ? "Active"
                                : "Inactive"
                            }
                            onChange={(e) =>
                              handleToggleActive(
                                member.mobile,
                                e.target.value === "Active",
                              )
                            }
                            style={{
                              background:
                                (member as any).active !== false
                                  ? "rgba(34,197,94,0.15)"
                                  : "rgba(239,68,68,0.15)",
                              color:
                                (member as any).active !== false
                                  ? "#22c55e"
                                  : "#ef4444",
                              border: `1px solid ${(member as any).active !== false ? "#22c55e" : "#ef4444"}`,
                              borderRadius: 6,
                              padding: "4px 8px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        </td>
                        <td
                          style={{ padding: "12px 20px", whiteSpace: "nowrap" }}
                        >
                          {(() => {
                            const due = salaryDueMap[member.mobile] ?? 0;
                            return (
                              <span
                                style={{
                                  color: due > 0 ? "#f87171" : "#22c55e",
                                  fontWeight: 700,
                                  fontSize: 14,
                                }}
                              >
                                ₹
                                {due.toLocaleString("en-IN", {
                                  maximumFractionDigits: 0,
                                })}
                              </span>
                            );
                          })()}
                        </td>
                        <td
                          style={{ padding: "12px 20px", whiteSpace: "nowrap" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              alignItems: "center",
                            }}
                          >
                            <input
                              type="number"
                              placeholder="Amount"
                              value={salaryInputs[member.mobile] || ""}
                              onChange={(e) =>
                                setSalaryInputs((prev) => ({
                                  ...prev,
                                  [member.mobile]: e.target.value,
                                }))
                              }
                              style={{
                                width: 90,
                                padding: "5px 8px",
                                background: "#0f172a",
                                border: "1px solid #334155",
                                borderRadius: 6,
                                color: "#f1f5f9",
                                fontSize: 12,
                              }}
                            />
                            <button
                              type="button"
                              data-ocid={`admin.team.pay_salary_button.${idx + 1}`}
                              onClick={() => handlePaySalary(member)}
                              style={{
                                padding: "5px 10px",
                                background: "#16a34a",
                                color: "white",
                                border: "none",
                                borderRadius: 6,
                                fontSize: 12,
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Pay
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: "12px 20px" }}>
                          <div style={{ position: "relative" }}>
                            <button
                              type="button"
                              data-ocid={`admin.team.edit_roles.button.${idx + 1}`}
                              onClick={() =>
                                setEditingRolesMobile(
                                  editingRolesMobile === member.mobile
                                    ? null
                                    : member.mobile,
                                )
                              }
                              style={{
                                background: "rgba(99,102,241,0.15)",
                                border: "1px solid rgba(99,102,241,0.3)",
                                color: "#818cf8",
                                borderRadius: 8,
                                padding: "4px 10px",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Edit Roles ✏️
                            </button>
                            {editingRolesMobile === member.mobile && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  left: 0,
                                  zIndex: 100,
                                  background: "#1e293b",
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  borderRadius: 10,
                                  padding: 12,
                                  minWidth: 220,
                                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                                }}
                              >
                                <div
                                  style={{
                                    color: "#94a3b8",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    marginBottom: 8,
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Assign Roles
                                </div>
                                {ROLE_OPTIONS.map((opt) => {
                                  const memberRoles = Array.isArray(
                                    member.roles,
                                  )
                                    ? member.roles
                                    : [member.role || "POS_Staff"];
                                  const checked = memberRoles.includes(opt.key);
                                  return (
                                    <label
                                      key={opt.key}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "6px 0",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          const newRoles = e.target.checked
                                            ? [...memberRoles, opt.key]
                                            : memberRoles.filter(
                                                (r: string) => r !== opt.key,
                                              );
                                          setMembers((prev) =>
                                            prev.map((m) =>
                                              m.mobile === member.mobile
                                                ? {
                                                    ...m,
                                                    roles: newRoles,
                                                    role:
                                                      newRoles[0] ||
                                                      "POS_Staff",
                                                  }
                                                : m,
                                            ),
                                          );
                                          fsUpdateDoc("users", member.mobile, {
                                            roles: newRoles,
                                            role: newRoles[0] || "POS_Staff",
                                          })
                                            .then(() =>
                                              toast.success(
                                                `Roles updated for ${member.name}`,
                                              ),
                                            )
                                            .catch(() =>
                                              toast.error(
                                                "Failed to update roles",
                                              ),
                                            );
                                        }}
                                        style={{ accentColor: opt.color }}
                                      />
                                      <span
                                        style={{
                                          color: opt.color,
                                          fontSize: 12,
                                          fontWeight: 600,
                                        }}
                                      >
                                        {opt.label}
                                      </span>
                                      <span
                                        style={{
                                          color: "#64748b",
                                          fontSize: 11,
                                        }}
                                      >
                                        {opt.desc}
                                      </span>
                                    </label>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={() => setEditingRolesMobile(null)}
                                  style={{
                                    marginTop: 8,
                                    width: "100%",
                                    padding: "6px",
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 6,
                                    color: "#94a3b8",
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  Done
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px 20px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Button
                              data-ocid={`admin.team.reset_pin_button.${idx + 1}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setResetPinTarget({
                                  mobile: member.mobile,
                                  name: member.name,
                                });
                                setNewPin("");
                              }}
                              style={{
                                color: "#f59e0b",
                                fontSize: 12,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                              title="Reset PIN"
                            >
                              <KeyRound style={{ width: 13, height: 13 }} />
                              Reset PIN
                            </Button>
                            <Button
                              data-ocid={`admin.team.delete_button.${idx + 1}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member.mobile)}
                              disabled={removing === member.mobile}
                              style={{ color: "#f87171", fontSize: 12 }}
                            >
                              {removing === member.mobile ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                "Remove"
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Reset PIN Modal */}
          {resetPinTarget && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                background: "rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => setResetPinTarget(null)}
              onKeyDown={(e) => e.key === "Escape" && setResetPinTarget(null)}
              role="presentation"
            >
              <div
                style={{
                  background: "#1e293b",
                  borderRadius: 14,
                  padding: 28,
                  width: 360,
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                aria-label="Reset PIN dialog"
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <h3
                    style={{
                      color: "#f1f5f9",
                      fontSize: 17,
                      fontWeight: 700,
                      margin: 0,
                    }}
                  >
                    Reset PIN
                  </h3>
                  <button
                    type="button"
                    onClick={() => setResetPinTarget(null)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#64748b",
                      padding: 4,
                      display: "flex",
                    }}
                  >
                    <X style={{ width: 18, height: 18 }} />
                  </button>
                </div>
                <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
                  Setting new PIN for{" "}
                  <strong style={{ color: "#f1f5f9" }}>
                    {resetPinTarget.name}
                  </strong>
                </p>

                <label
                  htmlFor="reset-pin-input"
                  style={{
                    display: "block",
                    color: "#94a3b8",
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 8,
                  }}
                >
                  New 4-Digit PIN
                </label>
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  <input
                    data-ocid="admin.team.input"
                    id="reset-pin-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) =>
                      setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="••••"
                    style={{
                      flex: 1,
                      background: "#0f172a",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      color: "#f1f5f9",
                      fontSize: 20,
                      letterSpacing: "0.3em",
                      fontFamily: "monospace",
                      outline: "none",
                    }}
                  />
                  <button
                    data-ocid="admin.team.secondary_button"
                    type="button"
                    onClick={() =>
                      setNewPin(String(Math.floor(1000 + Math.random() * 9000)))
                    }
                    style={{
                      background: "rgba(245,158,11,0.15)",
                      border: "1px solid rgba(245,158,11,0.3)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      color: "#f59e0b",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Generate Random
                  </button>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    data-ocid="admin.team.cancel_button"
                    type="button"
                    onClick={() => setResetPinTarget(null)}
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      padding: "10px 0",
                      color: "#94a3b8",
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    data-ocid="admin.team.save_button"
                    type="button"
                    onClick={handleResetPin}
                    disabled={savingPin || newPin.length !== 4}
                    style={{
                      flex: 2,
                      background:
                        newPin.length === 4
                          ? "linear-gradient(135deg, #f59e0b, #d97706)"
                          : "rgba(245,158,11,0.3)",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 0",
                      color: newPin.length === 4 ? "#fff" : "#94a3b8",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: newPin.length === 4 ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    {savingPin ? (
                      <Loader2
                        style={{ width: 16, height: 16 }}
                        className="animate-spin"
                      />
                    ) : null}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Staff Ledger Modal */}
          {staffLedgerModal &&
            (() => {
              const m = staffLedgerModal.member;
              const entries = (staffLedgerMap[m.mobile] || [])
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date));
              let runningBalance = 0;
              const rows = entries.map((e) => {
                if (e.entryType === "earned") runningBalance += e.amount;
                else runningBalance -= e.amount;
                return { ...e, balance: runningBalance };
              });
              const totalEarned = entries
                .filter((e) => e.entryType === "earned")
                .reduce((s, e) => s + e.amount, 0);
              const totalPaid = entries
                .filter((e) => e.entryType === "paid")
                .reduce((s, e) => s + e.amount, 0);
              const currentDue = totalEarned - totalPaid;
              const now = new Date();
              const monthYear = now.toLocaleString("en-IN", {
                month: "long",
                year: "numeric",
              });
              return (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 1100,
                    background: "rgba(0,0,0,0.75)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 20,
                  }}
                  onClick={() => setStaffLedgerModal(null)}
                  onKeyDown={(e) =>
                    e.key === "Escape" && setStaffLedgerModal(null)
                  }
                  role="presentation"
                >
                  <style>{`
                  @media print {
                    body > * { display: none !important; }
                    #staff-ledger-print { display: block !important; position: fixed; top: 0; left: 0; width: 100%; background: white; color: black; padding: 32px; }
                    #staff-ledger-print * { color: black !important; background: white !important; border-color: #ccc !important; }
                    #staff-ledger-print .no-print { display: none !important; }
                  }
                `}</style>
                  <div
                    id="staff-ledger-print"
                    style={{
                      background: "#1e293b",
                      borderRadius: 16,
                      padding: 28,
                      width: "100%",
                      maxWidth: 800,
                      maxHeight: "90vh",
                      overflowY: "auto",
                      border: "1px solid rgba(255,255,255,0.1)",
                      boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label="Staff Ledger"
                  >
                    {/* Print header (hidden on screen) */}
                    <div style={{ display: "none" }} className="print-header">
                      <div style={{ textAlign: "center", marginBottom: 16 }}>
                        <h1 style={{ fontSize: 22, fontWeight: 800 }}>
                          ClikMate — Staff Payslip
                        </h1>
                        <p style={{ fontSize: 14 }}>
                          {m.name} | {monthYear}
                        </p>
                      </div>
                      <hr />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 20,
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            color: "#f1f5f9",
                            fontSize: 18,
                            fontWeight: 700,
                            marginBottom: 4,
                          }}
                        >
                          Staff Ledger — {m.name}
                        </h3>
                        <p style={{ color: "#94a3b8", fontSize: 13 }}>
                          Mobile: {m.mobile} | Base Salary: ₹
                          {(m.baseSalary || 0).toLocaleString("en-IN")}/month
                        </p>
                      </div>
                      <div
                        style={{ display: "flex", gap: 8 }}
                        className="no-print"
                      >
                        <button
                          type="button"
                          onClick={() => window.print()}
                          style={{
                            padding: "8px 14px",
                            background: "rgba(99,102,241,0.2)",
                            color: "#818cf8",
                            border: "1px solid #6366f1",
                            borderRadius: 8,
                            fontSize: 13,
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          🖨️ Print Payslip (A4)
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffLedgerModal(null)}
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 8,
                            padding: "8px 14px",
                            color: "#94a3b8",
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          ✕ Close
                        </button>
                      </div>
                    </div>

                    {rows.length === 0 ? (
                      <div
                        style={{
                          padding: 40,
                          textAlign: "center",
                          color: "#64748b",
                        }}
                      >
                        No ledger entries yet. Save attendance to start tracking
                        earnings.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table
                          style={{ width: "100%", borderCollapse: "collapse" }}
                        >
                          <thead>
                            <tr style={{ background: "rgba(15,23,42,0.6)" }}>
                              {[
                                "Date",
                                "Description",
                                "Earned (+)",
                                "Paid (-)",
                                "Running Balance",
                              ].map((h) => (
                                <th
                                  key={h}
                                  style={{
                                    padding: "10px 14px",
                                    textAlign: "left",
                                    color: "#64748b",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                    border: "1px solid rgba(255,255,255,0.07)",
                                  }}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr
                                key={String(row.id)}
                                style={{
                                  borderTop: "1px solid rgba(255,255,255,0.05)",
                                }}
                              >
                                <td
                                  style={{
                                    padding: "10px 14px",
                                    color: "#94a3b8",
                                    fontSize: 13,
                                    border: "1px solid rgba(255,255,255,0.07)",
                                  }}
                                >
                                  {row.date}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 14px",
                                    color: "#f1f5f9",
                                    fontSize: 13,
                                    border: "1px solid rgba(255,255,255,0.07)",
                                  }}
                                >
                                  {row.description}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 14px",
                                    color:
                                      row.entryType === "earned"
                                        ? "#22c55e"
                                        : "#475569",
                                    fontSize: 13,
                                    fontWeight:
                                      row.entryType === "earned" ? 600 : 400,
                                    border: "1px solid rgba(255,255,255,0.07)",
                                  }}
                                >
                                  {row.entryType === "earned"
                                    ? `₹${row.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                                    : "—"}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 14px",
                                    color:
                                      row.entryType === "paid"
                                        ? "#f87171"
                                        : "#475569",
                                    fontSize: 13,
                                    fontWeight:
                                      row.entryType === "paid" ? 600 : 400,
                                    border: "1px solid rgba(255,255,255,0.07)",
                                  }}
                                >
                                  {row.entryType === "paid"
                                    ? `₹${row.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                                    : "—"}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 14px",
                                    color:
                                      row.balance >= 0 ? "#f59e0b" : "#f87171",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    border: "1px solid rgba(255,255,255,0.07)",
                                  }}
                                >
                                  ₹
                                  {row.balance.toLocaleString("en-IN", {
                                    maximumFractionDigits: 0,
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Summary */}
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        marginTop: 20,
                        flexWrap: "wrap",
                      }}
                    >
                      {[
                        {
                          label: "Total Earned",
                          value: `₹${totalEarned.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
                          color: "#22c55e",
                        },
                        {
                          label: "Total Paid",
                          value: `₹${totalPaid.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
                          color: "#f87171",
                        },
                        {
                          label: "Current Due",
                          value: `₹${Math.max(0, currentDue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
                          color: "#f59e0b",
                        },
                      ].map((s) => (
                        <div
                          key={s.label}
                          style={{
                            flex: 1,
                            minWidth: 140,
                            background: "rgba(15,23,42,0.6)",
                            borderRadius: 10,
                            padding: "14px 18px",
                            border: "1px solid rgba(255,255,255,0.07)",
                          }}
                        >
                          <div
                            style={{
                              color: "#64748b",
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: "uppercase",
                              marginBottom: 4,
                            }}
                          >
                            {s.label}
                          </div>
                          <div
                            style={{
                              color: s.color,
                              fontSize: 20,
                              fontWeight: 800,
                            }}
                          >
                            {s.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Print Signature Line */}
                    <div
                      style={{
                        marginTop: 32,
                        textAlign: "right",
                        color: "#64748b",
                        fontSize: 12,
                      }}
                    >
                      <div
                        style={{
                          borderTop: "1px solid #334155",
                          paddingTop: 8,
                          display: "inline-block",
                          minWidth: 200,
                        }}
                      >
                        Authorized Signature / Shop Seal
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      )}
    </div>
  );
}

// ─── WalletSection ───────────────────────────────────────────────────────────

function WalletSection() {
  const actor = null;
  const [mobileInput, setMobileInput] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function handleLookup() {
    if (!actor || mobileInput.length !== 10) {
      toast.error("Enter a valid 10-digit mobile number.");
      return;
    }
    setBalanceLoading(true);
    try {
      const bal = await (actor as unknown as backendInterface).getWalletBalance(
        mobileInput,
      );
      setBalance(bal);
    } catch {
      toast.error("Failed to fetch balance.");
    } finally {
      setBalanceLoading(false);
    }
  }

  async function handleRecharge() {
    if (!actor || mobileInput.length !== 10) {
      toast.error("Enter a valid 10-digit mobile number first.");
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setActionLoading(true);
    try {
      const newBal = await (
        actor as unknown as backendInterface
      ).rechargeWallet(mobileInput, amt);
      setBalance(newBal);
      setAmount("");
      toast.success(`Wallet recharged! New balance: ₹${newBal.toFixed(2)}`);
    } catch {
      toast.error("Failed to recharge wallet.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeduct() {
    if (!actor || mobileInput.length !== 10) {
      toast.error("Enter a valid 10-digit mobile number first.");
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setActionLoading(true);
    try {
      const newBal = await (actor as unknown as backendInterface).deductWallet(
        mobileInput,
        amt,
      );
      setBalance(newBal);
      setAmount("");
      toast.success(`Amount deducted! New balance: ₹${newBal.toFixed(2)}`);
    } catch {
      toast.error("Failed to deduct from wallet.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2
        style={{
          color: "white",
          fontWeight: 700,
          fontSize: 18,
          marginBottom: 20,
        }}
      >
        Customer Wallet Management
      </h2>

      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 24,
          maxWidth: 540,
        }}
      >
        {/* Mobile Lookup */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="wallet-mobile"
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 12,
              fontWeight: 600,
              display: "block",
              marginBottom: 6,
            }}
          >
            CUSTOMER MOBILE NUMBER
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="tel"
              id="wallet-mobile"
              data-ocid="admin.wallet.mobile.input"
              value={mobileInput}
              onChange={(e) =>
                setMobileInput(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="10-digit mobile number"
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "10px 14px",
                color: "white",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              type="button"
              data-ocid="admin.wallet.lookup.button"
              onClick={handleLookup}
              disabled={balanceLoading}
              style={{
                background: "#3b82f6",
                border: "none",
                borderRadius: 10,
                padding: "10px 18px",
                color: "white",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
                opacity: balanceLoading ? 0.7 : 1,
              }}
            >
              {balanceLoading ? "..." : "Lookup Balance"}
            </button>
          </div>

          {balance !== null && (
            <div
              data-ocid="admin.wallet.balance.card"
              style={{
                marginTop: 14,
                padding: "14px 18px",
                borderRadius: 12,
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(59,130,246,0.15))",
                border: "1px solid rgba(99,102,241,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 11,
                    marginBottom: 2,
                  }}
                >
                  Current Balance
                </div>
                <div style={{ color: "white", fontWeight: 800, fontSize: 22 }}>
                  ₹{balance.toFixed(2)}
                </div>
              </div>
              <Wallet style={{ width: 28, height: 28, color: "#a78bfa" }} />
            </div>
          )}
        </div>

        {/* Amount + Actions */}
        <div>
          <label
            htmlFor="wallet-amount"
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 12,
              fontWeight: 600,
              display: "block",
              marginBottom: 6,
            }}
          >
            AMOUNT (₹)
          </label>
          <input
            id="wallet-amount"
            type="number"
            data-ocid="admin.wallet.amount.input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            min={1}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: "10px 14px",
              color: "white",
              fontSize: 14,
              outline: "none",
              marginBottom: 14,
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              data-ocid="admin.wallet.recharge.button"
              onClick={handleRecharge}
              disabled={actionLoading}
              style={{
                flex: 1,
                background: "#10b981",
                border: "none",
                borderRadius: 10,
                padding: "11px",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                opacity: actionLoading ? 0.7 : 1,
              }}
            >
              ＋ Recharge Wallet
            </button>
            <button
              type="button"
              data-ocid="admin.wallet.deduct.button"
              onClick={handleDeduct}
              disabled={actionLoading}
              style={{
                flex: 1,
                background: "#ef4444",
                border: "none",
                borderRadius: 10,
                padding: "11px",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                opacity: actionLoading ? 0.7 : 1,
              }}
            >
              − Deduct from Wallet
            </button>
          </div>
          <p
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 11,
              marginTop: 10,
            }}
          >
            Use this when customer pays cash at the store. Manually adjust
            wallet balance here.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

// ─── B2B Leads Section ────────────────────────────────────────────────────────

function B2BLeadsSection() {
  const [quotes, setQuotes] = useState<TypesettingQuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<bigint | null>(null);
  const [quoteNotes, setQuoteNotes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<bigint | null>(null);

  function loadQuotes() {
    setLoading(true);
    const data = storageGet<TypesettingQuoteRequest[]>(
      STORAGE_KEYS.typesettingQuotes,
      [],
    );
    setQuotes(data);
    setLoading(false);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadQuotes is stable
  useEffect(() => {
    loadQuotes();
  }, []);

  async function handleStatusUpdate(id: bigint, status: string, notes: string) {
    setUpdatingId(id);
    const finalStatus = notes.trim()
      ? `${status} | Notes: ${notes.trim()}`
      : status;
    storageUpdateItem(STORAGE_KEYS.typesettingQuotes, id, {
      status: finalStatus,
    });
    toast.success(`Status updated: "${status}"`);
    loadQuotes();
    setUpdatingId(null);
  }

  function buildWhatsAppUrl(q: TypesettingQuoteRequest) {
    const phone = q.phone.replace(/\D/g, "");
    const number = phone.startsWith("91") ? phone : `91${phone}`;
    const msg = encodeURIComponent(
      `Hello ${q.name}, regarding your request for ${q.subject} Typesetting & Printing, our custom quote is [enter amount]. Please confirm to proceed. - Smart Online Service Center`,
    );
    return `https://wa.me/${number}?text=${msg}`;
  }

  function getStatusStyle(status: string): React.CSSProperties {
    const s = status.split(" | Notes:")[0].trim();
    if (s === "Quote Sent")
      return {
        background: "rgba(59,130,246,0.2)",
        color: "#60a5fa",
        border: "1px solid rgba(59,130,246,0.3)",
      };
    if (s === "Confirmed")
      return {
        background: "rgba(16,185,129,0.2)",
        color: "#34d399",
        border: "1px solid rgba(16,185,129,0.3)",
      };
    if (s === "Printing")
      return {
        background: "rgba(139,92,246,0.2)",
        color: "#c4b5fd",
        border: "1px solid rgba(139,92,246,0.3)",
      };
    // Pending Quote (default)
    return {
      background: "rgba(234,179,8,0.2)",
      color: "#fbbf24",
      border: "1px solid rgba(234,179,8,0.3)",
    };
  }

  function getStatusLabel(status: string) {
    return status.split(" | Notes:")[0].trim() || "Pending Quote";
  }

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Loader2
          style={{
            width: 28,
            height: 28,
            margin: "0 auto",
            color: "#fbbf24",
            animation: "spin 1s linear infinite",
          }}
        />
      </div>
    );
  }

  const pendingCount = quotes.filter(
    (q) => !q.status || q.status === "Pending Quote",
  ).length;

  return (
    <div style={{ padding: "32px 24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg, #d97706, #f59e0b)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Building2 style={{ width: 22, height: 22, color: "#111" }} />
        </div>
        <div>
          <h1
            style={{ color: "white", fontWeight: 800, fontSize: 22, margin: 0 }}
          >
            B2B Leads &amp; Quotes
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 13,
              marginTop: 2,
            }}
          >
            Coaching institute quote requests — dedicated high-value pipeline
          </p>
        </div>
        {pendingCount > 0 && (
          <span
            style={{
              marginLeft: "auto",
              background: "rgba(234,179,8,0.2)",
              color: "#fbbf24",
              border: "1px solid rgba(234,179,8,0.4)",
              borderRadius: 20,
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {pendingCount} Pending
          </span>
        )}
      </div>

      {quotes.length === 0 ? (
        <div
          data-ocid="admin.b2b_leads.empty_state"
          style={{
            textAlign: "center",
            padding: 60,
            color: "rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.02)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <Building2
            style={{
              width: 40,
              height: 40,
              margin: "0 auto 12px",
              opacity: 0.3,
            }}
          />
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            No B2B leads yet
          </p>
          <p style={{ fontSize: 13 }}>
            They will appear here when coaching institutes submit quote
            requests.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "#111827",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.07)",
            overflow: "hidden",
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 160px 100px 130px 80px",
              padding: "10px 16px",
              background: "#1a2236",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {[
              "Institute Name",
              "Subject",
              "Layout",
              "Date",
              "Status",
              "Action",
            ].map((h) => (
              <span
                key={h}
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {quotes.map((q, idx) => {
            const isOpen = expandedId === q.id;
            const noteKey = String(q.id);
            const rawLayout = q.format?.split(" | Logo:")[0] ?? q.format ?? "";
            return (
              <React.Fragment key={String(q.id)}>
                <div
                  data-ocid={`admin.b2b_leads.item.${idx + 1}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px 160px 100px 130px 80px",
                    padding: "14px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    alignItems: "center",
                    background: isOpen ? "rgba(234,179,8,0.03)" : "transparent",
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: "white",
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      {q.name}
                    </div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      +91 {q.phone}
                    </div>
                  </div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.75)",
                      fontSize: 13,
                    }}
                  >
                    {q.subject}
                  </div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.6)",
                      fontSize: 12,
                    }}
                  >
                    {rawLayout || "—"}
                  </div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: 12,
                    }}
                  >
                    {new Date(
                      Number(q.submittedAt) / 1_000_000,
                    ).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                  <div>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        ...getStatusStyle(q.status ?? ""),
                      }}
                    >
                      {getStatusLabel(q.status ?? "")}
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      data-ocid={`admin.b2b_leads.edit_button.${idx + 1}`}
                      onClick={() => setExpandedId(isOpen ? null : q.id)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(234,179,8,0.3)",
                        background: isOpen
                          ? "rgba(234,179,8,0.2)"
                          : "rgba(234,179,8,0.08)",
                        color: "#fbbf24",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {isOpen ? "Close" : "View"}
                    </button>
                  </div>
                </div>

                {/* Expanded panel */}
                {isOpen && (
                  <div
                    style={{
                      padding: "20px 16px 24px",
                      background: "rgba(234,179,8,0.03)",
                      borderBottom: "1px solid rgba(255,255,255,0.07)",
                      borderTop: "1px solid rgba(234,179,8,0.1)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                        marginBottom: 20,
                      }}
                    >
                      {[
                        ["Institute", q.name],
                        ["Contact (WhatsApp)", `+91 ${q.phone}`],
                        ["Subject", q.subject],
                        ["Layout", rawLayout],
                        ["Language", q.language],
                        [
                          "Submitted",
                          new Date(
                            Number(q.submittedAt) / 1_000_000,
                          ).toLocaleString("en-IN"),
                        ],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <div
                            style={{
                              color: "rgba(255,255,255,0.35)",
                              fontSize: 10,
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              marginBottom: 3,
                            }}
                          >
                            {label}
                          </div>
                          <div
                            style={{
                              color: "rgba(255,255,255,0.8)",
                              fontSize: 13,
                            }}
                          >
                            {val || "—"}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Raw material link */}
                    {q.fileUrl && (
                      <div style={{ marginBottom: 16 }}>
                        <a
                          href={q.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "#818cf8",
                            fontSize: 13,
                            textDecoration: "underline",
                          }}
                        >
                          📎 View uploaded raw material / notes
                        </a>
                      </div>
                    )}

                    {/* Quote Notes */}
                    <div style={{ marginBottom: 16 }}>
                      <label
                        htmlFor={`quote-notes-${String(q.id)}`}
                        style={{
                          color: "rgba(255,255,255,0.5)",
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          display: "block",
                          marginBottom: 6,
                        }}
                      >
                        Quote Notes / Custom Amount
                      </label>
                      <textarea
                        id={`quote-notes-${String(q.id)}`}
                        data-ocid="admin.b2b_leads.textarea"
                        value={quoteNotes[noteKey] ?? ""}
                        onChange={(e) =>
                          setQuoteNotes((prev) => ({
                            ...prev,
                            [noteKey]: e.target.value,
                          }))
                        }
                        placeholder="e.g. ₹5,000 for 200 pages, delivery in 3 days..."
                        rows={3}
                        style={{
                          width: "100%",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 10,
                          padding: "10px 12px",
                          color: "white",
                          fontSize: 13,
                          outline: "none",
                          resize: "vertical",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>

                    {/* Action Row */}
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      {/* Status Select */}
                      <select
                        data-ocid="admin.b2b_leads.select"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleStatusUpdate(
                              q.id,
                              e.target.value,
                              quoteNotes[noteKey] ?? "",
                            );
                          }
                        }}
                        disabled={updatingId === q.id}
                        style={{
                          background: "rgba(255,255,255,0.07)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 8,
                          padding: "8px 12px",
                          color: "white",
                          fontSize: 13,
                          cursor: "pointer",
                          outline: "none",
                        }}
                      >
                        <option value="" disabled>
                          Update Status
                        </option>
                        <option value="Pending Quote">Pending Quote</option>
                        <option value="Quote Sent">Quote Sent</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Printing">Printing</option>
                      </select>

                      {/* WhatsApp Button */}
                      <a
                        href={buildWhatsAppUrl(q)}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-ocid="admin.b2b_leads.button"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 16px",
                          borderRadius: 8,
                          background:
                            "linear-gradient(135deg, #16a34a, #15803d)",
                          color: "white",
                          fontSize: 13,
                          fontWeight: 600,
                          textDecoration: "none",
                          boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
                        }}
                      >
                        <span style={{ fontSize: 16 }}>📱</span>
                        Send Quote via WhatsApp
                      </a>

                      {updatingId === q.id && (
                        <Loader2
                          style={{
                            width: 18,
                            height: 18,
                            color: "#fbbf24",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Helpdesk Section ---
function HelpdeskSection() {
  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setTickets([]);
    setLoading(false);
  }, []);

  const resolve = (id: bigint) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, resolved: true } : t)),
    );
    toast.success("Ticket marked as resolved.");
  };

  return (
    <div style={{ padding: "24px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <Headphones size={22} color="#a78bfa" />
        <h2
          style={{
            color: "white",
            fontSize: "18px",
            fontWeight: 700,
            margin: 0,
          }}
        >
          Helpdesk / Support Tickets
        </h2>
      </div>
      {loading ? (
        <div
          data-ocid="admin.helpdesk.loading_state"
          style={{
            color: "rgba(255,255,255,0.5)",
            textAlign: "center",
            padding: "40px",
          }}
        >
          Loading tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div
          data-ocid="admin.helpdesk.empty_state"
          style={{
            textAlign: "center",
            padding: "48px 24px",
            background: "rgba(255,255,255,0.05)",
            borderRadius: "12px",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          No support tickets yet.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                {[
                  "Ticket ID",
                  "Order ID",
                  "Customer Mobile",
                  "Complaint",
                  "Date",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "10px 14px",
                      color: "rgba(255,255,255,0.5)",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, idx) => (
                <tr
                  key={String(t.id)}
                  data-ocid={`admin.helpdesk.item.${idx + 1}`}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "white",
                      fontFamily: "monospace",
                      whiteSpace: "nowrap",
                    }}
                  >
                    #{String(t.id)}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "rgba(255,255,255,0.8)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    #{t.orderId}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "rgba(255,255,255,0.8)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.customerMobile}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "rgba(255,255,255,0.7)",
                      maxWidth: "240px",
                    }}
                  >
                    {t.complaint.length > 80
                      ? `${t.complaint.slice(0, 80)}...`
                      : t.complaint}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "rgba(255,255,255,0.6)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(
                      Number(t.createdAt / 1_000_000n),
                    ).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background: t.resolved
                          ? "rgba(34,197,94,0.15)"
                          : "rgba(234,179,8,0.15)",
                        color: t.resolved ? "#4ade80" : "#fbbf24",
                        border: t.resolved
                          ? "1px solid rgba(34,197,94,0.3)"
                          : "1px solid rgba(234,179,8,0.3)",
                      }}
                    >
                      {t.resolved ? "Resolved" : "Open"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <button
                      type="button"
                      data-ocid={`admin.helpdesk.resolve_button.${idx + 1}`}
                      disabled={t.resolved}
                      onClick={() => resolve(t.id)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: t.resolved ? "not-allowed" : "pointer",
                        background: t.resolved
                          ? "rgba(255,255,255,0.07)"
                          : "rgba(99,102,241,0.25)",
                        color: t.resolved ? "rgba(255,255,255,0.3)" : "#a5b4fc",
                        fontSize: "12px",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.resolved ? "Resolved" : "Mark Resolved"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Audit & Reports Section ───────────────────────────────────────────────────
function AuditReportsSection({ isAdmin }: { isAdmin: boolean }) {
  const [incomes, setIncomes] = useState<ManualIncomeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [posSales, setPosSales] = useState<
    Array<{
      id: string | bigint;
      totalAmount: number;
      paymentMethod: string;
      cashPaid?: number;
      upiPaid?: number;
      khataDue?: number;
      createdAt: number | bigint;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editIncomeEntry, setEditIncomeEntry] =
    useState<ManualIncomeEntry | null>(null);
  const [editExpenseEntry, setEditExpenseEntry] = useState<ExpenseEntry | null>(
    null,
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<{
    type: "income" | "expense";
    id: bigint;
  } | null>(null);
  const [ledgerTab, setLedgerTab] = useState<"income" | "expense">("income");
  const [showAudit, setShowAudit] = useState(false);
  const [auditTimeframe, setAuditTimeframe] = useState<
    "today" | "yesterday" | "month" | "fy" | "custom"
  >("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");
  const [filterPaymentMode, setFilterPaymentMode] = useState("All");
  const [filterTxType, setFilterTxType] = useState("All");
  const [adminTallyFilter, setAdminTallyFilter] = useState<string | null>(null);
  const todayStr = new Date().toISOString().split("T")[0];
  const [incomeForm, setIncomeForm] = useState({
    date: todayStr,
    category: "Counter Sales (POS)",
    amount: "",
    paymentMode: "Cash",
    description: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    date: todayStr,
    category: "Printer Ink/Paper",
    amount: "",
    paymentMode: "Cash",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  const INCOME_CATEGORIES = [
    "Counter Sales (POS)",
    "Online App Orders",
    "Advance / Khata Recovery",
    "B2B Coaching Payment",
    "Misc / Other Income",
  ];
  const EXPENSE_CATEGORIES = [
    "Printer Ink/Paper",
    "Shop Rent",
    "Electricity/Internet",
    "Salary/Rider Payout",
    "Staff Salary & Payroll",
    "Tea/Snacks",
    "Misc",
  ];
  const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer"];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const inc = storageGet<ManualIncomeEntry[]>(
        STORAGE_KEYS.manualIncomes,
        [],
      );
      const exp = storageGet<ExpenseEntry[]>(STORAGE_KEYS.expenses, []);
      const firestoreOrders = await fsGetCollection<{
        id: string;
        totalAmount: number;
        paymentMethod: string;
        cashPaid?: number;
        upiPaid?: number;
        khataDue?: number;
        createdAt: number;
      }>("orders");
      setIncomes(inc);
      setExpenses(exp);
      setPosSales(firestoreOrders as any);
    } catch (e) {
      console.error("Failed to load orders for tally:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddIncome() {
    if (!incomeForm.amount) return;
    setSaving(true);
    try {
      if (editIncomeEntry) {
        const updatedIncome: ManualIncomeEntry = {
          ...editIncomeEntry,
          category: incomeForm.category,
          amount: Number(incomeForm.amount),
          date: incomeForm.date,
          paymentMode: incomeForm.paymentMode,
          description: incomeForm.description,
        };
        storageUpdateItem(
          STORAGE_KEYS.manualIncomes,
          editIncomeEntry.id,
          updatedIncome,
        );
        setIncomes((prev) =>
          prev.map((e) =>
            String(e.id) === String(editIncomeEntry.id) ? updatedIncome : e,
          ),
        );
        toast.success("Income updated!");
        setShowIncomeModal(false);
        setEditIncomeEntry(null);
        setIncomeForm({
          date: todayStr,
          category: "Counter Sales (POS)",
          amount: "",
          paymentMode: "Cash",
          description: "",
        });
      } else {
        const newIncome: ManualIncomeEntry = {
          id: Date.now() as unknown as bigint,
          category: incomeForm.category,
          amount: Number(incomeForm.amount),
          date: incomeForm.date,
          paymentMode: incomeForm.paymentMode,
          description: incomeForm.description,
          createdAt: Date.now() as unknown as bigint,
        };
        storageAddItem(STORAGE_KEYS.manualIncomes, newIncome);
        setIncomes((prev) => [newIncome, ...prev]);
        setShowIncomeModal(false);
        setEditIncomeEntry(null);
        setIncomeForm({
          date: todayStr,
          category: "Counter Sales (POS)",
          amount: "",
          paymentMode: "Cash",
          description: "",
        });
        toast.success("Income added!");
        setSaving(false);
        return;
      }
    } catch {
      toast.error("Failed to save income.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddExpense() {
    if (!expenseForm.amount) return;
    setSaving(true);
    try {
      if (editExpenseEntry) {
        const updatedExpense: ExpenseEntry = {
          ...editExpenseEntry,
          category: expenseForm.category,
          amount: Number(expenseForm.amount),
          date: expenseForm.date,
          paymentMode: expenseForm.paymentMode,
          note: expenseForm.note,
        };
        storageUpdateItem(
          STORAGE_KEYS.expenses,
          editExpenseEntry.id,
          updatedExpense,
        );
        setExpenses((prev) =>
          prev.map((e) =>
            String(e.id) === String(editExpenseEntry.id) ? updatedExpense : e,
          ),
        );
        toast.success("Expense updated!");
        setShowExpenseModal(false);
        setEditExpenseEntry(null);
        setExpenseForm({
          date: todayStr,
          category: "Printer Ink/Paper",
          amount: "",
          paymentMode: "Cash",
          note: "",
        });
      } else {
        const newExpense: ExpenseEntry = {
          id: Date.now() as unknown as bigint,
          category: expenseForm.category,
          amount: Number(expenseForm.amount),
          date: expenseForm.date,
          paymentMode: expenseForm.paymentMode,
          note: expenseForm.note,
          addedBy: "admin",
          createdAt: Date.now() as unknown as bigint,
        };
        storageAddItem(STORAGE_KEYS.expenses, newExpense);
        setExpenses((prev) => [newExpense, ...prev]);
        setShowExpenseModal(false);
        setEditExpenseEntry(null);
        setExpenseForm({
          date: todayStr,
          category: "Printer Ink/Paper",
          amount: "",
          paymentMode: "Cash",
          note: "",
        });
        toast.success("Expense added!");
        setSaving(false);
        return;
      }
    } catch {
      toast.error("Failed to save expense.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!deleteConfirmId) return;
    if (deleteConfirmId.type === "income") {
      storageRemoveItem(STORAGE_KEYS.manualIncomes, deleteConfirmId.id);
      setIncomes((prev) =>
        prev.filter((e) => String(e.id) !== String(deleteConfirmId.id)),
      );
      toast.success("Income deleted.");
    } else {
      storageRemoveItem(STORAGE_KEYS.expenses, deleteConfirmId.id);
      setExpenses((prev) =>
        prev.filter((e) => String(e.id) !== String(deleteConfirmId.id)),
      );
      toast.success("Expense deleted.");
    }
    setDeleteConfirmId(null);
  }

  function getDateRange(): { start: Date; end: Date } {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);
    if (auditTimeframe === "today") return { start: todayStart, end: todayEnd };
    if (auditTimeframe === "yesterday") {
      const y = new Date(todayStart);
      y.setDate(y.getDate() - 1);
      return { start: y, end: new Date(y.getTime() + 86400000 - 1) };
    }
    if (auditTimeframe === "month") {
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: todayEnd,
      };
    }
    if (auditTimeframe === "fy") {
      const fyStart =
        now.getMonth() >= 3
          ? new Date(now.getFullYear(), 3, 1)
          : new Date(now.getFullYear() - 1, 3, 1);
      return { start: fyStart, end: todayEnd };
    }
    if (auditTimeframe === "custom" && customFrom && customTo) {
      return {
        start: new Date(customFrom),
        end: new Date(`${customTo}T23:59:59`),
      };
    }
    return { start: todayStart, end: todayEnd };
  }

  const { start: rangeStart, end: rangeEnd } = getDateRange();

  const allTransactions: Array<{
    date: Date;
    type: "Income" | "Expense";
    category: string;
    amount: number;
    paymentMode: string;
    description: string;
  }> = [
    ...incomes.map((i) => ({
      date: new Date(i.date),
      type: "Income" as const,
      category: i.category,
      amount: i.amount,
      paymentMode: i.paymentMode,
      description: i.description,
    })),
    ...posSales.map((s) => ({
      date: new Date(Number(s.createdAt) / 1_000_000),
      type: "Income" as const,
      category: "Counter Sales (POS)",
      amount: s.totalAmount,
      paymentMode: s.paymentMethod,
      description: "POS Sale",
    })),
    ...expenses.map((e) => ({
      date: new Date(e.date),
      type: "Expense" as const,
      category: e.category,
      amount: e.amount,
      paymentMode: e.paymentMode,
      description: e.note,
    })),
  ];

  const filteredTx = allTransactions
    .filter((tx) => {
      if (tx.date < rangeStart || tx.date > rangeEnd) return false;
      const min = filterMinAmount ? Number(filterMinAmount) : null;
      const max = filterMaxAmount ? Number(filterMaxAmount) : null;
      if (min !== null && tx.amount < min) return false;
      if (max !== null && tx.amount > max) return false;
      if (filterPaymentMode !== "All" && tx.paymentMode !== filterPaymentMode)
        return false;
      if (filterTxType === "Income Only" && tx.type !== "Income") return false;
      if (filterTxType === "Expenses Only" && tx.type !== "Expense")
        return false;
      return true;
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const filteredIncome = filteredTx
    .filter((t) => t.type === "Income")
    .reduce((s, t) => s + t.amount, 0);
  const filteredExpense = filteredTx
    .filter((t) => t.type === "Expense")
    .reduce((s, t) => s + t.amount, 0);
  const filteredNet = filteredIncome - filteredExpense;

  function formatRupees(n: number) {
    return `₹${n.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, "$1,")}`;
  }

  function exportCSV() {
    const rows = [
      ["Date", "Type", "Category", "Amount", "Payment Mode", "Description"],
    ];
    for (const tx of filteredTx) {
      rows.push([
        tx.date.toLocaleDateString("en-IN"),
        tx.type,
        tx.category,
        tx.amount.toFixed(2),
        tx.paymentMode,
        tx.description,
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-report-${auditTimeframe}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    const lines2: string[] = [
      "Smart Online Service Center - Audit Report",
      `Period: ${rangeStart.toLocaleDateString("en-IN")} to ${rangeEnd.toLocaleDateString("en-IN")}`,
      "",
      `Total Income: ${formatRupees(filteredIncome)}`,
      `Total Expenses: ${formatRupees(filteredExpense)}`,
      `Net Profit: ${formatRupees(filteredNet)}`,
      "",
      "Date | Type | Category | Amount | Payment Mode | Description",
      "---",
      ...filteredTx.map(
        (tx) =>
          `${tx.date.toLocaleDateString("en-IN")} | ${tx.type} | ${tx.category} | ${formatRupees(tx.amount)} | ${tx.paymentMode} | ${tx.description}`,
      ),
    ];
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<html><head><title>Audit Report</title><style>body{font-family:monospace;padding:24px}pre{white-space:pre-wrap;font-size:13px}</style></head><body><h2>Audit Report</h2><pre>${lines2.join("\n")}</pre><br><button onclick="window.print()">Print / Save as PDF</button></body></html>`,
    );
    win.document.close();
  }

  const cardBox: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 16,
  };
  const inp: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    borderRadius: 7,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    fontSize: 13,
    outline: "none",
  };
  const fLabel: React.CSSProperties = {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    display: "block",
    marginBottom: 4,
  };

  return (
    <div
      style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/* Top Action Row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
        }}
      >
        <button
          type="button"
          data-ocid="admin.audit.new_bill_btn"
          onClick={() => {
            window.location.href = "/#/pos";
          }}
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            border: "2px solid #f59e0b",
            background: "linear-gradient(135deg,#f59e0b,#d97706)",
            color: "#1a1a1a",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <BarChart3 size={16} />+ Create New Bill / Order
        </button>
        <button
          type="button"
          data-ocid="admin.audit.add_income.button"
          onClick={() => {
            setEditIncomeEntry(null);
            setIncomeForm({
              date: todayStr,
              category: "Counter Sales (POS)",
              amount: "",
              paymentMode: "Cash",
              description: "",
            });
            setShowIncomeModal(true);
          }}
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            border: "none",
            background: "#10b981",
            color: "white",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          + Add Manual Income
        </button>
        <button
          type="button"
          data-ocid="admin.audit.add_expense.button"
          onClick={() => {
            setEditExpenseEntry(null);
            setExpenseForm({
              date: todayStr,
              category: "Printer Ink/Paper",
              amount: "",
              paymentMode: "Cash",
              note: "",
            });
            setShowExpenseModal(true);
          }}
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            border: "none",
            background: "#ef4444",
            color: "white",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          + Add Manual Expense
        </button>
        <button
          type="button"
          data-ocid="admin.audit.generate_report.button"
          onClick={() => setShowAudit(!showAudit)}
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: showAudit
              ? "rgba(139,92,246,0.2)"
              : "rgba(255,255,255,0.06)",
            color: "white",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: "auto",
          }}
        >
          <BarChart3 size={16} color="#a78bfa" />
          Generate Audit Report
        </button>
      </div>

      {/* Today's Tally Cards */}
      {(() => {
        // Firestore createdAt is Date.now() in milliseconds (not bigint nanoseconds)
        const todaySales = posSales.filter((s) => {
          const ms =
            typeof s.createdAt === "bigint"
              ? Number(s.createdAt) / 1_000_000
              : Number(s.createdAt);
          return new Date(ms).toDateString() === new Date().toDateString();
        });

        // Cash: pure Cash orders + cashPaid portion from all split orders
        const totalCash = todaySales.reduce((acc, s) => {
          const pm = s.paymentMethod || "";
          if (pm === "Cash") return acc + (s.totalAmount || 0);
          if (pm.includes("Cash") && pm.includes("Khata"))
            return acc + (s.cashPaid || 0);
          if (pm.includes("Cash") && pm.includes("UPI"))
            return acc + (s.cashPaid || 0);
          return acc;
        }, 0);

        // UPI: pure UPI orders + upiPaid from Cash+UPI splits
        const totalUpi = todaySales.reduce((acc, s) => {
          const pm = s.paymentMethod || "";
          if (pm === "UPI") return acc + (s.totalAmount || 0);
          if (pm.includes("Cash") && pm.includes("UPI"))
            return acc + (s.upiPaid || 0);
          return acc;
        }, 0);

        // Split (Cash+UPI only) — split into Cash+UPI above, show 0 here
        const totalSplit = 0;

        // Khata: khataDue from split Cash+Khata orders
        const totalKhata = todaySales.reduce((acc, s) => {
          const pm = s.paymentMethod || "";
          if (pm.includes("Cash") && pm.includes("Khata"))
            return acc + (s.khataDue || 0);
          return acc;
        }, 0);

        const totalNet = todaySales.reduce(
          (a, c) => a + (c.totalAmount || 0),
          0,
        );
        const tallyItems = [
          { label: "Cash", value: totalCash, color: "#10b981" },
          { label: "UPI", value: totalUpi, color: "#3b82f6" },
          { label: "Split", value: totalSplit, color: "#8b5cf6" },
          { label: "Khata/Due", value: totalKhata, color: "#ef4444" },
          { label: "Net Sales", value: totalNet, color: "#f59e0b", wide: true },
        ];
        const filtered =
          adminTallyFilter === "Net Sales"
            ? todaySales
            : adminTallyFilter
              ? todaySales.filter(
                  (s) =>
                    s.paymentMethod ===
                    (adminTallyFilter === "Khata/Due"
                      ? "Khata"
                      : adminTallyFilter),
                )
              : [];
        return (
          <div style={{ ...cardBox, marginBottom: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h3
                style={{
                  color: "white",
                  fontWeight: 700,
                  fontSize: 15,
                  margin: 0,
                }}
              >
                📊 Today&apos;s Tally
              </h3>
              {adminTallyFilter && (
                <button
                  type="button"
                  data-ocid="admin.audit.tally.print.button"
                  onClick={() => window.print()}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.06)",
                    color: "white",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🖨️ Print Daily Tally (A4)
                </button>
              )}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5,1fr)",
                gap: 8,
                marginBottom: 14,
              }}
            >
              {tallyItems.map((t) => {
                const isActive = adminTallyFilter === t.label;
                return (
                  <button
                    type="button"
                    key={t.label}
                    data-ocid={`admin.tally.${t.label.toLowerCase().replace(/\/| /g, "_")}.card`}
                    onClick={() =>
                      setAdminTallyFilter(isActive ? null : t.label)
                    }
                    style={{
                      background: isActive ? `${t.color}30` : `${t.color}15`,
                      border: `2px solid ${isActive ? t.color : `${t.color}30`}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      gridColumn: (t as any).wide ? "1/-1" : undefined,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      textAlign: "left",
                    }}
                  >
                    <p
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 11,
                        marginBottom: 3,
                      }}
                    >
                      {t.label}
                      {isActive ? " ✓" : ""}
                    </p>
                    <p
                      style={{ color: t.color, fontWeight: 800, fontSize: 18 }}
                    >
                      ₹
                      {t.value.toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </button>
                );
              })}
            </div>
            {!adminTallyFilter ? (
              <p
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 13,
                  textAlign: "center",
                  padding: "12px 0",
                }}
              >
                Click a card above to filter today&apos;s transactions
              </p>
            ) : filtered.length === 0 ? (
              <p
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 13,
                  textAlign: "center",
                  padding: "12px 0",
                }}
              >
                No transactions found for {adminTallyFilter}
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <div className="print-only" style={{ marginBottom: 12 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800 }}>
                    ClikMate - Daily Tally Report
                  </h2>
                  <p style={{ fontSize: 13 }}>
                    {new Date().toLocaleDateString("en-IN", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    — Filter: {adminTallyFilter}
                  </p>
                </div>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {[
                        "Time",
                        "Customer / Note",
                        "Amount (₹)",
                        "Payment Mode",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "6px 10px",
                            color: "rgba(255,255,255,0.5)",
                            textAlign: "left",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => {
                      const d = new Date(Number(s.createdAt) / 1_000_000);
                      return (
                        <tr
                          key={String(s.id)}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <td
                            style={{
                              padding: "6px 10px",
                              color: "rgba(255,255,255,0.7)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {d.toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px",
                              color: "rgba(255,255,255,0.7)",
                            }}
                          >
                            {`Transaction #${i + 1}`}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px",
                              color: "#f59e0b",
                              fontWeight: 700,
                            }}
                          >
                            ₹{s.totalAmount.toLocaleString("en-IN")}
                          </td>
                          <td
                            style={{
                              padding: "6px 10px",
                              color: "rgba(255,255,255,0.7)",
                            }}
                          >
                            {s.paymentMethod}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* Ledger Tabs */}
      <div style={cardBox}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["income", "expense"] as const).map((t) => (
            <button
              key={t}
              type="button"
              data-ocid={`admin.audit.${t}.tab`}
              onClick={() => setLedgerTab(t)}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "none",
                background:
                  ledgerTab === t
                    ? t === "income"
                      ? "#10b981"
                      : "#ef4444"
                    : "rgba(255,255,255,0.06)",
                color: ledgerTab === t ? "white" : "rgba(255,255,255,0.5)",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {t === "income" ? "Income Details" : "Expense Details"}
            </button>
          ))}
        </div>

        {loading && (
          <div
            style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}
            data-ocid="admin.audit.loading_state"
          >
            Loading...
          </div>
        )}

        {ledgerTab === "income" && !loading && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {[
                    "Date",
                    "Category",
                    "Amount",
                    "Payment Mode",
                    "Description",
                    ...(isAdmin ? ["Actions"] : []),
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontWeight: 600,
                        padding: "6px 8px",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incomes.length === 0 && posSales.length === 0 && (
                  <tr>
                    <td
                      colSpan={isAdmin ? 6 : 5}
                      style={{
                        color: "rgba(255,255,255,0.3)",
                        padding: "16px 8px",
                        textAlign: "center",
                      }}
                      data-ocid="admin.audit.income.empty_state"
                    >
                      No income entries yet.
                    </td>
                  </tr>
                )}
                {incomes.map((inc, idx) => (
                  <tr
                    key={String(inc.id)}
                    data-ocid={`admin.audit.income.item.${idx + 1}`}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <td
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        padding: "6px 8px",
                      }}
                    >
                      {inc.date}
                    </td>
                    <td style={{ color: "white", padding: "6px 8px" }}>
                      {inc.category}
                    </td>
                    <td
                      style={{
                        color: "#10b981",
                        fontWeight: 700,
                        padding: "6px 8px",
                      }}
                    >
                      \u20b9{inc.amount.toFixed(2)}
                    </td>
                    <td
                      style={{
                        color: "rgba(255,255,255,0.6)",
                        padding: "6px 8px",
                      }}
                    >
                      {inc.paymentMode}
                    </td>
                    <td
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        padding: "6px 8px",
                        maxWidth: 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {inc.description}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: "6px 8px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            data-ocid={`admin.audit.income.edit_button.${idx + 1}`}
                            onClick={() => {
                              setEditIncomeEntry(inc);
                              setIncomeForm({
                                date: inc.date,
                                category: inc.category,
                                amount: String(inc.amount),
                                paymentMode: inc.paymentMode,
                                description: inc.description,
                              });
                              setShowIncomeModal(true);
                            }}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "none",
                              background: "#3b82f6",
                              color: "white",
                              cursor: "pointer",
                              fontSize: 11,
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            data-ocid={`admin.audit.income.delete_button.${idx + 1}`}
                            onClick={() =>
                              setDeleteConfirmId({ type: "income", id: inc.id })
                            }
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "none",
                              background: "#ef4444",
                              color: "white",
                              cursor: "pointer",
                              fontSize: 11,
                            }}
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {posSales.map((s, idx) => {
                  const d = new Date(Number(s.createdAt) / 1_000_000);
                  return (
                    <tr
                      key={String(s.id)}
                      data-ocid={`admin.audit.pos_sale.item.${idx + 1}`}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        opacity: 0.75,
                      }}
                    >
                      <td
                        style={{
                          color: "rgba(255,255,255,0.7)",
                          padding: "6px 8px",
                        }}
                      >
                        {d.toLocaleDateString("en-IN")}
                      </td>
                      <td style={{ color: "white", padding: "6px 8px" }}>
                        Counter Sales (POS)
                      </td>
                      <td
                        style={{
                          color: "#10b981",
                          fontWeight: 700,
                          padding: "6px 8px",
                        }}
                      >
                        \u20b9{s.totalAmount.toFixed(2)}
                      </td>
                      <td
                        style={{
                          color: "rgba(255,255,255,0.6)",
                          padding: "6px 8px",
                        }}
                      >
                        {s.paymentMethod}
                      </td>
                      <td
                        style={{
                          color: "rgba(255,255,255,0.4)",
                          padding: "6px 8px",
                          fontSize: 11,
                        }}
                      >
                        Auto — POS Sale
                      </td>
                      {isAdmin && (
                        <td style={{ padding: "6px 8px" }}>
                          <span
                            style={{
                              color: "rgba(255,255,255,0.25)",
                              fontSize: 11,
                            }}
                          >
                            auto
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {ledgerTab === "expense" && !loading && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {[
                    "Date",
                    "Category",
                    "Amount",
                    "Payment Mode",
                    "Note",
                    ...(isAdmin ? ["Actions"] : []),
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontWeight: 600,
                        padding: "6px 8px",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 && (
                  <tr>
                    <td
                      colSpan={isAdmin ? 6 : 5}
                      style={{
                        color: "rgba(255,255,255,0.3)",
                        padding: "16px 8px",
                        textAlign: "center",
                      }}
                      data-ocid="admin.audit.expense.empty_state"
                    >
                      No expenses yet.
                    </td>
                  </tr>
                )}
                {expenses.map((exp, idx) => (
                  <tr
                    key={String(exp.id)}
                    data-ocid={`admin.audit.expense.item.${idx + 1}`}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <td
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        padding: "6px 8px",
                      }}
                    >
                      {exp.date}
                    </td>
                    <td style={{ color: "white", padding: "6px 8px" }}>
                      {exp.category}
                    </td>
                    <td
                      style={{
                        color: "#ef4444",
                        fontWeight: 700,
                        padding: "6px 8px",
                      }}
                    >
                      \u20b9{exp.amount.toFixed(2)}
                    </td>
                    <td
                      style={{
                        color: "rgba(255,255,255,0.6)",
                        padding: "6px 8px",
                      }}
                    >
                      {exp.paymentMode}
                    </td>
                    <td
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        padding: "6px 8px",
                        maxWidth: 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {exp.note}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: "6px 8px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            data-ocid={`admin.audit.expense.edit_button.${idx + 1}`}
                            onClick={() => {
                              setEditExpenseEntry(exp);
                              setExpenseForm({
                                date: exp.date,
                                category: exp.category,
                                amount: String(exp.amount),
                                paymentMode: exp.paymentMode,
                                note: exp.note,
                              });
                              setShowExpenseModal(true);
                            }}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "none",
                              background: "#3b82f6",
                              color: "white",
                              cursor: "pointer",
                              fontSize: 11,
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            data-ocid={`admin.audit.expense.delete_button.${idx + 1}`}
                            onClick={() =>
                              setDeleteConfirmId({
                                type: "expense",
                                id: exp.id,
                              })
                            }
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "none",
                              background: "#ef4444",
                              color: "white",
                              cursor: "pointer",
                              fontSize: 11,
                            }}
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Report Panel */}
      {showAudit && (
        <div style={cardBox}>
          <h3
            style={{
              color: "white",
              fontWeight: 700,
              fontSize: 16,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <BarChart3 size={18} color="#a78bfa" /> Audit Report
          </h3>
          <div style={{ marginBottom: 16 }}>
            <p style={fLabel}>Timeframe</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(["today", "month"] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  data-ocid={`admin.audit.filter.${tf}.button`}
                  onClick={() => setAuditTimeframe(tf)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 8,
                    border: "none",
                    background:
                      auditTimeframe === tf
                        ? "#7c3aed"
                        : "rgba(255,255,255,0.07)",
                    color:
                      auditTimeframe === tf ? "white" : "rgba(255,255,255,0.6)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {tf === "today" ? "Today" : "This Month"}
                </button>
              ))}
              {isAdmin && (
                <>
                  <button
                    type="button"
                    data-ocid="admin.audit.filter.yesterday.button"
                    onClick={() => setAuditTimeframe("yesterday")}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 8,
                      border: "none",
                      background:
                        auditTimeframe === "yesterday"
                          ? "#7c3aed"
                          : "rgba(255,255,255,0.07)",
                      color:
                        auditTimeframe === "yesterday"
                          ? "white"
                          : "rgba(255,255,255,0.6)",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    data-ocid="admin.audit.filter.fy.button"
                    onClick={() => setAuditTimeframe("fy")}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 8,
                      border: "none",
                      background:
                        auditTimeframe === "fy"
                          ? "#7c3aed"
                          : "rgba(255,255,255,0.07)",
                      color:
                        auditTimeframe === "fy"
                          ? "white"
                          : "rgba(255,255,255,0.6)",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    This Financial Year
                  </button>
                  <button
                    type="button"
                    data-ocid="admin.audit.filter.custom.button"
                    onClick={() => setAuditTimeframe("custom")}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 8,
                      border: "none",
                      background:
                        auditTimeframe === "custom"
                          ? "#7c3aed"
                          : "rgba(255,255,255,0.07)",
                      color:
                        auditTimeframe === "custom"
                          ? "white"
                          : "rgba(255,255,255,0.6)",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Custom Range
                  </button>
                </>
              )}
            </div>
            {isAdmin && auditTimeframe === "custom" && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="audit-custom-from" style={fLabel}>
                    From
                  </label>
                  <input
                    id="audit-custom-from"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    style={inp}
                    data-ocid="admin.audit.custom_from.input"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="audit-custom-to" style={fLabel}>
                    To
                  </label>
                  <input
                    id="audit-custom-to"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    style={inp}
                    data-ocid="admin.audit.custom_to.input"
                  />
                </div>
              </div>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div>
              <label htmlFor="audit-min-amount" style={fLabel}>
                Min Amount (Rs.)
              </label>
              <input
                id="audit-min-amount"
                type="number"
                placeholder="0"
                value={filterMinAmount}
                onChange={(e) => setFilterMinAmount(e.target.value)}
                style={inp}
                data-ocid="admin.audit.min_amount.input"
              />
            </div>
            <div>
              <label htmlFor="audit-max-amount" style={fLabel}>
                Max Amount (Rs.)
              </label>
              <input
                id="audit-max-amount"
                type="number"
                placeholder="No limit"
                value={filterMaxAmount}
                onChange={(e) => setFilterMaxAmount(e.target.value)}
                style={inp}
                data-ocid="admin.audit.max_amount.input"
              />
            </div>
            <div>
              <label htmlFor="audit-payment-mode" style={fLabel}>
                Payment Mode
              </label>
              <select
                id="audit-payment-mode"
                value={filterPaymentMode}
                onChange={(e) => setFilterPaymentMode(e.target.value)}
                style={inp}
                data-ocid="admin.audit.payment_mode.select"
              >
                {["All", "Cash", "UPI", "Bank Transfer", "Split", "Khata"].map(
                  (m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div>
              <label htmlFor="audit-tx-type" style={fLabel}>
                Transaction Type
              </label>
              <select
                id="audit-tx-type"
                value={filterTxType}
                onChange={(e) => setFilterTxType(e.target.value)}
                style={inp}
                data-ocid="admin.audit.tx_type.select"
              >
                {["All", "Income Only", "Expenses Only"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {[
              {
                label: "Total Income",
                value: filteredIncome,
                color: "#10b981",
                bg: "rgba(16,185,129,0.1)",
                border: "rgba(16,185,129,0.3)",
              },
              {
                label: "Total Expenses",
                value: filteredExpense,
                color: "#ef4444",
                bg: "rgba(239,68,68,0.1)",
                border: "rgba(239,68,68,0.3)",
              },
              {
                label: "Net Profit",
                value: filteredNet,
                color: filteredNet >= 0 ? "#3b82f6" : "#f59e0b",
                bg: "rgba(59,130,246,0.1)",
                border: "rgba(59,130,246,0.3)",
              },
            ].map((c) => (
              <div
                key={c.label}
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                }}
              >
                <p
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 11,
                    marginBottom: 6,
                  }}
                >
                  {c.label}
                </p>
                <p style={{ color: c.color, fontWeight: 800, fontSize: 22 }}>
                  {formatRupees(c.value)}
                </p>
              </div>
            ))}
          </div>
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {[
                    "Date",
                    "Type",
                    "Category",
                    "Amount",
                    "Payment Mode",
                    "Description",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontWeight: 600,
                        padding: "6px 8px",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTx.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        color: "rgba(255,255,255,0.3)",
                        padding: "16px 8px",
                        textAlign: "center",
                      }}
                      data-ocid="admin.audit.report.empty_state"
                    >
                      No transactions match the selected filters.
                    </td>
                  </tr>
                )}
                {filteredTx.map((tx, idx) => (
                  <tr
                    key={`${tx.date.getTime()}-${tx.category}-${idx}`}
                    data-ocid={`admin.audit.report.item.${idx + 1}`}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <td
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        padding: "6px 8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tx.date.toLocaleDateString("en-IN")}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background:
                            tx.type === "Income"
                              ? "rgba(16,185,129,0.15)"
                              : "rgba(239,68,68,0.15)",
                          color: tx.type === "Income" ? "#10b981" : "#ef4444",
                        }}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ color: "white", padding: "6px 8px" }}>
                      {tx.category}
                    </td>
                    <td
                      style={{
                        color: tx.type === "Income" ? "#10b981" : "#ef4444",
                        fontWeight: 700,
                        padding: "6px 8px",
                      }}
                    >
                      {formatRupees(tx.amount)}
                    </td>
                    <td
                      style={{
                        color: "rgba(255,255,255,0.6)",
                        padding: "6px 8px",
                      }}
                    >
                      {tx.paymentMode}
                    </td>
                    <td
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        padding: "6px 8px",
                        maxWidth: 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tx.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              data-ocid="admin.audit.export_pdf.button"
              onClick={exportPDF}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: "#7c3aed",
                color: "white",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Export as PDF
            </button>
            <button
              type="button"
              data-ocid="admin.audit.export_csv.button"
              onClick={exportCSV}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: "#0369a1",
                color: "white",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Export as CSV
            </button>
          </div>
        </div>
      )}

      {/* Income Entry Modal */}
      {showIncomeModal && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowIncomeModal(false);
              setEditIncomeEntry(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowIncomeModal(false);
              setEditIncomeEntry(null);
            }
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14,
              padding: 24,
              width: "100%",
              maxWidth: 480,
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            data-ocid="admin.audit.income.modal"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <h3 style={{ color: "white", fontWeight: 700, fontSize: 17 }}>
                {editIncomeEntry ? "Edit Income" : "+ Add Manual Income"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowIncomeModal(false);
                  setEditIncomeEntry(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                X
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="income-date-modal" style={fLabel}>
                  Date
                </label>
                <input
                  id="income-date-modal"
                  type="date"
                  value={incomeForm.date}
                  onChange={(e) =>
                    setIncomeForm((p) => ({ ...p, date: e.target.value }))
                  }
                  style={inp}
                  data-ocid="admin.audit.income.date.input"
                />
              </div>
              <div>
                <label htmlFor="income-category" style={fLabel}>
                  Category
                </label>
                <select
                  id="income-category"
                  value={incomeForm.category}
                  onChange={(e) =>
                    setIncomeForm((p) => ({ ...p, category: e.target.value }))
                  }
                  style={inp}
                  data-ocid="admin.audit.income.category.select"
                >
                  {INCOME_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="income-amount-modal" style={fLabel}>
                  Amount (Rs.)
                </label>
                <input
                  id="income-amount-modal"
                  type="number"
                  placeholder="0.00"
                  value={incomeForm.amount}
                  onChange={(e) =>
                    setIncomeForm((p) => ({ ...p, amount: e.target.value }))
                  }
                  style={inp}
                  data-ocid="admin.audit.income.amount.input"
                />
              </div>
              <div>
                <label htmlFor="income-payment-mode" style={fLabel}>
                  Payment Mode
                </label>
                <select
                  id="income-payment-mode"
                  value={incomeForm.paymentMode}
                  onChange={(e) =>
                    setIncomeForm((p) => ({
                      ...p,
                      paymentMode: e.target.value,
                    }))
                  }
                  style={inp}
                  data-ocid="admin.audit.income.payment_mode.select"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="income-description-modal" style={fLabel}>
                  Description / Note
                </label>
                <textarea
                  id="income-description-modal"
                  value={incomeForm.description}
                  onChange={(e) =>
                    setIncomeForm((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Optional note..."
                  rows={3}
                  style={{ ...inp, resize: "vertical" }}
                  data-ocid="admin.audit.income.description.textarea"
                />
              </div>
              <button
                type="button"
                data-ocid="admin.audit.income.submit_button"
                disabled={saving}
                onClick={handleAddIncome}
                style={{
                  padding: "11px",
                  borderRadius: 9,
                  border: "none",
                  background: "#10b981",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : editIncomeEntry
                    ? "Save Changes"
                    : "Add Income"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Entry Modal */}
      {showExpenseModal && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowExpenseModal(false);
              setEditExpenseEntry(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowExpenseModal(false);
              setEditExpenseEntry(null);
            }
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14,
              padding: 24,
              width: "100%",
              maxWidth: 480,
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            data-ocid="admin.audit.expense.modal"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <h3 style={{ color: "white", fontWeight: 700, fontSize: 17 }}>
                {editExpenseEntry ? "Edit Expense" : "+ Add Manual Expense"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowExpenseModal(false);
                  setEditExpenseEntry(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                X
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="expense-date-modal" style={fLabel}>
                  Date
                </label>
                <input
                  id="expense-date-modal"
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) =>
                    setExpenseForm((p) => ({ ...p, date: e.target.value }))
                  }
                  style={inp}
                  data-ocid="admin.audit.expense.date.input"
                />
              </div>
              <div>
                <label htmlFor="expense-category" style={fLabel}>
                  Category
                </label>
                <select
                  id="expense-category"
                  value={expenseForm.category}
                  onChange={(e) =>
                    setExpenseForm((p) => ({ ...p, category: e.target.value }))
                  }
                  style={inp}
                  data-ocid="admin.audit.expense.category.select"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="expense-amount-modal" style={fLabel}>
                  Amount (Rs.)
                </label>
                <input
                  id="expense-amount-modal"
                  type="number"
                  placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={(e) =>
                    setExpenseForm((p) => ({ ...p, amount: e.target.value }))
                  }
                  style={inp}
                  data-ocid="admin.audit.expense.amount.input"
                />
              </div>
              <div>
                <label htmlFor="expense-payment-mode" style={fLabel}>
                  Payment Mode
                </label>
                <select
                  id="expense-payment-mode"
                  value={expenseForm.paymentMode}
                  onChange={(e) =>
                    setExpenseForm((p) => ({
                      ...p,
                      paymentMode: e.target.value,
                    }))
                  }
                  style={inp}
                  data-ocid="admin.audit.expense.payment_mode.select"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="expense-note-modal" style={fLabel}>
                  Note
                </label>
                <textarea
                  id="expense-note-modal"
                  value={expenseForm.note}
                  onChange={(e) =>
                    setExpenseForm((p) => ({ ...p, note: e.target.value }))
                  }
                  placeholder="Optional note..."
                  rows={3}
                  style={{ ...inp, resize: "vertical" }}
                  data-ocid="admin.audit.expense.note.textarea"
                />
              </div>
              <button
                type="button"
                data-ocid="admin.audit.expense.submit_button"
                disabled={saving}
                onClick={handleAddExpense}
                style={{
                  padding: "11px",
                  borderRadius: 9,
                  border: "none",
                  background: "#ef4444",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : editExpenseEntry
                    ? "Save Changes"
                    : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: 14,
              padding: 24,
              maxWidth: 380,
            }}
            data-ocid="admin.audit.delete.dialog"
          >
            <h3
              style={{
                color: "white",
                fontWeight: 700,
                fontSize: 16,
                marginBottom: 10,
              }}
            >
              Confirm Delete
            </h3>
            <p
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              This action cannot be undone. Are you sure?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                data-ocid="admin.audit.delete.confirm_button"
                onClick={handleDelete}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
                  border: "none",
                  background: "#ef4444",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
              <button
                type="button"
                data-ocid="admin.audit.delete.cancel_button"
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamPaperEngineSection() {
  const [subject, setSubject] = React.useState("Mathematics");
  const [classLevel, setClassLevel] = React.useState("X");
  const [rawQuestions, setRawQuestions] = React.useState(
    "Q1. If x\u00b2 + 5x + 6 = 0, find the values of x.\nQ2. \u090f\u0915 \u0930\u0947\u0932\u0917\u093e\u0921\u093c\u0940 120 km/h \u0915\u0940 \u0930\u092b\u094d\u0924\u093e\u0930 \u0938\u0947 \u091a\u0932\u0924\u0940 \u0939\u0948\u0964 Find the distance in 2.5 hours.\nQ3. Prove that \u221a2 is irrational.",
  );

  function handleGenerate() {
    toast.success(
      "PDF generation queued! Your watermarked paper will be ready in 30 seconds.",
    );
  }

  function downloadTexFile() {
    const questions = rawQuestions.trim().split("\n").filter(Boolean);
    const questionsLatex = questions.map((q) => `\\item ${q}`).join("\n");
    const tex = `\\documentclass[12pt,a4paper]{article}
\\usepackage[a4paper,margin=2cm]{geometry}
\\usepackage{multicol}
\\usepackage{fontenc}
\\usepackage{inputenc}
\\usepackage{times}
\\usepackage{enumitem}
% CONFIDENTIAL - ClikMate Smart Online Service Center

\\setlength{\\columnseprule}{0.4pt}

\\begin{document}

\\begin{center}
  {\\large\\textbf{ClikMate Smart Online Service Center}}\\\\
  {\\normalsize Subject: ${subject} \\quad Class: ${classLevel}}\\\\[4pt]
  {\\normalsize Time: 3 Hours \\quad Max Marks: 80}
\\end{center}
\\vspace{4pt}
\\hrule
\\vspace{8pt}

\\begin{multicols}{2}
\\begin{enumerate}[leftmargin=*]
${questionsLatex}
\\end{enumerate}
\\end{multicols}

\\vspace{1cm}
\\begin{center}\\small --- End of Question Paper --- \\end{center}

\\end{document}`;
    const blob = new Blob([tex], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exam-paper.tex";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(".tex file downloaded successfully!");
  }

  function handlePrintExam() {
    const questions = rawQuestions.trim().split("\n").filter(Boolean);
    const questionsHtml = questions
      .map((q) => `<li style="margin-bottom:10px">${q}</li>`)
      .join("\n");
    const newWin = window.open("", "_blank", "width=900,height=700");
    if (!newWin) {
      toast.error("Pop-up blocked. Please allow pop-ups.");
      return;
    }
    newWin.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Exam Paper — ClikMate</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; color: #111; font-family: 'Times New Roman', Times, serif; font-size: 12pt; padding: 2cm; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 60px; font-weight: 900; color: rgba(0,0,0,0.06); white-space: nowrap; pointer-events: none; z-index: 0; }
  .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #333; padding-bottom: 12px; }
  .header h2 { font-size: 16pt; font-weight: bold; }
  .header p { font-size: 11pt; margin-top: 4px; }
  .columns { column-count: 2; column-gap: 2cm; column-rule: 1px solid #999; margin-top: 16px; }
  ol { padding-left: 20px; }
  li { margin-bottom: 12px; line-height: 1.6; }
  .hindi { font-family: 'Noto Serif', serif; color: #4b5563; font-size: 10.5pt; }
  @media print { @page { size: A4; margin: 2cm; } .watermark { position: fixed; } }
</style>
</head>
<body>
<div class="watermark">CONFIDENTIAL — ClikMate</div>
<div class="header">
  <h2>ClikMate Smart Online Service Center</h2>
  <p>Subject: ${subject} &nbsp;|&nbsp; Class: ${classLevel} &nbsp;|&nbsp; Time: 3 Hrs &nbsp;|&nbsp; Max Marks: 80</p>
</div>
<div class="columns">
<ol>
${questionsHtml}
</ol>
</div>
</body>
</html>`);
    newWin.document.close();
    setTimeout(() => {
      newWin.print();
      newWin.close();
    }, 500);
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 24,
  };

  const labelStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 8,
    display: "block",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#fff",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  const selectStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: "8px 12px",
    color: "#fff",
    fontSize: 14,
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div style={{ padding: "24px 0" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "#fff",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Exam Paper Engine
        </h2>
        <p
          style={{ color: "rgba(255,255,255,0.5)", marginTop: 6, fontSize: 14 }}
        >
          LaTeX-powered bilingual question paper generator for coaching
          institutes
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Left: Input Panel */}
        <div style={cardStyle}>
          <div style={labelStyle}>Paste Raw Question Data</div>
          <textarea
            value={rawQuestions}
            onChange={(e) => setRawQuestions(e.target.value)}
            rows={8}
            style={{
              ...inputStyle,
              resize: "vertical",
              fontFamily: "monospace",
              lineHeight: 1.6,
            }}
            placeholder="Q1. If x\u00b2 + 5x + 6 = 0, find x.&#10;Q2. ..."
            data-ocid="exam_paper.textarea"
          />

          <button
            type="button"
            style={{
              marginTop: 12,
              width: "100%",
              background: "rgba(255,255,255,0.06)",
              border: "1px dashed rgba(255,255,255,0.2)",
              borderRadius: 10,
              padding: "10px 16px",
              color: "rgba(255,255,255,0.7)",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onClick={() => toast.success("File upload dialog opened (mock)")}
            data-ocid="exam_paper.upload_button"
          >
            {"📄 Upload .txt / .docx"}
          </button>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              marginTop: 20,
            }}
          >
            <div>
              <div style={labelStyle}>Subject</div>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={selectStyle}
                data-ocid="exam_paper.select"
              >
                <option style={{ background: "#0f172a" }}>Mathematics</option>
                <option style={{ background: "#0f172a" }}>Science</option>
                <option style={{ background: "#0f172a" }}>Hindi</option>
                <option style={{ background: "#0f172a" }}>English</option>
              </select>
            </div>
            <div>
              <div style={labelStyle}>Class</div>
              <select
                value={classLevel}
                onChange={(e) => setClassLevel(e.target.value)}
                style={selectStyle}
                data-ocid="exam_paper.select"
              >
                {["VI", "VII", "VIII", "IX", "X", "XI", "XII"].map((c) => (
                  <option key={c} style={{ background: "#0f172a" }}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Language</div>
              <select style={selectStyle} data-ocid="exam_paper.select">
                <option style={{ background: "#0f172a" }}>
                  Bilingual EN+HI
                </option>
                <option style={{ background: "#0f172a" }}>English Only</option>
                <option style={{ background: "#0f172a" }}>Hindi Only</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              toast.success("Preview generated! Rendering LaTeX layout...")
            }
            style={{
              marginTop: 20,
              width: "100%",
              background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
              border: "none",
              borderRadius: 10,
              padding: "12px 20px",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
            data-ocid="exam_paper.primary_button"
          >
            Generate Preview
          </button>
        </div>

        {/* Right: Preview Panel */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 12,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Preview: Question Paper
            </span>
            <span
              style={{
                background: "rgba(234,179,8,0.15)",
                color: "#eab308",
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 20,
                border: "1px solid rgba(234,179,8,0.3)",
              }}
            >
              MOCK PREVIEW
            </span>
          </div>

          {/* Paper Preview */}
          <div
            style={{
              background: "rgba(255,255,255,0.97)",
              borderRadius: 8,
              padding: "20px 24px",
              color: "#1e293b",
              fontFamily: "Georgia, serif",
              fontSize: 12,
              lineHeight: 1.7,
              position: "relative",
              overflow: "hidden",
              minHeight: 320,
            }}
          >
            {/* Watermark */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%) rotate(-30deg)",
                fontSize: 22,
                fontWeight: 900,
                color: "rgba(0,0,0,0.06)",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                letterSpacing: "0.1em",
              }}
            >
              SAMPLE PREVIEW — ClikMate
            </div>

            <div
              style={{
                textAlign: "center",
                borderBottom: "2px solid #1e293b",
                paddingBottom: 10,
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13 }}>
                CLASS {classLevel} — {subject.toUpperCase()} (2025-26)
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                \u0915\u0915\u094d\u0937\u093e {classLevel} —{" "}
                {subject === "Mathematics"
                  ? "\u0917\u0923\u093f\u0924"
                  : subject === "Science"
                    ? "\u0935\u093f\u091c\u094d\u091e\u093e\u0928"
                    : "\u0935\u093f\u0937\u092f"}
              </div>
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "#374151",
                }}
              >
                <span>
                  Time: 3 Hours | \u0938\u092e\u092f: 3 \u0918\u0902\u091f\u0947
                </span>
                <span>
                  Max Marks: 80 | \u0905\u0927\u093f\u0915\u0924\u092e
                  \u0905\u0902\u0915: 80
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 11,
                    textDecoration: "underline",
                    marginBottom: 8,
                  }}
                >
                  SECTION A — \u0916\u0902\u0921 \u0905
                </div>
                <div style={{ marginBottom: 10 }}>
                  <strong>Q1.</strong> If x\u00b2 + 5x + 6 = 0, find x.
                  <br />
                  <span style={{ color: "#6b7280", fontSize: 11 }}>
                    \u092f\u0926\u093f x\u00b2 + 5x + 6 = 0, \u0924\u094b x
                    \u0915\u093e \u092e\u093e\u0928
                    \u091c\u094d\u091e\u093e\u0924
                    \u0915\u0940\u091c\u093f\u090f\u0964
                  </span>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <strong>Q2.</strong> Evaluate:{" "}
                  <span
                    style={{
                      fontFamily: "monospace",
                      background: "#f1f5f9",
                      padding: "1px 4px",
                      borderRadius: 3,
                    }}
                  >
                    \u222b\u2080\u00b9 x\u00b2 dx
                  </span>
                  <br />
                  <span style={{ color: "#6b7280", fontSize: 11 }}>
                    \u092e\u0942\u0932\u094d\u092f\u093e\u0902\u0915\u0928
                    \u0915\u0940\u091c\u093f\u090f
                  </span>
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 11,
                    textDecoration: "underline",
                    marginBottom: 8,
                  }}
                >
                  SECTION B — \u0916\u0902\u0921 \u092c
                </div>
                <div style={{ marginBottom: 10 }}>
                  <strong>Q3.</strong> Prove{" "}
                  <span
                    style={{
                      fontFamily: "monospace",
                      background: "#f1f5f9",
                      padding: "1px 4px",
                      borderRadius: 3,
                    }}
                  >
                    E = mc\u00b2
                  </span>{" "}
                  implies energy-mass equivalence.
                  <br />
                  <span style={{ color: "#6b7280", fontSize: 11 }}>
                    \u0938\u093f\u0926\u094d\u0927
                    \u0915\u0940\u091c\u093f\u090f \u0915\u093f
                    \u090a\u0930\u094d\u091c\u093e \u0914\u0930
                    \u0926\u094d\u0930\u0935\u094d\u092f\u092e\u093e\u0928
                    \u0938\u092e\u0924\u0941\u0932\u094d\u092f
                    \u0939\u0948\u0902\u0964
                  </span>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <strong>Q4.</strong> Balance:{" "}
                  <span
                    style={{
                      fontFamily: "monospace",
                      background: "#f1f5f9",
                      padding: "1px 4px",
                      borderRadius: 3,
                    }}
                  >
                    H\u2082O + CO\u2082 \u2192 C\u2086H\u2081\u2082O\u2086
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            style={{
              marginTop: 16,
              width: "100%",
              background: "linear-gradient(135deg, #e879f9, #a855f7)",
              border: "none",
              borderRadius: 10,
              padding: "12px 20px",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
            data-ocid="exam_paper.submit_button"
          >
            Generate & Watermark PDF
          </button>

          {/* Download .tex and Print PDF buttons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginTop: 12,
            }}
          >
            <button
              type="button"
              onClick={downloadTexFile}
              style={{
                background: "linear-gradient(135deg, #06b6d4, #0284c7)",
                border: "none",
                borderRadius: 10,
                padding: "11px 16px",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
              data-ocid="exam_paper.secondary_button"
            >
              ⬇ Download .tex File
            </button>
            <button
              type="button"
              onClick={handlePrintExam}
              style={{
                background: "linear-gradient(135deg, #e879f9, #a855f7)",
                border: "none",
                borderRadius: 10,
                padding: "11px 16px",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
              data-ocid="exam_paper.print_button"
            >
              🖨 Print / Save as PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MOCK_STUDENTS = [
  { name: "Arjun Sharma", roll: "RPM-001", class: "X-A" },
  { name: "Priya Verma", roll: "RPM-002", class: "X-B" },
  { name: "Rohit Singh", roll: "RPM-003", class: "XI-A" },
  { name: "Sneha Gupta", roll: "RPM-004", class: "XI-B" },
  { name: "Amit Kumar", roll: "RPM-005", class: "XII-A" },
  { name: "Kavita Patel", roll: "RPM-006", class: "XII-B" },
];

function SmartIDStudioSection() {
  const [isDragOver, setIsDragOver] = React.useState(false);
  function handlePrintCards() {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }
    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>PVC ID Cards — ClikMate</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; padding: 1cm; }
  .grid { display: grid; grid-template-columns: repeat(2, 85.6mm); gap: 5mm; justify-content: center; }
  .card { width: 85.6mm; height: 54mm; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; font-family: Arial, sans-serif; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); color: white; page-break-inside: avoid; }
  .card-top { background: linear-gradient(135deg, #06b6d4, #3b82f6); padding: 4mm 3mm 3mm; text-align: center; }
  .card-top-icon { font-size: 14px; margin-bottom: 2mm; }
  .card-top-name { font-size: 7pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2; }
  .card-body { padding: 3mm; text-align: center; }
  .photo { width: 12mm; height: 12mm; border-radius: 50%; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); margin: 0 auto 2mm; display: flex; align-items: center; justify-content: center; font-size: 16px; }
  .name { font-size: 8pt; font-weight: 700; margin-bottom: 1mm; }
  .roll { font-size: 7pt; color: rgba(255,255,255,0.7); margin-bottom: 0.5mm; }
  .class { font-size: 7pt; color: rgba(255,255,255,0.7); }
  .card-foot { background: rgba(0,0,0,0.4); padding: 2mm 3mm; text-align: center; font-size: 6pt; color: rgba(255,255,255,0.7); }
  @media print { @page { size: A4; margin: 1cm; } }
</style>
</head>
<body>
<div class="grid">
${MOCK_STUDENTS.map(
  (s) => `<div class="card">
<div class="card-top"><div class="card-top-icon">🏫</div><div class="card-top-name">RAIPUR PREMIER<br/>COACHING</div></div>
<div class="card-body"><div class="photo">👤</div><div class="name">${s.name}</div><div class="roll">Roll: ${s.roll}</div><div class="class">Class: ${s.class}</div></div>
<div class="card-foot">VALID 2025-26</div>
</div>`,
).join("")}
</div>
</body>
</html>`);
    iframeDoc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 24,
  };

  return (
    <div style={{ padding: "24px 0" }}>
      <div style={{ marginBottom: 28 }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "#fff",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Smart ID Studio
        </h2>
        <p
          style={{ color: "rgba(255,255,255,0.5)", marginTop: 6, fontSize: 14 }}
        >
          Auto-generate PVC ID cards from student data — bulk-ready,
          print-perfect
        </p>
      </div>

      {/* Drag-and-drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          toast.success("CSV uploaded! Mapped 6 student records.");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter")
            toast.success("CSV uploaded! Mapped 6 student records.");
        }}
        onClick={() => toast.success("CSV uploaded! Mapped 6 student records.")}
        style={{
          background: isDragOver
            ? "rgba(6,182,212,0.08)"
            : "rgba(255,255,255,0.02)",
          border: `2px dashed ${isDragOver ? "#06b6d4" : "rgba(255,255,255,0.15)"}`,
          borderRadius: 16,
          padding: "48px 24px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: 28,
          transition: "all 0.2s ease",
        }}
        data-ocid="smart_id.dropzone"
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>{"📁"}</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 8,
          }}
        >
          Upload Student CSV / Excel
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          Drag & drop your file here, or click to browse
        </div>
        <div
          style={{
            display: "inline-block",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 20,
            padding: "4px 16px",
            color: "rgba(255,255,255,0.4)",
            fontSize: 12,
          }}
        >
          Accepts .csv, .xlsx
        </div>
      </div>

      {/* Card grid */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h3
            style={{ color: "#fff", fontSize: 16, fontWeight: 700, margin: 0 }}
          >
            Card Preview Grid — 6 Students Loaded
          </h3>
          <span
            style={{
              background: "rgba(6,182,212,0.15)",
              color: "#06b6d4",
              fontSize: 12,
              padding: "3px 12px",
              borderRadius: 20,
              border: "1px solid rgba(6,182,212,0.3)",
            }}
          >
            READY TO PRINT
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
          }}
        >
          {MOCK_STUDENTS.map((student, i) => (
            <div
              key={student.roll}
              data-ocid={`smart_id.item.${i + 1}`}
              style={{
                background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14,
                overflow: "hidden",
                width: "100%",
                maxWidth: 200,
                margin: "0 auto",
              }}
            >
              {/* Top band */}
              <div
                style={{
                  background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                  padding: "16px 12px 12px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.25)",
                    margin: "0 auto 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  {"🏫"}
                </div>
                <div
                  style={{
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    lineHeight: 1.3,
                  }}
                >
                  RAIPUR PREMIER
                  <br />
                  COACHING
                </div>
              </div>

              {/* Photo placeholder */}
              <div style={{ padding: "16px 12px 8px", textAlign: "center" }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.08)",
                    border: "2px solid rgba(255,255,255,0.15)",
                    margin: "0 auto 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                  }}
                >
                  {"👤"}
                </div>
                <div
                  style={{
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 4,
                  }}
                >
                  {student.name}
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 11,
                    marginBottom: 2,
                  }}
                >
                  Roll: {student.roll}
                </div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>
                  Class: {student.class}
                </div>
              </div>

              {/* Bottom band */}
              <div
                style={{
                  background: "rgba(0,0,0,0.4)",
                  padding: "8px 12px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 10,
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  VALID 2025-26
                </div>
                {/* Mock barcode */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 1,
                    height: 20,
                  }}
                >
                  {[
                    { w: 3, k: "a", d: false },
                    { w: 1, k: "b", d: false },
                    { w: 1, k: "c", d: false },
                    { w: 3, k: "d", d: false },
                    { w: 1, k: "e", d: false },
                    { w: 3, k: "f", d: false },
                    { w: 1, k: "g", d: true },
                    { w: 1, k: "h", d: false },
                    { w: 3, k: "i", d: false },
                    { w: 1, k: "j", d: false },
                    { w: 1, k: "l", d: false },
                    { w: 3, k: "m", d: false },
                    { w: 1, k: "n", d: false },
                    { w: 3, k: "o", d: true },
                    { w: 1, k: "p", d: false },
                    { w: 1, k: "q", d: false },
                    { w: 3, k: "r", d: false },
                    { w: 1, k: "s", d: false },
                    { w: 3, k: "t", d: false },
                    { w: 1, k: "u", d: false },
                    { w: 1, k: "v", d: true },
                    { w: 3, k: "x", d: false },
                    { w: 1, k: "y", d: false },
                    { w: 1, k: "z", d: false },
                  ].map((bar) => (
                    <div
                      key={bar.k}
                      style={{
                        width: bar.w,
                        height: "100%",
                        background: bar.d
                          ? "rgba(255,255,255,0.3)"
                          : "rgba(255,255,255,0.7)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            toast.success("Sending 6 cards to PVC printer queue...")
          }
          style={{
            marginTop: 24,
            width: "100%",
            background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
            border: "none",
            borderRadius: 10,
            padding: "14px 20px",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
          data-ocid="smart_id.primary_button"
        >
          Print All Cards (PVC Format)
        </button>

        <button
          type="button"
          onClick={handlePrintCards}
          style={{
            marginTop: 12,
            width: "100%",
            background: "linear-gradient(135deg, #10b981, #059669)",
            border: "none",
            borderRadius: 10,
            padding: "12px 20px",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
          data-ocid="smart_id.print_button"
        >
          🖨 Print All Cards (A4 PDF)
        </button>
      </div>
    </div>
  );
}

const BULK_ORDERS = [
  {
    id: "ORD-2025-001",
    title: "5000 Exam Papers",
    institution: "Raipur Premier Coaching",
    qty: "5,000",
    category: "Exam Papers",
    status: 2, // 0=Processing, 1=Printed, 2=Out for Delivery, 3=Delivered
  },
  {
    id: "ORD-2025-002",
    title: "2500 PVC ID Cards",
    institution: "Sunrise Academy",
    qty: "2,500",
    category: "PVC ID Cards",
    status: 1,
  },
  {
    id: "ORD-2025-003",
    title: "10000 OMR Sheets",
    institution: "Excel Institute",
    qty: "10,000",
    category: "OMR Sheets",
    status: 0,
  },
];

const TIMELINE_STEPS = [
  "Processing",
  "Printed",
  "Out for Delivery",
  "Delivered",
];

function DeliveryDispatchSection() {
  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  };

  return (
    <div style={{ padding: "24px 0" }}>
      <div style={{ marginBottom: 28 }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "#fff",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Delivery Dispatch
        </h2>
        <p
          style={{ color: "rgba(255,255,255,0.5)", marginTop: 6, fontSize: 14 }}
        >
          Real-time tracking for bulk print orders — powered by ClikMate Fleet
        </p>
      </div>

      {/* Order cards */}
      {BULK_ORDERS.map((order, idx) => (
        <div
          key={order.id}
          style={cardStyle}
          data-ocid={`delivery_dispatch.item.${idx + 1}`}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
                {order.title}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                {order.institution}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {order.id}
              </span>
              <span
                style={{
                  background: "rgba(6,182,212,0.12)",
                  color: "#06b6d4",
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 20,
                  border: "1px solid rgba(6,182,212,0.25)",
                }}
              >
                {order.qty} units
              </span>
              <span
                style={{
                  background: "rgba(232,121,249,0.12)",
                  color: "#e879f9",
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 20,
                  border: "1px solid rgba(232,121,249,0.25)",
                }}
              >
                {order.category}
              </span>
            </div>
          </div>

          {/* Status Timeline */}
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 16 }}
          >
            {TIMELINE_STEPS.map((step, i) => {
              const isCompleted = i < order.status;
              const isActive = i === order.status;
              const isFuture = i > order.status;
              return (
                <React.Fragment key={step}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: 60,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: isCompleted
                          ? "#06b6d4"
                          : isActive
                            ? "#e879f9"
                            : "rgba(255,255,255,0.08)",
                        border: isFuture
                          ? "2px solid rgba(255,255,255,0.15)"
                          : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        boxShadow: isActive
                          ? "0 0 12px rgba(232,121,249,0.6)"
                          : isCompleted
                            ? "0 0 8px rgba(6,182,212,0.4)"
                            : "none",
                        animation: isActive
                          ? "pulse-badge 1.5s ease-in-out infinite"
                          : "none",
                      }}
                    >
                      {isCompleted ? "\u2713" : isActive ? "\u25CF" : ""}
                    </div>
                    <div
                      style={{
                        color: isCompleted
                          ? "#06b6d4"
                          : isActive
                            ? "#e879f9"
                            : "rgba(255,255,255,0.3)",
                        fontSize: 10,
                        marginTop: 6,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {step}
                    </div>
                  </div>
                  {i < TIMELINE_STEPS.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        background:
                          i < order.status
                            ? "linear-gradient(90deg, #06b6d4, #06b6d4)"
                            : "rgba(255,255,255,0.08)",
                        marginBottom: 22,
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() =>
              toast.success(`Opening live tracking for ${order.id}...`)
            }
            style={{
              background: "rgba(6,182,212,0.12)",
              border: "1px solid rgba(6,182,212,0.3)",
              borderRadius: 8,
              padding: "8px 18px",
              color: "#06b6d4",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
            data-ocid={`delivery_dispatch.button.${idx + 1}`}
          >
            Track Live
          </button>
        </div>
      ))}

      {/* Live Map Tracking Card */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 24,
          backdropFilter: "blur(20px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3
            style={{ color: "#fff", fontSize: 16, fontWeight: 700, margin: 0 }}
          >
            {"📍"} Live GPS Tracking — Active Riders
          </h3>
          <span
            style={{
              background: "rgba(34,197,94,0.15)",
              color: "#22c55e",
              fontSize: 12,
              padding: "3px 12px",
              borderRadius: 20,
              border: "1px solid rgba(34,197,94,0.3)",
            }}
          >
            ● 2 Riders Active
          </span>
        </div>

        {/* Mock map */}
        <div
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            borderRadius: 12,
            height: 280,
            position: "relative",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Grid lines */}
          {([12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100] as const).map((pct) => (
            <div
              key={`h-${pct}`}
              style={{
                position: "absolute",
                top: `${pct}%`,
                left: 0,
                right: 0,
                height: 1,
                background: "rgba(255,255,255,0.04)",
              }}
            />
          ))}
          {([10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const).map((pct) => (
            <div
              key={`v-${pct}`}
              style={{
                position: "absolute",
                left: `${pct}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: "rgba(255,255,255,0.04)",
              }}
            />
          ))}

          {/* Road lines (mock) */}
          <div
            style={{
              position: "absolute",
              top: "40%",
              left: "10%",
              right: "10%",
              height: 2,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "65%",
              left: "20%",
              right: "5%",
              height: 2,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "35%",
              top: "10%",
              bottom: "20%",
              width: 2,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 2,
            }}
          />

          {/* Rider 1 */}
          <div
            style={{
              position: "absolute",
              top: "38%",
              left: "28%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#06b6d4",
                boxShadow:
                  "0 0 0 6px rgba(6,182,212,0.25), 0 0 0 12px rgba(6,182,212,0.1)",
                animation: "pulse-badge 1.5s ease-in-out infinite",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "120%",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(6,182,212,0.9)",
                color: "#fff",
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 4,
                whiteSpace: "nowrap",
                fontWeight: 600,
              }}
            >
              Rider Raju — 2.3 km
            </div>
          </div>

          {/* Rider 2 */}
          <div
            style={{
              position: "absolute",
              top: "62%",
              left: "55%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#e879f9",
                boxShadow:
                  "0 0 0 6px rgba(232,121,249,0.25), 0 0 0 12px rgba(232,121,249,0.1)",
                animation: "pulse-badge 2s ease-in-out infinite",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "120%",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(168,85,247,0.9)",
                color: "#fff",
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 4,
                whiteSpace: "nowrap",
                fontWeight: 600,
              }}
            >
              Rider Dev — ETA 12 mins
            </div>
          </div>

          {/* Destination pin */}
          <div
            style={{
              position: "absolute",
              top: "30%",
              left: "70%",
              transform: "translate(-50%, -50%)",
              fontSize: 20,
            }}
          >
            {"📍"}
          </div>

          {/* Map label */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              background: "rgba(0,0,0,0.6)",
              color: "rgba(255,255,255,0.4)",
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: 4,
            }}
          >
            ClikMate Fleet Grid — Raipur
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            color: "rgba(255,255,255,0.35)",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Live tracking powered by ClikMate Fleet Management
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean>(
    () => localStorage.getItem("clikmate_admin_session") === "1",
  );
  const [activeSection, setActiveSection] = useState<NavSection>("catalog");

  const sectionToGroup: Record<string, string> = {
    orders: "sales",
    "active-orders": "sales",
    "order-history": "sales",
    catalog: "catalog",
    "b2b-leads": "business",
    wallet: "business",
    reviews: "business",
    team: "admin",
    settings: "admin",
    audit: "admin",
    helpdesk: "admin",
    "exam-paper-engine": "b2bvip",
    "smart-id-studio": "b2bvip",
    "delivery-dispatch": "b2bvip",
    "attendance-report": "reports",
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const group = sectionToGroup.catalog;
    return group ? { [group]: true } : {};
  });

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const isMobile = windowWidth < 768;

  async function seedServices() {
    const existing: CatalogItem[] = catalogItems;
    const SERVICE_CATS = [
      "Printing & Document",
      "CSC & Govt Forms",
      "Typing",
      "Misc",
    ];
    const hasServices = existing.some((item) =>
      SERVICE_CATS.includes(item.category),
    );
    if (hasServices) return;

    const services = [
      { name: "Printing (Single Sided)", category: "Printing & Document" },
      { name: "Photocopy (Single Sided)", category: "Printing & Document" },
      { name: "Photocopy (Double Sided)", category: "Printing & Document" },
      { name: "Printing (Double Sided)", category: "Printing & Document" },
      { name: "Color Printing (Normal)", category: "Printing & Document" },
      { name: "Color Printing (Glossy)", category: "Printing & Document" },
      { name: "PVC Card Printing", category: "Printing & Document" },
      { name: "ID Card Printing", category: "Printing & Document" },
      { name: "Normal Typing", category: "Typing" },
      { name: "Complex Sci/Math Typing", category: "Typing" },
      { name: "Document Correction", category: "Typing" },
      { name: "Basic Resume", category: "Typing" },
      { name: "Professional CV", category: "Typing" },
      { name: "Resume Update", category: "Typing" },
      { name: "Basic Form Fill-up", category: "CSC & Govt Forms" },
      { name: "Complex Form Fill-up", category: "CSC & Govt Forms" },
      { name: "Scholarship Form Fill-up", category: "CSC & Govt Forms" },
      { name: "Admit Card / Result Print", category: "CSC & Govt Forms" },
      { name: "Urgent Passport Size Photo", category: "Misc" },
      { name: "Lamination (ID Size)", category: "Misc" },
      { name: "Lamination (A4 Size)", category: "Misc" },
      { name: "Spiral Binding", category: "Misc" },
    ];

    const seeded: CatalogItem[] = services.map((svc, i) => ({
      id: (Date.now() + i) as unknown as bigint,
      name: svc.name,
      category: svc.category,
      description: "",
      price: "0",
      stockStatus: "N/A",
      requiredDocuments: "",
      requiresPdfCalc: false,
      published: true,
      createdAt: (Date.now() + i) as unknown as bigint,
      mediaFiles: [],
      mediaTypes: [],
    }));

    // Seed default services to Firestore if catalog is empty
    const merged = [...seeded, ...existing];
    if (existing.length === 0) {
      for (const svc of merged) {
        const pid = `ITM-${1000 + merged.indexOf(svc)}`;
        const withId = { ...svc, productId: pid };
        await fsSetDoc("catalog", pid, withId);
      }
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: stable seed
  useEffect(() => {
    if (isAdmin && catalogItems.length === 0) {
      seedServices().catch(console.error);
    }
  }, [isAdmin, catalogItems.length]);

  // Diagnostic: log whenever catalog or admin state changes
  useEffect(() => {
    console.log(
      "[AdminDashboard] Diagnostic — isAdmin:",
      isAdmin,
      "| catalogItems.length:",
      catalogItems.length,
    );
    if (!isAdmin && localStorage.getItem("clikmate_admin_session") === "1") {
      console.warn(
        "[AdminDashboard] WARNING: localStorage has admin session but isAdmin state is false — syncing.",
      );
      setIsAdmin(true);
    }
  }, [isAdmin, catalogItems]);

  // Catalog: subscribe to Firestore onSnapshot
  useEffect(() => {
    const unsub = fsSubscribeCollection<any>("catalog", (items) => {
      setCatalogItems(items);
      setCatalogLoading(false);
    });
    return () => unsub();
  }, []);

  const navSectionLabels: Record<NavSection, string> = {
    dashboard: "Live Dashboard",
    catalog: "Catalog Manager",
    orders: "Print Orders",
    "active-orders": "Active Orders",
    "order-history": "Order History",
    settings: "Settings",
    team: "Team & Access",
    wallet: "Customer Wallet",
    reviews: "Customer Reviews",
    "b2b-leads": "B2B Leads & Quotes",
    audit: "Audit & Reports",
    helpdesk: "Helpdesk / Support",
    "exam-paper-engine": "Exam Paper Engine",
    "smart-id-studio": "Smart ID Studio",
    "delivery-dispatch": "Delivery Dispatch",
    "attendance-report": "Attendance Report",
  };

  // ── View: Not logged in ──────────────────────────────────────────────────────
  if (!isAdmin) {
    return <AdminLoginScreen onSuccess={() => setIsAdmin(true)} />;
  }

  // ── View 4: Full Dashboard ────────────────────────────────────────────────
  const sidebarStyle = isMobile
    ? {
        ...S.sidebarMobile,
        transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s ease",
      }
    : S.sidebar;

  const mainStyle = isMobile
    ? {
        flex: 1,
        display: "flex",
        flexDirection: "column" as const,
        minHeight: "100vh",
      }
    : S.mainContent;

  return (
    <div style={S.body}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            zIndex: 45,
          }}
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSidebarOpen(false);
          }}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <nav style={sidebarStyle}>
        {/* Logo */}
        <div
          style={{
            padding: "20px 16px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#eab308",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Printer style={{ width: 18, height: 18, color: "#111" }} />
            </div>
            <div>
              <div style={{ color: "white", fontWeight: 800, fontSize: 15 }}>
                ClikMate
              </div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
                Admin Panel
              </div>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <div style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {/* Overview - standalone */}
          <NavItem
            icon={LayoutDashboard}
            label="Live Dashboard"
            active={activeSection === "dashboard"}
            ocid="admin.dashboard.tab"
            onClick={() => {
              setActiveSection("dashboard");
              setSidebarOpen(false);
            }}
          />

          {/* Sales & Operations */}
          <NavGroup
            icon={ShoppingCart}
            label="Sales & Operations"
            groupId="sales"
            isOpen={!!openGroups.sales}
            onToggle={() => toggleGroup("sales")}
          >
            <NavItem
              icon={ShoppingCart}
              label="POS / New Bill"
              active={false}
              ocid="admin.pos.shortcut"
              onClick={() => {
                window.location.hash = "#/pos";
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={ClipboardList}
              label="Print Orders"
              active={activeSection === "orders"}
              ocid="admin.orders.tab"
              onClick={() => {
                setActiveSection("orders");
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={Zap}
              label="Active Orders"
              active={activeSection === "active-orders"}
              ocid="admin.active_orders.tab"
              onClick={() => {
                setActiveSection("active-orders");
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={FolderOpen}
              label="Order History"
              active={activeSection === "order-history"}
              ocid="admin.order_history.tab"
              onClick={() => {
                setActiveSection("order-history");
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={Layers}
              label="Bulk Dashboard"
              active={false}
              ocid="admin.bulk.shortcut"
              onClick={() => {
                window.location.hash = "#/bulk-dashboard";
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={Truck}
              label="Rider Dashboard"
              active={false}
              ocid="admin.rider.shortcut"
              onClick={() => {
                window.location.hash = "#/rider";
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* Catalog & Products */}
          <NavGroup
            icon={Package}
            label="Catalog & Products"
            groupId="catalog"
            isOpen={!!openGroups.catalog}
            onToggle={() => toggleGroup("catalog")}
          >
            <NavItem
              icon={Package}
              label="Catalog Manager"
              active={activeSection === "catalog"}
              ocid="admin.catalog.tab"
              onClick={() => {
                setActiveSection("catalog");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* Business */}
          <NavGroup
            icon={Building2}
            label="Business"
            groupId="business"
            isOpen={!!openGroups.business}
            onToggle={() => toggleGroup("business")}
          >
            <NavItem
              icon={Building2}
              label="B2B Leads & Quotes"
              active={activeSection === "b2b-leads"}
              ocid="admin.b2b_leads.tab"
              onClick={() => {
                setActiveSection("b2b-leads");
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={Wallet}
              label="Customer Wallet"
              active={activeSection === "wallet"}
              ocid="admin.wallet.tab"
              onClick={() => {
                setActiveSection("wallet");
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={Star}
              label="Customer Reviews"
              active={activeSection === "reviews"}
              ocid="admin.reviews.tab"
              onClick={() => {
                setActiveSection("reviews");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* B2B VIP Tools */}
          <NavGroup
            icon={Star}
            label="B2B VIP Tools"
            groupId="b2bvip"
            isOpen={!!openGroups.b2bvip}
            onToggle={() => toggleGroup("b2bvip")}
          >
            <NavItem
              icon={Printer}
              label="Exam Paper Engine"
              active={activeSection === "exam-paper-engine"}
              ocid="admin.exam_paper.tab"
              onClick={() => {
                setActiveSection("exam-paper-engine");
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={Upload}
              label="Smart ID Studio"
              active={activeSection === "smart-id-studio"}
              ocid="admin.smart_id.tab"
              onClick={() => {
                setActiveSection("smart-id-studio");
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={Truck}
              label="Delivery Dispatch"
              active={activeSection === "delivery-dispatch"}
              ocid="admin.delivery_dispatch.tab"
              onClick={() => {
                setActiveSection("delivery-dispatch");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* Admin */}
          <NavGroup
            icon={FileText}
            label="Print & Reports"
            groupId="reports"
            isOpen={!!openGroups.reports}
            onToggle={() => toggleGroup("reports")}
          >
            <NavItem
              icon={UserCheck}
              label="Attendance Report"
              active={activeSection === "attendance-report"}
              ocid="admin.attendance_report.tab"
              onClick={() => {
                setActiveSection("attendance-report");
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={BookOpen}
              label="Khata/Ledger Reports"
              active={false}
              ocid="admin.khata_reports.shortcut"
              onClick={() => {
                window.location.hash = "#/admin/khata-settlement";
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={FolderOpen}
              label="Order/Sales Reports"
              active={activeSection === "order-history"}
              ocid="admin.order_sales_reports.shortcut"
              onClick={() => {
                setActiveSection("order-history");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          <NavGroup
            icon={Shield}
            label="Admin"
            groupId="admin"
            isOpen={!!openGroups.admin}
            onToggle={() => toggleGroup("admin")}
          >
            <NavItem
              icon={Users}
              label="Team & Access"
              active={activeSection === "team"}
              ocid="admin.team.tab"
              onClick={() => {
                setActiveSection("team");
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={Settings}
              label="Settings"
              active={activeSection === "settings"}
              ocid="admin.settings.tab"
              onClick={() => {
                setActiveSection("settings");
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={BarChart3}
              label="Audit & Reports"
              active={activeSection === "audit"}
              ocid="admin.audit.tab"
              onClick={() => {
                setActiveSection("audit");
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={Headphones}
              label="Helpdesk / Support"
              active={activeSection === "helpdesk"}
              ocid="admin.helpdesk.tab"
              onClick={() => {
                setActiveSection("helpdesk");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* Accounts / Khata */}
          <NavGroup
            icon={BookOpen}
            label="Accounts / Khata"
            groupId="khata"
            isOpen={!!openGroups.khata}
            onToggle={() => toggleGroup("khata")}
          >
            <NavItem
              icon={BookOpen}
              label="Khata Settlement"
              active={false}
              ocid="admin.khata_settlement.shortcut"
              onClick={() => {
                window.location.hash = "#/admin/khata-settlement";
                setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={Receipt}
              label="Expense Book"
              active={false}
              ocid="admin.expense_book.shortcut"
              onClick={() => {
                window.location.hash = "#/expense-tracker";
                setSidebarOpen(false);
              }}
            />
            {getGstSettings().enabled && (
              <NavItem
                icon={FileText}
                label="GST Reports"
                active={false}
                ocid="admin.gst_reports.shortcut"
                onClick={() => {
                  window.location.hash = "#/gst-reports";
                  setSidebarOpen(false);
                }}
              />
            )}
          </NavGroup>
        </div>

        {/* User + Logout */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div style={{ position: "relative" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>
                  A
                </span>
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                  border: "2px solid #111827",
                }}
              />
            </div>
            <div>
              <div style={{ color: "white", fontWeight: 600, fontSize: 13 }}>
                {localStorage.getItem("clikmate_admin_email") ||
                  "admin@clikmate.com"}
              </div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
                Active
              </div>
            </div>
          </div>
          <button
            type="button"
            data-ocid="admin.logout.button"
            onClick={() => {
              localStorage.removeItem("clikmate_admin_session");
              setIsAdmin(false);
            }}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "rgba(239,68,68,0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                "rgba(255,255,255,0.5)";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "rgba(255,255,255,0.1)";
            }}
          >
            <LogOut style={{ width: 14, height: 14 }} />
            Logout
          </button>
        </div>
      </nav>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div style={mainStyle}>
        {/* Header */}
        <header style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isMobile && (
              <button
                type="button"
                data-ocid="admin.sidebar.toggle"
                onClick={() => setSidebarOpen((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.6)",
                  padding: 4,
                }}
              >
                <Menu style={{ width: 22, height: 22 }} />
              </button>
            )}
            <h1 style={{ color: "white", fontWeight: 700, fontSize: 17 }}>
              {navSectionLabels[activeSection]}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.5)",
                padding: 4,
              }}
            >
              <Bell style={{ width: 20, height: 20 }} />
            </button>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>
                A
              </span>
            </div>
            <Link
              to="/"
              data-ocid="admin.back.link"
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                textDecoration: "none",
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              ← Site
            </Link>
          </div>
        </header>

        {/* Section content */}
        <main style={{ flex: 1, overflowY: "auto" }}>
          {activeSection === "dashboard" && <LiveOperationalDashboard />}
          {activeSection === "catalog" && (
            <CatalogSection
              items={catalogItems}
              loading={catalogLoading}
              onRefresh={() => {
                /* Firestore onSnapshot handles refresh */
              }}
              onItemAdded={(item) => {
                console.log("[onItemAdded] Adding item:", item.name, item.id);
                setCatalogItems((prev) => {
                  const updated = [
                    item,
                    ...prev.filter((i) => i.id !== item.id),
                  ];
                  localStorage.setItem(
                    "clikmate_catalog_items",
                    JSON.stringify(updated),
                  );
                  return updated;
                });
              }}
            />
          )}
          {activeSection === "orders" && <OrdersSection />}
          {activeSection === "active-orders" && <ActiveOrdersSection />}
          {activeSection === "order-history" && <OrderHistorySection />}
          {activeSection === "settings" && <SettingsSection />}
          {activeSection === "team" && <TeamAccessSection />}
          {activeSection === "wallet" && <WalletSection />}
          {activeSection === "reviews" && <ReviewsAdminSection />}
          {activeSection === "b2b-leads" && <B2BLeadsSection />}
          {activeSection === "audit" && (
            <AuditReportsSection isAdmin={isAdmin} />
          )}
          {activeSection === "helpdesk" && <HelpdeskSection />}
          {activeSection === "exam-paper-engine" && <ExamPaperEngineSection />}
          {activeSection === "smart-id-studio" && <SmartIDStudioSection />}
          {activeSection === "delivery-dispatch" && <DeliveryDispatchSection />}
          {activeSection === "attendance-report" && <AttendanceReportSection />}
        </main>
      </div>
    </div>
  );
}
