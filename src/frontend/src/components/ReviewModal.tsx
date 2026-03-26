import type { ShopOrder } from "@/backend.d";
import type { backendInterface } from "@/backend.d";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/useActor";
import { Star, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SUBMITTED_KEY = "clikmate_submitted_reviews";
const DISMISSED_KEY = "clikmate_dismissed_reviews";

export function getSubmittedReviews(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SUBMITTED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getDismissedReviews(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function markReviewSubmitted(orderId: string) {
  const arr = getSubmittedReviews();
  if (!arr.includes(orderId)) {
    arr.push(orderId);
    localStorage.setItem(SUBMITTED_KEY, JSON.stringify(arr));
  }
}

export function markReviewDismissed(orderId: string) {
  const arr = getDismissedReviews();
  if (!arr.includes(orderId)) {
    arr.push(orderId);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(arr));
  }
}

function StarRating({
  value,
  onChange,
  size = 24,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none transition-transform hover:scale-110"
          aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            style={{ width: size, height: size }}
            className={
              (hovered || value) >= n
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-200"
            }
          />
        </button>
      ))}
    </div>
  );
}

interface ReviewModalProps {
  order: ShopOrder;
  open: boolean;
  customerPhone: string;
  onDismiss: () => void;
  onSubmitted: () => void;
}

export default function ReviewModal({
  order,
  open,
  customerPhone,
  onDismiss,
  onSubmitted,
}: ReviewModalProps) {
  const { actor } = useActor();
  const [serviceRating, setServiceRating] = useState(5);
  const [serviceComment, setServiceComment] = useState("");
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [deliveryComment, setDeliveryComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isLocalDelivery = order.deliveryMethod === "Local Delivery";
  const orderId = String(order.id);
  const customerName = order.customerName || "Customer";

  async function handleSubmit() {
    if (!actor) {
      toast.error("Not connected. Please try again.");
      return;
    }
    if (serviceRating === 0) {
      toast.error("Please rate the service.");
      return;
    }
    setSubmitting(true);
    try {
      await (actor as unknown as backendInterface).submitReview(
        order.id,
        customerName,
        customerPhone,
        "", // location not collected here; admin can see it
        BigInt(serviceRating),
        serviceComment,
        isLocalDelivery && deliveryRating > 0 ? BigInt(deliveryRating) : null,
        isLocalDelivery && deliveryComment ? deliveryComment : null,
      );
      markReviewSubmitted(orderId);
      toast.success("Thank you for your review!");
      onSubmitted();
    } catch (e) {
      console.error(e);
      toast.error("Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDismiss() {
    markReviewDismissed(orderId);
    onDismiss();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent
        data-ocid="review.modal"
        className="max-w-md w-full rounded-2xl p-0 overflow-hidden border-0 shadow-2xl"
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-4 relative"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.25 0.08 256), oklch(0.3 0.1 280))",
          }}
        >
          <button
            type="button"
            data-ocid="review.close_button"
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <DialogHeader>
            <DialogTitle className="text-white text-xl font-bold mb-1">
              How was your experience?
            </DialogTitle>
            <p className="text-white/60 text-sm">
              Order #{orderId} &mdash; {order.items[0]?.itemName || "Service"}
            </p>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {/* Section 1: Service Rating */}
          <div>
            <p className="font-semibold blue-text mb-3">
              Rate the Service / Shop
            </p>
            <StarRating
              value={serviceRating}
              onChange={setServiceRating}
              size={28}
            />
            <Textarea
              data-ocid="review.service.textarea"
              className="mt-3 text-sm resize-none"
              placeholder="Share your experience (optional)"
              rows={3}
              value={serviceComment}
              onChange={(e) => setServiceComment(e.target.value)}
            />
          </div>

          {/* Section 2: Delivery Rating (only for Local Delivery) */}
          {isLocalDelivery && (
            <div className="border-t pt-5">
              <p className="font-semibold blue-text mb-3">
                Rate the Delivery Partner
              </p>
              <StarRating
                value={deliveryRating}
                onChange={setDeliveryRating}
                size={28}
              />
              <Textarea
                data-ocid="review.delivery.textarea"
                className="mt-3 text-sm resize-none"
                placeholder="Comment about delivery (optional)"
                rows={2}
                value={deliveryComment}
                onChange={(e) => setDeliveryComment(e.target.value)}
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              data-ocid="review.skip_button"
              variant="outline"
              className="flex-1"
              onClick={handleDismiss}
              disabled={submitting}
            >
              Skip
            </Button>
            <Button
              data-ocid="review.submit_button"
              className="flex-1 blue-bg hover:opacity-90 text-white"
              onClick={handleSubmit}
              disabled={submitting || serviceRating === 0}
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
