import type { backendInterface } from "@/backend.d";
import WhatsAppFloatingButton from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/context/CartContext";
import { useActor } from "@/hooks/useActor";
import { Link, useNavigate } from "@/utils/router";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  MapPin,
  Package,
  Printer,
  ShoppingBag,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cartItems, cartTotal, clearCart } = useCart();
  const { actor } = useActor();

  const phone = localStorage.getItem("clikmate_phone") || "";

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">(
    "delivery",
  );
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "cod" | "wallet">(
    "upi",
  );
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!phone) {
      navigate("/");
    }
  }, [phone, navigate]);

  // Load customer profile for auto-fill
  useEffect(() => {
    if (!actor || !phone || profileLoaded) return;
    (actor as unknown as backendInterface)
      .getCustomerProfile(phone)
      .then((profile) => {
        if (profile) {
          setName(profile.customerName || "");
          setAddress(profile.deliveryAddress || "");
        }
        setProfileLoaded(true);
      })
      .catch(() => setProfileLoaded(true));
  }, [actor, phone, profileLoaded]);

  // Fetch wallet balance when wallet payment selected
  useEffect(() => {
    if (paymentMethod === "wallet" && actor && phone && walletBalance === 0) {
      setWalletLoading(true);
      (actor as unknown as backendInterface)
        .getWalletBalance(phone)
        .then((bal) => setWalletBalance(bal))
        .catch(() => setWalletBalance(0))
        .finally(() => setWalletLoading(false));
    }
  }, [paymentMethod, actor, phone, walletBalance]);

  async function saveProfile() {
    if (!actor || !phone) return;
    try {
      await (actor as unknown as backendInterface).saveCustomerProfile(
        phone,
        name,
        address,
      );
    } catch {
      // silent
    }
  }

  async function handlePlaceOrder() {
    if (!actor || !phone) return;
    if (!name.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (deliveryMethod === "delivery" && !address.trim()) {
      toast.error("Please enter a delivery address.");
      return;
    }
    if (cartItems.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }
    if (paymentMethod === "wallet" && walletBalance < cartTotal) {
      toast.error(
        `Insufficient wallet balance (\u20b9${walletBalance.toFixed(0)} available).`,
      );
      return;
    }

    setPlacing(true);
    try {
      await saveProfile();
      const backendItems = cartItems.map((item) => ({
        qty: BigInt(item.qty),
        itemId: BigInt(item.itemId),
        itemName: item.itemName,
        price: item.price,
      }));

      if (paymentMethod === "wallet") {
        // Deduct wallet first
        const newBalance = await (
          actor as unknown as backendInterface
        ).deductWalletForOrder(phone, cartTotal);
        if (newBalance < 0) {
          toast.error(
            "Insufficient wallet balance. Please choose another payment method.",
          );
          setPlacing(false);
          return;
        }
        setWalletBalance(newBalance);
      }

      const paymentLabel =
        paymentMethod === "upi"
          ? "UPI"
          : paymentMethod === "wallet"
            ? "ClikMate Wallet"
            : "Cash on Delivery";

      const order = await (actor as unknown as backendInterface).placeShopOrder(
        phone,
        name,
        deliveryMethod === "delivery" ? "Fast Local Delivery" : "Store Pickup",
        deliveryMethod === "delivery" ? address : "Awanti Vihar Shop, Raipur",
        paymentLabel,
        backendItems,
        cartTotal,
      );

      if (paymentMethod === "wallet") {
        toast.success(
          `Order placed! \u20b9${cartTotal.toFixed(0)} deducted from your wallet.`,
        );
      }

      clearCart();
      navigate(`/order-success/${order.id.toString()}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  const walletInsufficient =
    paymentMethod === "wallet" && walletBalance < cartTotal;

  if (cartItems.length === 0 && !placing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-blue-950 px-4">
        <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-white/70 mb-2">
          Your cart is empty
        </h2>
        <p className="text-white/50 mb-6">
          Add some items before checking out.
        </p>
        <Link to="/">
          <Button className="rounded-xl">Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-white/10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link
            to="/"
            data-ocid="checkout.back.link"
            className="flex items-center gap-2 text-sm text-white/50 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-cyan-300 text-sm">
              ClikMate Checkout
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Form */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Contact & Delivery Info */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-white/10">
              <h2 className="text-lg font-bold text-cyan-300 mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  1
                </span>
                Delivery Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label
                    htmlFor="checkout-name"
                    className="text-sm font-semibold text-white/70 mb-1.5 block"
                  >
                    Full Name *
                  </Label>
                  <Input
                    id="checkout-name"
                    data-ocid="checkout.name.input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={saveProfile}
                    placeholder="Enter your full name"
                    className="rounded-xl border-white/10 h-11"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label
                    htmlFor="checkout-phone"
                    className="text-sm font-semibold text-white/70 mb-1.5 block"
                  >
                    Mobile Number
                  </Label>
                  <Input
                    id="checkout-phone"
                    value={phone}
                    readOnly
                    className="rounded-xl border-white/10 h-11 bg-gray-50 text-white/50"
                  />
                </div>
              </div>
            </section>

            {/* Delivery Method */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-white/10">
              <h2 className="text-lg font-bold text-cyan-300 mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  2
                </span>
                Delivery Method
              </h2>
              <RadioGroup
                value={deliveryMethod}
                onValueChange={(v) =>
                  setDeliveryMethod(v as "delivery" | "pickup")
                }
                className="flex flex-col gap-3"
              >
                <label
                  htmlFor="del-delivery"
                  data-ocid="checkout.delivery.radio"
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    deliveryMethod === "delivery"
                      ? "border-blue-500 bg-blue-50"
                      : "border-white/10 hover:border-gray-300"
                  }`}
                >
                  <RadioGroupItem
                    value="delivery"
                    id="del-delivery"
                    className="mt-0.5"
                  />
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        Fast Local Delivery (Raipur)
                      </div>
                      <div className="text-sm text-white/50">
                        Delivered to your address within Raipur
                      </div>
                    </div>
                  </div>
                </label>

                <label
                  htmlFor="del-pickup"
                  data-ocid="checkout.pickup.radio"
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    deliveryMethod === "pickup"
                      ? "border-blue-500 bg-blue-50"
                      : "border-white/10 hover:border-gray-300"
                  }`}
                >
                  <RadioGroupItem
                    value="pickup"
                    id="del-pickup"
                    className="mt-0.5"
                  />
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        Store Pickup (Awanti Vihar Shop)
                      </div>
                      <div className="text-sm text-white/50">
                        Krish PG, Geetanjali Colony, Awanti Vihar, Raipur
                      </div>
                    </div>
                  </div>
                </label>
              </RadioGroup>

              {deliveryMethod === "delivery" && (
                <div className="mt-4">
                  <Label
                    htmlFor="checkout-addr"
                    className="text-sm font-semibold text-white/70 mb-1.5 block"
                  >
                    <MapPin className="w-4 h-4 inline mr-1" /> Delivery Address
                    *
                  </Label>
                  <Input
                    id="checkout-addr"
                    data-ocid="checkout.address.input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onBlur={saveProfile}
                    placeholder="House/Flat No, Street, Area, Raipur"
                    className="rounded-xl border-white/10 h-11"
                  />
                </div>
              )}
            </section>

            {/* Payment Method */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-white/10">
              <h2 className="text-lg font-bold text-cyan-300 mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  3
                </span>
                Payment Method
              </h2>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) =>
                  setPaymentMethod(v as "upi" | "cod" | "wallet")
                }
                className="flex flex-col gap-3"
              >
                <label
                  htmlFor="pay-upi"
                  data-ocid="checkout.upi.radio"
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === "upi"
                      ? "border-blue-500 bg-blue-50"
                      : "border-white/10 hover:border-gray-300"
                  }`}
                >
                  <RadioGroupItem value="upi" id="pay-upi" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      Pay via UPI (Scan QR Code)
                    </div>
                    <div className="text-sm text-white/50">
                      Scan and pay instantly with any UPI app
                    </div>
                  </div>
                </label>

                <label
                  htmlFor="pay-cod"
                  data-ocid="checkout.cod.radio"
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === "cod"
                      ? "border-blue-500 bg-blue-50"
                      : "border-white/10 hover:border-gray-300"
                  }`}
                >
                  <RadioGroupItem value="cod" id="pay-cod" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      Cash on Delivery / Pay at Store
                    </div>
                    <div className="text-sm text-white/50">
                      Pay when you receive or at the store
                    </div>
                  </div>
                </label>

                {/* ClikMate Wallet option */}
                <label
                  htmlFor="pay-wallet"
                  data-ocid="checkout.wallet.radio"
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === "wallet"
                      ? "border-purple-500 bg-purple-50"
                      : "border-white/10 hover:border-gray-300"
                  }`}
                >
                  <RadioGroupItem
                    value="wallet"
                    id="pay-wallet"
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-purple-600" />
                      Pay via ClikMate Wallet
                    </div>
                    <div className="text-sm text-white/50 flex items-center gap-2 mt-0.5">
                      {walletLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <span>
                          Balance:{" "}
                          <span
                            className={`font-semibold ${
                              walletBalance >= cartTotal
                                ? "text-green-600"
                                : "text-red-500"
                            }`}
                          >
                            ₹{walletBalance.toFixed(0)}
                          </span>
                          {" available"}
                        </span>
                      )}
                    </div>
                    {paymentMethod === "wallet" && walletInsufficient && (
                      <div
                        data-ocid="checkout.wallet.error_state"
                        className="mt-2 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2"
                      >
                        ⚠️ Insufficient wallet balance (₹
                        {walletBalance.toFixed(0)} available). Please choose
                        another payment method.
                      </div>
                    )}
                  </div>
                </label>
              </RadioGroup>

              {paymentMethod === "upi" && (
                <div className="mt-5 p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 flex flex-col sm:flex-row items-center gap-6">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-blue-100">
                    <img
                      src="/assets/generated/upi-qr-placeholder-transparent.dim_300x350.png"
                      alt="UPI QR Code"
                      className="w-40 h-44 object-contain"
                    />
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="text-sm text-white/50 mb-1">
                      Scan &amp; Pay via any UPI app
                    </div>
                    <div className="font-bold text-lg text-cyan-300 mb-3">
                      smartonline@sbi
                    </div>
                    <div className="text-xs text-white/50 bg-white/80 border border-blue-100 rounded-xl px-3 py-2">
                      ✓ Google Pay &nbsp; ✓ PhonePe &nbsp; ✓ Paytm &nbsp; ✓ BHIM
                    </div>
                    <div className="text-xs text-gray-400 mt-3">
                      After payment, screenshot confirmation will be requested
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Right: Order Summary */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-white/10 sticky top-24">
              <h2 className="text-lg font-bold text-cyan-300 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" /> Order Summary
              </h2>
              <div className="flex flex-col gap-3 mb-4">
                {cartItems.map((item) => (
                  <div
                    key={item.itemId}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">
                        {item.itemName}
                      </div>
                      <div className="text-gray-400 text-xs">x{item.qty}</div>
                    </div>
                    <div className="font-semibold text-cyan-300 ml-3">
                      ₹{(item.price * item.qty).toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between font-bold text-base">
                <span className="text-white/70">Total</span>
                <span className="text-cyan-300 text-lg">
                  ₹{cartTotal.toFixed(0)}
                </span>
              </div>
              <Button
                data-ocid="checkout.place_order.button"
                className="w-full mt-5 h-12 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-base"
                onClick={handlePlaceOrder}
                disabled={placing || walletInsufficient}
              >
                {placing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Place Order
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-400 text-center mt-3">
                🔒 Secure checkout. Your data is protected.
              </p>
            </div>
          </div>
        </div>
      </main>
      <WhatsAppFloatingButton />
    </div>
  );
}
