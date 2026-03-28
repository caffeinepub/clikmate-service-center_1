import type { CatalogItem, KhataEntry, PosSaleItem } from "@/backend.d";
import {
  fsAddDoc,
  fsGetCollection,
  fsGetSettings,
  fsSetSettings,
  fsSubscribeCollection,
  fsUpdateDoc,
} from "@/utils/firestoreService";
import { useNavigate } from "@/utils/router";
import { STORAGE_KEYS, storageGet, storageSet } from "@/utils/storage";
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  FileText,
  LogOut,
  Minus,
  PenLine,
  Plus,
  Printer,
  QrCode,
  ScanLine,
  Search,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── PDF page counter ─────────────────────────────────────────────────────────
async function countPdfPages(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const alreadyLoaded = (window as any)["pdfjs-dist/build/pdf"];
    const doCount = () => {
      const pdfjsLib = (window as any)["pdfjs-dist/build/pdf"];
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target!.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument(typedArray).promise;
          resolve(pdf.numPages);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    };
    if (alreadyLoaded) {
      doCount();
    } else {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = doCount;
      script.onerror = reject;
      document.head.appendChild(script);
    }
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface CartItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
  meta?: string; // e.g. "12 pages × 2 copies"
}

type PaymentMode =
  | "Cash"
  | "UPI"
  | "Online"
  | "Split_Cash_UPI"
  | "Split_Cash_Khata";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today = () => new Date().toDateString();

function formatRs(n: number) {
  return `₹${n.toFixed(2)}`;
}

function parseRate(price: string): number {
  const match = price.match(/[\d.]+/);
  return match ? Number.parseFloat(match[0]) : 0;
}

function getGstSettings(): { enabled: boolean; shopGstNumber: string } {
  try {
    const raw = localStorage.getItem("clikmate_gst_settings");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, shopGstNumber: "" };
}

