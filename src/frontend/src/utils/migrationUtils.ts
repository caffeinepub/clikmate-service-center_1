/**
 * migrationUtils.ts
 * One-time migration: reads all ClikMate localStorage keys and
 * batch-writes them to their respective Firestore collections.
 * After a successful write, clears the localStorage key.
 */
import {
  FS_COLLECTIONS,
  fsBatchWrite,
  fsSetDoc,
  fsSetSettings,
} from "@/utils/firestoreService";

const LS_KEYS = {
  catalog: "clikmate_catalog_items",
  staff: "clikmate_staff_members",
  khata: "clikmate_khata_entries",
  attendance: "clikmate_clock_in_log",
  orders: "clikmate_pos_sales",
  categories: "clikmate_categories",
};

function lsRead<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export interface MigrationResult {
  success: boolean;
  counts: Record<string, number>;
  errors: string[];
}

export async function runCloudMigration(): Promise<MigrationResult> {
  const counts: Record<string, number> = {};
  const errors: string[] = [];

  // ── Array collections ────────────────────────────────────────────────────
  const arrayMigrations: Array<{
    lsKey: string;
    fsCol: string;
    label: string;
  }> = [
    { lsKey: LS_KEYS.catalog, fsCol: FS_COLLECTIONS.catalog, label: "catalog" },
    { lsKey: LS_KEYS.staff, fsCol: FS_COLLECTIONS.users, label: "users" },
    { lsKey: LS_KEYS.khata, fsCol: FS_COLLECTIONS.khata, label: "khata" },
    {
      lsKey: LS_KEYS.attendance,
      fsCol: FS_COLLECTIONS.attendance,
      label: "attendance",
    },
    { lsKey: LS_KEYS.orders, fsCol: FS_COLLECTIONS.orders, label: "orders" },
    {
      lsKey: LS_KEYS.categories,
      fsCol: FS_COLLECTIONS.categories,
      label: "categories",
    },
  ];

  for (const { lsKey, fsCol, label } of arrayMigrations) {
    try {
      const items = lsRead<Record<string, unknown>>(lsKey);
      const written = await fsBatchWrite(fsCol, items);
      counts[label] = written;
      if (written > 0) localStorage.removeItem(lsKey);
    } catch (e) {
      errors.push(`${label}: ${String(e)}`);
      counts[label] = 0;
    }
  }

  // ── Settings doc ────────────────────────────────────────────────────────
  try {
    const appConfig = {
      whatsappBotEnabled:
        localStorage.getItem("clikmate_whatsapp_bot_enabled") === "true",
      whatsappRateTemplate:
        localStorage.getItem("clikmate_whatsapp_rate_template") || "",
      logoUrl: localStorage.getItem("clikmate_logo_url") || "",
    };
    await fsSetSettings("appConfig", appConfig);
    counts.settings = 1;
    localStorage.removeItem("clikmate_whatsapp_bot_enabled");
    localStorage.removeItem("clikmate_whatsapp_rate_template");
    localStorage.removeItem("clikmate_logo_url");
  } catch (e) {
    errors.push(`settings: ${String(e)}`);
  }

  // ── Admin auth doc ───────────────────────────────────────────────────────
  try {
    const adminAuth = {
      email:
        localStorage.getItem("clikmate_admin_email") || "admin@clikmate.com",
      password: localStorage.getItem("clikmate_admin_password") || "admin123",
      masterKey: "CLIKMATE-ADMIN-2024",
    };
    await fsSetSettings("adminAuth", adminAuth);
    counts.adminAuth = 1;
    localStorage.removeItem("clikmate_admin_email");
    localStorage.removeItem("clikmate_admin_password");
  } catch (e) {
    errors.push(`adminAuth: ${String(e)}`);
  }

  return {
    success: errors.length === 0,
    counts,
    errors,
  };
}
