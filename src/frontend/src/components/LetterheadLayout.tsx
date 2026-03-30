import { db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

interface BusinessProfile {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  proprietorName: string;
  shopGstNumber?: string;
}

interface LetterheadLayoutProps {
  printAreaId: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

let _profileCache: BusinessProfile | null = null;

// Export cache invalidation for use after saving business profile
export function invalidateLetterheadCache() {
  _profileCache = null;
}

export function triggerPrint(printAreaId: string) {
  const el = document.getElementById(printAreaId);
  if (!el) {
    console.warn(`[triggerPrint] Element #${printAreaId} not found`);
    return;
  }

  // Make the print area visible BEFORE injecting print CSS and calling print
  el.style.display = "block";

  const styleId = `print-override-${printAreaId}`;
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }

  // Use visibility approach so nested elements work regardless of parent nesting
  style.textContent = `
    @media print {
      body * { visibility: hidden !important; }
      #${printAreaId}, #${printAreaId} * { visibility: visible !important; }
      #${printAreaId} {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        display: block !important;
      }
      @page { size: A4 portrait; margin: 15mm; }
    }
  `;

  window.print();

  window.addEventListener(
    "afterprint",
    () => {
      el.style.display = "none";
      style?.remove();
    },
    { once: true },
  );
}

export function LetterheadLayout({
  printAreaId,
  title,
  subtitle,
  children,
}: LetterheadLayoutProps) {
  const [profile, setProfile] = useState<BusinessProfile>(
    _profileCache ?? {
      shopName: "ClikMate Service Center",
      shopAddress: "Raipur, C.G.",
      shopPhone: "+91 9508911400",
      proprietorName: "Proprietor",
      shopGstNumber: "",
    },
  );

  useEffect(() => {
    if (_profileCache) {
      setProfile(_profileCache);
      return;
    }
    getDoc(doc(db, "settings", "businessProfile"))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as BusinessProfile;
          _profileCache = data;
          setProfile(data);
        }
      })
      .catch(() => {});
  }, []);

  const printedDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div id={printAreaId} style={{ display: "none" }}>
      <div
        className="a4-letterhead-wrapper"
        style={{
          background: "white",
          color: "black",
          fontFamily: "Arial, sans-serif",
          width: "100%",
          minHeight: "100vh",
          padding: 0,
          boxSizing: "border-box",
        }}
      >
        {/* Letterhead Header */}
        <div
          style={{
            borderBottom: "3px double #1e40af",
            paddingBottom: 12,
            marginBottom: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: "#1e3a8a",
                  margin: "0 0 2px 0",
                }}
              >
                {profile.shopName}
              </h1>
              <p style={{ margin: "2px 0", fontSize: 11, color: "#444" }}>
                {profile.shopAddress}
                {profile.shopPhone ? ` | Ph: ${profile.shopPhone}` : ""}
              </p>
              {profile.shopGstNumber && (
                <p style={{ margin: "2px 0", fontSize: 11, color: "#444" }}>
                  GSTIN: {profile.shopGstNumber}
                </p>
              )}
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: "#555" }}>
              <div>Printed: {printedDate}</div>
            </div>
          </div>
        </div>

        {/* Report Title Bar */}
        <div
          style={{
            borderBottom: "1px solid #ccc",
            padding: "8px 0",
            marginBottom: 4,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <strong style={{ fontSize: 13, color: "#111" }}>{title}</strong>
            {subtitle && (
              <span style={{ fontSize: 11, color: "#555", marginLeft: 8 }}>
                {subtitle}
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: "#555" }}>{printedDate}</span>
        </div>

        {/* Content */}
        <div style={{ width: "100%" }}>{children}</div>

        {/* Authorized Signature Block */}
        <div
          style={{
            marginTop: 60,
            textAlign: "right",
            paddingTop: 12,
            borderTop: "1px solid #ccc",
          }}
        >
          <div
            style={{
              display: "inline-block",
              textAlign: "center",
              minWidth: 200,
            }}
          >
            <div
              style={{
                borderBottom: "1px solid #333",
                marginBottom: 4,
                paddingBottom: 20,
                width: "100%",
              }}
            />
            <div style={{ fontSize: 11, fontWeight: 700, color: "#111" }}>
              Authorized Signatory
            </div>
            <div style={{ fontSize: 10, color: "#555" }}>
              For {profile.shopName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