// ─── Main POS Component ───────────────────────────────────────────────────────
export default function PosPage() {
  const navigate = useNavigate();
  const isFetching = false;
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  // Subscribe to catalog via Firestore onSnapshot
  useEffect(() => {
    const unsub = fsSubscribeCollection<any>("catalog", (items: any[]) => {
      setCatalogItems(items as CatalogItem[]);
    });
    return () => unsub();
  }, []);

  // Expose catalog to window for GST tax line lookup in CheckoutModal
  useEffect(() => {
    (window as any).__clikmate_catalog = catalogItems;
  }, [catalogItems]);

  // -- Barcode Scanner State --
  const [scannerActive, setScannerActive] = useState(true);
  const barcodeBuffer = useRef("");
  const lastKeyTime = useRef(0);

  useEffect(() => {
    setScannerActive(true);
    function handler(e: KeyboardEvent) {
      const tag = (
        document.activeElement as HTMLElement
      )?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const now = Date.now();
      const timeDiff = now - lastKeyTime.current;
      lastKeyTime.current = now;
      if (e.key === "Enter") {
        const buf = barcodeBuffer.current.trim();
        barcodeBuffer.current = "";
        // Enforce minimum barcode length of 4 characters
        if (buf.length >= 4) {
          const found = catalogItems.find(
            (item: CatalogItem) =>
              // Match barcode field first (primary)
              ((item as any).barcode &&
                (item as any).barcode.trim() !== "" &&
                (item as any).barcode.trim().toUpperCase() ===
                  buf.toUpperCase()) ||
              // Then match Product ID
              (item.productId &&
                item.productId.toUpperCase() === buf.toUpperCase()) ||
              // Then match raw id
              String(item.id) === buf,
          );
          if (found) {
            const unitPrice = parseRate(found.price);
            window.dispatchEvent(
              new CustomEvent("pos:addToCart", {
                detail: {
                  id: `${found.id}-${Date.now()}`,
                  name: found.name,
                  qty: 1,
                  unitPrice,
                  total: unitPrice,
                },
              }),
            );
            toast.success(`✓ Scanned: ${found.name}`);
          } else {
            // Option C: error toast + focus search + paste scanned string
            toast.error(`Item not found — barcode: ${buf}`);
            window.dispatchEvent(
              new CustomEvent("pos:focusSearch", { detail: { query: buf } }),
            );
          }
        }
        return;
      }
      if (e.key.length === 1) {
        // 50ms threshold between keystrokes to detect scanner vs manual typing
        if (timeDiff < 50 || barcodeBuffer.current.length === 0) {
          barcodeBuffer.current += e.key;
        } else {
          barcodeBuffer.current = e.key;
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [catalogItems]);

  // ── Panel tab ──
  const [rightTab, setRightTab] = useState<"billing" | "accounts">("billing");

  // Session guard
  const session = localStorage.getItem("staffSession");
  const adminSession = localStorage.getItem("clikmate_admin_session");
  const isAdminBypass = adminSession === "1";
  useEffect(() => {
    if (!session && !isAdminBypass) navigate("/pos-login");
  }, [navigate, session, isAdminBypass]);
  if (!session && !isAdminBypass) return null;
  const staffData = isAdminBypass
    ? { mobile: "admin", name: "Super Admin" }
    : (JSON.parse(session!) as { mobile: string; name?: string });

  function handleLogout() {
    if (isAdminBypass) {
      navigate("/admin");
      return;
    }
    localStorage.removeItem("staffSession");
    navigate("/pos-login");
  }

  return (
    <div
      data-ocid="pos.page"
      style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg,#f59e0b,#d97706)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              color: "#1a1a1a",
              fontSize: 14,
            }}
          >
            C
          </div>
          <div>
            <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>
              POS Terminal
            </span>
            <span
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                marginLeft: 8,
              }}
            >
              Staff: {staffData.mobile}
            </span>
          </div>
        </div>
        {/* Scanner + ClockIn indicators */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            data-ocid="pos.scanner.toggle"
            title="Barcode scanner is active"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: scannerActive
                ? "rgba(16,185,129,0.15)"
                : "rgba(255,255,255,0.07)",
              border: `1px solid ${scannerActive ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 20,
              padding: "3px 10px",
              fontSize: 12,
              color: scannerActive ? "#10b981" : "rgba(255,255,255,0.4)",
              fontWeight: 600,
              cursor: "default",
            }}
          >
            <ScanLine size={12} />
            Scanner Ready
          </div>
          <button
            type="button"
            data-ocid="pos.clockin.button"
            onClick={() => navigate("/clock-in")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.35)",
              borderRadius: 20,
              padding: "3px 10px",
              fontSize: 12,
              color: "#a78bfa",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <QrCode size={12} />
            Clock-In
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            data-ocid="pos.billing.tab"
            onClick={() => setRightTab("billing")}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background:
                rightTab === "billing" ? "#f59e0b" : "rgba(255,255,255,0.07)",
              color:
                rightTab === "billing" ? "#1a1a1a" : "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <ShoppingCart size={14} />
            Billing
          </button>
          <button
            type="button"
            data-ocid="pos.accounts.tab"
            onClick={() => setRightTab("accounts")}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background:
                rightTab === "accounts" ? "#7c3aed" : "rgba(255,255,255,0.07)",
              color:
                rightTab === "accounts" ? "white" : "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <BookOpen size={14} />
            Accounts &amp; Ledger
          </button>
          <button
            type="button"
            data-ocid="pos.logout.button"
            onClick={handleLogout}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
            }}
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          maxHeight: "calc(100vh - 56px)",
        }}
      >
        {/* LEFT: Catalog */}
        <CatalogPanel
          items={catalogItems}
          loading={isFetching}
          onAddToCart={(item) => {
            // handled in BillingPanel via callback
            return item;
          }}
          rightTab={rightTab}
        />

        {/* RIGHT panel depends on tab */}
        {rightTab === "billing" ? (
          <BillingPanel
            catalogItems={catalogItems}
            staffMobile={staffData.mobile}
          />
        ) : (
          <AccountsPanel onNewBill={() => setRightTab("billing")} />
        )}
      </div>
    </div>
  );
}

// ─── Catalog Panel ────────────────────────────────────────────────────────────
function CatalogPanel({
  items,
  loading,
}: {
  items: CatalogItem[];
  loading: boolean;
  onAddToCart: (item: CatalogItem) => CatalogItem;
  rightTab: "billing" | "accounts";
}) {
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"services" | "products">("services");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [rowQty, setRowQty] = useState<Record<string, number>>({});

  // Listen for barcode miss event to focus search with scanned string
  useEffect(() => {
    function handleFocusSearch(e: Event) {
      const { query } = (e as CustomEvent).detail as { query: string };
      setSearch(query);
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
    }
    window.addEventListener("pos:focusSearch", handleFocusSearch);
    return () =>
      window.removeEventListener("pos:focusSearch", handleFocusSearch);
  }, []);
  const [modalItem, setModalItem] = useState<CatalogItem | null>(null);
  const [modalType, setModalType] = useState<
    "product" | "service" | "pdf" | null
  >(null);
  // Cart state lives here so both panels can share via context — using a simple
  // window event bus for cross-component communication

  const displayed = items
    .filter((i) => {
      const isService = i.itemType === "service";
      return tab === "services" ? isService : !isService;
    })
    .filter(
      (i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.category.toLowerCase().includes(search.toLowerCase()) ||
        (i as any).barcode?.toLowerCase().includes(search.toLowerCase()) ||
        i.productId?.toLowerCase().includes(search.toLowerCase()),
    );

  function handleItemClick(item: CatalogItem) {
    // If item already in cart and it is a simple service (no PDF calc),
    // just increment qty directly without opening a modal.
    const alreadyInCart = (window as any).__pos_cart_ref?.find(
      (c: any) => c.id === (item.productId || String(item.id)),
    );
    const isService = item.itemType === "service";
    if (alreadyInCart && isService && !item.requiresPdfCalc) {
      dispatchAddToCart({
        id: item.productId || String(item.id),
        name: item.name,
        qty: 1,
        unitPrice: Number(item.saleRate ?? item.price ?? 0),
        total: Number(item.saleRate ?? item.price ?? 0),
      });
      return;
    }
    setModalItem(item);
    if (!isService) {
      setModalType("product");
    } else if (item.requiresPdfCalc) {
      setModalType("pdf");
    } else {
      setModalType("service");
    }
  }

  function dispatchAddToCart(cartItem: CartItem) {
    window.dispatchEvent(
      new CustomEvent("pos:addToCart", { detail: cartItem }),
    );
  }

  return (
    <div
      style={{
        flex: "0 0 60%",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Search + tabs */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              width: 15,
              height: 15,
              color: "rgba(255,255,255,0.3)",
            }}
          />
          <input
            ref={searchInputRef}
            data-ocid="pos.catalog.search_input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, barcode, or Product ID..."
            style={{
              width: "100%",
              padding: "8px 10px 8px 32px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              color: "white",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["services", "products"] as const).map((t) => (
            <button
              key={t}
              type="button"
              data-ocid={`pos.catalog.${t}.tab`}
              onClick={() => setTab(t)}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "none",
                background:
                  tab === t ? "rgba(124,58,237,0.8)" : "rgba(255,255,255,0.05)",
                color: tab === t ? "white" : "rgba(255,255,255,0.5)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 12,
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        {/* View Mode Toggle */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 6,
            padding: 2,
            marginTop: 8,
          }}
        >
          {(["list", "grid"] as const).map((v) => (
            <button
              key={v}
              type="button"
              data-ocid={`pos.catalog.${v}_view.toggle`}
              onClick={() => setViewMode(v)}
              style={{
                flex: 1,
                padding: "4px 8px",
                borderRadius: 5,
                border: "none",
                background:
                  viewMode === v ? "rgba(245,158,11,0.8)" : "transparent",
                color: viewMode === v ? "#1a1a1a" : "rgba(255,255,255,0.4)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              {v === "list" ? "≡ List" : "⊞ Grid"}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog View: Grid or List */}
      {viewMode === "grid" ? (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 8,
            alignContent: "start",
          }}
        >
          {loading && (
            <div
              data-ocid="pos.catalog.loading_state"
              style={{
                gridColumn: "1/-1",
                textAlign: "center",
                color: "rgba(255,255,255,0.3)",
                padding: 40,
              }}
            >
              Loading catalog...
            </div>
          )}
          {!loading && displayed.length === 0 && (
            <div
              data-ocid="pos.catalog.empty_state"
              style={{
                gridColumn: "1/-1",
                textAlign: "center",
                color: "rgba(255,255,255,0.3)",
                padding: 40,
              }}
            >
              No items found
            </div>
          )}
          {displayed.map((item) => (
            <button
              key={item.id.toString()}
              type="button"
              onClick={() => handleItemClick(item)}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "10px 8px",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.15s",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(124,58,237,0.2)";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "rgba(124,58,237,0.5)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.04)";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "rgba(255,255,255,0.08)";
              }}
            >
              {item.requiresPdfCalc && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    background: "#2563eb",
                    borderRadius: 4,
                    padding: "1px 4px",
                    fontSize: 9,
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  PDF
                </span>
              )}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(124,58,237,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 6px",
                }}
              >
                <FileText size={16} color="#a78bfa" />
              </div>
              <p
                style={{
                  color: "white",
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1.3,
                  marginBottom: 3,
                }}
              >
                {item.name}
              </p>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700 }}>
                {item.price || "₹0"}
              </p>
            </button>
          ))}
        </div>
      ) : (
        /* ── List View (ERP-style compact table) ── */
        <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
          {loading && (
            <div
              data-ocid="pos.catalog.loading_state"
              style={{
                textAlign: "center",
                color: "rgba(255,255,255,0.3)",
                padding: 40,
              }}
            >
              Loading catalog...
            </div>
          )}
          {!loading && displayed.length === 0 && (
            <div
              data-ocid="pos.catalog.empty_state"
              style={{
                textAlign: "center",
                color: "rgba(255,255,255,0.3)",
                padding: 40,
              }}
            >
              No items found
            </div>
          )}
          {!loading && displayed.length > 0 && (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
                minWidth: 480,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <th
                    style={{
                      padding: "6px 10px",
                      textAlign: "left",
                      color: "rgba(255,255,255,0.5)",
                      fontWeight: 600,
                      fontSize: 11,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Item
                  </th>
                  <th
                    style={{
                      padding: "6px 8px",
                      textAlign: "left",
                      color: "rgba(255,255,255,0.5)",
                      fontWeight: 600,
                      fontSize: 11,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Category
                  </th>
                  <th
                    style={{
                      padding: "6px 8px",
                      textAlign: "right",
                      color: "rgba(255,255,255,0.5)",
                      fontWeight: 600,
                      fontSize: 11,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Rate (₹)
                  </th>
                  <th
                    style={{
                      padding: "6px 8px",
                      textAlign: "center",
                      color: "rgba(255,255,255,0.5)",
                      fontWeight: 600,
                      fontSize: 11,
                      width: 64,
                    }}
                  >
                    Qty
                  </th>
                  <th
                    style={{
                      padding: "6px 8px",
                      textAlign: "center",
                      color: "rgba(255,255,255,0.5)",
                      fontWeight: 600,
                      fontSize: 11,
                      width: 60,
                    }}
                  >
                    Add
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((item, idx) => {
                  const itemKey = item.id.toString();
                  const qty = rowQty[itemKey] ?? 1;
                  const rateNum =
                    typeof item.price === "string"
                      ? Number.parseFloat(item.price.replace(/[^0-9.]/g, "")) ||
                        0
                      : (item.price as number) || 0;
                  return (
                    <tr
                      key={itemKey}
                      style={{
                        background:
                          idx % 2 === 0
                            ? "transparent"
                            : "rgba(255,255,255,0.015)",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        height: 36,
                      }}
                    >
                      <td
                        style={{
                          padding: "4px 10px",
                          color: "white",
                          fontWeight: 600,
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          {item.name}
                          {item.requiresPdfCalc && (
                            <span
                              style={{
                                background: "#2563eb",
                                borderRadius: 3,
                                padding: "1px 5px",
                                fontSize: 9,
                                color: "white",
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              PDF
                            </span>
                          )}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "4px 8px",
                          color: "rgba(255,255,255,0.4)",
                          fontSize: 11,
                        }}
                      >
                        {item.category}
                      </td>
                      <td
                        style={{
                          padding: "4px 8px",
                          color: "#f59e0b",
                          fontWeight: 700,
                          textAlign: "right",
                        }}
                      >
                        {rateNum > 0 ? `₹${rateNum}` : "₹0"}
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "center" }}>
                        {item.requiresPdfCalc ? (
                          <span
                            style={{
                              color: "rgba(255,255,255,0.2)",
                              fontSize: 10,
                            }}
                          >
                            —
                          </span>
                        ) : (
                          <input
                            type="number"
                            min={1}
                            value={qty}
                            onChange={(e) => {
                              const v = Math.max(
                                1,
                                Number.parseInt(e.target.value) || 1,
                              );
                              setRowQty((prev) => ({ ...prev, [itemKey]: v }));
                            }}
                            style={{
                              width: 52,
                              padding: "2px 6px",
                              borderRadius: 5,
                              border: "1px solid rgba(255,255,255,0.15)",
                              background: "rgba(255,255,255,0.07)",
                              color: "white",
                              fontSize: 12,
                              textAlign: "center",
                              outline: "none",
                            }}
                          />
                        )}
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "center" }}>
                        <button
                          type="button"
                          data-ocid={`pos.catalog.list.add_button.${idx + 1}`}
                          onClick={() => {
                            handleItemClick(item);
                          }}
                          style={{
                            padding: "3px 10px",
                            borderRadius: 5,
                            border: "none",
                            background: item.requiresPdfCalc
                              ? "#2563eb"
                              : "#f59e0b",
                            color: item.requiresPdfCalc ? "white" : "#1a1a1a",
                            fontWeight: 700,
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          {item.requiresPdfCalc ? "PDF" : "Add"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals */}
      {modalItem && modalType === "product" && (
        <ProductModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          onAdd={dispatchAddToCart}
        />
      )}
      {modalItem && modalType === "service" && (
        <ServiceModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          onAdd={dispatchAddToCart}
        />
      )}
      {modalItem && modalType === "pdf" && (
        <SmartPdfModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          onAdd={dispatchAddToCart}
        />
      )}
    </div>
  );
}

// ─── Product Modal ─────────────────────────────────────────────────────────────
function ProductModal({
  item,
  onClose,
  onAdd,
}: {
  item: CatalogItem;
  onClose: () => void;
  onAdd: (c: CartItem) => void;
}) {
  const baseRate = parseRate(item.price);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(baseRate);
  const total = qty * price;

  return (
    <PosModal onClose={onClose} title={item.name}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <p style={lblStyle}>Rate / Unit Price (editable)</p>
          <input
            data-ocid="pos.product.price.input"
            type="number"
            min="0"
            step="0.5"
            value={price}
            onChange={(e) => setPrice(Number.parseFloat(e.target.value) || 0)}
            style={posInput}
          />
        </div>
        <div>
          <p style={lblStyle}>Quantity</p>
          <input
            data-ocid="pos.product.qty.input"
            type="number"
            min="1"
            value={qty}
            onChange={(e) =>
              setQty(Math.max(1, Number.parseInt(e.target.value) || 1))
            }
            style={posInput}
          />
        </div>
        <div
          style={{
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 8,
            padding: 12,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            Total
          </span>
          <p style={{ color: "#f59e0b", fontSize: 22, fontWeight: 800 }}>
            {formatRs(total)}
          </p>
        </div>
        <button
          type="button"
          data-ocid="pos.product.add_button"
          onClick={() => {
            onAdd({
              id: `${item.id}-${Date.now()}`,
              name: item.name,
              qty,
              unitPrice: price,
              total,
            });
            onClose();
          }}
          style={addBtn}
        >
          Add to Cart
        </button>
      </div>
    </PosModal>
  );
}

// ─── Service Modal ─────────────────────────────────────────────────────────────
function ServiceModal({
  item,
  onClose,
  onAdd,
}: {
  item: CatalogItem;
  onClose: () => void;
  onAdd: (c: CartItem) => void;
}) {
  const baseRate = parseRate(item.price);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(baseRate);
  const total = qty * price;

  return (
    <PosModal onClose={onClose} title={item.name}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <p style={lblStyle}>Price (editable)</p>
          <input
            data-ocid="pos.service.price.input"
            type="number"
            min="0"
            step="0.5"
            value={price}
            onChange={(e) => setPrice(Number.parseFloat(e.target.value) || 0)}
            style={posInput}
          />
        </div>
        <div>
          <p style={lblStyle}>Quantity</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              data-ocid="pos.service.qty.input"
              type="number"
              min="1"
              value={qty}
              onChange={(e) =>
                setQty(Math.max(1, Number.parseInt(e.target.value) || 1))
              }
              style={{ ...posInput, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              style={qtyBtn}
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              style={qtyBtn}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div
          style={{
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 8,
            padding: 12,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            Total
          </span>
          <p style={{ color: "#f59e0b", fontSize: 22, fontWeight: 800 }}>
            {formatRs(total)}
          </p>
        </div>
        <button
          type="button"
          data-ocid="pos.service.add_button"
          onClick={() => {
            onAdd({
              id: `${item.id}-${Date.now()}`,
              name: item.name,
              qty,
              unitPrice: price,
              total,
            });
            onClose();
          }}
          style={addBtn}
        >
          Add to Cart
        </button>
      </div>
    </PosModal>
  );
}

// ─── Smart PDF Modal ──────────────────────────────────────────────────────────
function SmartPdfModal({
  item,
  onClose,
  onAdd,
}: {
  item: CatalogItem;
  onClose: () => void;
  onAdd: (c: CartItem) => void;
}) {
  const baseRate = parseRate(item.price);
  const [pages, setPages] = useState<number | null>(null);
  const [copies, setCopies] = useState(1);
  const [rate, setRate] = useState(baseRate);
  const [loading, setLoading] = useState(false);
  const total = pages ? pages * copies * rate : 0;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const n = await countPdfPages(file);
      setPages(n);
    } catch {
      toast.error("Could not read PDF. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PosModal onClose={onClose} title="Smart PDF Billing">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          Service: <strong style={{ color: "white" }}>{item.name}</strong>
        </p>
        <div>
          <p style={lblStyle}>Upload PDF</p>
          <input
            data-ocid="pos.pdf.upload_button"
            type="file"
            accept=".pdf"
            onChange={handleFile}
            style={{ ...posInput, padding: "6px 10px" }}
          />
        </div>
        {loading && (
          <div
            data-ocid="pos.pdf.loading_state"
            style={{ color: "#a78bfa", fontSize: 13 }}
          >
            🔍 Analysing PDF...
          </div>
        )}
        {pages !== null && (
          <div
            data-ocid="pos.pdf.success_state"
            style={{
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: 8,
              padding: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle size={16} color="#10b981" />
            <span style={{ color: "#10b981", fontWeight: 700, fontSize: 14 }}>
              Detected Pages: {pages}
            </span>
          </div>
        )}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <p style={lblStyle}>Copies</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => setCopies((c) => Math.max(1, c - 1))}
                style={qtyBtn}
              >
                <Minus size={12} />
              </button>
              <span
                style={{
                  color: "white",
                  fontWeight: 700,
                  minWidth: 24,
                  textAlign: "center",
                }}
              >
                {copies}
              </span>
              <button
                type="button"
                onClick={() => setCopies((c) => c + 1)}
                style={qtyBtn}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div>
            <p style={lblStyle}>Rate/page (₹, editable)</p>
            <input
              data-ocid="pos.pdf.rate.input"
              type="number"
              min="0"
              step="0.5"
              value={rate}
              onChange={(e) => setRate(Number.parseFloat(e.target.value) || 0)}
              style={posInput}
            />
          </div>
        </div>
        <div
          style={{
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 8,
            padding: 12,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
            {pages ?? "?"} pages × {copies} copies × ₹{rate} =
          </span>
          <p style={{ color: "#f59e0b", fontSize: 22, fontWeight: 800 }}>
            {pages ? formatRs(total) : "—"}
          </p>
        </div>
        <button
          type="button"
          data-ocid="pos.pdf.add_button"
          disabled={pages === null}
          onClick={() => {
            if (!pages) return;
            onAdd({
              id: `${item.id}-${Date.now()}`,
              name: item.name,
              qty: copies,
              unitPrice: pages * rate,
              total,
              meta: `${pages} pages × ${copies} copies`,
            });
            onClose();
          }}
          style={{ ...addBtn, opacity: pages === null ? 0.5 : 1 }}
        >
          Add to Cart
        </button>
      </div>
    </PosModal>
  );
}

// ─── Billing Panel ────────────────────────────────────────────────────────────
function BillingPanel({
  catalogItems: _catalogItems,
  staffMobile,
}: {
  catalogItems: CatalogItem[];
  staffMobile: string;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerMobile, setCustomerMobile] = useState("");
  const [khataClients, setKhataClients] = useState<
    Array<{ phone: string; customerName: string }>
  >([]);

  useEffect(() => {
    fsGetCollection<{ id: string; phone: string; customerName: string }>(
      "khata",
    )
      .then(setKhataClients)
      .catch(console.error);
  }, []);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState<{
    id: string;
    items: CartItem[];
    total: number;
    paymentMode: string;
    customerMobile: string;
    isGstInvoice?: boolean;
    customerName?: string;
    customerGstin?: string;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    grandTotal?: number;
    taxLines?: Array<{
      name: string;
      qty: number;
      rate: number;
      taxableValue: number;
      gstPct: number;
      taxAmount: number;
      hsnSac: string;
    }>;
  } | null>(null);

  // Listen for add-to-cart events from catalog panel
  useEffect(() => {
    const handler = (e: Event) => {
      const item = (e as CustomEvent).detail as CartItem;
      setCart((prev) => {
        const existing = prev.find((c) => c.id === item.id);
        if (existing) {
          return prev.map((c) =>
            c.id === item.id
              ? {
                  ...c,
                  qty: c.qty + item.qty,
                  total: (c.qty + item.qty) * c.unitPrice,
                }
              : c,
          );
        }
        return [...prev, item];
      });
    };
    window.addEventListener("pos:addToCart", handler);
    return () => window.removeEventListener("pos:addToCart", handler);
  }, []);

  const subtotal = cart.reduce((s, c) => s + c.total, 0);

  function updatePrice(id: string, newPrice: number) {
    setCart((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, unitPrice: newPrice, total: c.qty * newPrice }
          : c,
      ),
    );
  }

  function removeItem(id: string) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }

  function addCustomItem() {
    const name = window.prompt("Custom item name:");
    if (!name) return;
    const priceStr = window.prompt("Price (₹):");
    const price = Number.parseFloat(priceStr || "0") || 0;
    const qtyStr = window.prompt("Quantity:");
    const qty = Number.parseInt(qtyStr || "1") || 1;
    setCart((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        name,
        qty,
        unitPrice: price,
        total: qty * price,
      },
    ]);
  }

  return (
    <div
      style={{
        flex: "0 0 40%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Cart header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h3
          style={{
            color: "white",
            fontWeight: 700,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ShoppingCart size={15} color="#f59e0b" />
          Cart ({cart.length})
        </h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            data-ocid="pos.cart.custom_button"
            onClick={addCustomItem}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "transparent",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <PenLine size={11} /> Custom
          </button>
          <button
            type="button"
            data-ocid="pos.cart.clear_button"
            onClick={() => setCart([])}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid rgba(239,68,68,0.3)",
              background: "transparent",
              color: "rgba(239,68,68,0.7)",
              cursor: "pointer",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Trash2 size={11} /> Clear
          </button>
        </div>
      </div>

      {/* Cart items */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
        {cart.length === 0 && (
          <div
            data-ocid="pos.cart.empty_state"
            style={{
              textAlign: "center",
              color: "rgba(255,255,255,0.2)",
              padding: "40px 0",
              fontSize: 13,
            }}
          >
            Tap items on the left to add to cart
          </div>
        )}
        {cart.map((item, idx) => (
          <div
            key={item.id}
            data-ocid={`pos.cart.item.${idx + 1}`}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding: "8px 10px",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ color: "white", fontSize: 12, fontWeight: 600 }}>
                {item.name}
              </span>
              <button
                type="button"
                data-ocid={`pos.cart.delete_button.${idx + 1}`}
                onClick={() => removeItem(item.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(239,68,68,0.6)",
                  cursor: "pointer",
                  padding: 2,
                }}
              >
                <X size={13} />
              </button>
            </div>
            {item.meta && (
              <p
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 10,
                  marginBottom: 4,
                }}
              >
                {item.meta}
              </p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setCart((prev) =>
                    prev
                      .map((c) =>
                        c.id === item.id && c.qty > 1
                          ? {
                              ...c,
                              qty: c.qty - 1,
                              total: (c.qty - 1) * c.unitPrice,
                            }
                          : c,
                      )
                      .filter(
                        (c) => !(c.id === item.id && c.qty <= 1) || c.qty > 1,
                      ),
                  );
                  if (item.qty <= 1) removeItem(item.id);
                }}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.05)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                −
              </button>
              <span
                style={{
                  color: "white",
                  fontSize: 12,
                  fontWeight: 700,
                  minWidth: 20,
                  textAlign: "center",
                }}
              >
                {item.qty}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCart((prev) =>
                    prev.map((c) =>
                      c.id === item.id
                        ? {
                            ...c,
                            qty: c.qty + 1,
                            total: (c.qty + 1) * c.unitPrice,
                          }
                        : c,
                    ),
                  )
                }
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  border: "1px solid rgba(0,255,255,0.3)",
                  background: "rgba(0,255,255,0.07)",
                  color: "#06b6d4",
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                +
              </button>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                @
              </span>
              <input
                data-ocid={`pos.cart.price.input.${idx + 1}`}
                type="number"
                min="0"
                step="0.5"
                value={item.unitPrice}
                onChange={(e) =>
                  updatePrice(item.id, Number.parseFloat(e.target.value) || 0)
                }
                style={{
                  width: 64,
                  padding: "2px 6px",
                  borderRadius: 5,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  color: "white",
                  fontSize: 11,
                  outline: "none",
                }}
              />
              <span
                style={{
                  marginLeft: "auto",
                  color: "#f59e0b",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {formatRs(item.total)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Customer mobile */}
      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* B2B Client Dropdown */}
        {khataClients.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <select
              data-ocid="pos.b2b_client.select"
              onChange={(e) => {
                if (e.target.value) setCustomerMobile(e.target.value);
                else setCustomerMobile("");
              }}
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: 7,
                border: "1px solid rgba(6,182,212,0.3)",
                background: "rgba(6,182,212,0.05)",
                color: "white",
                fontSize: 12,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="" style={{ background: "#0f172a" }}>
                Walk-in / Retail Customer
              </option>
              {khataClients.map((c) => (
                <option
                  key={c.phone}
                  value={c.phone}
                  style={{ background: "#0f172a" }}
                >
                  {c.customerName} (+91{c.phone})
                </option>
              ))}
            </select>
          </div>
        )}
        <input
          data-ocid="pos.customer.mobile.input"
          type="tel"
          placeholder="Customer Mobile (optional, for Digital Vault sync)"
          value={customerMobile}
          onChange={(e) => setCustomerMobile(e.target.value)}
          style={{
            width: "100%",
            padding: "7px 10px",
            borderRadius: 7,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: "white",
            fontSize: 12,
            outline: "none",
          }}
        />
        {customerMobile && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 12 }}>{"📱"}</span>
            <span style={{ color: "#4ade80", fontSize: 11 }}>
              WhatsApp receipt will be sent to +91{customerMobile}
            </span>
          </div>
        )}
      </div>

      {/* Subtotal + checkout */}
      <div
        style={{
          padding: "10px 12px 14px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              color: "rgba(255,255,255,0.5)",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Subtotal
          </span>
          <span style={{ color: "white", fontWeight: 800, fontSize: 20 }}>
            {formatRs(subtotal)}
          </span>
        </div>
        <button
          type="button"
          data-ocid="pos.checkout.button"
          disabled={cart.length === 0}
          onClick={() => setCheckoutOpen(true)}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 10,
            border: "none",
            background: cart.length === 0 ? "rgba(245,158,11,0.3)" : "#f59e0b",
            color: cart.length === 0 ? "rgba(255,255,255,0.4)" : "#1a1a1a",
            fontSize: 15,
            fontWeight: 800,
            cursor: cart.length === 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <CheckCircle size={16} />
          Checkout — {formatRs(subtotal)}
        </button>
      </div>

      {/* Checkout modal */}
      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          subtotal={subtotal}
          customerMobile={customerMobile}
          staffMobile={staffMobile}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={(receiptData) => {
            setReceipt(receiptData);
            setCart([]);
            setCheckoutOpen(false);
          }}
        />
      )}

      {/* Receipt */}
      {receipt && (
        <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
      )}
    </div>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────
function CheckoutModal({
  cart,
  subtotal,
  customerMobile,
  staffMobile,
  onClose,
  onSuccess,
}: {
  cart: CartItem[];
  subtotal: number;
  customerMobile: string;
  staffMobile: string;
  onClose: () => void;
  onSuccess: (r: {
    id: string;
    items: CartItem[];
    total: number;
    paymentMode: string;
    customerMobile: string;
    amountPaid?: number;
    amountDue?: number;
    isGstInvoice?: boolean;
    customerName?: string;
    customerGstin?: string;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    grandTotal?: number;
    taxLines?: Array<{
      name: string;
      qty: number;
      rate: number;
      taxableValue: number;
      gstPct: number;
      taxAmount: number;
      hsnSac: string;
    }>;
  }) => void;
}) {
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Cash");
  const [amountPaid, setAmountPaid] = useState(subtotal.toFixed(2));
  const [cashAmount, setCashAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [amountTendered, setAmountTendered] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState(customerMobile);
  const [saving, setSaving] = useState(false);
  const [isGstInvoice, setIsGstInvoice] = useState(false);
  const amountDue = Math.max(
    0,
    subtotal - Number.parseFloat(amountPaid || "0"),
  );
  const returnAmount = Math.max(
    0,
    Number.parseFloat(amountTendered || "0") - subtotal,
  );
  const [b2bCustomerName, setB2bCustomerName] = useState("");
  const [b2bCustomerGstin, setB2bCustomerGstin] = useState("");

  // GST tax computation
  const gstSettings = getGstSettings();
  const isIntraState =
    b2bCustomerGstin.length >= 2 && gstSettings.shopGstNumber.length >= 2
      ? b2bCustomerGstin.substring(0, 2) ===
        gstSettings.shopGstNumber.substring(0, 2)
      : true;
  const taxLines = cart.map((c) => {
    const catalogMatch = ((window as any).__clikmate_catalog || []).find(
      (ci: any) => ci.name === c.name,
    );
    const gstPct = catalogMatch?.gstPercentage || 0;
    const hsnSac = catalogMatch?.hsnSac || "";
    const taxAmount = isGstInvoice ? (c.total * gstPct) / 100 : 0;
    return {
      name: c.name,
      qty: c.qty,
      rate: c.unitPrice,
      taxableValue: c.total,
      gstPct,
      taxAmount,
      hsnSac,
    };
  });
  const totalTax = taxLines.reduce((s, l) => s + l.taxAmount, 0);
  const cgstAmount = isIntraState ? totalTax / 2 : 0;
  const sgstAmount = isIntraState ? totalTax / 2 : 0;
  const igstAmount = isIntraState ? 0 : totalTax;
  const grandTotal = subtotal + (isGstInvoice ? totalTax : 0);

  async function completeSale() {
    // For Split_Cash_Khata, amountDue = balance going to Khata
    const effectiveAmountDue =
      paymentMode === "Split_Cash_Khata"
        ? Math.max(0, subtotal - Number.parseFloat(amountPaid || "0"))
        : amountDue;
    if (effectiveAmountDue > 0 && !phone) {
      toast.error("Customer Mobile is mandatory when there is an Amount Due.");
      return;
    }
    if (effectiveAmountDue > 0 && !customerName && !phone) {
      toast.error("Customer Name is mandatory when there is an Amount Due.");
      return;
    }
    if (isGstInvoice && (!b2bCustomerName || !b2bCustomerGstin)) {
      toast.error("Customer Name and GSTIN are required for B2B GST Invoice.");
      return;
    }
    setSaving(true);
    try {
      const saleId = Date.now();
      const newSale = {
        id: saleId,
        items: cart.map((c) => ({
          itemName: c.name,
          qty: c.qty,
          unitPrice: c.unitPrice,
          totalPrice: c.total,
        })),
        totalAmount: isGstInvoice ? grandTotal : subtotal,
        paymentMethod: paymentMode,
        amountPaid: Number.parseFloat(amountPaid || "0"),
        amountDue: amountDue,
        cashPaid:
          paymentMode === "Cash" ||
          paymentMode === "Split_Cash_UPI" ||
          paymentMode === "Split_Cash_Khata"
            ? Number.parseFloat(amountPaid || "0")
            : 0,
        upiPaid:
          paymentMode === "UPI"
            ? Number.parseFloat(amountPaid || "0")
            : paymentMode === "Split_Cash_UPI"
              ? Math.max(0, subtotal - Number.parseFloat(amountPaid || "0"))
              : 0,
        khataDue:
          paymentMode === "Split_Cash_Khata"
            ? Math.max(0, subtotal - Number.parseFloat(amountPaid || "0"))
            : 0,
        customerPhone: phone,
        staffMobile,
        createdAt: Date.now(),
        isGstInvoice,
        customerName: isGstInvoice ? b2bCustomerName : "",
        customerGstin: isGstInvoice ? b2bCustomerGstin : "",
        cgstAmount: isGstInvoice ? cgstAmount : 0,
        sgstAmount: isGstInvoice ? sgstAmount : 0,
        igstAmount: isGstInvoice ? igstAmount : 0,
        grandTotal: isGstInvoice ? grandTotal : subtotal,
        taxLines: isGstInvoice ? taxLines : [],
      };
      // Generate sequential invoice number
      let invoiceNumber = "";
      try {
        const now = new Date();
        const month = now.getMonth() + 1; // 1-12
        const year = now.getFullYear();
        const fyStart = month >= 4 ? year : year - 1;
        const fyEnd = (fyStart + 1) % 100;
        const fy = `${fyStart.toString().slice(-2)}${String(fyEnd).padStart(2, "0")}`;
        const counterDoc = await fsGetSettings<{ counter: number }>(
          "invoiceCounter",
        );
        const counter = counterDoc ? counterDoc.counter + 1 : 1;
        await fsSetSettings("invoiceCounter", { counter });
        invoiceNumber = `INV-${fy}-${String(counter).padStart(4, "0")}`;
      } catch {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const fyStart = month >= 4 ? year : year - 1;
        const fyEnd = (fyStart + 1) % 100;
        const fy = `${fyStart.toString().slice(-2)}${String(fyEnd).padStart(2, "0")}`;
        invoiceNumber = `INV-${fy}-${Date.now().toString().slice(-6)}`;
      }
      (newSale as any).invoiceNumber = invoiceNumber;

      // Save sale to Firestore
      await fsAddDoc("orders", newSale);

      // Deduct stock for product items via Firestore
      const currentCatalog = await fsGetCollection<any>("catalog");
      for (const cartItem of cart) {
        const catalogItem = currentCatalog.find(
          (c: any) => c.name === cartItem.name,
        );
        if (
          catalogItem &&
          catalogItem.itemType === "product" &&
          catalogItem.productId
        ) {
          const newQty = Math.max(
            0,
            (catalogItem.quantity || 0) - cartItem.qty,
          );
          await fsUpdateDoc("catalog", catalogItem.productId, {
            quantity: newQty,
          });
        }
      }

      const finalAmountDue =
        paymentMode === "Split_Cash_Khata"
          ? Math.max(0, subtotal - Number.parseFloat(amountPaid || "0"))
          : amountDue;
      if (finalAmountDue > 0 && phone) {
        const khataList = await fsGetCollection<any>("khata");
        const existing = khataList.find((e: any) => e.phone === phone);
        const invoiceNum = (newSale as any).invoiceNumber || `#SO-${saleId}`;
        const khataDescription = `POS Sale - Bill #${invoiceNum} (Total: ₹${subtotal.toFixed(2)}, Paid: ₹${Number.parseFloat(amountPaid || "0").toFixed(2)})`;
        if (existing) {
          await fsUpdateDoc("khata", existing.id, {
            totalDue: (existing.totalDue || 0) + finalAmountDue,
            lastUpdated: Date.now(),
            lastNote: khataDescription,
          });
        } else {
          await fsAddDoc("khata", {
            phone,
            customerName: customerName || phone,
            name: customerName || phone,
            totalDue: finalAmountDue,
            description: khataDescription,
            createdAt: Date.now(),
            lastUpdated: Date.now(),
          });
        }
      }

      onSuccess({
        id: `#SO-${saleId.toString()}`,
        items: cart,
        total: isGstInvoice ? grandTotal : subtotal,
        paymentMode,
        customerMobile: phone,
        amountPaid: Number.parseFloat(amountPaid || "0"),
        amountDue: amountDue,
        customerName: isGstInvoice ? b2bCustomerName : customerName,
        isGstInvoice,
        customerGstin: isGstInvoice ? b2bCustomerGstin : "",
        cgstAmount: isGstInvoice ? cgstAmount : 0,
        sgstAmount: isGstInvoice ? sgstAmount : 0,
        igstAmount: isGstInvoice ? igstAmount : 0,
        grandTotal: isGstInvoice ? grandTotal : subtotal,
        taxLines: isGstInvoice ? taxLines : [],
      });
      toast.success("Sale recorded!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to record sale.");
    } finally {
      setSaving(false);
    }
  }

  const modes: { key: PaymentMode; label: string; color: string }[] = [
    { key: "Cash", label: "💵 Cash", color: "#10b981" },
    { key: "UPI", label: "📱 UPI", color: "#3b82f6" },
    { key: "Split_Cash_UPI", label: "💵+📱 Cash & UPI", color: "#f59e0b" },
    { key: "Split_Cash_Khata", label: "💵+📒 Cash & Khata", color: "#8b5cf6" },
  ];

  return (
    <PosModal onClose={onClose} title="Checkout">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Cart summary */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            borderRadius: 8,
            padding: 10,
            maxHeight: 120,
            overflowY: "auto",
          }}
        >
          {cart.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 3,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                {c.name} ×{c.qty}
              </span>
              <span style={{ color: "white", fontSize: 12, fontWeight: 600 }}>
                {formatRs(c.total)}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "4px 0",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
            Total
          </span>
          <span style={{ color: "#f59e0b", fontSize: 20, fontWeight: 800 }}>
            {formatRs(isGstInvoice ? grandTotal : subtotal)}
          </span>
        </div>

        {/* GST B2B Section */}
        {gstSettings.enabled && (
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div>
                <p
                  style={{
                    color: "white",
                    fontWeight: 700,
                    fontSize: 13,
                    margin: 0,
                  }}
                >
                  Generate B2B GST Invoice
                </p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 11,
                    margin: "2px 0 0",
                  }}
                >
                  A4 Tax Invoice with GSTIN details
                </p>
              </div>
              <div
                role="switch"
                aria-checked={isGstInvoice}
                tabIndex={0}
                data-ocid="pos.gst.invoice_toggle"
                onClick={() => setIsGstInvoice(!isGstInvoice)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter")
                    setIsGstInvoice(!isGstInvoice);
                }}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  cursor: "pointer",
                  background: isGstInvoice
                    ? "#10b981"
                    : "rgba(255,255,255,0.15)",
                  position: "relative",
                  transition: "background 0.2s",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: isGstInvoice ? 22 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "white",
                    transition: "left 0.2s",
                  }}
                />
              </div>
            </div>
            {isGstInvoice && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <p style={lblStyle}>Customer Name / Company *</p>
                  <input
                    data-ocid="pos.gst.customer_name.input"
                    type="text"
                    value={b2bCustomerName}
                    onChange={(e) => setB2bCustomerName(e.target.value)}
                    style={posInput}
                    placeholder="ABC Enterprises Pvt Ltd"
                  />
                </div>
                <div>
                  <p style={lblStyle}>Customer GSTIN *</p>
                  <input
                    data-ocid="pos.gst.customer_gstin.input"
                    type="text"
                    value={b2bCustomerGstin}
                    onChange={(e) =>
                      setB2bCustomerGstin(e.target.value.toUpperCase())
                    }
                    style={posInput}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                  />
                </div>
                <div
                  style={{
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  <p
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 11,
                      marginBottom: 4,
                    }}
                  >
                    {isIntraState
                      ? "🏠 Intra-state (CGST + SGST)"
                      : "✈️ Inter-state (IGST)"}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}
                    >
                      Taxable Value
                    </span>
                    <span style={{ color: "white", fontSize: 12 }}>
                      ₹{subtotal.toFixed(2)}
                    </span>
                  </div>
                  {isIntraState ? (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 2,
                        }}
                      >
                        <span
                          style={{
                            color: "rgba(255,255,255,0.6)",
                            fontSize: 12,
                          }}
                        >
                          CGST
                        </span>
                        <span style={{ color: "#10b981", fontSize: 12 }}>
                          +₹{cgstAmount.toFixed(2)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            color: "rgba(255,255,255,0.6)",
                            fontSize: 12,
                          }}
                        >
                          SGST
                        </span>
                        <span style={{ color: "#10b981", fontSize: 12 }}>
                          +₹{sgstAmount.toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}
                      >
                        IGST
                      </span>
                      <span style={{ color: "#10b981", fontSize: 12 }}>
                        +₹{igstAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px solid rgba(255,255,255,0.1)",
                      paddingTop: 4,
                    }}
                  >
                    <span
                      style={{ color: "white", fontWeight: 700, fontSize: 13 }}
                    >
                      Grand Total
                    </span>
                    <span
                      style={{
                        color: "#f59e0b",
                        fontWeight: 800,
                        fontSize: 14,
                      }}
                    >
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payment mode */}
        <div>
          <p style={lblStyle}>Payment Mode</p>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                data-ocid={`pos.payment.${m.key.toLowerCase()}.button`}
                onClick={() => setPaymentMode(m.key)}
                style={{
                  padding: "10px",
                  borderRadius: 8,
                  border: `2px solid ${paymentMode === m.key ? m.color : "rgba(255,255,255,0.1)"}`,
                  background:
                    paymentMode === m.key
                      ? `${m.color}22`
                      : "rgba(255,255,255,0.03)",
                  color:
                    paymentMode === m.key ? m.color : "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tally-like Split Payment & Change Calculator */}
        {paymentMode === "Split_Cash_UPI" && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div>
              <p style={lblStyle}>Cash Amount (₹)</p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cashAmount}
                onChange={(e) => {
                  setCashAmount(e.target.value);
                  setAmountPaid(
                    String(
                      Number(e.target.value || 0) + Number(upiAmount || 0),
                    ),
                  );
                }}
                style={posInput}
                placeholder="Cash received"
              />
            </div>
            <div>
              <p style={lblStyle}>UPI Amount (₹)</p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={upiAmount}
                onChange={(e) => {
                  setUpiAmount(e.target.value);
                  setAmountPaid(
                    String(
                      Number(cashAmount || 0) + Number(e.target.value || 0),
                    ),
                  );
                }}
                style={posInput}
                placeholder="UPI received"
              />
            </div>
          </div>
        )}
        {paymentMode === "Split_Cash_Khata" && (
          <div>
            <p style={lblStyle}>Cash Paid Now (₹) — balance goes to Khata</p>
            <input
              data-ocid="pos.checkout.amount_paid.input"
              type="number"
              min="0"
              max={subtotal}
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              style={posInput}
              placeholder="Cash paid now"
            />
          </div>
        )}
        {(paymentMode === "Cash" || paymentMode === "UPI") && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div>
              <p style={lblStyle}>Amount Paid (₹)</p>
              <input
                data-ocid="pos.checkout.amount_paid.input"
                type="number"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                style={posInput}
                placeholder="Amount received"
              />
            </div>
            <div>
              <p
                style={{
                  ...lblStyle,
                  color: amountDue > 0 ? "#ef4444" : "rgba(255,255,255,0.5)",
                }}
              >
                Amount Due (₹)
              </p>
              <div
                style={{
                  ...posInput,
                  background:
                    amountDue > 0
                      ? "rgba(239,68,68,0.12)"
                      : "rgba(255,255,255,0.03)",
                  border: `1px solid ${amountDue > 0 ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                  color: amountDue > 0 ? "#ef4444" : "rgba(255,255,255,0.4)",
                  fontWeight: amountDue > 0 ? 700 : 400,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                ₹{amountDue.toFixed(2)}
                {amountDue > 0 && (
                  <span style={{ marginLeft: 4, fontSize: 10 }}>→ Khata</span>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Change Calculator — visible for Cash modes */}
        {(paymentMode === "Cash" ||
          paymentMode === "Split_Cash_UPI" ||
          paymentMode === "Split_Cash_Khata") && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div>
              <p style={lblStyle}>Amount Tendered (₹)</p>
              <input
                type="number"
                min="0"
                step="1"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                style={{
                  ...posInput,
                  border: "1px solid rgba(251,191,36,0.4)",
                }}
                placeholder="Cash given by customer"
              />
            </div>
            <div>
              <p
                style={{
                  ...lblStyle,
                  color: returnAmount > 0 ? "#10b981" : "rgba(255,255,255,0.5)",
                }}
              >
                Return / Change (₹)
              </p>
              <div
                style={{
                  ...posInput,
                  background:
                    returnAmount > 0
                      ? "rgba(16,185,129,0.12)"
                      : "rgba(255,255,255,0.03)",
                  border: `1px solid ${returnAmount > 0 ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.1)"}`,
                  color: returnAmount > 0 ? "#10b981" : "rgba(255,255,255,0.4)",
                  fontWeight: returnAmount > 0 ? 800 : 400,
                  fontSize: returnAmount > 0 ? 16 : 13,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {returnAmount > 0 ? `₹${returnAmount.toFixed(2)}` : "—"}
              </div>
            </div>
          </div>
        )}

        {/* Customer fields - required if amountDue > 0 */}
        <div>
          <p style={lblStyle}>
            Customer Mobile{" "}
            {amountDue > 0 ? (
              <span style={{ color: "#ef4444" }}>
                * (required for due amount)
              </span>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.3)" }}>(optional)</span>
            )}
          </p>
          <input
            data-ocid="pos.checkout.mobile.input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{
              ...posInput,
              border: `1px solid ${amountDue > 0 && !phone ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.1)"}`,
            }}
            placeholder="10-digit mobile"
          />
        </div>
        <div>
          <p style={lblStyle}>
            Customer Name{" "}
            {amountDue > 0 ? (
              <span style={{ color: "#ef4444" }}>
                * (required for due amount)
              </span>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.3)" }}>(optional)</span>
            )}
          </p>
          <input
            data-ocid="pos.checkout.customer_name.input"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            style={posInput}
            placeholder="Customer name"
          />
        </div>

        <button
          type="button"
          data-ocid="pos.checkout.submit_button"
          disabled={saving}
          onClick={completeSale}
          style={{ ...addBtn, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Processing..." : "✅ Complete Sale"}
        </button>
      </div>
    </PosModal>
  );
}

