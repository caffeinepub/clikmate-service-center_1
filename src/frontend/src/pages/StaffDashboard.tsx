import type { CatalogItem, backendInterface } from "@/backend.d";
import BackButton from "@/components/BackButton";
import { useActor } from "@/hooks/useActor";
import { useAllCatalogItems } from "@/hooks/useQueries";
import {
  Bell,
  ChevronRight,
  ClipboardList,
  Clock,
  FolderOpen,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Printer,
  Search,
  ShoppingCart,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Styles (identical to AdminDashboard) ─────────────────────────────────────
const S = {
  body: {
    backgroundColor: "#0a0f1e",
    minHeight: "100vh",
    display: "flex" as const,
    fontFamily: "'Inter', sans-serif",
    color: "white",
  },
  sidebar: {
    width: "260px",
    flexShrink: 0,
    backgroundColor: "#111827",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    display: "flex" as const,
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
    display: "flex" as const,
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
    display: "flex" as const,
    flexDirection: "column" as const,
    minHeight: "100vh",
  },
  header: {
    height: 60,
    background: "rgba(17,24,39,0.95)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: "0 24px",
    flexShrink: 0,
    position: "sticky" as const,
    top: 0,
    zIndex: 30,
  },
};

type StaffSection = "dashboard" | "catalog" | "order-history" | "clock-in";

// ─── NavItem (identical to AdminDashboard) ────────────────────────────────────
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

// ─── NavGroup (identical to AdminDashboard) ───────────────────────────────────
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
        data-ocid={`staff.${groupId}.toggle`}
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "8px 12px",
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

// ─── Basic Dashboard View (no financial cards) ────────────────────────────────
function StaffDashboardView({ staffName }: { staffName: string }) {
  const clockLog: { name: string; time: string; date: string }[] = (() => {
    try {
      return JSON.parse(localStorage.getItem("clikmate_clock_in_log") || "[]");
    } catch {
      return [];
    }
  })();
  const today = new Date().toDateString();
  const todayLog = clockLog.filter((l) => l.date === today);

  return (
    <div style={{ padding: 24 }}>
      {/* Welcome */}
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(139,92,246,0.1))",
          border: "1px solid rgba(6,182,212,0.2)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h2
          style={{ color: "#67e8f9", fontWeight: 800, fontSize: 22, margin: 0 }}
        >
          Welcome, {staffName} 👋
        </h2>
        <p
          style={{ color: "rgba(255,255,255,0.5)", marginTop: 6, fontSize: 14 }}
        >
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Quick Action Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "POS Counter",
            desc: "Start a new billing session",
            icon: ShoppingCart,
            grad: "linear-gradient(135deg, #0e7490, #2563eb)",
            onClick: () => {
              window.location.hash = "#/pos";
            },
          },
          {
            label: "Clock-In",
            desc: "Mark your attendance",
            icon: Clock,
            grad: "linear-gradient(135deg, #059669, #0d9488)",
            onClick: () => {
              window.location.hash = "#/clock-in";
            },
          },
          {
            label: "Bulk Dashboard",
            desc: "View bulk orders",
            icon: Layers,
            grad: "linear-gradient(135deg, #7c3aed, #db2777)",
            onClick: () => {
              window.location.hash = "#/bulk-dashboard";
            },
          },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={card.onClick}
            style={{
              background: card.grad,
              border: "none",
              borderRadius: 14,
              padding: "20px 20px",
              cursor: "pointer",
              textAlign: "left",
              transition: "transform 0.2s, box-shadow 0.2s",
              color: "white",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(-2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 8px 30px rgba(0,0,0,0.3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            <card.icon
              style={{ width: 28, height: 28, marginBottom: 10, opacity: 0.9 }}
            />
            <div style={{ fontWeight: 700, fontSize: 16 }}>{card.label}</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
              {card.desc}
            </div>
          </button>
        ))}
      </div>

      {/* Today's Clock-In Log */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          padding: 20,
        }}
      >
        <h3
          style={{
            color: "white",
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 14,
          }}
        >
          Today's Clock-In Log
        </h3>
        {todayLog.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
            No clock-ins recorded today.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {todayLog.map((entry) => (
              <div
                key={entry.name + entry.time}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 12px",
                  background: "rgba(6,182,212,0.07)",
                  borderRadius: 8,
                }}
              >
                <Clock style={{ width: 14, height: 14, color: "#06b6d4" }} />
                <span
                  style={{
                    color: "rgba(255,255,255,0.8)",
                    fontSize: 13,
                    flex: 1,
                  }}
                >
                  {entry.name}
                </span>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                  {entry.time}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Read-only Catalog View ───────────────────────────────────────────────────
function StaffCatalogView() {
  const { data: allItems, isLoading } = useAllCatalogItems();
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(() => {
    try {
      const s = localStorage.getItem("clikmate_catalog_items");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (allItems && allItems.length > 0) {
      setCatalogItems(allItems);
    }
  }, [allItems]);

  const filtered = catalogItems.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase()),
  );

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
        <h2 style={{ color: "white", fontWeight: 700, fontSize: 18 }}>
          Catalog (Read-Only)
        </h2>
        <span
          style={{
            background: "rgba(6,182,212,0.15)",
            border: "1px solid rgba(6,182,212,0.3)",
            color: "#67e8f9",
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 20,
          }}
        >
          VIEW ONLY
        </span>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            width: 16,
            height: 16,
            color: "rgba(255,255,255,0.3)",
          }}
        />
        <input
          type="text"
          placeholder="Search by name or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            paddingLeft: 38,
            paddingRight: 16,
            paddingTop: 10,
            paddingBottom: 10,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            color: "white",
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box" as const,
          }}
        />
      </div>

      {isLoading ? (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          Loading catalog...
        </p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
          No items found.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map((item) => (
            <div
              key={String(item.id)}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#06b6d4",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 6,
                }}
              >
                {item.category}
              </div>
              <div
                style={{
                  color: "white",
                  fontWeight: 600,
                  fontSize: 14,
                  marginBottom: 4,
                }}
              >
                {item.name}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                {item.description}
              </div>
              <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: 15 }}>
                {item.price}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color:
                    item.stockStatus === "In Stock"
                      ? "#34d399"
                      : item.stockStatus === "Out of Stock"
                        ? "#f87171"
                        : "#fbbf24",
                }}
              >
                {item.stockStatus}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Order History View (read-only) ──────────────────────────────────────────
