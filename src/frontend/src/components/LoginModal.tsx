import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ChevronRight, Loader2, Phone, Shield } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useActor } from "../hooks/useActor";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess: (phone: string) => void;
}

const OTP_POSITIONS = [0, 1, 2, 3, 4, 5] as const;

export default function LoginModal({
  open,
  onOpenChange,
  onLoginSuccess,
}: LoginModalProps) {
  const { actor } = useActor();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handlePhoneChange(val: string) {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    setPhone(digits);
  }

  async function handleSendOtp() {
    if (phone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    setLoading(true);
    try {
      await actor?.generateOtp(phone);
      toast.success("OTP sent! (Demo: use 123456)");
      setStep("otp");
    } catch {
      toast.error("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerifyOtp() {
    const code = otp.join("");
    if (code.length !== 6) {
      toast.error("Please enter the complete 6-digit OTP.");
      return;
    }
    setLoading(true);
    try {
      const valid = await actor?.verifyOtp(phone, code);
      if (valid) {
        // Save profile - don't let failure block login
        try {
          await actor?.saveCallerUserProfile({ name: "", phone });
        } catch {
          // profile save failed, login still succeeds
        }
        // Persist phone to localStorage for session restore
        localStorage.setItem("clikmate_phone", phone);
        toast.success("Login successful! Welcome to ClikMate.");
        onLoginSuccess(phone);
        onOpenChange(false);
        setStep("phone");
        setPhone("");
        setOtp(["", "", "", "", "", ""]);
      } else {
        toast.error("Invalid OTP. Please try again.");
      }
    } catch {
      toast.error("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep("phone");
    setOtp(["", "", "", "", "", ""]);
  }

  const maskedPhone =
    phone.length === 10 ? `+91 ${phone.slice(0, 4)}XX${phone.slice(6)}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-ocid="login.modal"
        className="max-w-md rounded-2xl p-0 overflow-hidden border-0 shadow-2xl"
      >
        {/* Header gradient */}
        <div className="hero-gradient px-8 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 yellow-bg rounded-xl flex items-center justify-center">
              <Phone className="w-5 h-5 text-gray-900" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">ClikMate</div>
              <div className="text-white/60 text-xs">
                Smart Online Service Center
              </div>
            </div>
          </div>
          <DialogHeader>
            <DialogTitle className="text-white text-2xl font-bold">
              {step === "phone" ? "Login / Sign Up" : "Verify OTP"}
            </DialogTitle>
            <p className="text-blue-200 text-sm mt-1">
              {step === "phone"
                ? "Enter your mobile number to continue"
                : `Enter the 6-digit OTP sent to ${maskedPhone}`}
            </p>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {step === "phone" ? (
            <div className="flex flex-col gap-5">
              <div>
                <Label
                  htmlFor="login-phone"
                  className="text-sm font-semibold blue-text mb-2 block"
                >
                  10-Digit Mobile Number
                </Label>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                  <span className="px-4 py-3 bg-gray-50 text-gray-500 text-sm font-medium border-r border-gray-200">
                    +91
                  </span>
                  <input
                    id="login-phone"
                    data-ocid="login.phone.input"
                    type="tel"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="9876543210"
                    className="flex-1 px-4 py-3 text-sm outline-none bg-white"
                    maxLength={10}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                  />
                </div>
              </div>
              <Button
                data-ocid="login.send_otp.primary_button"
                onClick={handleSendOtp}
                disabled={loading || phone.length !== 10}
                className="yellow-bg text-gray-900 font-semibold rounded-xl h-12 hover:opacity-90 border-0 text-sm"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-2" />
                )}
                {loading ? "Sending OTP..." : "Send OTP"}
              </Button>
              <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
                <Shield className="w-3.5 h-3.5" />
                Your number is safe. We don&apos;t share it with anyone.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <Label className="text-sm font-semibold blue-text mb-3 block">
                  Enter 6-Digit OTP
                </Label>
                <div
                  className="flex gap-2 justify-center"
                  data-ocid="login.otp.input"
                >
                  {OTP_POSITIONS.map((pos) => (
                    <input
                      key={`otp-${pos}`}
                      ref={(el) => {
                        otpRefs.current[pos] = el;
                      }}
                      type="tel"
                      value={otp[pos]}
                      onChange={(e) => handleOtpChange(pos, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(pos, e)}
                      maxLength={1}
                      className="w-11 h-12 text-center text-xl font-bold border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  ))}
                </div>
              </div>
              <Button
                data-ocid="login.verify_otp.primary_button"
                onClick={handleVerifyOtp}
                disabled={loading || otp.join("").length !== 6}
                className="yellow-bg text-gray-900 font-semibold rounded-xl h-12 hover:opacity-90 border-0 text-sm"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                {loading ? "Verifying..." : "Verify & Login"}
              </Button>
              <button
                type="button"
                data-ocid="login.back.button"
                onClick={handleBack}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors text-center"
              >
                &larr; Change number
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
