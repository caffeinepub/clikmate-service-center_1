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
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  CloudUpload,
  FileText,
  Loader2,
  Lock,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalBlob } from "../backend";
import { useActor } from "../hooks/useActor";

const SERVICE_TYPES = [
  "B&W Bulk Printing",
  "Color Printing",
  "Bilingual LaTeX Typesetting",
  "PVC Smart Card",
];

const PRINTING_SERVICES = ["B&W Bulk Printing", "Color Printing"];

function detectPdfPageCount(buffer: ArrayBuffer): number {
  try {
    const bytes = new Uint8Array(buffer);
    let text = "";
    for (let i = 0; i < bytes.length; i++) {
      text += String.fromCharCode(bytes[i]);
    }
    const matches = text.match(/\/Type\s*\/Page[^s]/g);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

export default function UploadSection() {
  const { actor } = useActor();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [orderId, setOrderId] = useState<bigint | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [printType, setPrintType] = useState<"bw" | "color">("bw");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPrintingService = PRINTING_SERVICES.includes(serviceType);
  const printRate = printType === "bw" ? 2 : 10;
  const estimatedCost = pageCount * printRate;

  const handleFile = useCallback(
    async (f: File) => {
      const allowed = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
      ];
      if (!allowed.includes(f.type)) {
        toast.error("Only PDF and JPG/PNG files are allowed.");
        return;
      }
      if (f.size > 20 * 1024 * 1024) {
        toast.error("File size must be under 20MB.");
        return;
      }
      setFile(f);
      setPageCount(0);

      if (
        f.type === "application/pdf" &&
        PRINTING_SERVICES.includes(serviceType)
      ) {
        try {
          const buffer = await f.arrayBuffer();
          const count = detectPdfPageCount(buffer);
          setPageCount(count);
        } catch {
          setPageCount(0);
        }
      }
    },
    [serviceType],
  );

  async function handleServiceTypeChange(value: string) {
    setServiceType(value);
    if (value === "B&W Bulk Printing") setPrintType("bw");
    else if (value === "Color Printing") setPrintType("color");

    // Re-detect page count if file already uploaded and it's a PDF printing service
    if (
      file &&
      file.type === "application/pdf" &&
      PRINTING_SERVICES.includes(value)
    ) {
      try {
        const buffer = await file.arrayBuffer();
        const count = detectPdfPageCount(buffer);
        setPageCount(count);
      } catch {
        setPageCount(0);
      }
    } else if (!PRINTING_SERVICES.includes(value)) {
      setPageCount(0);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  function handleDragOver(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (phone.replace(/\D/g, "").length !== 10) {
      toast.error("Please enter a valid 10-digit WhatsApp number.");
      return;
    }
    if (!serviceType) {
      toast.error("Please select a service type.");
      return;
    }
    if (!file) {
      toast.error("Please upload a file.");
      return;
    }
    if (!actor) {
      toast.error("Service unavailable. Please try again.");
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const blob = ExternalBlob.fromBytes(bytes).withUploadProgress((pct) =>
        setUploadProgress(pct),
      );
      const id = await actor.submitOrderFull({
        name,
        phone: phone.replace(/\D/g, ""),
        serviceType,
        instructions,
        files: [blob],
      });
      setOrderId(id);
      toast.success("Order submitted! We will contact you shortly.");
    } catch (err) {
      console.error(err);
      toast.error("Submission failed. Please call us directly.");
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  }

  function handleReset() {
    setName("");
    setPhone("");
    setServiceType("");
    setInstructions("");
    setFile(null);
    setOrderId(null);
    setPageCount(0);
    setPrintType("bw");
  }

  return (
    <section id="upload" className="py-20 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 hero-gradient opacity-100" />
      <div
        className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: "oklch(0.87 0.185 95)",
          opacity: 0.07,
          transform: "translate(30%, -30%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-60 h-60 rounded-full pointer-events-none"
        style={{
          background: "white",
          opacity: 0.04,
          transform: "translate(-30%, 30%)",
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-10">
          <span className="inline-block yellow-bg text-gray-900 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            Secure Upload
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Upload &amp; Print Securely
          </h2>
          <p className="text-blue-200 mt-3 text-base">
            Submit your documents safely. We guarantee zero leaks.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {orderId !== null ? (
            <div
              data-ocid="upload.form.success_state"
              className="flex flex-col items-center justify-center py-10 text-center"
            >
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-2xl font-bold blue-text mb-2">
                Order Submitted!
              </h3>
              <p className="text-gray-500 mb-2">
                Your order has been received. We&apos;ll contact you on WhatsApp
                shortly.
              </p>
              <div
                className="inline-block px-4 py-2 rounded-xl text-sm font-mono font-semibold blue-text border border-blue-100 mb-6"
                style={{ background: "oklch(0.95 0.04 256)" }}
              >
                Order ID: #{String(orderId)}
              </div>
              <Button
                type="button"
                onClick={handleReset}
                data-ocid="upload.form.submit_another.button"
                className="yellow-bg text-gray-900 font-semibold rounded-xl border-0 hover:opacity-90"
              >
                Submit Another Order
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Full Name */}
                <div>
                  <Label
                    htmlFor="up-name"
                    className="text-sm font-semibold blue-text mb-1.5 block"
                  >
                    Full Name *
                  </Label>
                  <Input
                    id="up-name"
                    data-ocid="upload.name.input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="rounded-xl border-gray-200 focus-visible:ring-blue-500"
                  />
                </div>
                {/* WhatsApp */}
                <div>
                  <Label
                    htmlFor="up-phone"
                    className="text-sm font-semibold blue-text mb-1.5 block"
                  >
                    WhatsApp Number *
                  </Label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                    <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm border-r border-gray-200">
                      +91
                    </span>
                    <input
                      id="up-phone"
                      data-ocid="upload.phone.input"
                      type="tel"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      placeholder="9876543210"
                      className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Service Type */}
              <div>
                <Label className="text-sm font-semibold blue-text mb-1.5 block">
                  Service Type *
                </Label>
                <Select
                  value={serviceType}
                  onValueChange={handleServiceTypeChange}
                >
                  <SelectTrigger
                    data-ocid="upload.service_type.select"
                    className="rounded-xl border-gray-200 focus:ring-blue-500"
                  >
                    <SelectValue placeholder="Select a service..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {SERVICE_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Print Type Radio — only for printing services */}
              {isPrintingService && (
                <div>
                  <Label className="text-sm font-semibold blue-text mb-2 block">
                    Print Type *
                  </Label>
                  <div className="flex gap-3">
                    <label
                      htmlFor="print-bw"
                      className={`flex items-center gap-3 flex-1 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        printType === "bw"
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        id="print-bw"
                        type="radio"
                        data-ocid="upload.print_bw.radio"
                        name="printType"
                        value="bw"
                        checked={printType === "bw"}
                        onChange={() => setPrintType("bw")}
                        className="accent-blue-600"
                      />
                      <div>
                        <div className="font-semibold text-sm text-gray-800">
                          ⬜ Black &amp; White
                        </div>
                        <div className="text-xs text-gray-500">₹2 / page</div>
                      </div>
                    </label>
                    <label
                      htmlFor="print-color"
                      className={`flex items-center gap-3 flex-1 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        printType === "color"
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        id="print-color"
                        type="radio"
                        data-ocid="upload.print_color.radio"
                        name="printType"
                        value="color"
                        checked={printType === "color"}
                        onChange={() => setPrintType("color")}
                        className="accent-purple-600"
                      />
                      <div>
                        <div className="font-semibold text-sm text-gray-800">
                          🎨 Color
                        </div>
                        <div className="text-xs text-gray-500">₹10 / page</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* File Upload */}
              <div>
                <Label className="text-sm font-semibold blue-text mb-1.5 block">
                  Upload File (PDF / JPG) *
                </Label>
                <button
                  type="button"
                  data-ocid="upload.file.dropzone"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => !file && fileInputRef.current?.click()}
                  className={`w-full relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                    dragging
                      ? "border-blue-400 bg-blue-50"
                      : file
                        ? "border-green-400 bg-green-50"
                        : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/40"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) =>
                      e.target.files?.[0] && handleFile(e.target.files[0])
                    }
                    className="hidden"
                    data-ocid="upload.file.upload_button"
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-8 h-8 text-green-500" />
                      <div className="text-left">
                        <p className="font-semibold text-gray-800 text-sm">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {(file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setPageCount(0);
                        }}
                        className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <CloudUpload
                        className={`w-12 h-12 mx-auto mb-3 ${
                          dragging ? "text-blue-500" : "text-gray-300"
                        }`}
                      />
                      <p className="font-semibold text-gray-600 text-sm">
                        Drag &amp; Drop or{" "}
                        <span className="blue-text underline">
                          Click to Upload
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        PDF, JPG up to 20MB
                      </p>
                    </div>
                  )}
                </button>

                {/* Trust Badge */}
                <div className="flex items-center gap-2 mt-3 px-1">
                  <Lock className="w-4 h-4 text-green-600 shrink-0" />
                  <p className="text-xs text-gray-500">
                    <span className="font-semibold text-green-700">
                      100% Data Privacy Guaranteed.
                    </span>{" "}
                    We ensure zero paper leaks for coaching institutes.
                  </p>
                </div>
              </div>

              {/* Cost Estimation Box */}
              {isPrintingService && pageCount > 0 && (
                <div
                  data-ocid="upload.cost_estimate.card"
                  className="rounded-2xl border-2 border-green-200 bg-green-50 px-6 py-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-700 font-semibold text-sm">
                      📄 Print Cost Estimate
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm">
                    <span className="font-semibold text-gray-900">
                      {pageCount} pages
                    </span>
                    {" detected × ₹"}
                    <span className="font-semibold text-gray-900">
                      {printRate}/page
                    </span>
                    {" = "}
                  </p>
                  <p className="text-2xl font-extrabold text-green-700 mt-1">
                    Total: ₹{estimatedCost}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    * Final price may vary based on paper type and binding
                    options.
                  </p>
                </div>
              )}

              {/* Instructions */}
              <div>
                <Label
                  htmlFor="up-instructions"
                  className="text-sm font-semibold blue-text mb-1.5 block"
                >
                  Special Instructions / Number of Copies
                </Label>
                <Textarea
                  id="up-instructions"
                  data-ocid="upload.instructions.textarea"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. 50 copies, double-sided, stapled. Any special formatting notes..."
                  rows={3}
                  className="rounded-xl border-gray-200 resize-none focus-visible:ring-blue-500"
                />
              </div>

              {/* Upload progress */}
              {submitting && uploadProgress > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="blue-bg h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                data-ocid="upload.form.submit_button"
                disabled={submitting}
                className="yellow-bg text-gray-900 font-bold rounded-xl py-4 hover:opacity-90 border-0 text-base shadow-lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit & Get Quote"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