// ─── Receipt Modal ─────────────────────────────────────────────────────────────
function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: {
    id: string;
    items: CartItem[];
    total: number;
    paymentMode: string;
    customerMobile: string;
    amountPaid?: number;
    amountDue?: number;
    isGstInvoice?: boolean;
    customerName?: string;
    customerGstin?: string;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    grandTotal?: number;
    taxLines?: Array<{
      name: string;
      qty: number;
      rate: number;
      taxableValue: number;
      gstPct: number;
      taxAmount: number;
      hsnSac: string;
    }>;
  };
  onClose: () => void;
}) {
  const now = new Date();
  const dateStr = now.toLocaleString("en-IN");
  const gstSettingsR = getGstSettings();

  function handleThermalPrint() {
    document.body.classList.add("pos-print-mode");
    window.print();
    const cleanup = () => {
      document.body.classList.remove("pos-print-mode");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => document.body.classList.remove("pos-print-mode"), 3000);
  }

  function sendOnWhatsApp() {
    if (!receipt.customerMobile) {
      toast.error("Please enter Customer Mobile number first.");
      return;
    }
    const shopName = "Smart Online Service Center (ClikMate)";
    const itemsText = receipt.items
      .map((i) => `  - ${i.name} x${i.qty}: ₹${i.total.toFixed(2)}`)
      .join("\n");
    const amountDue = receipt.amountDue || 0;
    const amountPaidVal = receipt.amountPaid ?? receipt.total;
    const billText = `*${shopName}*\n\n📋 *Bill Summary*\nBill ID: ${receipt.id}\nDate: ${now.toLocaleString("en-IN")}\n\n*Items:*\n${itemsText}\n\n*Total: ₹${receipt.total.toFixed(2)}*\nPaid: ₹${typeof amountPaidVal === "number" ? amountPaidVal.toFixed(2) : amountPaidVal}\n${amountDue > 0 ? `⚠️ Amount Due: ₹${amountDue.toFixed(2)}` : "✅ Fully Paid"}\n\nThank you for visiting! 🙏`;
    window.open(
      `https://wa.me/91${receipt.customerMobile}?text=${encodeURIComponent(billText)}`,
      "_blank",
    );
  }
  const isIntra =
    (receipt.customerGstin?.substring(0, 2) || "") ===
    (gstSettingsR.shopGstNumber.substring(0, 2) || "");

  return (
    <PosModal onClose={onClose} title="Sale Complete!">
      <div
        data-ocid="pos.receipt.card"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <CheckCircle
            size={40}
            color="#10b981"
            style={{ margin: "0 auto 8px" }}
          />
          <p style={{ color: "#10b981", fontWeight: 700, fontSize: 15 }}>
            Sale Recorded!
          </p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
            {receipt.id}
          </p>
        </div>
        {/* A4 GST Tax Invoice */}
        {receipt.isGstInvoice && (
          <div
            id="pos-gst-invoice-printable"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: 16,
              fontSize: 12,
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                textAlign: "center",
                marginBottom: 10,
                borderBottom: "2px solid rgba(255,255,255,0.2)",
                paddingBottom: 8,
              }}
            >
              <p
                style={{
                  color: "#f59e0b",
                  fontWeight: 900,
                  fontSize: 16,
                  margin: 0,
                }}
              >
                TAX INVOICE
              </p>
              <p
                style={{
                  color: "white",
                  fontWeight: 700,
                  fontSize: 13,
                  margin: "4px 0 0",
                }}
              >
                Smart Online Service Center (ClikMate)
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 10,
                  margin: "2px 0 0",
                }}
              >
                Krish PG, Geetanjali Colony, Awanti Vihar, Raipur 492001
              </p>
              {gstSettingsR.shopGstNumber && (
                <p
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 10,
                    margin: "2px 0 0",
                  }}
                >
                  GSTIN:{" "}
                  <strong style={{ color: "white" }}>
                    {gstSettingsR.shopGstNumber}
                  </strong>
                </p>
              )}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 10,
                fontSize: 11,
              }}
            >
              <div>
                <p style={{ color: "rgba(255,255,255,0.5)", margin: 0 }}>
                  Invoice No:{" "}
                  <span style={{ color: "white" }}>{receipt.id}</span>
                </p>
                <p
                  style={{ color: "rgba(255,255,255,0.5)", margin: "2px 0 0" }}
                >
                  Date:{" "}
                  <span style={{ color: "white" }}>
                    {now.toLocaleDateString("en-IN")}
                  </span>
                </p>
              </div>
              <div>
                <p style={{ color: "rgba(255,255,255,0.5)", margin: 0 }}>
                  Bill To:{" "}
                  <span style={{ color: "white" }}>{receipt.customerName}</span>
                </p>
                <p
                  style={{ color: "rgba(255,255,255,0.5)", margin: "2px 0 0" }}
                >
                  GSTIN:{" "}
                  <span style={{ color: "white" }}>
                    {receipt.customerGstin}
                  </span>
                </p>
              </div>
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 10,
                marginBottom: 8,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    borderBottom: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <th
                    style={{
                      padding: "4px 6px",
                      textAlign: "left",
                      color: "rgba(255,255,255,0.7)",
                      fontWeight: 700,
                    }}
                  >
                    Item
                  </th>
                  <th
                    style={{
                      padding: "4px 6px",
                      textAlign: "left",
                      color: "rgba(255,255,255,0.7)",
                      fontWeight: 700,
                    }}
                  >
                    HSN/SAC
                  </th>
                  <th
                    style={{
                      padding: "4px 6px",
                      textAlign: "right",
                      color: "rgba(255,255,255,0.7)",
                      fontWeight: 700,
                    }}
                  >
                    Qty
                  </th>
                  <th
                    style={{
                      padding: "4px 6px",
                      textAlign: "right",
                      color: "rgba(255,255,255,0.7)",
                      fontWeight: 700,
                    }}
                  >
                    Rate
                  </th>
                  <th
                    style={{
                      padding: "4px 6px",
                      textAlign: "right",
                      color: "rgba(255,255,255,0.7)",
                      fontWeight: 700,
                    }}
                  >
                    Taxable
                  </th>
                  {isIntra ? (
                    <>
                      <th
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          color: "rgba(255,255,255,0.7)",
                          fontWeight: 700,
                        }}
                      >
                        CGST
                      </th>
                      <th
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          color: "rgba(255,255,255,0.7)",
                          fontWeight: 700,
                        }}
                      >
                        SGST
                      </th>
                    </>
                  ) : (
                    <th
                      style={{
                        padding: "4px 6px",
                        textAlign: "right",
                        color: "rgba(255,255,255,0.7)",
                        fontWeight: 700,
                      }}
                    >
                      IGST
                    </th>
                  )}
                  <th
                    style={{
                      padding: "4px 6px",
                      textAlign: "right",
                      color: "rgba(255,255,255,0.7)",
                      fontWeight: 700,
                    }}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {(receipt.taxLines || []).map((line, i) => {
                  const halfTax = line.taxAmount / 2;
                  return (
                    <tr
                      key={`tax-${i}-${line.name}`}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <td style={{ padding: "4px 6px", color: "white" }}>
                        {line.name}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          color: "rgba(255,255,255,0.5)",
                        }}
                      >
                        {line.hsnSac || "-"}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          color: "white",
                        }}
                      >
                        {line.qty}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          color: "white",
                        }}
                      >
                        ₹{line.rate.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          color: "white",
                        }}
                      >
                        ₹{line.taxableValue.toFixed(2)}
                      </td>
                      {isIntra ? (
                        <>
                          <td
                            style={{
                              padding: "4px 6px",
                              textAlign: "right",
                              color: "#10b981",
                            }}
                          >
                            ₹{halfTax.toFixed(2)}
                            <br />
                            <span
                              style={{
                                fontSize: 9,
                                color: "rgba(255,255,255,0.3)",
                              }}
                            >
                              {line.gstPct / 2}%
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "4px 6px",
                              textAlign: "right",
                              color: "#10b981",
                            }}
                          >
                            ₹{halfTax.toFixed(2)}
                            <br />
                            <span
                              style={{
                                fontSize: 9,
                                color: "rgba(255,255,255,0.3)",
                              }}
                            >
                              {line.gstPct / 2}%
                            </span>
                          </td>
                        </>
                      ) : (
                        <td
                          style={{
                            padding: "4px 6px",
                            textAlign: "right",
                            color: "#10b981",
                          }}
                        >
                          ₹{line.taxAmount.toFixed(2)}
                          <br />
                          <span
                            style={{
                              fontSize: 9,
                              color: "rgba(255,255,255,0.3)",
                            }}
                          >
                            {line.gstPct}%
                          </span>
                        </td>
                      )}
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          color: "#f59e0b",
                          fontWeight: 700,
                        }}
                      >
                        ₹{(line.taxableValue + line.taxAmount).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid rgba(255,255,255,0.15)" }}>
                  <td
                    colSpan={4}
                    style={{
                      padding: "6px 6px",
                      color: "rgba(255,255,255,0.6)",
                      textAlign: "right",
                      fontSize: 11,
                    }}
                  >
                    Subtotal
                  </td>
                  <td
                    style={{
                      padding: "6px 6px",
                      textAlign: "right",
                      color: "white",
                      fontWeight: 700,
                    }}
                  >
                    ₹{receipt.total.toFixed(2)}
                  </td>
                  {isIntra ? (
                    <>
                      <td />
                      <td />
                    </>
                  ) : (
                    <td />
                  )}
                  <td
                    style={{
                      padding: "6px 6px",
                      textAlign: "right",
                      color: "white",
                      fontWeight: 700,
                    }}
                  >
                    ₹{receipt.total.toFixed(2)}
                  </td>
                </tr>
                {isIntra ? (
                  <>
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "2px 6px",
                          textAlign: "right",
                          color: "rgba(255,255,255,0.6)",
                          fontSize: 11,
                        }}
                      >
                        CGST
                      </td>
                      <td
                        style={{
                          padding: "2px 6px",
                          textAlign: "right",
                          color: "#10b981",
                        }}
                      >
                        ₹{(receipt.cgstAmount || 0).toFixed(2)}
                      </td>
                      <td />
                      <td
                        style={{
                          padding: "2px 6px",
                          textAlign: "right",
                          color: "#10b981",
                        }}
                      >
                        ₹{(receipt.cgstAmount || 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "2px 6px",
                          textAlign: "right",
                          color: "rgba(255,255,255,0.6)",
                          fontSize: 11,
                        }}
                      >
                        SGST
                      </td>
                      <td />
                      <td
                        style={{
                          padding: "2px 6px",
                          textAlign: "right",
                          color: "#10b981",
                        }}
                      >
                        ₹{(receipt.sgstAmount || 0).toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "2px 6px",
                          textAlign: "right",
                          color: "#10b981",
                        }}
                      >
                        ₹{(receipt.sgstAmount || 0).toFixed(2)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: "2px 6px",
                        textAlign: "right",
                        color: "rgba(255,255,255,0.6)",
                        fontSize: 11,
                      }}
                    >
                      IGST
                    </td>
                    <td
                      style={{
                        padding: "2px 6px",
                        textAlign: "right",
                        color: "#10b981",
                      }}
                    >
                      ₹{(receipt.igstAmount || 0).toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: "2px 6px",
                        textAlign: "right",
                        color: "#10b981",
                      }}
                    >
                      ₹{(receipt.igstAmount || 0).toFixed(2)}
                    </td>
                  </tr>
                )}
                <tr
                  style={{
                    background: "rgba(245,158,11,0.1)",
                    borderTop: "2px solid rgba(245,158,11,0.3)",
                  }}
                >
                  <td
                    colSpan={isIntra ? 7 : 6}
                    style={{
                      padding: "6px 6px",
                      textAlign: "right",
                      color: "white",
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    GRAND TOTAL
                  </td>
                  <td
                    style={{
                      padding: "6px 6px",
                      textAlign: "right",
                      color: "#f59e0b",
                      fontWeight: 900,
                      fontSize: 14,
                    }}
                  >
                    ₹{(receipt.grandTotal || receipt.total).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
            <p
              style={{
                color: "rgba(255,255,255,0.3)",
                fontSize: 9,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              This is a computer-generated invoice. Thank you for your business.
            </p>
          </div>
        )}

        {/* Receipt content for printing */}
        <div
          id="pos-receipt-printable"
          style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: 8,
            padding: 14,
            fontSize: 12,
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <p style={{ color: "white", fontWeight: 800, fontSize: 13 }}>
              Smart Online Service Center (ClikMate)
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 10,
                lineHeight: 1.5,
              }}
            >
              Krish PG, Geetanjali Colony, Awanti Vihar, Raipur 492001
            </p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
              {dateStr}
            </p>
          </div>
          <div
            style={{
              borderTop: "1px dashed rgba(255,255,255,0.15)",
              paddingTop: 8,
              marginBottom: 8,
            }}
          >
            {receipt.items.map((item) => (
              <div
                key={`${item.name}-${item.unitPrice}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 3,
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>
                  {item.name} ×{item.qty}
                </span>
                <span style={{ color: "white", fontSize: 11 }}>
                  {formatRs(item.total)}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              borderTop: "1px dashed rgba(255,255,255,0.15)",
              paddingTop: 8,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: "white", fontWeight: 700 }}>TOTAL</span>
            <span style={{ color: "#f59e0b", fontWeight: 800, fontSize: 15 }}>
              {formatRs(receipt.total)}
            </span>
          </div>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 10,
              marginTop: 4,
            }}
          >
            Payment: {receipt.paymentMode}
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 9,
              textAlign: "center",
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            Thank you for trusting us with your secure printing &amp; digital
            needs.{"\n"}
            100% Data Privacy Maintained.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            data-ocid="pos.receipt.print_button"
            onClick={handleThermalPrint}
            style={{
              flex: 1,
              padding: "9px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <Printer size={13} /> Print
          </button>
          <button
            type="button"
            data-ocid="pos.receipt.whatsapp_button"
            onClick={sendOnWhatsApp}
            style={{
              flex: 1,
              padding: "9px",
              borderRadius: 8,
              border: "1px solid rgba(37,211,102,0.4)",
              background: "rgba(37,211,102,0.12)",
              color: "#25d366",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            📲 WhatsApp
          </button>
          <button
            type="button"
            data-ocid="pos.receipt.new_bill_button"
            onClick={onClose}
            style={{ ...addBtn, flex: 1, padding: "9px" }}
          >
            New Bill
          </button>
        </div>
      </div>
    </PosModal>
  );
}

// ─── Accounts Panel ───────────────────────────────────────────────────────────
function AccountsPanel({ onNewBill }: { onNewBill?: () => void }) {
  const [sales, setSales] = useState<
    Array<{
      id: bigint;
      totalAmount: number;
      paymentMethod: string;
      customerPhone: string;
      createdAt: bigint;
      amountDue?: number;
    }>
  >([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [khataList, setKhataList] = useState<KhataEntry[]>([]);
  const [khataSearch, setKhataSearch] = useState("");
  const [searchResult, setSearchResult] = useState<
    KhataEntry | null | "not_found"
  >(null);
  const [duePhone, setDuePhone] = useState("");
  const [dueName, setDueName] = useState("");
  const [dueAmount, setDueAmount] = useState("");
  const [clearPhone, setClearPhone] = useState("");
  const [clearAmount, setClearAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [tallyFilter, setTallyFilter] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadingSales(true);
    try {
      const [s, k] = await Promise.all([
        fsGetCollection<any>("orders"),
        fsGetCollection<any>("khata"),
      ]);
      setSales(s);
      setKhataList(k);
    } catch (e) {
      console.error("Failed to load POS data:", e);
      // Fallback to localStorage
      const s = storageGet<any[]>(STORAGE_KEYS.posSales, []);
      const k = storageGet<KhataEntry[]>(STORAGE_KEYS.khata, []);
      setSales(s);
      setKhataList(k);
    } finally {
      setLoadingSales(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const todaySales = sales.filter((s) => {
    const d = new Date(Number(s.createdAt));
    return d.toDateString() === today();
  });

  const totalCash = todaySales
    .filter((s) => s.paymentMethod === "Cash")
    .reduce((s, c) => s + c.totalAmount, 0);
  const totalUpi = todaySales
    .filter((s) => s.paymentMethod === "UPI")
    .reduce((s, c) => s + c.totalAmount, 0);
  const totalSplit = todaySales
    .filter((s) => s.paymentMethod === "Split")
    .reduce((s, c) => s + c.totalAmount, 0);
  const totalKhata = todaySales
    .filter((s) => s.paymentMethod === "Khata")
    .reduce((s, c) => s + c.totalAmount, 0);
  const totalNet = todaySales.reduce((s, c) => s + c.totalAmount, 0);

  function handleSearch() {
    if (!khataSearch) return;
    const entry =
      khataList.find(
        (e) =>
          e.phone === khataSearch ||
          e.customerName?.toLowerCase().includes(khataSearch.toLowerCase()),
      ) ?? null;
    setSearchResult(entry ?? "not_found");
  }

  async function handleAddDue() {
    if (!duePhone || !dueAmount) {
      toast.error("Phone and amount required.");
      return;
    }
    setSaving(true);
    const existing = khataList.find((e) => e.phone === duePhone);
    const amount = Number.parseFloat(dueAmount);
    if (existing) {
      const newDue = (existing.totalDue || 0) + amount;
      const updated = khataList.map((e) =>
        e.phone === duePhone ? { ...e, totalDue: newDue } : e,
      );
      setKhataList(updated);
      await fsUpdateDoc("khata", existing.phone, { totalDue: newDue });
    } else {
      const newEntry = {
        phone: duePhone,
        customerName: dueName || duePhone,
        name: dueName || duePhone,
        totalDue: amount,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };
      const newId = await fsAddDoc("khata", newEntry);
      setKhataList((prev) => [
        ...prev,
        { ...newEntry, id: newId } as unknown as KhataEntry,
      ]);
    }
    toast.success("Due added!");
    setDuePhone("");
    setDueName("");
    setDueAmount("");
    setSaving(false);
  }

  async function handleClearDue() {
    if (!clearPhone || !clearAmount) {
      toast.error("Phone and amount required.");
      return;
    }
    setSaving(true);
    const clearAmt = Number.parseFloat(clearAmount);
    const target = khataList.find((e) => e.phone === clearPhone);
    const newDue = Math.max(0, (target?.totalDue || 0) - clearAmt);
    const updated = khataList.map((e) =>
      e.phone === clearPhone ? { ...e, totalDue: newDue } : e,
    );
    setKhataList(updated);
    if (target) {
      await fsUpdateDoc("khata", target.phone, { totalDue: newDue });
    }
    const newBal = Math.max(
      0,
      (khataList.find((e) => e.phone === clearPhone)?.totalDue || 0) - clearAmt,
    );
    toast.success(`Due cleared! New balance: ₹${newBal.toFixed(2)}`);
    setClearPhone("");
    setClearAmount("");
    if (
      searchResult &&
      searchResult !== "not_found" &&
      searchResult.phone === clearPhone
    ) {
      setSearchResult({ ...searchResult, totalDue: newBal });
    }
    setSaving(false);
  }

  return (
    <div
      style={{
        flex: "0 0 40%",
        overflowY: "auto",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* New Bill shortcut */}
      {onNewBill && (
        <button
          type="button"
          data-ocid="pos.accounts.new_bill_btn"
          onClick={onNewBill}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "2px solid #f59e0b",
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "#1a1a1a",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          + Create New Bill / Order
        </button>
      )}
      {/* Daily Tally */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 14,
        }}
      >
        <h3
          style={{
            color: "white",
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <TrendingUp size={15} color="#f59e0b" />
          Today's Tally
        </h3>
        {loadingSales ? (
          <div
            data-ocid="pos.tally.loading_state"
            style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}
          >
            Loading...
          </div>
        ) : (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            {[
              { label: "Cash", value: totalCash, color: "#10b981" },
              { label: "UPI", value: totalUpi, color: "#3b82f6" },
              { label: "Split", value: totalSplit, color: "#8b5cf6" },
              { label: "Khata/Due", value: totalKhata, color: "#ef4444" },
              {
                label: "Net Sales",
                value: totalNet,
                color: "#f59e0b",
                wide: true,
              },
            ].map((t) => {
              const isActive = tallyFilter === t.label;
              return (
                <button
                  type="button"
                  key={t.label}
                  data-ocid={`pos.tally.${t.label.toLowerCase().replace(/\/| /g, "_")}.card`}
                  onClick={() => setTallyFilter(isActive ? null : t.label)}
                  style={{
                    background: isActive ? `${t.color}30` : `${t.color}15`,
                    border: `2px solid ${isActive ? t.color : `${t.color}30`}`,
                    borderRadius: 8,
                    padding: "8px 10px",
                    gridColumn: (t as any).wide ? "1/-1" : undefined,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textAlign: "left",
                  }}
                >
                  <p
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 10,
                      marginBottom: 2,
                    }}
                  >
                    {t.label} {isActive ? "✓" : ""}
                  </p>
                  <p style={{ color: t.color, fontWeight: 800, fontSize: 16 }}>
                    {formatRs(t.value)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Filtered Transactions Table */}
      <div
        className="print-area"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <h3
            style={{
              color: "white",
              fontWeight: 700,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
              margin: 0,
            }}
          >
            <span style={{ fontSize: 14 }}>📊</span>
            {tallyFilter
              ? `Transactions: ${tallyFilter}`
              : "Filtered Transactions"}
          </h3>
          {tallyFilter && (
            <button
              type="button"
              data-ocid="pos.tally.print.button"
              onClick={() => window.print()}
              style={{
                padding: "5px 12px",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              🖨️ Print A4
            </button>
          )}
        </div>
        {!tallyFilter ? (
          <p
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 12,
              textAlign: "center",
              padding: "16px 0",
            }}
          >
            Click a card above to filter transactions
          </p>
        ) : (
          (() => {
            const filtered =
              tallyFilter === "Net Sales"
                ? todaySales
                : tallyFilter === "Khata/Due"
                  ? todaySales.filter(
                      (s) =>
                        (s.amountDue ?? 0) > 0 || s.paymentMethod === "Khata",
                    )
                  : todaySales.filter((s) => s.paymentMethod === tallyFilter);
            if (filtered.length === 0) {
              return (
                <p
                  style={{
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 12,
                    textAlign: "center",
                    padding: "16px 0",
                  }}
                >
                  No transactions found
                </p>
              );
            }
            return (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {["Time", "Note / Customer", "Amount (₹)", "Mode"].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              padding: "5px 8px",
                              color: "rgba(255,255,255,0.5)",
                              textAlign: "left",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => {
                      const d = new Date(Number(s.createdAt));
                      return (
                        <tr
                          key={String(s.id)}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <td
                            style={{
                              padding: "5px 8px",
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
                              padding: "5px 8px",
                              color: "rgba(255,255,255,0.7)",
                            }}
                          >
                            {s.customerPhone || `Sale #${i + 1}`}
                          </td>
                          <td
                            style={{
                              padding: "5px 8px",
                              color: "#f59e0b",
                              fontWeight: 700,
                            }}
                          >
                            {formatRs(s.totalAmount)}
                          </td>
                          <td
                            style={{
                              padding: "5px 8px",
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
            );
          })()
        )}
      </div>

      {/* Khata Search */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 14,
        }}
      >
        <h3
          style={{
            color: "white",
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Users size={15} color="#a78bfa" />
          Customer Khata
        </h3>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input
            data-ocid="pos.khata.search_input"
            type="tel"
            placeholder="Search by mobile number"
            value={khataSearch}
            onChange={(e) => setKhataSearch(e.target.value)}
            style={{ ...posInput, flex: 1 }}
          />
          <button
            type="button"
            data-ocid="pos.khata.search.button"
            onClick={handleSearch}
            style={{
              padding: "6px 12px",
              borderRadius: 7,
              border: "none",
              background: "#7c3aed",
              color: "white",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Search size={13} />
          </button>
        </div>
        {searchResult && searchResult !== "not_found" && (
          <div
            data-ocid="pos.khata.result.card"
            style={{
              background:
                searchResult.totalDue > 0
                  ? "rgba(239,68,68,0.08)"
                  : "rgba(16,185,129,0.08)",
              border: `1px solid ${searchResult.totalDue > 0 ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
              borderRadius: 8,
              padding: 10,
              marginBottom: 8,
            }}
          >
            <p style={{ color: "white", fontWeight: 700, fontSize: 13 }}>
              {searchResult.customerName}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
              {searchResult.phone}
            </p>
            <p
              style={{
                color: searchResult.totalDue > 0 ? "#ef4444" : "#10b981",
                fontWeight: 800,
                fontSize: 16,
                marginTop: 4,
              }}
            >
              Outstanding: {formatRs(searchResult.totalDue)}
            </p>
          </div>
        )}
        {searchResult === "not_found" && (
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            No Khata entry found for this number.
          </p>
        )}

        {/* Add Due */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingTop: 10,
            marginTop: 4,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            ADD DUE
          </p>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}
          >
            <input
              data-ocid="pos.khata.due_phone.input"
              type="tel"
              placeholder="Mobile"
              value={duePhone}
              onChange={(e) => setDuePhone(e.target.value)}
              style={posInput}
            />
            <input
              data-ocid="pos.khata.due_name.input"
              type="text"
              placeholder="Name"
              value={dueName}
              onChange={(e) => setDueName(e.target.value)}
              style={posInput}
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              data-ocid="pos.khata.due_amount.input"
              type="number"
              placeholder="Amount (₹)"
              value={dueAmount}
              onChange={(e) => setDueAmount(e.target.value)}
              style={{ ...posInput, flex: 1 }}
            />
            <button
              type="button"
              data-ocid="pos.khata.add_due.button"
              disabled={saving}
              onClick={handleAddDue}
              style={{
                padding: "6px 14px",
                borderRadius: 7,
                border: "none",
                background: "#ef4444",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              + Due
            </button>
          </div>
        </div>

        {/* Clear Due */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingTop: 10,
            marginTop: 4,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            CLEAR DUE
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              data-ocid="pos.khata.clear_phone.input"
              type="tel"
              placeholder="Mobile"
              value={clearPhone}
              onChange={(e) => setClearPhone(e.target.value)}
              style={{ ...posInput, flex: 1 }}
            />
            <input
              data-ocid="pos.khata.clear_amount.input"
              type="number"
              placeholder="Amount paid (₹)"
              value={clearAmount}
              onChange={(e) => setClearAmount(e.target.value)}
              style={{ ...posInput, flex: 1 }}
            />
            <button
              type="button"
              data-ocid="pos.khata.clear_due.button"
              disabled={saving}
              onClick={handleClearDue}
              style={{
                padding: "6px 14px",
                borderRadius: 7,
                border: "none",
                background: "#10b981",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Khata list */}
      {khataList.length > 0 && (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <h3
            style={{
              color: "white",
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 10,
            }}
          >
            All Khata Entries
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {khataList.map((entry, idx) => (
              <div
                key={entry.phone}
                data-ocid={`pos.khata.item.${idx + 1}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 8px",
                  background:
                    entry.totalDue > 0
                      ? "rgba(239,68,68,0.06)"
                      : "rgba(255,255,255,0.02)",
                  borderRadius: 6,
                }}
              >
                <div>
                  <p style={{ color: "white", fontSize: 12, fontWeight: 600 }}>
                    {entry.customerName}
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
                    {entry.phone}
                  </p>
                </div>
                <span
                  style={{
                    color: entry.totalDue > 0 ? "#ef4444" : "#10b981",
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {formatRs(entry.totalDue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared modal wrapper ─────────────────────────────────────────────────────
function PosModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
          background: "#0f172a",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          padding: 20,
          width: "100%",
          maxWidth: 420,
          maxHeight: "85vh",
          overflowY: "auto",
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
          <h3 style={{ color: "white", fontWeight: 700, fontSize: 16 }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Shared sub-components & styles ──────────────────────────────────────────
function _InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
        {label}
      </span>
      <span style={{ color: "white", fontSize: 12, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

const lblStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.5)",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 5,
  display: "block",
};

const posInput: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  fontSize: 13,
  outline: "none",
};

const qtyBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const addBtn: React.CSSProperties = {
  width: "100%",
  padding: "11px",
  borderRadius: 9,
  border: "none",
  background: "#f59e0b",
  color: "#1a1a1a",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};
