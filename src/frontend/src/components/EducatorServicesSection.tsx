import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Award,
  BookOpen,
  CheckCircle,
  ChevronDown,
  FileText,
  Loader2,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalBlob } from "../backend";
import { useActor } from "../hooks/useActor";

const LANGUAGE_OPTIONS = [
  { value: "English (Times New Roman)", label: "English (Times New Roman)" },
  { value: "Hindi (Noto Serif)", label: "Hindi (Noto Serif)" },
  { value: "Bilingual", label: "Bilingual (EN + HI)" },
];

export default function EducatorServicesSection() {
  const { actor } = useActor();
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [instituteName, setInstituteName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [layout, setLayout] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const rawFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  function toggleLanguage(val: string) {
    setLanguages((prev) =>
      prev.includes(val) ? prev.filter((l) => l !== val) : [...prev, val],
    );
  }

  function resetForm() {
    setInstituteName("");
    setContactNumber("");
    setSubject("");
    setLayout("");
    setLanguages([]);
    setRawFile(null);
    setLogoFile(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instituteName.trim()) {
      toast.error("Please enter your Institute Name.");
      return;
    }
    if (contactNumber.length !== 10) {
      toast.error("Please enter a valid 10-digit contact number.");
      return;
    }
    if (!subject) {
      toast.error("Please select a subject.");
      return;
    }
    if (!layout) {
      toast.error("Please select a layout option.");
      return;
    }
    if (languages.length === 0) {
      toast.error("Please select at least one language option.");
      return;
    }
    if (!rawFile) {
      toast.error("Please upload your raw material (notes/Word doc).");
      return;
    }
    if (!actor) {
      toast.error("Service unavailable. Please try again.");
      return;
    }

    setSubmitting(true);
    try {
      // Mock file upload: save filename as string instead of raw File object
      const fileUrl = rawFile.name;
      const logoUrl = logoFile ? logoFile.name : "";

      const langStr = languages.join(" / ");
      const formatStr = logoUrl ? `${layout} | Logo: ${logoUrl}` : layout;

      await actor.submitTypesettingQuoteRequest({
        name: instituteName,
        phone: contactNumber,
        subject,
        format: formatStr,
        language: langStr,
        fileUrl,
      });
      setSubmitted(true);
      resetForm();
      toast.success("Quote request sent! We'll contact you within 2 hours.");
    } catch (err) {
      console.error("B2B Submission Error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Submission failed: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="py-24 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #0a0f1e 0%, #0d1631 50%, #0f1a2e 100%)",
      }}
    >
      {/* Decorative orbs */}
      <div
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(234,179,8,0.08) 0%, transparent 70%)",
          transform: "translate(30%, -30%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)",
          transform: "translate(-30%, 30%)",
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span
              className="text-xs font-bold px-3 py-1 rounded-full tracking-widest uppercase"
              style={{
                background: "rgba(234,179,8,0.15)",
                color: "#fbbf24",
                border: "1px solid rgba(234,179,8,0.3)",
              }}
            >
              🏛️ For Coaching Institutes &amp; Educators
            </span>
          </div>
          <h2
            className="text-4xl md:text-5xl font-extrabold mb-4"
            style={{ color: "white", letterSpacing: "-0.02em" }}
          >
            Premium Educator <span style={{ color: "#fbbf24" }}>Services</span>
          </h2>
          <p
            className="text-base max-w-xl mx-auto"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            High-quality bulk printing &amp; expert typesetting for coaching
            centers, schools &amp; educational institutes in Raipur.
          </p>

          {/* B2B Partner Program Badge */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
              style={{
                background: "linear-gradient(135deg, #78350f, #92400e)",
                border: "1px solid rgba(234,179,8,0.5)",
                boxShadow: "0 0 20px rgba(234,179,8,0.15)",
              }}
            >
              <Award style={{ width: 16, height: 16, color: "#fbbf24" }} />
              <span
                style={{
                  color: "#fde68a",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: "0.05em",
                }}
              >
                B2B Partner Program
              </span>
            </div>
          </div>
        </div>

        {/* Quick Feature Pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {[
            { icon: "📚", text: "Bilingual Hindi & English" },
            { icon: "🔢", text: "LaTeX Math Formulas" },
            { icon: "🏛️", text: "Custom Institute Branding" },
            { icon: "⚡", text: "24–48 Hour Delivery" },
            { icon: "📦", text: "Bulk Printing Discounts" },
          ].map((f) => (
            <span
              key={f.text}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <span>{f.icon}</span> {f.text}
            </span>
          ))}
        </div>

        {/* Main B2B Feature Card */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #141e3c, #1a2550)",
            border: "1px solid rgba(234,179,8,0.25)",
            boxShadow:
              "0 25px 80px rgba(0,0,0,0.5), 0 0 40px rgba(234,179,8,0.05)",
          }}
        >
          {/* Card Header */}
          <div
            className="px-8 py-7 flex items-start gap-5"
            style={{
              background:
                "linear-gradient(135deg, rgba(234,179,8,0.08) 0%, rgba(99,102,241,0.08) 100%)",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, #d97706, #f59e0b)",
                boxShadow: "0 8px 24px rgba(234,179,8,0.3)",
              }}
            >
              <BookOpen className="w-8 h-8" style={{ color: "#1a1a1a" }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center flex-wrap gap-2 mb-2">
                <span
                  className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(234,179,8,0.2)",
                    color: "#fbbf24",
                    border: "1px solid rgba(234,179,8,0.3)",
                  }}
                >
                  🏆 Premium B2B Service
                </span>
                <span
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(99,102,241,0.2)",
                    color: "#a5b4fc",
                  }}
                >
                  Custom Quote
                </span>
              </div>
              <h3
                className="text-2xl font-bold"
                style={{ color: "white", letterSpacing: "-0.01em" }}
              >
                Premium Question Paper Design &amp; Bulk Printing
              </h3>
              <p
                className="text-sm mt-1.5"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                For Coaching Institutes · Bilingual / LaTeX · Exam-Ready Quality
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="px-8 py-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              "Hindi & English bilingual support",
              "LaTeX & Word doc input accepted",
              "Two-column / single-column format",
              "Handwritten notes accepted",
              "Custom institute header/logo",
              "Bulk order discounts available",
            ].map((feat) => (
              <div
                key={feat}
                className="flex items-center gap-2 text-xs"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                <CheckCircle
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "#34d399" }}
                />
                {feat}
              </div>
            ))}
          </div>

          {/* LaTeX Feature Highlight Box */}
          <div className="px-8 pb-2">
            <div
              className="flex items-start gap-3 rounded-2xl px-5 py-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))",
                border: "1px solid rgba(99,102,241,0.3)",
              }}
            >
              <Zap
                className="w-5 h-5 mt-0.5 shrink-0"
                style={{ color: "#818cf8" }}
              />
              <p className="text-sm" style={{ color: "#c7d2fe" }}>
                <strong style={{ color: "#a5b4fc" }}>
                  ⚡ Expert LaTeX Typesetting
                </strong>{" "}
                — Crisp mathematical formulas, perfect formatting, and
                error-free numbering &amp; marks distribution.
              </p>
            </div>
          </div>

          {/* Expand Toggle */}
          <button
            type="button"
            data-ocid="educator.form.toggle"
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-8 py-5 transition-colors text-left"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.07)",
              color: expanded ? "#fbbf24" : "rgba(255,255,255,0.7)",
              background: expanded
                ? "rgba(234,179,8,0.05)"
                : "rgba(255,255,255,0.02)",
            }}
          >
            <span className="font-semibold text-sm">
              {expanded
                ? "— Hide Request Form"
                : "📋 Request Custom Quote — Fill Details"}
            </span>
            <ChevronDown
              className={`w-5 h-5 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Expandable Form */}
          {expanded && (
            <div className="px-8 pb-10 pt-2">
              {submitted ? (
                <div
                  data-ocid="educator.form.success_state"
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
                    style={{ background: "rgba(16,185,129,0.15)" }}
                  >
                    <CheckCircle
                      className="w-10 h-10"
                      style={{ color: "#34d399" }}
                    />
                  </div>
                  <h3
                    className="text-2xl font-bold mb-2"
                    style={{ color: "white" }}
                  >
                    Quote Request Sent! 🎉
                  </h3>
                  <p
                    className="max-w-sm text-sm"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    Your request has been flagged as a{" "}
                    <strong style={{ color: "#fbbf24" }}>B2B Lead</strong> in
                    our Admin panel. We&apos;ll contact you on WhatsApp within{" "}
                    <strong style={{ color: "white" }}>2 hours</strong> with a
                    custom price estimate.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      resetForm();
                    }}
                    className="mt-6 text-sm underline"
                    style={{ color: "#fbbf24" }}
                  >
                    Submit another request
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-6 pt-4"
                >
                  {/* Row 1: Institute Name + Contact */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <Label
                        htmlFor="edu-institute"
                        className="text-xs font-semibold mb-1.5 block uppercase tracking-wider"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
                        Institute Name *
                      </Label>
                      <Input
                        id="edu-institute"
                        data-ocid="educator.name.input"
                        value={instituteName}
                        onChange={(e) => setInstituteName(e.target.value)}
                        placeholder="e.g. Shri Ram Coaching Center"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "white",
                          borderRadius: 10,
                        }}
                        className="placeholder:text-gray-600"
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="edu-contact"
                        className="text-xs font-semibold mb-1.5 block uppercase tracking-wider"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
                        Contact Number (WhatsApp) *
                      </Label>
                      <div
                        className="flex items-center rounded-xl overflow-hidden"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <span
                          className="px-3 py-2.5 text-sm border-r"
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            borderColor: "rgba(255,255,255,0.12)",
                          }}
                        >
                          +91
                        </span>
                        <input
                          id="edu-contact"
                          data-ocid="educator.phone.input"
                          type="tel"
                          value={contactNumber}
                          onChange={(e) =>
                            setContactNumber(
                              e.target.value.replace(/\D/g, "").slice(0, 10),
                            )
                          }
                          placeholder="9876543210"
                          className="flex-1 px-3 py-2.5 text-sm outline-none"
                          style={{
                            background: "transparent",
                            color: "white",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Subject + Layout */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <Label
                        className="text-xs font-semibold mb-1.5 block uppercase tracking-wider"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
                        Subject Category *
                      </Label>
                      <Select value={subject} onValueChange={setSubject}>
                        <SelectTrigger
                          data-ocid="educator.subject.select"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: subject ? "white" : "rgba(255,255,255,0.35)",
                            borderRadius: 10,
                          }}
                        >
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Physics">Physics</SelectItem>
                          <SelectItem value="Chemistry">Chemistry</SelectItem>
                          <SelectItem value="Mathematics">
                            Mathematics
                          </SelectItem>
                          <SelectItem value="Biology">Biology</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label
                        className="text-xs font-semibold mb-1.5 block uppercase tracking-wider"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
                        Layout Options *
                      </Label>
                      <Select value={layout} onValueChange={setLayout}>
                        <SelectTrigger
                          data-ocid="educator.format.select"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: layout ? "white" : "rgba(255,255,255,0.35)",
                            borderRadius: 10,
                          }}
                        >
                          <SelectValue placeholder="Select layout" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Single Column">
                            Single Column
                          </SelectItem>
                          <SelectItem value="Two-Column with Vertical Line">
                            Two-Column with Vertical Line
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Language Checkboxes */}
                  <div>
                    <Label
                      className="text-xs font-semibold mb-3 block uppercase tracking-wider"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      Language &amp; Typesetting *
                    </Label>
                    <div className="flex flex-wrap gap-3">
                      {LANGUAGE_OPTIONS.map((opt) => {
                        const checked = languages.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            data-ocid="educator.language.toggle"
                            onClick={() => toggleLanguage(opt.value)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                            style={{
                              background: checked
                                ? "rgba(234,179,8,0.2)"
                                : "rgba(255,255,255,0.05)",
                              border: checked
                                ? "1px solid rgba(234,179,8,0.5)"
                                : "1px solid rgba(255,255,255,0.12)",
                              color: checked
                                ? "#fde68a"
                                : "rgba(255,255,255,0.6)",
                            }}
                          >
                            <span
                              className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                              style={{
                                background: checked
                                  ? "#d97706"
                                  : "rgba(255,255,255,0.1)",
                                border: checked
                                  ? "none"
                                  : "1px solid rgba(255,255,255,0.2)",
                              }}
                            >
                              {checked && (
                                <CheckCircle
                                  className="w-3 h-3"
                                  style={{ color: "white" }}
                                />
                              )}
                            </span>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* File Uploads */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Raw Material */}
                    <div>
                      <Label
                        className="text-xs font-semibold mb-1.5 block uppercase tracking-wider"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
                        Upload Raw Material *
                      </Label>
                      <button
                        type="button"
                        className="w-full rounded-xl p-4 text-center cursor-pointer transition-all"
                        style={{
                          border: rawFile
                            ? "2px solid rgba(52,211,153,0.5)"
                            : "2px dashed rgba(255,255,255,0.15)",
                          background: rawFile
                            ? "rgba(52,211,153,0.05)"
                            : "rgba(255,255,255,0.02)",
                        }}
                        onClick={() => rawFileRef.current?.click()}
                      >
                        <input
                          ref={rawFileRef}
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) setRawFile(f);
                          }}
                          className="hidden"
                          data-ocid="educator.file.upload_button"
                        />
                        {rawFile ? (
                          <div className="flex items-center justify-center gap-2">
                            <FileText
                              className="w-5 h-5"
                              style={{ color: "#34d399" }}
                            />
                            <span
                              className="text-xs font-medium truncate max-w-[150px]"
                              style={{ color: "rgba(255,255,255,0.8)" }}
                            >
                              {rawFile.name}
                            </span>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setRawFile(null);
                              }}
                              style={{ color: "rgba(255,255,255,0.35)" }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p
                              className="text-xs font-medium"
                              style={{ color: "rgba(255,255,255,0.4)" }}
                            >
                              📎 Handwritten notes, Word docs, PDFs
                            </p>
                          </div>
                        )}
                      </button>
                    </div>

                    {/* Institute Logo */}
                    <div>
                      <Label
                        className="text-xs font-semibold mb-1.5 block uppercase tracking-wider"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
                        Institute Logo{" "}
                        <span
                          style={{
                            color: "rgba(255,255,255,0.3)",
                            fontWeight: 400,
                            textTransform: "none",
                            letterSpacing: 0,
                            fontSize: 10,
                          }}
                        >
                          (Optional — added to every page header)
                        </span>
                      </Label>
                      <button
                        type="button"
                        className="w-full rounded-xl p-4 text-center cursor-pointer transition-all"
                        style={{
                          border: logoFile
                            ? "2px solid rgba(234,179,8,0.5)"
                            : "2px dashed rgba(255,255,255,0.15)",
                          background: logoFile
                            ? "rgba(234,179,8,0.05)"
                            : "rgba(255,255,255,0.02)",
                        }}
                        onClick={() => logoFileRef.current?.click()}
                      >
                        <input
                          ref={logoFileRef}
                          type="file"
                          accept=".png,.jpg,.jpeg,.svg"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) setLogoFile(f);
                          }}
                          className="hidden"
                          data-ocid="educator.logo.upload_button"
                        />
                        {logoFile ? (
                          <div className="flex items-center justify-center gap-2">
                            <Award
                              className="w-5 h-5"
                              style={{ color: "#fbbf24" }}
                            />
                            <span
                              className="text-xs font-medium truncate max-w-[150px]"
                              style={{ color: "rgba(255,255,255,0.8)" }}
                            >
                              {logoFile.name}
                            </span>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setLogoFile(null);
                              }}
                              style={{ color: "rgba(255,255,255,0.35)" }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p
                              className="text-xs font-medium"
                              style={{ color: "rgba(255,255,255,0.4)" }}
                            >
                              🏛️ Upload PNG / JPG logo
                            </p>
                          </div>
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    data-ocid="educator.form.submit_button"
                    disabled={submitting}
                    className="font-bold rounded-xl py-6 text-base border-0"
                    style={{
                      background: submitting
                        ? "rgba(234,179,8,0.4)"
                        : "linear-gradient(135deg, #d97706, #f59e0b)",
                      color: "#111",
                      boxShadow: submitting
                        ? "none"
                        : "0 8px 24px rgba(234,179,8,0.3)",
                    }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Sending Quote Request...
                      </>
                    ) : (
                      "📩 Request Custom Quote"
                    )}
                  </Button>

                  <p
                    className="text-xs text-center"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    Our team will analyze your requirements and send a detailed
                    custom quote on WhatsApp within 2 hours.
                  </p>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
