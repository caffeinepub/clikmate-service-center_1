import BackButton from "@/components/BackButton";
import { LetterheadLayout, triggerPrint } from "@/components/LetterheadLayout";
import {
  fsAddDoc,
  fsDeleteDoc,
  fsGetCollection,
} from "@/utils/firestoreService";
import { formatDateOnly } from "@/utils/formatDateTime";
import { BookOpen, Loader2, Printer, Receipt, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const EXPENSE_CATEGORIES = [
  "Utilities (Light/Net)",
  "Shop Supplies (Ink/Paper)",
  "Maintenance",
  "Staff/Salary",
  "Food & Tea",
  "Other",
];

interface ExpenseDoc {
  id?: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  addedBy: string;
  createdAt: number;
}

type DateRangeFilter = "today" | "week" | "month" | "all";

function getDateBounds(range: DateRangeFilter) {
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

function getAddedBy(): string {
  const isAdmin = localStorage.getItem("clikmate_admin_session") === "1";
  if (isAdmin) return "Admin";
  const staffSession = JSON.parse(
    localStorage.getItem("staffSession") || "null",
  );
  if (staffSession?.name) return staffSession.name;
  if (staffSession?.mobile) return staffSession.mobile;
  return "Staff";
}

export default function ExpenseTrackerPage() {
  const [expenses, setExpenses] = useState<ExpenseDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>("today");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];
  const addedBy = getAddedBy();

  const [form, setForm] = useState({
    amount: "",
    category: EXPENSE_CATEGORIES[0],
    date: todayStr,
    description: "",
  });

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const data = await fsGetCollection<ExpenseDoc>("expenses");
      const sorted = [...data].sort((a, b) => b.createdAt - a.createdAt);
      setExpenses(sorted);
    } catch (e) {
      console.error("Failed to load expenses:", e);
      toast.error("Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only
  useEffect(() => {
    loadExpenses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    try {
      setSubmitting(true);
      const doc: Omit<ExpenseDoc, "id"> = {
        date: form.date,
        amount: Number(form.amount),
        category: form.category,
        description: form.description,
        addedBy,
        createdAt: Date.now(),
      };
      await fsAddDoc("expenses", doc);
      toast.success("Expense logged successfully!");
      setForm({
        amount: "",
        category: EXPENSE_CATEGORIES[0],
        date: todayStr,
        description: "",
      });
      await loadExpenses();
    } catch (e) {
      console.error("addExpense error:", e);
      toast.error("Failed to log expense.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fsDeleteDoc("expenses", id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      toast.success("Expense deleted.");
    } catch (e) {
      console.error("deleteExpense error:", e);
      toast.error("Failed to delete expense.");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const { start, end } = getDateBounds(dateFilter);
  const filtered = expenses.filter((e) => e.date >= start && e.date <= end);
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const S = {
    page: {
      minHeight: "100vh",
      background: "#080d1a",
      color: "white",
      fontFamily: "'Inter', sans-serif",
      padding: "24px",
    } as React.CSSProperties,
    card: {
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 16,
      padding: 24,
      marginBottom: 24,
    } as React.CSSProperties,
    label: {
      color: "rgba(255,255,255,0.6)",
      fontSize: 12,
      fontWeight: 600,
      display: "block",
      marginBottom: 6,
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
    } as React.CSSProperties,
    input: {
      width: "100%",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      padding: "10px 14px",
      color: "white",
      fontSize: 14,
      outline: "none",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,
  };

  const formDirty = !!(form.amount || form.description);

  return (
    <div style={S.page}>
      {/* Top Bar */}
      <div
        className="no-print"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <BackButton disabled={formDirty} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Receipt size={22} style={{ color: "#06b6d4" }} />
          <h1
            style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "white" }}
          >
            Expense Book
          </h1>
          <span
            style={{
              background: "linear-gradient(135deg, #06b6d4, #7c3aed)",
              color: "white",
              borderRadius: 999,
              padding: "2px 10px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Accounts / Khata
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 380px) 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Add Expense Form */}
        <div className="no-print">
          <div style={S.card}>
            <h2
              style={{
                margin: "0 0 20px 0",
                fontSize: 16,
                fontWeight: 700,
                color: "white",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <BookOpen size={16} style={{ color: "#06b6d4" }} />
              Log New Expense
            </h2>

            {/* addedBy badge */}
            <div style={{ marginBottom: 16 }}>
              <span style={S.label}>Added By (Auto-Captured)</span>
              <div
                data-ocid="expense.addedby.panel"
                style={{
                  background: "rgba(6,182,212,0.12)",
                  border: "1px solid rgba(6,182,212,0.3)",
                  borderRadius: 8,
                  padding: "8px 14px",
                  color: "#06b6d4",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 16 }}>🔒</span> {addedBy}
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div>
                <label htmlFor="exp-amount" style={S.label}>
                  Amount (₹) *
                </label>
                <input
                  id="exp-amount"
                  data-ocid="expense.amount.input"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, amount: e.target.value }))
                  }
                  placeholder="e.g. 500"
                  style={S.input}
                />
              </div>

              <div>
                <label htmlFor="exp-category" style={S.label}>
                  Category *
                </label>
                <select
                  id="exp-category"
                  data-ocid="expense.category.select"
                  value={form.category}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, category: e.target.value }))
                  }
                  style={{ ...S.input, background: "#1e293b" }}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="exp-date" style={S.label}>
                  Date *
                </label>
                <input
                  id="exp-date"
                  data-ocid="expense.date.input"
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, date: e.target.value }))
                  }
                  style={{ ...S.input, colorScheme: "dark" }}
                />
              </div>

              <div>
                <label htmlFor="exp-desc" style={S.label}>
                  Description (optional)
                </label>
                <textarea
                  id="exp-desc"
                  data-ocid="expense.description.textarea"
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Short note e.g. Bought 2 ink cartridges"
                  rows={3}
                  style={{ ...S.input, resize: "vertical" as const }}
                />
              </div>

              <button
                type="submit"
                data-ocid="expense.submit_button"
                disabled={submitting}
                style={{
                  background: "linear-gradient(135deg, #06b6d4, #7c3aed)",
                  border: "none",
                  borderRadius: 10,
                  color: "white",
                  padding: "12px 20px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Logging...
                  </>
                ) : (
                  <>💸 Log Expense</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Expense Table */}
        <div>
          <div style={S.card}>
            {/* Table header */}
            <div
              className="no-print"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "white",
                }}
              >
                Expense Ledger
              </h2>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {/* Date filter tabs */}
                {(["today", "week", "month", "all"] as DateRangeFilter[]).map(
                  (r) => (
                    <button
                      key={r}
                      type="button"
                      data-ocid={`expense.filter.${r}.tab`}
                      onClick={() => setDateFilter(r)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 999,
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        background:
                          dateFilter === r
                            ? "linear-gradient(135deg, #06b6d4, #7c3aed)"
                            : "rgba(255,255,255,0.08)",
                        color:
                          dateFilter === r ? "white" : "rgba(255,255,255,0.6)",
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
                  ),
                )}
                <button
                  type="button"
                  data-ocid="expense.print.button"
                  onClick={() => triggerPrint("expense-print")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.2)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.7)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Printer size={12} /> Print
                </button>
              </div>
            </div>

            {/* Printable area */}
            <div id="expense-print-area">
              {/* Print header */}
              <div
                style={{
                  display: "none",
                  marginBottom: 20,
                  borderBottom: "2px solid #06b6d4",
                  paddingBottom: 12,
                }}
                className="print-header"
              >
                <h2 style={{ margin: 0, color: "#06b6d4", fontSize: 18 }}>
                  ClikMate ERP — Expense Report
                </h2>
                <p style={{ margin: 0, color: "#555", fontSize: 12 }}>
                  Period:{" "}
                  {start === "1970-01-01" ? "All Time" : `${start} to ${end}`}
                </p>
              </div>

              {loading ? (
                <div
                  data-ocid="expense.table.loading_state"
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  <Loader2
                    size={24}
                    className="animate-spin"
                    style={{ margin: "0 auto" }}
                  />
                  <div style={{ marginTop: 10, fontSize: 13 }}>
                    Loading expenses...
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div
                  data-ocid="expense.table.empty_state"
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "rgba(255,255,255,0.3)",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: 12,
                    border: "1px dashed rgba(255,255,255,0.1)",
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    No expenses found
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Log your first expense using the form.
                  </div>
                </div>
              ) : (
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
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.5)",
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Date
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Category
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Description
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            fontWeight: 600,
                          }}
                        >
                          Amount (₹)
                        </th>
                        <th
                          style={{
                            padding: "8px 10px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Added By
                        </th>
                        <th
                          className="no-print"
                          style={{
                            padding: "8px 10px",
                            textAlign: "center",
                            fontWeight: 600,
                          }}
                        >
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((exp, idx) => (
                        <tr
                          key={exp.id}
                          data-ocid={`expense.table.item.${idx + 1}`}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background =
                              "rgba(255,255,255,0.03)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background =
                              "transparent";
                          }}
                        >
                          <td
                            style={{
                              padding: "10px 10px",
                              color: "rgba(255,255,255,0.6)",
                            }}
                          >
                            {formatDateOnly(exp.date)}
                          </td>
                          <td style={{ padding: "10px 10px" }}>
                            <span
                              style={{
                                background: "rgba(6,182,212,0.12)",
                                border: "1px solid rgba(6,182,212,0.25)",
                                borderRadius: 6,
                                padding: "2px 8px",
                                fontSize: 11,
                                color: "#06b6d4",
                                fontWeight: 600,
                              }}
                            >
                              {exp.category}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "10px 10px",
                              color: "rgba(255,255,255,0.7)",
                            }}
                          >
                            {exp.description || (
                              <span style={{ color: "rgba(255,255,255,0.25)" }}>
                                —
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "10px 10px",
                              textAlign: "right",
                              fontWeight: 700,
                              color: "#fca5a5",
                            }}
                          >
                            ₹{Number(exp.amount).toLocaleString("en-IN")}
                          </td>
                          <td
                            style={{
                              padding: "10px 10px",
                              color: "rgba(255,255,255,0.5)",
                              fontSize: 12,
                            }}
                          >
                            {exp.addedBy}
                          </td>
                          <td
                            className="no-print"
                            style={{
                              padding: "10px 10px",
                              textAlign: "center",
                            }}
                          >
                            {deleteConfirm === exp.id ? (
                              <div
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  justifyContent: "center",
                                }}
                              >
                                <button
                                  type="button"
                                  data-ocid={`expense.confirm_button.${idx + 1}`}
                                  onClick={() => exp.id && handleDelete(exp.id)}
                                  style={{
                                    background: "#ef4444",
                                    border: "none",
                                    borderRadius: 6,
                                    color: "white",
                                    padding: "4px 10px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  data-ocid={`expense.cancel_button.${idx + 1}`}
                                  onClick={() => setDeleteConfirm(null)}
                                  style={{
                                    background: "rgba(255,255,255,0.1)",
                                    border: "none",
                                    borderRadius: 6,
                                    color: "rgba(255,255,255,0.7)",
                                    padding: "4px 10px",
                                    fontSize: 11,
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                data-ocid={`expense.delete_button.${idx + 1}`}
                                onClick={() => setDeleteConfirm(exp.id || null)}
                                style={{
                                  background: "rgba(239,68,68,0.12)",
                                  border: "1px solid rgba(239,68,68,0.3)",
                                  borderRadius: 6,
                                  color: "#ef4444",
                                  padding: "4px 10px",
                                  fontSize: 11,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr
                        style={{
                          borderTop: "2px solid rgba(255,255,255,0.15)",
                          background: "rgba(255,255,255,0.03)",
                        }}
                      >
                        <td
                          colSpan={3}
                          style={{
                            padding: "12px 10px",
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.7)",
                          }}
                        >
                          Total ({filtered.length} entries)
                        </td>
                        <td
                          style={{
                            padding: "12px 10px",
                            textAlign: "right",
                            fontWeight: 800,
                            fontSize: 16,
                            color: "#fca5a5",
                          }}
                        >
                          ₹{total.toLocaleString("en-IN")}
                        </td>
                        <td colSpan={2} className="no-print" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <LetterheadLayout
        printAreaId="expense-print"
        title="Expense Book Report"
        subtitle={start === "1970-01-01" ? "All Time" : `${start} to ${end}`}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", marginTop: 15 }}
        >
          <thead>
            <tr>
              {[
                "Date",
                "Category",
                "Description",
                "Amount (₹)",
                "Added By",
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
            {filtered.map((exp) => (
              <tr key={exp.id}>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  {formatDateOnly(exp.date)}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  {exp.category}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  {exp.description || "—"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                    textAlign: "right",
                  }}
                >
                  ₹{Number(exp.amount || 0).toLocaleString("en-IN")}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px 10px",
                    fontSize: "12pt",
                    color: "#000",
                  }}
                >
                  {exp.addedBy || "—"}
                </td>
              </tr>
            ))}
            <tr>
              <td
                colSpan={3}
                style={{
                  border: "1px solid #000",
                  padding: "8px 10px",
                  fontSize: "12pt",
                  color: "#000",
                  textAlign: "right",
                  fontWeight: "bold",
                }}
              >
                Total:
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "8px 10px",
                  fontSize: "12pt",
                  color: "#000",
                  textAlign: "right",
                  fontWeight: "bold",
                }}
              >
                ₹
                {filtered
                  .reduce((s, e) => s + Number(e.amount || 0), 0)
                  .toLocaleString("en-IN")}
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "8px 10px",
                  fontSize: "12pt",
                  color: "#000",
                }}
              />
            </tr>
          </tbody>
        </table>
      </LetterheadLayout>

      {/* Footer */}
      <div
        className="no-print"
        style={{
          textAlign: "center",
          color: "rgba(255,255,255,0.2)",
          fontSize: 12,
          marginTop: 24,
        }}
      >
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: "rgba(6,182,212,0.6)", textDecoration: "none" }}
        >
          caffeine.ai
        </a>
      </div>
    </div>
  );
}
