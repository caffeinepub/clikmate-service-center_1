import { db } from "@/firebase";
import {
  fsGetCollection,
  fsSetDoc,
  fsUpdateDoc,
} from "@/utils/firestoreService";
import { generateProductId } from "@/utils/storage";
import { collection, doc, writeBatch } from "firebase/firestore";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface CsvBulkUploaderProps {
  onImportComplete: () => void;
}

const EXPECTED_HEADERS = [
  "item name",
  "main category",
  "sub category",
  "purchase rate",
  "sale rate",
  "initial stock",
  // barcode, gst %, hsn/sac are optional trailing columns
];

const TEMPLATE_FILENAME = "clikmate-catalog-template.csv";
const TEMPLATE_CONTENT =
  "Item Name,Main Category,Sub Category,Purchase Rate,Sale Rate,Initial Stock,Barcode,GST %,HSN/SAC\nExample Product,Product,Electronics,100,150,20,,0,\n";

interface CatalogItem {
  id?: string;
  productId?: string;
  name?: string;
  itemType?: string;
  category?: string;
  purchaseRate?: number;
  saleRate?: number;
  quantity?: number;
  reorderLevel?: number;
  alertBefore?: number;
  published?: boolean;
  createdAt?: number;
  price?: string;
  stockStatus?: string;
  description?: string;
  requiredDocuments?: string;
  requiresPdfCalc?: boolean;
  mediaFiles?: unknown[];
  mediaTypes?: unknown[];
  barcode?: string;
  gstPercentage?: number;
  hsnSac?: string;
}

interface CategoryItem {
  id?: string;
  name?: string;
  appliesTo?: string;
}