function StaffOrderHistoryView({ actor }: { actor: backendInterface | null }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actor) {
      setLoading(false);
      return;
    }
    (actor as any)
      .getOrders()
      .then((res: any[]) => {
        setOrders(res || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [actor]);

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
        Order History
      </h2>
      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          Loading...
        </p>
      ) : orders.length === 0 ? (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: 40,
            textAlign: "center",
          }}
        >
          <ClipboardList
            style={{
              width: 40,
              height: 40,
              color: "rgba(255,255,255,0.15)",
              margin: "0 auto 12px",
            }}
          />
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
            No orders found.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {orders.map((order: any, i: number) => (
            <div
              key={String(order.id ?? i)}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ color: "white", fontWeight: 600, fontSize: 14 }}>
                  Order #{String(order.id || i + 1)}
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  {order.createdAt || order.timestamp || "—"}
                </div>
              </div>
              <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: 15 }}>
                ₹{order.total || order.totalAmount || "0"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Staff Clock-In View ──────────────────────────────────────────────────────
function StaffClockInView({ staffName }: { staffName: string }) {
  const [clockedIn, setClockedIn] = useState(false);
  const [log, setLog] = useState<
    { name: string; time: string; date: string }[]
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("clikmate_clock_in_log") || "[]");
    } catch {
      return [];
    }
  });

  const today = new Date().toDateString();
  const todayLog = log.filter((l) => l.date === today);

  // biome-ignore lint/correctness/useExhaustiveDependencies: todayLog is derived from log
  useEffect(() => {
    const alreadyClockedIn = todayLog.some((l) => l.name === staffName);
    setClockedIn(alreadyClockedIn);
  }, [staffName, log]);

  function handleClockIn() {
    const now = new Date();
    const entry = {
      name: staffName,
      time: now.toLocaleTimeString("en-IN"),
      date: now.toDateString(),
    };
    const updated = [entry, ...log];
    localStorage.setItem("clikmate_clock_in_log", JSON.stringify(updated));
    setLog(updated);
    setClockedIn(true);
    toast.success(`✅ ${staffName} clocked in at ${entry.time}`);
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
        Clock-In / Attendance
      </h2>

      {/* Clock-In Card */}
      <div
        style={{
          background: clockedIn
            ? "linear-gradient(135deg, rgba(5,150,105,0.2), rgba(13,148,136,0.15))"
            : "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(139,92,246,0.1))",
          border: clockedIn
            ? "1px solid rgba(52,211,153,0.3)"
            : "1px solid rgba(6,182,212,0.2)",
          borderRadius: 18,
          padding: 32,
          textAlign: "center" as const,
          marginBottom: 24,
        }}
      >
        {/* Scan animation */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            margin: "0 auto 20px",
            background: clockedIn
              ? "rgba(52,211,153,0.2)"
              : "rgba(6,182,212,0.2)",
            border: clockedIn ? "2px solid #34d399" : "2px solid #06b6d4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Clock
            style={{
              width: 36,
              height: 36,
              color: clockedIn ? "#34d399" : "#06b6d4",
            }}
          />
        </div>

        <h3
          style={{ color: "white", fontWeight: 700, fontSize: 20, margin: 0 }}
        >
          {staffName}
        </h3>
        <p
          style={{
            color: "rgba(255,255,255,0.45)",
            fontSize: 13,
            margin: "6px 0 20px",
          }}
        >
          {today}
        </p>

        {clockedIn ? (
          <div
            style={{
              background: "rgba(52,211,153,0.15)",
              border: "1px solid rgba(52,211,153,0.3)",
              color: "#34d399",
              borderRadius: 10,
              padding: "10px 20px",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            ✅ Already Clocked In Today
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClockIn}
            style={{
              background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
              border: "none",
              borderRadius: 12,
              padding: "12px 32px",
              color: "white",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "1";
            }}
          >
            Clock In Now
          </button>
        )}
      </div>

      {/* Today's log */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          padding: 20,
        }}
      >
        <h4
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          TODAY'S LOG
        </h4>
        {todayLog.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
            No entries yet today.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {todayLog.map((entry) => (
              <div
                key={entry.name + entry.time}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 12px",
                  background: "rgba(6,182,212,0.07)",
                  borderRadius: 8,
                }}
              >
                <Clock style={{ width: 14, height: 14, color: "#06b6d4" }} />
                <span
                  style={{
                    color: "rgba(255,255,255,0.8)",
                    fontSize: 13,
                    flex: 1,
                  }}
                >
                  {entry.name}
                </span>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                  {entry.time}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main StaffDashboard Component ───────────────────────────────────────────
function normalizeRoles(session: any): string[] {
  if (!session) return [];
  if (Array.isArray(session.roles) && session.roles.length > 0)
    return session.roles;
  if (session.role) return [session.role];
  return ["POS_Staff"];
}

export default function StaffDashboard() {
  const { actor } = useActor();

  // Get staff session
  const staffSession = (() => {
    try {
      return JSON.parse(localStorage.getItem("staffSession") || "null");
    } catch {
      return null;
    }
  })();

  const staffName = staffSession?.name || staffSession?.mobile || "Staff";

  const userRoles = normalizeRoles(staffSession);
  const hasRole = (r: string) =>
    userRoles.some(
      (role: string) => role.toLowerCase() === r.toLowerCase() || role === r,
    );
  const isAdmin = hasRole("Admin");
  const isPOS = hasRole("POS_Staff") || isAdmin;
  const isPrint = hasRole("Print_Staff") || isAdmin;
  const isAccountant = hasRole("Accountant") || isAdmin;
  const isManager = hasRole("Manager") || isAdmin;
  const isRider = hasRole("Rider");
  const isBulk = hasRole("Bulk Service") || hasRole("Bulk_Service") || isAdmin;

  const [activeSection, setActiveSection] = useState<StaffSection>("dashboard");

  const sectionToGroup: Record<string, string> = {
    "order-history": "sales",
    catalog: "catalog",
    "clock-in": "tools",
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const group = sectionToGroup[activeSection];
    return group ? { [group]: true } : {};
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  const isMobile = windowWidth < 768;

  // Redirect to login if no session
  if (!staffSession) {
    window.location.hash = "#/pos-login";
    return null;
  }

  const navSectionLabels: Record<StaffSection, string> = {
    dashboard: "Live Dashboard",
    catalog: "Catalog",
    "order-history": "Order History",
    "clock-in": "Clock-In / Attendance",
  };

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
        display: "flex" as const,
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

      {/* ── Sidebar (identical shell to AdminDashboard) ──────────────────── */}
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
                Staff Panel
              </div>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <div style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {/* Overview - standalone */}
          <NavItem
            icon={LayoutDashboard}
            label="Live Dashboard"
            active={activeSection === "dashboard"}
            ocid="staff.dashboard.tab"
            onClick={() => {
              setActiveSection("dashboard");
              setSidebarOpen(false);
            }}
          />

          {/* Sales & Operations */}
          {(isPOS || isPrint || isBulk || isManager || isAdmin) && (
            <NavGroup
              icon={ShoppingCart}
              label="Sales & Operations"
              groupId="sales"
              isOpen={!!openGroups.sales}
              onToggle={() => toggleGroup("sales")}
            >
              {isPOS && (
                <NavItem
                  icon={ShoppingCart}
                  label="POS Counter / Billing"
                  active={false}
                  ocid="staff.pos.shortcut"
                  onClick={() => {
                    window.location.hash = "#/pos";
                    setSidebarOpen(false);
                  }}
                />
              )}
              {(isPOS || isManager || isAdmin) && (
                <NavItem
                  icon={FolderOpen}
                  label="Order History"
                  active={activeSection === "order-history"}
                  ocid="staff.order_history.tab"
                  onClick={() => {
                    setActiveSection("order-history");
                    setSidebarOpen(false);
                  }}
                />
              )}
              {(isBulk || isAdmin) && (
                <NavItem
                  icon={Layers}
                  label="Bulk Dashboard"
                  active={false}
                  ocid="staff.bulk.shortcut"
                  onClick={() => {
                    window.location.hash = "#/bulk-dashboard";
                    setSidebarOpen(false);
                  }}
                />
              )}
            </NavGroup>
          )}

          {/* Catalog & Products */}
          {(isManager || isAdmin || isPOS) && (
            <NavGroup
              icon={Package}
              label="Catalog & Products"
              groupId="catalog"
              isOpen={!!openGroups.catalog}
              onToggle={() => toggleGroup("catalog")}
            >
              <NavItem
                icon={Package}
                label="Catalog (Read-Only)"
                active={activeSection === "catalog"}
                ocid="staff.catalog.tab"
                onClick={() => {
                  setActiveSection("catalog");
                  setSidebarOpen(false);
                }}
              />
            </NavGroup>
          )}

          {/* Accounts / Khata */}
          {isAccountant && (
            <NavGroup
              icon={ClipboardList}
              label="Accounts / Khata"
              groupId="accounts"
              isOpen={!!openGroups.accounts}
              onToggle={() => toggleGroup("accounts")}
            >
              <NavItem
                icon={ClipboardList}
                label="Khata Settlement"
                active={false}
                ocid="staff.khata.link"
                onClick={() => {
                  window.location.hash = "#/khata";
                  setSidebarOpen(false);
                }}
              />
              <NavItem
                icon={FolderOpen}
                label="Expense Book"
                active={false}
                ocid="staff.expenses.link"
                onClick={() => {
                  window.location.hash = "#/expense-tracker";
                  setSidebarOpen(false);
                }}
              />
              <NavItem
                icon={ClipboardList}
                label="GST Reports"
                active={false}
                ocid="staff.gst_reports.link"
                onClick={() => {
                  window.location.hash = "#/gst-reports";
                  setSidebarOpen(false);
                }}
              />
            </NavGroup>
          )}

          {/* Staff Tools */}
          <NavGroup
            icon={Clock}
            label="Staff Tools"
            groupId="tools"
            isOpen={!!openGroups.tools}
            onToggle={() => toggleGroup("tools")}
          >
            <NavItem
              icon={Clock}
              label="Clock-In / Attendance"
              active={activeSection === "clock-in"}
              ocid="staff.clock_in.tab"
              onClick={() => {
                setActiveSection("clock-in");
                setSidebarOpen(false);
              }}
            />
          </NavGroup>

          {/* Rider standalone link */}
          {isRider && (
            <NavItem
              icon={Layers}
              label="Rider Dashboard"
              active={false}
              ocid="staff.rider.link"
              onClick={() => {
                window.location.hash = "#/rider-dashboard";
                setSidebarOpen(false);
              }}
            />
          )}
        </div>

        {/* Staff Identity + Logout */}
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
                  background: "linear-gradient(135deg, #0e7490, #2563eb)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>
                  {staffName.charAt(0).toUpperCase()}
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
                {staffName}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                Staff · Active
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {userRoles.slice(0, 3).map((r: string) => (
                  <span
                    key={r}
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#06b6d4",
                      background: "rgba(6,182,212,0.15)",
                      border: "1px solid rgba(6,182,212,0.3)",
                      borderRadius: 4,
                      padding: "1px 5px",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {r.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            data-ocid="staff.logout.button"
            onClick={() => {
              localStorage.removeItem("staffSession");
              window.location.hash = "#/pos-login";
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
            <BackButton />
            {isMobile && (
              <button
                type="button"
                data-ocid="staff.sidebar.toggle"
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
                background: "linear-gradient(135deg, #0e7490, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>
                {staffName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Section content */}
        <main style={{ flex: 1, overflowY: "auto" }}>
          {activeSection === "dashboard" && (
            <StaffDashboardView staffName={staffName} />
          )}
          {activeSection === "catalog" && <StaffCatalogView />}
          {activeSection === "order-history" && (
            <StaffOrderHistoryView
              actor={actor as unknown as backendInterface}
            />
          )}
          {activeSection === "clock-in" && (
            <StaffClockInView staffName={staffName} />
          )}
        </main>
      </div>
    </div>
  );
}
