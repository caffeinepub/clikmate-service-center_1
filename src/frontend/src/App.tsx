import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { CartProvider, useCart } from "@/context/CartContext";
import { fsGetCollection } from "@/utils/firestoreService";
import { HashRouter, Link, Route, Routes, useNavigate } from "@/utils/router";
import {
  Box as BoxIcon,
  Briefcase,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  FolderOpen,
  HardDrive,
  Headphones,
  Languages,
  Layers,
  LogIn,
  Mail,
  MapPin,
  Menu,
  Minus,
  Package,
  PenTool,
  Phone,
  Plus,
  Printer,
  Shield,
  ShoppingCart,
  Star,
  Tag,
  Trash2,
  Truck,
  User,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ShopOrder } from "./backend.d";
import type { backendInterface } from "./backend.d";
import DashboardModal from "./components/DashboardModal";
import EducatorServicesSection from "./components/EducatorServicesSection";
import HeroIllustration from "./components/HeroIllustration";
import LoginModal from "./components/LoginModal";
import ReviewModal, {
  getDismissedReviews,
  getSubmittedReviews,
  markReviewSubmitted,
  markReviewDismissed,
} from "./components/ReviewModal";
import TestimonialsSection from "./components/TestimonialsSection";
import UploadSection from "./components/UploadSection";
import WhatsAppFloatingButton from "./components/WhatsAppButton";
import { useActor } from "./hooks/useActor";
import { usePublishedCatalogItems } from "./hooks/useQueries";
import AdminDashboard from "./pages/AdminDashboard";
import BulkDashboard from "./pages/BulkDashboard";
import BulkLoginPage from "./pages/BulkLoginPage";
import CheckoutPage from "./pages/CheckoutPage";
import ExpenseTrackerPage from "./pages/ExpenseTrackerPage";
import GstReportsPage from "./pages/GstReportsPage";
import ItemDetailPage from "./pages/ItemDetailPage";
import KhataSettlementPage from "./pages/KhataSettlementPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import PosLoginPage from "./pages/PosLoginPage";
import PosPage from "./pages/PosPage";
import RiderDashboard from "./pages/RiderDashboard";
import StaffClockInPage from "./pages/StaffClockInPage";
import StaffDashboard from "./pages/StaffDashboard";
import SupportPage from "./pages/SupportPage";
import TeamPortalPage from "./pages/TeamPortalPage";
import UnifiedLoginPage from "./pages/UnifiedLoginPage";
import VaultPage from "./pages/VaultPage";

