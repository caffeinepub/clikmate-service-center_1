import type { CatalogItem, KhataEntry, PosSaleItem } from "@/backend.d";
// useAllCatalogItems replaced by localStorage read
import { useNavigate } from "@/utils/router";
import {
  STORAGE_KEYS,
  storageAddItem,
  storageGet,
  storageSet,
  storageUpdateItem,
} from "@/utils/storage";
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

type PaymentMode = "Cash" | "UPI" | "Split" | "Khata";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today = () => new Date().toDateString();

function formatRs(n: number) {
  return `₹${n.toFixed(2)}`;
}

function parseRate(price: string): number {
  const match = price.match(/[\d.]+/);
  return match ? Number.parseFloat(match[0]) : 0;
}

// ─── Main POS Component ───────────────────────────────────────────────────────
export default function PosPage() {
  const navigate = useNavigate();
  const isFetching = false;
  const catalogItems = storageGet<CatalogItem[]>(STORAGE_KEYS.catalog, []);

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
        if (buf.length >= 3) {
          const found = catalogItems.find(
            (item: CatalogItem) =>
              (item.productId &&
                item.productId.toUpperCase() === buf.toUpperCase()) ||
              String(item.id) === buf ||
              item.name.toLowerCase().includes(buf.toLowerCase()),
          );
          if (found) {
            const unitPrice = parseRate(found.price);
            window.dispatchEvent(
              new CustomEvent("pos:addToCart", {
                detail: {
                  id: String(found.id),
                  name: found.name,
                  qty: 1,
                  unitPrice,
                  total: unitPrice,
                },
              }),
            );
            toast.success(`Barcode: "${found.name}" added!`);
          } else {
            toast.error(`Barcode "${buf}" not found in catalog`);
          }
        }
        return;
      }
      if (e.key.length === 1) {
        if (timeDiff < 80 || barcodeBuffer.current.length === 0) {
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
  const [tab, setTab] = useState<"services" | "products">("services");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [rowQty, setRowQty] = useState<Record<string, number>>({});
  const [modalItem, setModalItem] = useState<CatalogItem | null>(null);
  const [modalType, setModalType] = useState<
    "product" | "service" | "pdf" | null
  >(null);
  // Cart state lives here so both panels can share via context — using a simple
  // window event bus for cross-component communication
  const SERVICE_CATS = [
    "Printing & Document",
    "CSC & Govt Forms",
    "Typing",
    "Misc",
  ];

  const displayed = items
    .filter((i) => {
      const isService = SERVICE_CATS.includes(i.category);
      return tab === "services" ? isService : !isService;
    })
    .filter(
      (i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.category.toLowerCase().includes(search.toLowerCase()),
    );

  function handleItemClick(item: CatalogItem) {
    setModalItem(item);
    const isService = SERVICE_CATS.includes(item.category);
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
            data-ocid="pos.catalog.search_input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search catalog..."
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
  const [khataClients] = useState<
    Array<{ phone: string; customerName: string }>
  >(() => {
    try {
      const s = localStorage.getItem("clikmate_khata_entries");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState<{
    id: string;
    items: CartItem[];
    total: number;
    paymentMode: string;
    customerMobile: string;
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
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                ×{item.qty}
              </span>
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
  }) => void;
}) {
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Cash");
  const [cashAmount, setCashAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [khataCustomer, setKhataCustomer] = useState("");
  const [phone, setPhone] = useState(customerMobile);
  const [saving, setSaving] = useState(false);

  async function completeSale() {
    if (paymentMode === "Khata" && !phone) {
      toast.error("Customer mobile is required for Khata.");
      return;
    }
    setSaving(true);
    try {
      const saleId = BigInt(Date.now());
      const newSale = {
        id: saleId,
        items: cart.map((c) => ({
          itemName: c.name,
          qty: BigInt(c.qty),
          unitPrice: c.unitPrice,
          totalPrice: c.total,
        })),
        totalAmount: subtotal,
        paymentMethod: paymentMode,
        customerPhone: phone,
        staffMobile,
        createdAt: BigInt(Date.now()),
      };
      storageAddItem(STORAGE_KEYS.posSales, newSale);

      // Deduct stock for product items
      const catalogList = storageGet<any[]>(STORAGE_KEYS.catalog, []);
      let stockUpdated = false;
      const updatedCatalog = catalogList.map((catalogItem) => {
        if (catalogItem.itemType !== "product") return catalogItem;
        const sold = cart.find((c) => c.name === catalogItem.name);
        if (!sold) return catalogItem;
        stockUpdated = true;
        return {
          ...catalogItem,
          quantity: Math.max(0, (catalogItem.quantity || 0) - sold.qty),
        };
      });
      if (stockUpdated) {
        storageSet(STORAGE_KEYS.catalog, updatedCatalog);
      }

      if (paymentMode === "Khata" && phone) {
        const khataList = storageGet<any[]>(STORAGE_KEYS.khata, []);
        const existing = khataList.find((e) => e.phone === phone);
        if (existing) {
          const updatedList = khataList.map((e) =>
            e.phone === phone
              ? { ...e, totalDue: (e.totalDue || 0) + subtotal }
              : e,
          );
          storageSet(STORAGE_KEYS.khata, updatedList);
        } else {
          storageAddItem(STORAGE_KEYS.khata, {
            id: BigInt(Date.now()),
            phone,
            customerName: khataCustomer || phone,
            name: khataCustomer || phone,
            totalDue: subtotal,
            createdAt: BigInt(Date.now()),
            lastUpdated: BigInt(Date.now()),
          });
        }
      }

      onSuccess({
        id: `#SO-${saleId.toString()}`,
        items: cart,
        total: subtotal,
        paymentMode,
        customerMobile: phone,
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
    { key: "Split", label: "✂️ Split", color: "#8b5cf6" },
    { key: "Khata", label: "📒 Add to Khata", color: "#ef4444" },
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
            {formatRs(subtotal)}
          </span>
        </div>

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

        {/* Split amounts */}
        {paymentMode === "Split" && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div>
              <p style={lblStyle}>Cash (₹)</p>
              <input
                data-ocid="pos.split.cash.input"
                type="number"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                style={posInput}
              />
            </div>
            <div>
              <p style={lblStyle}>UPI (₹)</p>
              <input
                data-ocid="pos.split.upi.input"
                type="number"
                value={upiAmount}
                onChange={(e) => setUpiAmount(e.target.value)}
                style={posInput}
              />
            </div>
          </div>
        )}

        {/* Khata fields */}
        {paymentMode === "Khata" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <p style={lblStyle}>Customer Mobile *</p>
              <input
                data-ocid="pos.khata.mobile.input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={posInput}
                placeholder="10-digit mobile"
              />
            </div>
            <div>
              <p style={lblStyle}>Customer Name</p>
              <input
                data-ocid="pos.khata.name.input"
                type="text"
                value={khataCustomer}
                onChange={(e) => setKhataCustomer(e.target.value)}
                style={posInput}
                placeholder="Name (optional)"
              />
            </div>
          </div>
        )}

        {/* Customer mobile (for non-khata) */}
        {paymentMode !== "Khata" && (
          <div>
            <p style={lblStyle}>Customer Mobile (optional)</p>
            <input
              data-ocid="pos.checkout.mobile.input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={posInput}
              placeholder="Link to Digital Vault"
            />
          </div>
        )}

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
  };
  onClose: () => void;
}) {
  const now = new Date();
  const dateStr = now.toLocaleString("en-IN");

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
            onClick={() => window.print()}
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

  const loadData = useCallback(() => {
    setLoadingSales(true);
    const s = storageGet<any[]>(STORAGE_KEYS.posSales, []);
    const k = storageGet<KhataEntry[]>(STORAGE_KEYS.khata, []);
    setSales(s);
    setKhataList(k);
    setLoadingSales(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const todaySales = sales.filter((s) => {
    const d = new Date(Number(s.createdAt) / 1_000_000);
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

  function handleAddDue() {
    if (!duePhone || !dueAmount) {
      toast.error("Phone and amount required.");
      return;
    }
    setSaving(true);
    const existing = khataList.find((e) => e.phone === duePhone);
    const amount = Number.parseFloat(dueAmount);
    if (existing) {
      const updated = khataList.map((e) =>
        e.phone === duePhone
          ? { ...e, totalDue: (e.totalDue || 0) + amount }
          : e,
      );
      setKhataList(updated);
      storageSet(STORAGE_KEYS.khata, updated);
    } else {
      const newEntry = {
        id: BigInt(Date.now()),
        phone: duePhone,
        customerName: dueName || duePhone,
        name: dueName || duePhone,
        totalDue: amount,
        createdAt: BigInt(Date.now()),
        lastUpdated: BigInt(Date.now()),
      };
      const updated = storageAddItem(STORAGE_KEYS.khata, newEntry);
      setKhataList(updated as unknown as KhataEntry[]);
    }
    toast.success("Due added!");
    setDuePhone("");
    setDueName("");
    setDueAmount("");
    setSaving(false);
  }

  function handleClearDue() {
    if (!clearPhone || !clearAmount) {
      toast.error("Phone and amount required.");
      return;
    }
    setSaving(true);
    const clearAmt = Number.parseFloat(clearAmount);
    const updated = khataList.map((e) =>
      e.phone === clearPhone
        ? { ...e, totalDue: Math.max(0, (e.totalDue || 0) - clearAmt) }
        : e,
    );
    setKhataList(updated);
    storageSet(STORAGE_KEYS.khata, updated);
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
                : todaySales.filter(
                    (s) =>
                      s.paymentMethod ===
                      (tallyFilter === "Khata/Due" ? "Khata" : tallyFilter),
                  );
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