export function CsvBulkUploader({ onImportComplete }: CsvBulkUploaderProps) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CONTENT], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = TEMPLATE_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can be re-uploaded
    e.target.value = "";

    setLoading(true);
    try {
      const text = await readFile(file);
      await processCSV(text);
    } catch (err) {
      console.error("CSV import error:", err);
      toast.error(`Import failed: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  async function processCSV(text: string) {
    const lines = text.replace(/\r/g, "").split("\n");
    if (lines.length === 0) {
      toast.error("CSV file is empty");
      return;
    }

    // Validate headers
    const headerRow = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const headersMatch = EXPECTED_HEADERS.every((h, i) => headerRow[i] === h);
    if (!headersMatch) {
      toast.error("Invalid CSV format. Please use the downloaded template.");
      return;
    }

    // Parse data rows
    const dataRows = lines.slice(1).filter((l) => l.trim() !== "");
    if (dataRows.length === 0) {
      toast.error("CSV has no data rows");
      return;
    }

    // Fetch existing catalog + categories in parallel
    const [existingItems, existingCategories] = await Promise.all([
      fsGetCollection<CatalogItem>("catalog"),
      fsGetCollection<CategoryItem>("categories"),
    ]);

    // Build duplicate-check map (name -> item)
    const nameMap = new Map<string, CatalogItem>();
    for (const item of existingItems) {
      if (item.name) nameMap.set(item.name.toLowerCase(), item);
    }

    // Build category lookup ("name|appliesTo" -> true)
    const catSet = new Set<string>();
    for (const cat of existingCategories) {
      if (cat.name && cat.appliesTo) {
        catSet.add(`${cat.name.toLowerCase()}|${cat.appliesTo}`);
      }
    }

    // Track max product ID for sequential assignment
    let maxId = 1000;
    for (const item of existingItems) {
      if (item.productId?.startsWith("ITM-")) {
        const num = Number.parseInt(item.productId.replace("ITM-", ""), 10);
        if (!Number.isNaN(num) && num >= maxId) maxId = num + 1;
      }
    }

    // Separate new items (for batch write) from updates
    const newItems: CatalogItem[] = [];
    const updates: Array<{ id: string; patch: Partial<CatalogItem> }> = [];

    let catIndex = 0;
    for (const line of dataRows) {
      const cols = line.split(",").map((c) => c.trim());
      const itemName = cols[0] || "";
      const rawMainCategory = (cols[1] || "product").toLowerCase();
      const subCategory = cols[2] || "";
      const purchaseRate = Number.parseFloat(cols[3]) || 0;
      const saleRate = Number.parseFloat(cols[4]) || 0;
      const initialStock = Number.parseInt(cols[5], 10) || 0;
      const barcode = cols[6]?.trim() || "";
      const gstPercentage = Number.parseFloat(cols[7] || "0") || 0;
      const hsnSac = cols[8]?.trim() || "";

      if (!itemName) continue;

      const itemType: "product" | "service" =
        rawMainCategory === "service" ? "service" : "product";
      const isProduct = itemType === "product";

      // Auto-create sub-category if missing
      const catKey = `${subCategory.toLowerCase()}|${itemType}`;
      if (subCategory && !catSet.has(catKey)) {
        const newCatId = `csv-${Date.now()}-${catIndex++}`;
        await fsSetDoc("categories", newCatId, {
          id: newCatId,
          name: subCategory,
          appliesTo: itemType,
        });
        catSet.add(catKey);
      }

      // Duplicate check by name
      const existing = nameMap.get(itemName.toLowerCase());
      if (existing) {
        // Update existing
        const docId = existing.id || existing.productId || "";
        if (docId) {
          updates.push({
            id: docId,
            patch: {
              saleRate,
              purchaseRate: isProduct ? purchaseRate : 0,
              quantity: isProduct ? initialStock : 0,
              category: subCategory,
              itemType,
              price: String(saleRate),
              stockStatus:
                isProduct && initialStock <= 0 ? "out_of_stock" : "available",
              barcode,
              gstPercentage,
              hsnSac,
            },
          });
        }
      } else {
        // New item
        const productId = `ITM-${maxId++}`;
        newItems.push({
          productId,
          name: itemName,
          itemType,
          category: subCategory,
          purchaseRate: isProduct ? purchaseRate : 0,
          saleRate,
          quantity: isProduct ? initialStock : 0,
          reorderLevel: 5,
          alertBefore: 5,
          published: true,
          createdAt: Date.now(),
          price: String(saleRate),
          stockStatus:
            isProduct && initialStock <= 0 ? "out_of_stock" : "available",
          barcode,
          gstPercentage,
          hsnSac,
          description: "",
          requiredDocuments: "",
          requiresPdfCalc: false,
          mediaFiles: [],
          mediaTypes: [],
        });
      }
    }

    // Batch write new items
    if (newItems.length > 0) {
      const batch = writeBatch(db);
      for (const item of newItems) {
        const ref = doc(collection(db, "catalog"), item.productId!);
        batch.set(ref, item);
      }
      await batch.commit();
    }

    // Apply updates individually
    for (const { id, patch } of updates) {
      await fsUpdateDoc("catalog", id, patch);
    }

    const total = newItems.length + updates.length;
    toast.success(
      `✓ ${total} item${total !== 1 ? "s" : ""} imported successfully (${newItems.length} new, ${updates.length} updated)`,
    );
    onImportComplete();
  }

  const baseStyle: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 10,
    cursor: loading ? "not-allowed" : "pointer",
    fontWeight: 600,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
    opacity: loading ? 0.6 : 1,
    transition: "opacity 0.2s",
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={handleFileChange}
        data-ocid="catalog.upload_button"
      />

      {/* Download Template Button */}
      <button
        type="button"
        disabled={loading}
        onClick={downloadTemplate}
        data-ocid="catalog.secondary_button"
        style={{
          ...baseStyle,
          border: "1px solid rgba(99,102,241,0.4)",
          background: "rgba(99,102,241,0.12)",
          color: "#818cf8",
        }}
      >
        {loading ? (
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid #818cf8",
              borderTopColor: "transparent",
              display: "inline-block",
              animation: "spin 0.7s linear infinite",
            }}
          />
        ) : (
          "⬇"
        )}{" "}
        CSV Template
      </button>

      {/* Upload CSV Button */}
      <button
        type="button"
        disabled={loading}
        onClick={handleUploadClick}
        data-ocid="catalog.primary_button"
        style={{
          ...baseStyle,
          border: "1px solid rgba(34,197,94,0.4)",
          background: "rgba(34,197,94,0.12)",
          color: "#4ade80",
        }}
      >
        {loading ? (
          <>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                border: "2px solid #4ade80",
                borderTopColor: "transparent",
                display: "inline-block",
                animation: "spin 0.7s linear infinite",
              }}
            />
            Importing...
          </>
        ) : (
          <>⬆ Upload CSV</>
        )}
      </button>
    </>
  );
}
