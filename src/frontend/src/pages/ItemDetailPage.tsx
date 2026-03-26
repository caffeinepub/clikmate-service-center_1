import { ExternalBlob } from "@/backend";
import type { ShopOrderItem } from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { useActor } from "@/hooks/useActor";
import { useCatalogItem } from "@/hooks/useQueries";
import { Link, useNavigate, useParams } from "@/utils/router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileUp,
  Loader2,
  MessageCircle,
  Package,
  Phone,
  Printer,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const RETAIL_CATEGORIES = ["Tech Gadget", "Stationery", "Retail Product"];

function StockBadge({ status }: { status: string }) {
  const cls =
    status === "In Stock"
      ? "bg-green-100 text-green-700"
      : status === "Limited Stock"
        ? "bg-orange-100 text-orange-700"
        : "bg-red-100 text-red-700";
  return <Badge className={`${cls} font-semibold`}>{status}</Badge>;
}

function CscApplicationForm({
  item,
  onClose,
}: {
  item: { id: bigint; name: string; price: string; requiredDocuments: string };
  onClose: () => void;
}) {
  const { actor } = useActor();
  const docs = item.requiredDocuments
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [files, setFiles] = useState<(File | null)[]>(
    Array(docs.length).fill(null),
  );
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [specialDetails, setSpecialDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState<string>("");
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function handleSubmit() {
    if (!actor) return;
    if (!phone || phone.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (docs.length > 0 && files.some((f) => f === null)) {
      toast.error("Please upload all required documents.");
      return;
    }
    setSubmitting(true);
    try {
      const uploadedBlobs: ExternalBlob[] = [];
      for (const file of files) {
        if (file) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const blob = ExternalBlob.fromBytes(bytes);
          uploadedBlobs.push(blob);
        }
      }
      const price = Number.parseFloat(item.price.replace(/[^0-9.]/g, "")) || 0;
      const items: ShopOrderItem[] = [
        {
          itemId: item.id,
          itemName: item.name,
          qty: 1n,
          price,
        },
      ];
      const result = await actor.placeCscShopOrder(
        phone,
        customerName || "Customer",
        "Store Pickup",
        "",
        "Pay at Store",
        items,
        price,
        uploadedBlobs,
        specialDetails,
      );
      setOrderId(String(result.id));
      setSubmitted(true);
      toast.success("Application submitted successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        data-ocid="csc.success_state"
        className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-8 text-center"
      >
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-green-800 mb-2">
          Application Submitted!
        </h3>
        <p className="text-green-700 mb-1">
          Order ID: <span className="font-mono font-bold">#{orderId}</span>
        </p>
        <p className="text-green-600 text-sm mb-4">
          We will process your documents and notify you. Check your Digital
          Vault for updates.
        </p>
        <Button
          data-ocid="csc.close.secondary_button"
          variant="outline"
          onClick={onClose}
          className="border-green-300 text-green-700 hover:bg-green-100"
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <div
      data-ocid="csc.form.panel"
      className="mt-6 rounded-2xl border border-indigo-200 p-6"
      style={{ background: "oklch(0.97 0.015 270)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-indigo-900">
          📋 Start Application
        </h3>
        <button
          type="button"
          onClick={onClose}
          data-ocid="csc.form.close_button"
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          Cancel
        </button>
      </div>

      <div className="space-y-4">
        {/* Customer Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="csc-name"
              className="block text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1"
            >
              Your Name
            </label>
            <input
              id="csc-name"
              data-ocid="csc.name.input"
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-indigo-200 text-sm focus:outline-none focus:border-indigo-400 bg-white"
              placeholder="Full Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="csc-phone"
              className="block text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1"
            >
              Mobile Number *
            </label>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-indigo-400" />
              <input
                id="csc-phone"
                data-ocid="csc.phone.input"
                type="tel"
                maxLength={10}
                className="flex-1 px-3 py-2 rounded-lg border border-indigo-200 text-sm focus:outline-none focus:border-indigo-400 bg-white"
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
        </div>

        {/* Document Upload Slots */}
        {docs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">
              Required Documents
            </p>
            <div className="space-y-2">
              {docs.map((docName, i) => (
                <div
                  key={docName}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white border border-indigo-100"
                >
                  <FileUp className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-sm text-gray-700 flex-1">
                    {docName}
                  </span>
                  {files[i] ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600 font-medium truncate max-w-[120px]">
                        ✓ {files[i]!.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFiles((prev) => {
                            const next = [...prev];
                            next[i] = null;
                            return next;
                          });
                        }}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor={`doc-upload-${i}`}
                      data-ocid={`csc.doc.upload_button.${i + 1}`}
                      className="flex items-center gap-1.5 cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                    </label>
                  )}
                  <input
                    id={`doc-upload-${i}`}
                    ref={(el) => {
                      fileRefs.current[i] = el;
                    }}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setFiles((prev) => {
                        const next = [...prev];
                        next[i] = file;
                        return next;
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Special Details */}
        <div>
          <label
            htmlFor="csc-special-details"
            className="block text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1"
          >
            Special Details / Login IDs
          </label>
          <textarea
            id="csc-special-details"
            data-ocid="csc.special_details.textarea"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-indigo-200 text-sm focus:outline-none focus:border-indigo-400 bg-white resize-none"
            placeholder="Enter any login credentials, application numbers, or special instructions..."
            value={specialDetails}
            onChange={(e) => setSpecialDetails(e.target.value)}
          />
        </div>

        <Button
          data-ocid="csc.submit.primary_button"
          className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting Application...
            </>
          ) : (
            "Submit Application"
          )}
        </Button>
      </div>
    </div>
  );
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const itemId = id ? BigInt(id) : null;
  const { data: item, isLoading } = useCatalogItem(itemId);
  const [cscFormOpen, setCscFormOpen] = useState(false);

  const isRetail = item ? RETAIL_CATEGORIES.includes(item.category) : false;
  const isCsc = item?.category === "CSC & Govt Services";

  const imageFiles = item
    ? item.mediaFiles.filter((_, i) => item.mediaTypes[i] === "image")
    : [];
  const videoFiles = item
    ? item.mediaFiles.filter((_, i) => item.mediaTypes[i] === "video")
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div
          data-ocid="item.loading_state"
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
        >
          <Skeleton className="h-6 w-40 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <Skeleton className="h-80 w-full rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-11 w-40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div data-ocid="item.error_state" className="text-center px-4">
          <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-700 mb-2">
            Item Not Found
          </h1>
          <p className="text-gray-500 mb-6">
            This item may have been removed or is no longer available.
          </p>
          <Link to="/">
            <Button
              data-ocid="item.home.primary_button"
              className="blue-bg text-white hover:opacity-90"
            >
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl blue-bg flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold blue-text">ClikMate</span>
          </div>
          <Link
            to="/"
            data-ocid="item.back.link"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav
          className="flex items-center gap-1.5 text-sm text-gray-500 mb-8"
          aria-label="Breadcrumb"
        >
          <Link
            to="/"
            data-ocid="item.breadcrumb.link"
            className="hover:text-gray-800 transition-colors"
          >
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>{item.category}</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-800 font-medium truncate max-w-[180px]">
            {item.name}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Media Column */}
          <div className="space-y-4">
            {imageFiles.length > 0 ? (
              <>
                <Carousel
                  className="w-full rounded-2xl overflow-hidden shadow-card"
                  data-ocid="item.carousel"
                >
                  <CarouselContent>
                    {imageFiles.map((blob, idx) => (
                      <CarouselItem key={blob.getDirectURL()}>
                        <div className="relative aspect-[4/3] bg-gray-100">
                          <img
                            src={blob.getDirectURL()}
                            alt={`${item.name} - view ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {imageFiles.length > 1 && (
                    <>
                      <CarouselPrevious className="left-3" />
                      <CarouselNext className="right-3" />
                    </>
                  )}
                </Carousel>

                {/* Thumbnail strip */}
                {imageFiles.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {imageFiles.map((blob, idx) => (
                      <img
                        key={blob.getDirectURL()}
                        src={blob.getDirectURL()}
                        alt={`${item.name} - thumbnail ${idx + 1}`}
                        data-ocid={`item.thumbnail.${idx + 1}`}
                        className="w-16 h-16 rounded-lg object-cover shrink-0 border-2 border-transparent hover:border-blue-500 cursor-pointer transition-colors"
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="aspect-[4/3] rounded-2xl bg-gray-100 flex items-center justify-center">
                <Package className="w-16 h-16 text-gray-300" />
              </div>
            )}

            {/* Video Player */}
            {videoFiles.length > 0 && (
              <div className="rounded-2xl overflow-hidden shadow-card bg-black">
                {/* biome-ignore lint/a11y/useMediaCaption: user-uploaded video, no caption available */}
                <video
                  data-ocid="item.video.canvas_target"
                  src={videoFiles[0].getDirectURL()}
                  controls
                  className="w-full max-h-64 object-contain"
                />
              </div>
            )}
          </div>

          {/* Info Column */}
          <div className="space-y-5">
            <div>
              <Badge
                variant="outline"
                className={`text-xs mb-3 ${isCsc ? "text-indigo-600 border-indigo-200 bg-indigo-50" : "blue-text border-blue-200"}`}
              >
                {item.category}
              </Badge>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                {item.name}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold blue-text">{item.price}</span>
              <StockBadge status={item.stockStatus} />
            </div>

            {item.description && (
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                {item.description}
              </p>
            )}

            {isCsc && item.requiredDocuments && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">
                  Required Documents
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {item.requiredDocuments
                    .split(",")
                    .map((d) => d.trim())
                    .filter(Boolean)
                    .map((doc) => (
                      <span
                        key={doc}
                        className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium"
                      >
                        {doc}
                      </span>
                    ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {isCsc ? (
                <Button
                  data-ocid="item.start_application.primary_button"
                  className="h-12 px-6 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  onClick={() => setCscFormOpen(true)}
                >
                  <FileUp className="w-4 h-4 mr-2" />
                  Start Application
                </Button>
              ) : (
                <Button
                  data-ocid="item.contact.primary_button"
                  className="yellow-bg text-gray-900 font-semibold hover:opacity-90 h-12 px-6 rounded-full"
                  onClick={() => {
                    navigate("/");
                    setTimeout(
                      () =>
                        document
                          .getElementById("contact")
                          ?.scrollIntoView({ behavior: "smooth" }),
                      200,
                    );
                  }}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contact for Order
                </Button>
              )}
              <Button
                data-ocid="item.back.secondary_button"
                variant="outline"
                className="h-12 px-6 rounded-full"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {isRetail ? "Back to Products" : "Back to Services"}
              </Button>
            </div>

            <div
              className="mt-4 p-4 rounded-xl border border-blue-100"
              style={{ background: "oklch(0.97 0.01 256)" }}
            >
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-base">🔒</span>
                <span>
                  100% Data Privacy Guaranteed. Your order and information stay
                  completely secure.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CSC Application Form */}
        {isCsc && cscFormOpen && (
          <CscApplicationForm
            item={item}
            onClose={() => setCscFormOpen(false)}
          />
        )}
      </main>

      <footer className="navy-bg text-white mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p className="text-white/60 text-sm">
            &copy; {new Date().getFullYear()} ClikMate &mdash; Smart Online
            Service Center, Raipur.{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
              target="_blank"
              rel="noreferrer"
              className="text-white/40 hover:text-white/70 transition-colors"
            >
              Built with caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