function smoothScroll(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

const NAV_LINKS = [
  { label: "Home", id: "home" },
  { label: "Services", id: "services" },
  { label: "B2B Specialization", id: "b2b" },
  { label: "Upload & Print", id: "upload" },
  { label: "Retail & Products", id: "retail" },
  { label: "Contact Us", id: "contact" },
];

// ─── Auth Context (simple prop-drilling) ─────────────────────────────────────
interface AuthState {
  loggedInPhone: string | null;
  onLogin: (phone: string) => void;
  onLogout: () => void;
  onOpenLogin: () => void;
  onOpenDashboard: () => void;
}

function parsePrice(priceStr: string): number {
  return Number.parseFloat(priceStr.replace(/[^0-9.]/g, "")) || 0;
}

// ─── Cart Sheet ───────────────────────────────────────────────────────────────
function CartSheet({
  open,
  onOpenChange,
  loggedInPhone,
  onOpenLogin,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loggedInPhone: string | null;
  onOpenLogin: () => void;
}) {
  const { cartItems, cartTotal, removeFromCart, updateQty } = useCart();
  const navigate = useNavigate();

  function handleCheckout() {
    if (!loggedInPhone) {
      onOpenChange(false);
      onOpenLogin();
      toast.info("Please login to proceed to checkout.");
      return;
    }
    onOpenChange(false);
    navigate("/checkout");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-ocid="cart.sheet"
        className="w-full sm:w-[420px] flex flex-col p-0"
      >
        <SheetHeader className="px-5 py-4 border-b border-gray-100">
          <SheetTitle className="flex items-center gap-2 blue-text">
            <ShoppingCart className="w-5 h-5" />
            Your Cart
            {cartItems.length > 0 && (
              <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-bold">
                {cartItems.reduce((s, i) => s + i.qty, 0)}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {cartItems.length === 0 ? (
          <div
            data-ocid="cart.empty_state"
            className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3"
          >
            <ShoppingCart className="w-14 h-14 opacity-20" />
            <p className="font-medium">Your cart is empty</p>
            <p className="text-sm">Add services or products to get started.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {cartItems.map((item, i) => (
                <div
                  key={item.itemId}
                  data-ocid={`cart.item.${i + 1}`}
                  className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-white border border-gray-200">
                    <Package className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm blue-text truncate">
                      {item.itemName}
                    </div>
                    <div className="text-xs text-gray-400">{item.category}</div>
                    <div className="font-bold text-sm blue-text mt-1">
                      ₹{(item.price * item.qty).toFixed(0)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      data-ocid={`cart.delete_button.${i + 1}`}
                      onClick={() => removeFromCart(item.itemId)}
                      className="text-red-400 hover:text-red-600 transition-colors p-0.5"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg">
                      <button
                        type="button"
                        data-ocid={`cart.qty_minus.${i + 1}`}
                        onClick={() => updateQty(item.itemId, item.qty - 1)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-l-lg transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-semibold w-5 text-center">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        data-ocid={`cart.qty_plus.${i + 1}`}
                        onClick={() => updateQty(item.itemId, item.qty + 1)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-r-lg transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-gray-700">Total</span>
                <span className="text-xl font-bold blue-text">
                  ₹{cartTotal.toFixed(0)}
                </span>
              </div>
              <Button
                data-ocid="cart.checkout.button"
                className="w-full h-12 rounded-xl blue-bg text-white font-bold hover:opacity-90 transition-opacity border-0"
                onClick={handleCheckout}
              >
                Proceed to Checkout
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Header({
  auth,
  onOpenCart,
}: {
  auth: AuthState;
  onOpenCart: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { cartCount } = useCart();
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(() =>
    localStorage.getItem("clikmate_logo_url"),
  );

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "clikmate_logo_url") {
        setCustomLogoUrl(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    // Also poll on focus for same-tab updates
    function onFocus() {
      setCustomLogoUrl(localStorage.getItem("clikmate_logo_url"));
    }
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link
            to="/"
            className="flex items-center gap-3 shrink-0 no-underline"
            data-ocid="nav.logo.home_link"
          >
            {customLogoUrl ? (
              <img
                src={customLogoUrl}
                alt="Shop Logo"
                className="h-10 w-auto max-w-[160px] object-contain"
                onError={() => setCustomLogoUrl(null)}
              />
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl blue-bg flex items-center justify-center shadow-sm">
                  <Printer className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-sm md:text-base leading-tight blue-text">
                    ClikMate
                  </div>
                  <div className="text-xs text-gray-500 leading-tight hidden sm:block">
                    Smart Online Service Center
                  </div>
                </div>
              </>
            )}
          </Link>
          <nav className="hidden lg:flex items-center gap-5 xl:gap-7">
            {NAV_LINKS.map((link) => (
              <button
                type="button"
                key={link.id}
                data-ocid={`nav.${link.id}.link`}
                onClick={() => smoothScroll(link.id)}
                className="text-sm font-medium text-gray-600 hover:text-brand-blue transition-colors"
              >
                {link.label}
              </button>
            ))}
            <Link
              to="/admin"
              data-ocid="nav.admin.link"
              className="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors"
            >
              Admin
            </Link>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5 yellow-text" />
              <span>Raipur, CG</span>
            </div>
            <div className="h-4 w-px bg-gray-200" />
            {/* Cart icon */}
            <button
              type="button"
              data-ocid="nav.cart.button"
              onClick={onOpenCart}
              className="relative p-2 blue-text hover:bg-blue-50 rounded-full transition-colors"
              aria-label="Open cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
            {auth.loggedInPhone ? (
              <>
                <Link
                  to="/vault"
                  data-ocid="nav.vault.link"
                  className="flex items-center gap-2 text-blue-700 font-semibold text-xs px-3 py-2 rounded-full hover:bg-blue-50 transition-colors border border-blue-200"
                >
                  <Shield className="w-3.5 h-3.5" />
                  My Vault
                </Link>
                <button
                  type="button"
                  data-ocid="nav.my_account.button"
                  onClick={auth.onOpenDashboard}
                  className="flex items-center gap-2 yellow-bg text-gray-900 font-semibold text-xs px-3 py-2 rounded-full hover:opacity-90 transition-opacity"
                >
                  <User className="w-3.5 h-3.5" />
                  My Account
                </button>
              </>
            ) : (
              <button
                type="button"
                data-ocid="nav.login.button"
                onClick={auth.onOpenLogin}
                className="flex items-center gap-2 yellow-bg text-gray-900 font-semibold text-xs px-3 py-2 rounded-full hover:opacity-90 transition-opacity"
              >
                <LogIn className="w-3.5 h-3.5" />
                Login / Sign Up
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 md:hidden">
            {/* Mobile cart icon */}
            <button
              type="button"
              data-ocid="nav.mobile.cart.button"
              onClick={onOpenCart}
              className="relative p-2 blue-text"
              aria-label="Open cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
            <button
              type="button"
              data-ocid="nav.menu.toggle"
              className="p-2 rounded-md blue-text"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>
      {mobileOpen && (
        <div className="lg:hidden blue-bg px-4 pb-4 pt-1">
          {NAV_LINKS.map((link) => (
            <button
              type="button"
              key={link.id}
              data-ocid={`nav.mobile.${link.id}.link`}
              onClick={() => {
                smoothScroll(link.id);
                setMobileOpen(false);
              }}
              className="block w-full text-left py-3 text-sm font-medium text-white border-b border-white/10 last:border-0"
            >
              {link.label}
            </button>
          ))}
          <div className="pt-3 flex items-center justify-between">
            <span className="text-xs text-white/70">
              <Phone className="w-3.5 h-3.5 inline mr-1" />
              +91 9508911400
            </span>
            {auth.loggedInPhone ? (
              <button
                type="button"
                data-ocid="nav.mobile.my_account.button"
                onClick={() => {
                  setMobileOpen(false);
                  auth.onOpenDashboard();
                }}
                className="flex items-center gap-1 yellow-bg text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-full"
              >
                <User className="w-3.5 h-3.5" />
                My Account
              </button>
            ) : (
              <button
                type="button"
                data-ocid="nav.mobile.login.button"
                onClick={() => {
                  setMobileOpen(false);
                  auth.onOpenLogin();
                }}
                className="flex items-center gap-1 yellow-bg text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-full"
              >
                <LogIn className="w-3.5 h-3.5" />
                Login
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section id="home" className="hero-gradient overflow-hidden relative">
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 pointer-events-none"
        style={{
          background: "oklch(0.87 0.185 95)",
          transform: "translate(30%, -30%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-5 pointer-events-none"
        style={{ background: "white", transform: "translate(-30%, 30%)" }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 yellow-bg text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <MapPin className="w-3.5 h-3.5" />
              Raipur&apos;s #1 Digital Services Hub
            </div>
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
              Smart Online Service Center:
              <span className="yellow-text block mt-1">
                Raipur&apos;s Premier Printing
              </span>
              &amp; Digital Services Hub.
            </h1>
            <p className="text-blue-100 text-base md:text-lg mb-8 leading-relaxed">
              The trusted partner for coaching institutes&apos; bulk orders and
              Raipur citizens&apos; Govt services. Experience speed, accuracy,
              and absolute data privacy.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                data-ocid="hero.upload.primary_button"
                type="button"
                onClick={() => smoothScroll("upload")}
                className="yellow-bg text-gray-900 font-semibold px-6 py-3 h-auto rounded-full hover:opacity-90 transition-opacity shadow-lg border-0"
              >
                Upload Documents for Bulk Print
              </Button>
              <Button
                data-ocid="hero.smartcard.secondary_button"
                type="button"
                onClick={() => smoothScroll("services")}
                variant="outline"
                className="bg-transparent text-white border-2 border-white/60 font-semibold px-6 py-3 h-auto rounded-full hover:bg-white/10 transition-colors"
              >
                Order Instant Smart Cards
              </Button>
            </div>
            <div className="flex gap-8 mt-10">
              {[
                { val: "500+", label: "Daily Prints" },
                { val: "99.9%", label: "Privacy Guaranteed" },
                { val: "5★", label: "Customer Rating" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-bold yellow-text">{s.val}</div>
                  <div className="text-xs text-blue-200">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <HeroIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Services ─────────────────────────────────────────────────────────────────

function ServiceCard({
  item,
  index,
}: {
  item: {
    id: bigint;
    name: string;
    category: string;
    description: string;
    price: string;
    stockStatus: string;
  };
  index: number;
}) {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  function handleAddToCart(e: React.MouseEvent) {
    e.stopPropagation();
    addToCart({
      itemId: Number(item.id),
      itemName: item.name,
      category: item.category,
      price: parsePrice(item.price),
    });
    toast.success(`✅ Added "${item.name}" to cart`);
  }

  return (
    <div
      data-ocid={`services.item.${index + 1}`}
      className="bg-white rounded-2xl p-6 shadow-card border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group flex flex-col"
    >
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 shrink-0"
        style={{ background: "oklch(0.95 0.04 95)" }}
      >
        <ChevronRight className="w-7 h-7 yellow-text" />
      </div>
      <Badge
        variant="outline"
        className="text-xs w-fit mb-2 blue-text border-blue-200"
      >
        {item.category}
      </Badge>
      <h3 className="font-bold text-base blue-text mb-2">{item.name}</h3>
      <p className="text-gray-500 text-sm leading-relaxed mb-4 flex-1">
        {item.description}
      </p>
      <div className="flex items-center justify-between mt-auto gap-2">
        <span className="font-bold blue-text">{item.price}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-ocid={`services.add_to_cart.${index + 1}`}
            onClick={handleAddToCart}
            className="text-xs font-semibold text-white blue-bg px-2.5 py-1.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
          >
            <ShoppingCart className="w-3 h-3" /> Add
          </button>
          <button
            type="button"
            data-ocid={`services.view_button.${index + 1}`}
            onClick={() => navigate(`/item/${item.id}`)}
            className="text-sm font-semibold blue-text flex items-center gap-1 hover:gap-2 transition-all"
          >
            View <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ServicesSection() {
  const { data: allItems, isLoading } = usePublishedCatalogItems();
  const servicesList = (allItems || []).filter(
    (item) => (item.itemType || "service").toLowerCase() === "service",
  );

  return (
    <section id="services" className="bg-white py-20 relative overflow-hidden">
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 w-36 h-96 pointer-events-none opacity-40"
        style={{
          background: "oklch(0.87 0.185 95)",
          borderRadius: "100% 0 0 100%",
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-14">
          <span className="inline-block yellow-bg text-gray-900 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            What We Offer
          </span>
          <h2 className="text-3xl md:text-4xl font-bold blue-text">
            Our Services
          </h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            Comprehensive printing, digital, and government services for
            individuals and businesses in Raipur.
          </p>
        </div>
        {isLoading ? (
          <div
            data-ocid="services.loading_state"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-60 w-full rounded-2xl" />
            ))}
          </div>
        ) : servicesList.length === 0 ? (
          <div
            data-ocid="services.empty_state"
            className="text-center py-16"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "16px",
              backdropFilter: "blur(10px)",
            }}
          >
            <p className="text-gray-400 font-medium">
              New services launching soon!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {servicesList.map((item, i) => (
              <ServiceCard key={item.id.toString()} item={item} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── B2B ──────────────────────────────────────────────────────────────────────
function B2BSection() {
  return (
    <section id="b2b" className="section-gray py-20 relative overflow-hidden">
      <div
        className="absolute -right-16 top-1/2 -translate-y-1/2 w-64 h-80 pointer-events-none"
        style={{
          background: "oklch(0.87 0.185 95)",
          borderRadius: "60% 40% 40% 60% / 50%",
          opacity: 0.25,
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="inline-block yellow-bg text-gray-900 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              B2B Partner
            </span>
            <h2 className="text-3xl md:text-4xl font-bold blue-text mb-5">
              B2B &amp; Coaching Center Specialization
            </h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Raipur&apos;s preferred bulk print partner for coaching
              institutes, schools, and businesses. Industrial-grade equipment
              and expert team ensure materials are always ready on time.
            </p>
            <div className="flex flex-col gap-3">
              {[
                {
                  icon: <Printer className="w-5 h-5" />,
                  label: "Industrial-Grade Printing Capacity",
                  desc: "High-volume A4/A3 printing with professional finishing",
                },
                {
                  icon: <Languages className="w-5 h-5" />,
                  label: "Bilingual LaTeX Equations",
                  desc: "Hindi-English math & science typesetting for question papers",
                },
                {
                  icon: <Shield className="w-5 h-5" />,
                  label: "Guaranteed Data Privacy (No Paper Leaks)",
                  desc: "Your exam content and student data stays absolutely secure",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-4 p-4 rounded-xl"
                  style={{ background: "oklch(0.93 0.04 256)" }}
                >
                  <div className="w-10 h-10 rounded-lg blue-bg flex items-center justify-center shrink-0">
                    <span className="text-white inline-flex">{item.icon}</span>
                  </div>
                  <div>
                    <div className="font-semibold blue-text text-sm">
                      {item.label}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl p-8 shadow-card border border-gray-100">
              <div className="flex gap-0.5 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className="w-5 h-5 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>
              <blockquote className="text-gray-700 text-lg leading-relaxed mb-6 italic">
                &ldquo;Smart Online Service Center has been an invaluable
                partner for our institute for over 2 years. Their bulk printing
                quality is exceptional &mdash; we have never once had a paper
                leak. Our exam question sets are treated with absolute
                confidentiality. Highly recommended for every coaching center in
                Raipur!&rdquo;
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full blue-bg flex items-center justify-center text-white font-bold text-sm">
                  RK
                </div>
                <div>
                  <div className="font-semibold blue-text">
                    Rajesh Kumar Sahu
                  </div>
                  <div className="text-xs text-gray-500">
                    Director, Raipur Premier Coaching Institute
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  icon: <Zap className="w-5 h-5" />,
                  label: "Fast Turnaround",
                  desc: "Same-day for bulk orders under 500 pages",
                },
                {
                  icon: <CreditCard className="w-5 h-5" />,
                  label: "Flexible Payment",
                  desc: "Credit, UPI, Net Banking — all accepted",
                },
                {
                  icon: <Headphones className="w-5 h-5" />,
                  label: "Dedicated Support",
                  desc: "Your personal account manager for bulk orders",
                },
                {
                  icon: <Briefcase className="w-5 h-5" />,
                  label: "B2B Contracts",
                  desc: "Annual tie-ups for coaching institutes",
                },
              ].map((f) => (
                <div
                  key={f.label}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
                >
                  <div className="w-9 h-9 yellow-bg rounded-lg flex items-center justify-center mb-3">
                    <span className="text-gray-900">{f.icon}</span>
                  </div>
                  <div className="font-semibold blue-text text-sm">
                    {f.label}
                  </div>
                  <div className="text-gray-500 text-xs mt-1">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Why Us ───────────────────────────────────────────────────────────────────
function WhyUsSection() {
  const WHY_US = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Data Privacy First",
      desc: "Your documents and exam papers are handled with absolute confidentiality. No leaks, ever.",
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Lightning Fast",
      desc: "Express printing, same-day smart cards, instant govt services — speed is our guarantee.",
    },
    {
      icon: <CheckCircle className="w-6 h-6" />,
      title: "Quality Certified",
      desc: "State-of-the-art industrial printing machines with precision quality checks on every batch.",
    },
    {
      icon: <HardDrive className="w-6 h-6" />,
      title: "Digital & Physical",
      desc: "Upload online or walk in. We bridge the gap between digital convenience and physical service.",
    },
    {
      icon: <PenTool className="w-6 h-6" />,
      title: "Expert Team",
      desc: "Trained staff for LaTeX typesetting, bilingual documents, and complex design requirements.",
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Govt Services Hub",
      desc: "Aadhaar, PAN, Voter ID, certificates — all under one roof with expert assistance.",
    },
    {
      icon: <FolderOpen className="w-6 h-6" />,
      title: "Organized Records",
      desc: "Your order history, uploaded files, and digital copies are always accessible in your vault.",
    },
    {
      icon: <Truck className="w-6 h-6" />,
      title: "Local Delivery",
      desc: "Fast Raipur delivery for bulk orders — no need to visit the store for regular orders.",
    },
  ];

  return (
    <section className="bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block yellow-bg text-gray-900 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            Why Choose Us
          </span>
          <h2 className="text-3xl md:text-4xl font-bold blue-text">
            The ClikMate Difference
          </h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            We&apos;re not just a print shop. We&apos;re your complete digital
            services partner.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {WHY_US.map((item) => (
            <div
              key={item.title}
              className="p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl blue-bg flex items-center justify-center mb-4">
                <span className="text-white">{item.icon}</span>
              </div>
              <h3 className="font-bold blue-text mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Retail ───────────────────────────────────────────────────────────────────
function RetailSection() {
  const { data: allItems, isLoading } = usePublishedCatalogItems();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const productsList = (allItems || []).filter(
    (item) => (item.itemType || "service").toLowerCase() === "product",
  );

  return (
    <section id="retail" className="section-gray py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block yellow-bg text-gray-900 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            In-Store Shopping
          </span>
          <h2 className="text-3xl md:text-4xl font-bold blue-text">
            Essential Tech &amp; Stationery Retail
          </h2>
          <p className="text-gray-500 mt-3 max-w-lg mx-auto">
            Pick up everyday essentials right at our service center.
          </p>
        </div>
        {isLoading ? (
          <div
            data-ocid="retail.loading_state"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        ) : productsList.length === 0 ? (
          <div
            data-ocid="retail.empty_state"
            className="text-center py-16"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "16px",
              backdropFilter: "blur(10px)",
            }}
          >
            <p className="text-gray-400 font-medium">
              New stock arriving soon!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {productsList.map((p, i) => (
              <div
                key={p.id.toString()}
                data-ocid={`retail.item.${i + 1}`}
                className="bg-white rounded-2xl p-6 shadow-card border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col"
              >
                {p.mediaFiles.length > 0 ? (
                  <img
                    src={
                      typeof p.mediaFiles[0] === "string"
                        ? p.mediaFiles[0]
                        : (p.mediaFiles[0] as any).getDirectURL?.() || ""
                    }
                    alt={p.name}
                    className="w-full h-36 object-cover rounded-xl mb-4"
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                    style={{ background: "oklch(0.95 0.04 95)" }}
                  >
                    <Package className="w-8 h-8 yellow-text" />
                  </div>
                )}
                <Badge variant="outline" className="text-xs w-fit mb-2">
                  {p.category}
                </Badge>
                <h3 className="font-bold text-base blue-text mb-1">{p.name}</h3>
                <p className="text-gray-500 text-sm mb-3 flex-1">
                  {p.description}
                </p>
                <div className="flex items-center justify-between mt-auto gap-2">
                  <span className="font-bold blue-text">{p.price}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-ocid={`retail.add_to_cart.${i + 1}`}
                      onClick={() => {
                        addToCart({
                          itemId: Number(p.id),
                          itemName: p.name,
                          category: p.category,
                          price: parsePrice(p.price),
                        });
                        toast.success(`✅ Added "${p.name}" to cart`);
                      }}
                      className="text-xs font-semibold text-white blue-bg px-2.5 py-1.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                    >
                      <ShoppingCart className="w-3 h-3" /> Add
                    </button>
                    <button
                      type="button"
                      data-ocid={`retail.view_button.${i + 1}`}
                      onClick={() => navigate(`/item/${p.id}`)}
                      className="text-sm font-semibold blue-text flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      View <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Contact ──────────────────────────────────────────────────────────────────

// ─── Public Rate List (Customer-Facing Catalog) ──────────────────────────────
function PublicRateListSection() {
  const { data: allItems } = usePublishedCatalogItems();
  const [productCatFilter, setProductCatFilter] = useState<string>("All");
  const [serviceCatFilter, setServiceCatFilter] = useState<string>("All");
  const [storedCats, setStoredCats] = useState<
    Array<{ id: string; name: string; appliesTo: string }>
  >([]);

  useEffect(() => {
    fsGetCollection<{ id: string; name: string; appliesTo: string }>(
      "categories",
    )
      .then(setStoredCats)
      .catch(console.error);
  }, []);

  const productCatOptions = [
    "All",
    ...storedCats.filter((c) => c.appliesTo === "product").map((c) => c.name),
  ];
  const serviceCatOptions = [
    "All",
    ...storedCats.filter((c) => c.appliesTo === "service").map((c) => c.name),
  ];

  const rateItems = (allItems || []).filter(
    (item) => item.saleRate !== undefined && item.saleRate !== null,
  );

  const products = rateItems.filter(
    (i) => (i.itemType || "service").toLowerCase() === "product",
  );
  const services = rateItems.filter(
    (i) => (i.itemType || "service").toLowerCase() === "service",
  );

  const filteredProducts = products.filter(
    (i) => productCatFilter === "All" || i.category === productCatFilter,
  );
  const filteredServices = services.filter(
    (i) => serviceCatFilter === "All" || i.category === serviceCatFilter,
  );

  const getAvailability = (
    item: ReturnType<typeof usePublishedCatalogItems>["data"][number],
  ) => {
    const t = (item.itemType || "service").toLowerCase();
    if (t === "product" && (item.quantity ?? 0) <= 0) return "out";
    return "available";
  };

  const activeTabStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #00ffff, #0080ff)",
    color: "#080d1a",
    boxShadow: "0 0 12px rgba(0,255,255,0.35)",
    border: "none",
    padding: "6px 18px",
    borderRadius: 9999,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.2s",
  };
  const inactiveTabStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.6)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "6px 18px",
    borderRadius: 9999,
    fontWeight: 500,
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.2s",
  };

  const renderItemCard = (
    item: ReturnType<typeof usePublishedCatalogItems>["data"][number],
  ) => {
    const avail = getAvailability(item);
    const isService = (item.itemType || "service").toLowerCase() === "service";
    return (
      <div
        key={String(item.id)}
        className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 hover:scale-[1.02]"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(0,255,255,0.12)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={
              isService
                ? { background: "rgba(168,85,247,0.18)", color: "#c084fc" }
                : { background: "rgba(0,255,255,0.12)", color: "#00ffff" }
            }
          >
            {isService ? (
              <Layers className="w-3 h-3" />
            ) : (
              <BoxIcon className="w-3 h-3" />
            )}
            {isService ? "Service" : "Product"}
          </span>
          <span
            className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={
              avail === "out"
                ? { background: "rgba(239,68,68,0.18)", color: "#f87171" }
                : { background: "rgba(34,197,94,0.15)", color: "#4ade80" }
            }
          >
            {avail === "out" ? (
              <span>Out of Stock</span>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3" /> Available
              </>
            )}
          </span>
        </div>
        <h3
          className="font-bold text-base leading-snug"
          style={{ color: "rgba(255,255,255,0.92)" }}
        >
          {item.name}
        </h3>
        {item.productId && (
          <span
            className="text-xs font-mono tracking-wide"
            style={{ color: "rgba(0,255,255,0.6)" }}
          >
            {item.productId}
          </span>
        )}
        {item.description && (
          <p
            className="text-xs leading-relaxed line-clamp-2"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            {item.description}
          </p>
        )}
        <div
          className="mt-auto pt-3 border-t"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <span
            className="text-2xl font-black"
            style={{
              background: "linear-gradient(135deg, #00ffff, #00aaff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {"₹"}
            {Number(item.saleRate).toLocaleString("en-IN")}
          </span>
          <span
            className="text-xs ml-1"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            {isService ? "/ unit" : "/ piece"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <section
      id="rate-list"
      style={{
        background:
          "linear-gradient(135deg, #080d1a 0%, #0d1a2e 50%, #080d1a 100%)",
        borderTop: "1px solid rgba(0,255,255,0.1)",
        borderBottom: "1px solid rgba(0,255,255,0.1)",
      }}
      className="py-20"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mb-4"
            style={{
              background: "rgba(0,255,255,0.12)",
              color: "#00ffff",
              border: "1px solid rgba(0,255,255,0.25)",
            }}
          >
            <Tag className="w-3 h-3" /> Live Price Board
          </span>
          <h2
            className="text-3xl md:text-4xl font-bold mb-3"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #00ffff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Our Rate List
          </h2>
          <p
            style={{ color: "rgba(255,255,255,0.55)" }}
            className="max-w-xl mx-auto text-sm"
          >
            Transparent pricing for all our products &amp; services. Rates
            inclusive of service charges.
          </p>
        </div>

        {/* Products Section */}
        <div className="mb-14">
          <h3
            style={{
              color: "rgba(255,255,255,0.9)",
              fontWeight: 700,
              fontSize: 20,
              marginBottom: 8,
            }}
          >
            Essential Tech &amp; Stationery
          </h3>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            Pick up everyday essentials &mdash; cables, stationery, accessories
            and more.
          </p>
          {productCatOptions.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {productCatOptions.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setProductCatFilter(tab)}
                  style={
                    productCatFilter === tab ? activeTabStyle : inactiveTabStyle
                  }
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
          {filteredProducts.length === 0 ? (
            <div
              className="text-center py-12 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(0,255,255,0.1)",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              <BoxIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">New stock arriving soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(renderItemCard)}
            </div>
          )}
        </div>

        {/* Services Section */}
        <div>
          <h3
            style={{
              color: "rgba(255,255,255,0.9)",
              fontWeight: 700,
              fontSize: 20,
              marginBottom: 8,
            }}
          >
            Digital Services
          </h3>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            Printing, scanning, online forms, and more &mdash; all in one place.
          </p>
          {serviceCatOptions.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {serviceCatOptions.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setServiceCatFilter(tab)}
                  style={
                    serviceCatFilter === tab ? activeTabStyle : inactiveTabStyle
                  }
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
          {filteredServices.length === 0 ? (
            <div
              className="text-center py-12 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(168,85,247,0.15)",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">New services launching soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredServices.map(renderItemCard)}
            </div>
          )}
        </div>

        <p
          className="text-center mt-10 text-xs"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          * Prices are subject to change. Contact us for bulk order discounts.
        </p>
      </div>
    </section>
  );
}

function ContactSection() {
  const { actor } = useActor();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    try {
      await actor?.submitInquiry(name, phone, message);
      setSubmitted(true);
      setName("");
      setPhone("");
      setMessage("");
      toast.success("Inquiry submitted! We will contact you shortly.");
    } catch {
      toast.error("Submission failed. Please call us directly.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="contact" className="bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block yellow-bg text-gray-900 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            Get In Touch
          </span>
          <h2 className="text-3xl md:text-4xl font-bold blue-text">
            Contact &amp; Location
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
          {/* Contact info */}
          <div>
            <h3 className="text-xl font-bold blue-text mb-6">Visit Us</h3>
            <div className="flex flex-col gap-5">
              {[
                {
                  icon: <MapPin className="w-5 h-5 text-gray-900" />,
                  label: "Address",
                  content: (
                    <span>
                      Krish PG, Geetanjali Colony, Awanti Vihar,
                      <br />
                      Raipur &ndash; 492001, Chhattisgarh, India
                    </span>
                  ),
                },
                {
                  icon: <Phone className="w-5 h-5 text-gray-900" />,
                  label: "Phone",
                  content: (
                    <>
                      <a
                        href="tel:+919508911400"
                        className="text-gray-600 text-sm block hover:underline"
                      >
                        +91 9508911400
                      </a>
                      <a
                        href="tel:+919977546922"
                        className="text-gray-600 text-sm block hover:underline"
                      >
                        +91 9977546922
                      </a>
                    </>
                  ),
                },
                {
                  icon: <Mail className="w-5 h-5 text-gray-900" />,
                  label: "Email",
                  content: (
                    <a
                      href="mailto:smartonlineservicecenter4u@gmail.com"
                      className="text-gray-600 text-sm break-all hover:underline"
                    >
                      smartonlineservicecenter4u@gmail.com
                    </a>
                  ),
                },
                {
                  icon: <Clock className="w-5 h-5 text-gray-900" />,
                  label: "Hours",
                  content: (
                    <>
                      <div className="text-gray-600 text-sm">
                        Mon &ndash; Sat: 9:00 AM &ndash; 8:00 PM
                      </div>
                      <div className="text-gray-600 text-sm">
                        Sunday: 10:00 AM &ndash; 6:00 PM
                      </div>
                    </>
                  ),
                },
              ].map((row) => (
                <div key={row.label} className="flex items-start gap-4">
                  <div className="w-10 h-10 yellow-bg rounded-xl flex items-center justify-center shrink-0">
                    {row.icon}
                  </div>
                  <div>
                    <div className="font-semibold blue-text text-sm mb-0.5">
                      {row.label}
                    </div>
                    <div>{row.content}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact form */}
          <div>
            <h3 className="text-xl font-bold blue-text mb-6">Send Inquiry</h3>
            {submitted ? (
              <div
                data-ocid="contact.form.success_state"
                className="flex flex-col items-center justify-center py-12 gap-3"
              >
                <CheckCircle className="w-14 h-14 text-green-500" />
                <p className="font-semibold blue-text">Inquiry Sent!</p>
                <p className="text-gray-500 text-sm text-center">
                  We will contact you within 24 hours. Thank you!
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <Label
                    htmlFor="inq-name"
                    className="text-sm font-medium blue-text mb-1.5 block"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="inq-name"
                    data-ocid="contact.name.input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    className="rounded-xl border-gray-200"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="inq-phone"
                    className="text-sm font-medium blue-text mb-1.5 block"
                  >
                    Phone Number
                  </Label>
                  <Input
                    id="inq-phone"
                    data-ocid="contact.phone.input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="rounded-xl border-gray-200"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="inq-msg"
                    className="text-sm font-medium blue-text mb-1.5 block"
                  >
                    Message / Requirements
                  </Label>
                  <Textarea
                    id="inq-msg"
                    data-ocid="contact.message.textarea"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your printing or service requirement..."
                    rows={4}
                    className="rounded-xl border-gray-200 resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  data-ocid="contact.form.submit_button"
                  disabled={submitting}
                  className="yellow-bg text-gray-900 font-semibold rounded-xl h-12 hover:opacity-90 transition-opacity border-0"
                >
                  {submitting ? "Sending..." : "Send Inquiry"}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="rounded-2xl overflow-hidden shadow-card border border-gray-100">
          <iframe
            title="ClikMate Location — Awanti Vihar, Raipur"
            src="https://www.openstreetmap.org/export/embed.html?bbox=81.6400%2C21.2000%2C81.6600%2C21.2200&layer=mapnik"
            width="100%"
            height="380"
            style={{ border: 0, display: "block" }}
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const year = new Date().getFullYear();
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  return (
    <footer className="navy-bg text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 yellow-bg rounded-xl flex items-center justify-center">
                <Printer className="w-5 h-5 text-gray-900" />
              </div>
              <div>
                <div className="font-bold text-white">ClikMate</div>
                <div className="text-xs text-white/60">
                  Smart Online Service Center
                </div>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-5">
              Raipur&apos;s trusted digital services partner &mdash; printing,
              smart cards, govt services, and more.
            </p>
            <div className="flex flex-wrap gap-3">
              {NAV_LINKS.map((link) => (
                <button
                  type="button"
                  key={link.id}
                  data-ocid={`footer.${link.id}.link`}
                  onClick={() => smoothScroll(link.id)}
                  className="text-xs text-white/50 hover:text-yellow-300 transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold yellow-text mb-5">Contact Details</h4>
            <div className="flex flex-col gap-3 text-sm text-white/70">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 yellow-text mt-0.5 shrink-0" />
                <span>
                  Krish PG, Geetanjali Colony,
                  <br />
                  Awanti Vihar, Raipur &ndash; 492001
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 yellow-text" />
                <span>+91 9508911400 / 9977546922</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 yellow-text" />
                <span className="break-all">
                  smartonlineservicecenter4u@gmail.com
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 yellow-text" />
                <span>Mon&ndash;Sat: 9am&ndash;8pm | Sun: 10am&ndash;6pm</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold yellow-text mb-5">Our Services</h4>
            <ul className="flex flex-col gap-2">
              {[
                "Bulk B&W & Color Printing",
                "Instant Smart PVC ID Cards",
                "Govt. Form & Certificate Services",
                "Professional Resume & CV Services",
              ].map((svc) => (
                <li key={svc}>
                  <button
                    type="button"
                    onClick={() => smoothScroll("services")}
                    className="text-sm text-white/60 hover:text-white transition-colors text-left"
                  >
                    &rarr; {svc}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      {/* Internal portal link */}
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-center">
          <Link
            to="/login"
            data-ocid="footer.portal.login_button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:opacity-90"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,255,255,0.15), rgba(0,128,255,0.15))",
              border: "1px solid rgba(0,255,255,0.3)",
              color: "rgba(0,255,255,0.85)",
              boxShadow: "0 0 16px rgba(0,255,255,0.1)",
            }}
          >
            <LogIn className="w-4 h-4" />
            Login — Employee &amp; Partner Portal
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/40">
          <span>
            &copy; {year} ClikMate / Smart Online Service Center. All Rights
            Reserved.
          </span>
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/60 transition-colors"
          >
            Built with &hearts; using caffeine.ai
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─── Review Queue Manager ─────────────────────────────────────────────────────
function ReviewQueueManager({ loggedInPhone }: { loggedInPhone: string }) {
  const { actor, isFetching } = useActor();
  const [currentOrder, setCurrentOrder] = useState<ShopOrder | null>(null);
  const queueRef = useRef<ShopOrder[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: queueRef is a stable ref
  useEffect(() => {
    if (!actor || isFetching) return;
    (actor as unknown as { getAllShopOrders?: () => Promise<ShopOrder[]> })
      .getAllShopOrders?.()
      .then((orders: ShopOrder[]) => {
        const dismissed = getDismissedReviews();
        const submitted = getSubmittedReviews();
        const pending = orders.filter(
          (o) =>
            o.phone === loggedInPhone &&
            (o.status === "Delivered" || o.status === "Completed") &&
            !dismissed.includes(String(o.id)) &&
            !submitted.includes(String(o.id)),
        );
        queueRef.current = pending;
        if (pending.length > 0) setCurrentOrder(pending[0]);
      })
      .catch(() => {});
  }, [actor, isFetching, loggedInPhone]);

  function advanceQueue() {
    queueRef.current = queueRef.current.slice(1);
    const next = queueRef.current[0] ?? null;
    if (next) setTimeout(() => setCurrentOrder(next), 400);
  }

  function handleDismiss() {
    setCurrentOrder(null);
    advanceQueue();
  }

  function handleSubmitted() {
    setCurrentOrder(null);
    advanceQueue();
  }

  if (!currentOrder) return null;
  return (
    <ReviewModal
      order={currentOrder}
      open={!!currentOrder}
      customerPhone={loggedInPhone}
      onDismiss={handleDismiss}
      onSubmitted={handleSubmitted}
    />
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────
function LandingPage() {
  const [loggedInPhone, setLoggedInPhone] = useState<string | null>(() => {
    return localStorage.getItem("clikmate_phone") || null;
  });
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [dashboardModalOpen, setDashboardModalOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (loggedInPhone) {
      localStorage.setItem("clikmate_phone", loggedInPhone);
    } else {
      localStorage.removeItem("clikmate_phone");
    }
  }, [loggedInPhone]);

  function handleLogin(phone: string) {
    setLoggedInPhone(phone);
  }

  function handleLogout() {
    setLoggedInPhone(null);
    setDashboardModalOpen(false);
    toast.success("Logged out successfully.");
  }

  function handleUploadFromDashboard() {
    setDashboardModalOpen(false);
    setTimeout(() => smoothScroll("upload"), 150);
  }

  const auth: AuthState = {
    loggedInPhone,
    onLogin: handleLogin,
    onLogout: handleLogout,
    onOpenLogin: () => setLoginModalOpen(true),
    onOpenDashboard: () => setDashboardModalOpen(true),
  };

  return (
    <>
      <Toaster richColors position="top-right" />
      <WhatsAppFloatingButton />
      <Header auth={auth} onOpenCart={() => setCartOpen(true)} />
      <main>
        <HeroSection />
        <ServicesSection />
        <B2BSection />
        <EducatorServicesSection />
        <UploadSection />
        <WhyUsSection />
        <TestimonialsSection />
        <RetailSection />
        <PublicRateListSection />
        <ContactSection />
      </main>
      <Footer />
      {loggedInPhone && <ReviewQueueManager loggedInPhone={loggedInPhone} />}

      {/* Modals */}
      <LoginModal
        open={loginModalOpen}
        onOpenChange={setLoginModalOpen}
        onLoginSuccess={handleLogin}
      />
      {loggedInPhone && (
        <DashboardModal
          open={dashboardModalOpen}
          onOpenChange={setDashboardModalOpen}
          phone={loggedInPhone}
          onLogout={handleLogout}
          onUploadClick={handleUploadFromDashboard}
        />
      )}
      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        loggedInPhone={loggedInPhone}
        onOpenLogin={() => setLoginModalOpen(true)}
      />
    </>
  );
}

// ─── App (Router Root) ────────────────────────────────────────────────────────
export default function App() {
  return (
    <CartProvider>
      {/* Global print letterhead — hidden on screen, shown on print */}
      <div id="clikmate-global-print-letterhead" style={{ display: "none" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "#1e40af",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-label="Printer"
            >
              <title>Printer</title>
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 20,
                color: "#1e3a8a",
                letterSpacing: "-0.02em",
              }}
            >
              ClikMate Smart Online Service Center
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Krish PG, Geetanjali Colony, Awanti Vihar, Raipur – 492001, CG |
              +91 9508911400 | smartonlineservicecenter4u@gmail.com
            </div>
          </div>
        </div>
        <div
          style={{
            borderTop: "1px solid #cbd5e1",
            paddingTop: 6,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "#94a3b8",
          }}
        >
          <span>Official Document — ClikMate POS System</span>
          <span>Printed: {new Date().toLocaleString("en-IN")}</span>
        </div>
      </div>
      <HashRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/item/:id" element={<ItemDetailPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/rider" element={<RiderDashboard />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/pos-login" element={<PosLoginPage />} />
          <Route path="/portal" element={<TeamPortalPage />} />
          <Route path="/bulk-dashboard" element={<BulkDashboard />} />
          <Route path="/bulk-login" element={<BulkLoginPage />} />
          <Route path="/vault" element={<VaultPage />} />
          <Route path="/login" element={<UnifiedLoginPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/clock-in" element={<StaffClockInPage />} />
          <Route path="/staff-dashboard" element={<StaffDashboard />} />
          <Route path="/expense-tracker" element={<ExpenseTrackerPage />} />
          <Route path="/gst-reports" element={<GstReportsPage />} />
          <Route
            path="/admin/khata-settlement"
            element={<KhataSettlementPage />}
          />
          <Route
            path="/order-success/:orderId"
            element={<OrderSuccessPage />}
          />
        </Routes>
      </HashRouter>
    </CartProvider>
  );
}
