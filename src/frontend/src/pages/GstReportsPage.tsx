import BackButton from "@/components/BackButton";
import { fsGetCollection, fsGetSettings } from "@/utils/firestoreService";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const YEARS = Array.from({ length: 8 }, (_, i) => 2023 + i);

type GstOrder = {
  id?: string;
  createdAt?: number;
  invoiceNumber?: string;
  customerName?: string;
  customerGstin?: string;
  grandTotal?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  taxLines?: {
    hsnSac?: string;
    taxRate?: number;
    taxableValue?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    itemName?: string;
  }[];
  items?: { itemName?: string; hsnSac?: string }[];
};

const S = {
  page: {
    minHeight: "100vh",
    background: "#080d1a",
    color: "white",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    padding: "24px",
  } as React.CSSProperties,
  card: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    overflow: "hidden",
  } as React.CSSProperties,
  btn: (color: string) =>
    ({
      padding: "9px 18px",
      borderRadius: 8,
      border: "none",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 13,
      background: color,
      color: "white",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
    }) as React.CSSProperties,
  select: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    color: "white",
    padding: "8px 12px",
    fontSize: 13,
    cursor: "pointer",
  } as React.CSSProperties,
};

export default function GstReportsPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [orders, setOrders] = useState<GstOrder[]>([]);
  const [shopGstin, setShopGstin] = useState("");
  const [loading, setLoading] = useState(false);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [allOrders, cfg] = await Promise.all([
        fsGetCollection<any>("orders"),
        fsGetSettings<any>("appConfig"),
      ]);
      if (cfg?.shopGstNumber) setShopGstin(cfg.shopGstNumber);

      const filtered = allOrders.filter((o: any) => {
        if (!o.isGstInvoice) return false;
        const ts = o.createdAt ? new Date(o.createdAt) : null;
        if (!ts) return false;
        return (
          ts.getMonth() === selectedMonth && ts.getFullYear() === selectedYear
        );
      });
      setOrders(filtered);
    } catch {
      toast.error("Failed to load GST orders");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute summary
  const totalTaxable = orders.reduce((sum, o) => {
    const tv =
      (o.taxLines ?? []).length > 0
        ? (o.taxLines ?? []).reduce((s, t) => s + (t.taxableValue ?? 0), 0)
        : (o.grandTotal ?? 0) -
          (o.cgstAmount ?? 0) -
          (o.sgstAmount ?? 0) -
          (o.igstAmount ?? 0);
    return sum + tv;
  }, 0);
  const totalCgst = orders.reduce((s, o) => s + (o.cgstAmount ?? 0), 0);
  const totalSgst = orders.reduce((s, o) => s + (o.sgstAmount ?? 0), 0);
  const totalIgst = orders.reduce((s, o) => s + (o.igstAmount ?? 0), 0);

  function getInvoiceNo(o: GstOrder) {
    return (
      o.invoiceNumber || `INV-${String(o.id || o.createdAt || "").slice(-6)}`
    );
  }

  function getTaxableValue(o: GstOrder) {
    if ((o.taxLines ?? []).length > 0) {
      return (o.taxLines ?? []).reduce((s, t) => s + (t.taxableValue ?? 0), 0);
    }
    return (
      (o.grandTotal ?? 0) -
      (o.cgstAmount ?? 0) -
      (o.sgstAmount ?? 0) -
      (o.igstAmount ?? 0)
    );
  }

  function formatDate(ts?: number) {
    if (!ts) return "-";
    return new Date(ts).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function fmt(n: number) {
    return `₹${n.toFixed(2)}`;
  }

  function handleExportCsv() {
    if (orders.length === 0) {
      toast.error("No GST orders to export for this period.");
      return;
    }
    const rows: string[][] = [];
    const headers = [
      "Date",
      "Invoice No",
      "Customer Name",
      "Customer GSTIN",
      "Shop GSTIN",
      "HSN/SAC",
      "Tax Rate %",
      "Taxable Value",
      "CGST",
      "SGST",
      "IGST",
      "Total",
    ];
    rows.push(headers);

    for (const o of orders) {
      const date = formatDate(o.createdAt);
      const invNo = getInvoiceNo(o);
      const custName = o.customerName ?? "";
      const custGstin = o.customerGstin ?? "";

      if ((o.taxLines ?? []).length > 0) {
        for (const tl of o.taxLines ?? []) {
          rows.push([
            date,
            invNo,
            custName,
            custGstin,
            shopGstin,
            tl.hsnSac ?? "-",
            String(tl.taxRate ?? "-"),
            (tl.taxableValue ?? 0).toFixed(2),
            (tl.cgst ?? 0).toFixed(2),
            (tl.sgst ?? 0).toFixed(2),
            (tl.igst ?? 0).toFixed(2),
            (o.grandTotal ?? 0).toFixed(2),
          ]);
        }
      } else {
        const taxable = getTaxableValue(o);
        const totalGst =
          (o.cgstAmount ?? 0) + (o.sgstAmount ?? 0) + (o.igstAmount ?? 0);
        const taxRate =
          taxable > 0 ? ((totalGst / taxable) * 100).toFixed(0) : "-";
        const hsnSac =
          (o.items ?? [])
            .map((i: any) => i.hsnSac)
            .filter(Boolean)
            .join("/") || "-";
        rows.push([
          date,
          invNo,
          custName,
          custGstin,
          shopGstin,
          hsnSac,
          taxRate,
          taxable.toFixed(2),
          (o.cgstAmount ?? 0).toFixed(2),
          (o.sgstAmount ?? 0).toFixed(2),
          (o.igstAmount ?? 0).toFixed(2),
          (o.grandTotal ?? 0).toFixed(2),
        ]);
      }
    }

    const csv = rows
      .map((r) =>
        r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GST_Report_${MONTHS[selectedMonth]}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length - 1} rows successfully!`);
  }

  function handlePrint() {
    window.print();
  }

  const summaryCards = [
    {
      label: "Total Taxable Value",
      value: fmt(totalTaxable),
      color: "rgba(6,182,212,0.2)",
      border: "rgba(6,182,212,0.4)",
      text: "#67e8f9",
    },
    {
      label: "Total CGST",
      value: fmt(totalCgst),
      color: "rgba(139,92,246,0.2)",
      border: "rgba(139,92,246,0.4)",
      text: "#c4b5fd",
    },
    {
      label: "Total SGST",
      value: fmt(totalSgst),
      color: "rgba(16,185,129,0.2)",
      border: "rgba(16,185,129,0.4)",
      text: "#6ee7b7",
    },
    {
      label: "Total IGST",
      value: fmt(totalIgst),
      color: "rgba(245,158,11,0.2)",
      border: "rgba(245,158,11,0.4)",
      text: "#fcd34d",
    },
  ];

  const tableRows = orders.map((o, i) => ({
    idx: i + 1,
    date: formatDate(o.createdAt),
    invoiceNo: getInvoiceNo(o),
    customerName: o.customerName ?? "-",
    customerGstin: o.customerGstin ?? "-",
    taxable: getTaxableValue(o),
    cgst: o.cgstAmount ?? 0,
    sgst: o.sgstAmount ?? 0,
    igst: o.igstAmount ?? 0,
    total: o.grandTotal ?? 0,
  }));

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; color: black !important; }
          .gst-print-area { background: white !important; color: black !important; padding: 20px !important; }
          .gst-print-area table { width: 100%; border-collapse: collapse; }
          .gst-print-area th, .gst-print-area td { border: 1px solid #000; padding: 6px 8px; font-size: 10pt; color: black !important; background: white !important; }
          .gst-print-area th { background: #f2f2f2 !important; font-weight: bold; }
          .gst-print-area .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
          .gst-print-area .summary-card { border: 1px solid #ccc; padding: 8px; border-radius: 4px; }
          .gst-print-area .summary-card-label { font-size: 9pt; color: #666; }
          .gst-print-area .summary-card-value { font-size: 12pt; font-weight: bold; color: black; }
        }
        .print-only { display: none; }
      `}</style>

      <div style={S.page}>
        {/* Header */}
        <div className="no-print" style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <BackButton />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h1
                style={{
                  color: "white",
                  fontSize: 26,
                  fontWeight: 800,
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                🧾 GST Reports
              </h1>
              <p
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 13,
                  margin: "4px 0 0",
                }}
              >
                GSTR-1 Monthly Summary &amp; CA Export
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                data-ocid="gst_reports.export_csv.button"
                style={S.btn("rgba(16,185,129,0.85)")}
                onClick={handleExportCsv}
              >
                📥 Export CSV
              </button>
              <button
                type="button"
                data-ocid="gst_reports.print.button"
                style={S.btn("rgba(6,182,212,0.85)")}
                onClick={handlePrint}
              >
                🖨️ Print Report
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div
          className="no-print"
          style={{
            ...S.card,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            Filter by:
          </span>
          <select
            data-ocid="gst_reports.month.select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={S.select}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i} style={{ background: "#1a1f2e" }}>
                {m}
              </option>
            ))}
          </select>
          <select
            data-ocid="gst_reports.year.select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={S.select}
          >
            {YEARS.map((y) => (
              <option key={y} value={y} style={{ background: "#1a1f2e" }}>
                {y}
              </option>
            ))}
          </select>
          {loading && (
            <span style={{ color: "rgba(6,182,212,0.8)", fontSize: 12 }}>
              ⏳ Loading...
            </span>
          )}
          {!loading && (
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
              {orders.length} GST invoice(s) found
            </span>
          )}
        </div>

        {/* Print-only header */}
        <div className="print-only gst-print-area">
          <div
            style={{
              marginBottom: 12,
              borderBottom: "2px solid #000",
              paddingBottom: 8,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16 }}>
              ClikMate — GST Report — {MONTHS[selectedMonth]} {selectedYear}
            </h2>
            {shopGstin && (
              <p style={{ margin: "4px 0 0", fontSize: 11 }}>
                Shop GSTIN: {shopGstin}
              </p>
            )}
          </div>
          <div className="summary-cards">
            {summaryCards.map((c) => (
              <div key={c.label} className="summary-card">
                <div className="summary-card-label">{c.label}</div>
                <div className="summary-card-value">{c.value}</div>
              </div>
            ))}
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Invoice No</th>
                <th>Customer</th>
                <th>GSTIN</th>
                <th>Taxable Value</th>
                <th>CGST</th>
                <th>SGST</th>
                <th>IGST</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.idx}>
                  <td>{r.idx}</td>
                  <td>{r.date}</td>
                  <td>{r.invoiceNo}</td>
                  <td>{r.customerName}</td>
                  <td>{r.customerGstin}</td>
                  <td>{r.taxable.toFixed(2)}</td>
                  <td>{r.cgst.toFixed(2)}</td>
                  <td>{r.sgst.toFixed(2)}</td>
                  <td>{r.igst.toFixed(2)}</td>
                  <td>{r.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Cards */}
        <div
          className="no-print"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {summaryCards.map((c) => (
            <div
              key={c.label}
              data-ocid={`gst_reports.${c.label.toLowerCase().replace(/ /g, "_")}.card`}
              style={{
                ...S.card,
                padding: 20,
                background: c.color,
                border: `1px solid ${c.border}`,
              }}
            >
              <p
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 12,
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {c.label}
              </p>
              <p
                style={{
                  color: c.text,
                  fontSize: 22,
                  fontWeight: 800,
                  margin: "6px 0 0",
                }}
              >
                {c.value}
              </p>
            </div>
          ))}
        </div>

        {/* Data Table */}
        <div className="no-print" style={{ ...S.card }}>
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
                fontSize: 15,
                fontWeight: 700,
                margin: 0,
              }}
            >
              GST Invoice Register — {MONTHS[selectedMonth]} {selectedYear}
            </h3>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
              {orders.length} records
            </span>
          </div>
          {orders.length === 0 ? (
            <div
              data-ocid="gst_reports.table.empty_state"
              style={{
                padding: 48,
                textAlign: "center",
                color: "rgba(255,255,255,0.3)",
                fontSize: 14,
              }}
            >
              📭 No GST invoices found for {MONTHS[selectedMonth]}{" "}
              {selectedYear}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {[
                      "#",
                      "Date",
                      "Invoice No",
                      "Customer Name",
                      "Customer GSTIN",
                      "Taxable Value",
                      "CGST",
                      "SGST",
                      "IGST",
                      "Total",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 14px",
                          textAlign: "left",
                          color: "rgba(255,255,255,0.45)",
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, idx) => (
                    <tr
                      key={r.invoiceNo}
                      data-ocid={`gst_reports.table.item.${idx + 1}`}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.03)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 14px",
                          color: "rgba(255,255,255,0.4)",
                          fontSize: 12,
                        }}
                      >
                        {r.idx}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          color: "rgba(255,255,255,0.7)",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.date}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12 }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            color: "#67e8f9",
                            fontSize: 12,
                          }}
                        >
                          {r.invoiceNo}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          color: "white",
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {r.customerName}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          fontFamily: "monospace",
                          color: "rgba(255,255,255,0.6)",
                          fontSize: 11,
                        }}
                      >
                        {r.customerGstin}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          color: "#67e8f9",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {fmt(r.taxable)}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          color: "#c4b5fd",
                          fontSize: 12,
                        }}
                      >
                        {fmt(r.cgst)}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          color: "#6ee7b7",
                          fontSize: 12,
                        }}
                      >
                        {fmt(r.sgst)}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          color: "#fcd34d",
                          fontSize: 12,
                        }}
                      >
                        {fmt(r.igst)}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          color: "white",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {fmt(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid rgba(255,255,255,0.15)" }}>
                    <td
                      colSpan={5}
                      style={{
                        padding: "10px 14px",
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      Totals
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#67e8f9",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {fmt(totalTaxable)}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#c4b5fd",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {fmt(totalCgst)}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#6ee7b7",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {fmt(totalSgst)}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#fcd34d",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {fmt(totalIgst)}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "white",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {fmt(totalTaxable + totalCgst + totalSgst + totalIgst)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div
          className="no-print"
          style={{
            marginTop: 20,
            textAlign: "center",
            color: "rgba(255,255,255,0.2)",
            fontSize: 11,
          }}
        >
          GSTR-1 format export · Data from Firestore orders collection ·
          ClikMate ERP
        </div>
      </div>
    </>
  );
}
