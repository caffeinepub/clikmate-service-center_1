import type { Review } from "@/backend.d";
import type { backendInterface } from "@/backend.d";
import { useActor } from "@/hooks/useActor";
import { ChevronLeft, ChevronRight, MapPin, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SEED_KEY = "clikmate_reviews_seeded";

const FALLBACK_REVIEWS = [
  {
    id: "f1",
    serviceRating: 5,
    customerName: "Aman V.",
    location: "Awanti Vihar",
    serviceComment:
      "Best place for bulk printing near our PG. Quality is top notch and rates are very genuine.",
  },
  {
    id: "f2",
    serviceRating: 5,
    customerName: "Neha R.",
    location: "Geetanjali Colony",
    serviceComment:
      "I always use ClikMate for my coaching notes printing. Never disappointed.",
  },
  {
    id: "f3",
    serviceRating: 5,
    customerName: "Divya S.",
    location: "Awanti Vihar",
    serviceComment:
      "Very polite owner. The new online document upload feature is a game changer.",
  },
  {
    id: "f4",
    serviceRating: 5,
    customerName: "Vikas K.",
    location: "Labhandih",
    serviceComment:
      "Ordered a 64GB pendrive and some color printouts. Arrived at my office within 30 mins. Superfast!",
  },
  {
    id: "f5",
    serviceRating: 5,
    customerName: "Rohit S.",
    location: "NIT Raipur",
    serviceComment:
      "Their LaTeX typing service saved my project. Highly recommended for engineering students!",
  },
];

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-4 h-4 ${
            n <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

export default function TestimonialsSection() {
  const { actor, isFetching } = useActor();
  const [reviews, setReviews] =
    useState<
      Array<{
        id: string;
        serviceRating: number;
        customerName: string;
        location: string;
        serviceComment: string;
      }>
    >(FALLBACK_REVIEWS);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!actor || isFetching) return;
    const backend = actor as unknown as backendInterface;

    async function loadReviews() {
      // Seed once
      if (!localStorage.getItem(SEED_KEY)) {
        try {
          await backend.seedReviews();
          localStorage.setItem(SEED_KEY, "true");
        } catch (e) {
          console.warn("seedReviews failed:", e);
        }
      }
      // Fetch published reviews
      try {
        const data = await backend.getPublishedReviews();
        if (data && data.length > 0) {
          setReviews(
            data.map((r: Review) => ({
              id: String(r.id),
              serviceRating: Number(r.serviceRating),
              customerName: r.customerName,
              location: r.location,
              serviceComment: r.serviceComment,
            })),
          );
        }
      } catch (e) {
        console.warn("getPublishedReviews failed:", e);
      }
    }

    loadReviews();
  }, [actor, isFetching]);

  // Auto-slide every 4 seconds
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % reviews.length);
    }, 4000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [reviews.length]);

  function prev() {
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrent((c) => (c - 1 + reviews.length) % reviews.length);
  }

  function next() {
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrent((c) => (c + 1) % reviews.length);
  }

  // Show 3 cards at a time (or all if less)
  const visible =
    reviews.length <= 3
      ? reviews
      : [
          reviews[current % reviews.length],
          reviews[(current + 1) % reviews.length],
          reviews[(current + 2) % reviews.length],
        ];

  return (
    <section
      id="testimonials"
      className="py-20"
      style={{ background: "oklch(0.96 0.025 256)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span
            className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-3"
            style={{
              background: "oklch(0.87 0.185 95)",
              color: "oklch(0.2 0.04 60)",
            }}
          >
            Customer Stories
          </span>
          <h2 className="text-3xl md:text-4xl font-bold blue-text">
            What Raipur Says About Us
          </h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            Real reviews from our community of customers across Raipur.
          </p>
        </div>

        <div className="relative">
          {/* Carousel cards */}
          <div
            data-ocid="testimonials.list"
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {visible.map((review, idx) => (
              <div
                key={`${review.id}-${idx}`}
                data-ocid={`testimonials.item.${idx + 1}`}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4 transition-all duration-300"
              >
                <StarDisplay rating={review.serviceRating} />
                <blockquote className="text-gray-700 text-sm leading-relaxed italic flex-1">
                  &ldquo;{review.serviceComment}&rdquo;
                </blockquote>
                <div className="flex items-center gap-2 border-t pt-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background: "oklch(0.3 0.1 256)" }}
                  >
                    {review.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold blue-text text-sm">
                      {review.customerName}
                    </p>
                    <p className="text-gray-400 text-xs flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {review.location || "Raipur"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation arrows */}
          {reviews.length > 3 && (
            <div className="flex justify-center gap-4 mt-8">
              <button
                type="button"
                data-ocid="testimonials.pagination_prev"
                onClick={prev}
                className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:border-blue-300 transition-colors shadow-sm"
                aria-label="Previous reviews"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              {/* Dots */}
              <div className="flex items-center gap-2">
                {reviews.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setCurrent(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === current
                        ? "w-6 bg-blue-600"
                        : "bg-gray-300 hover:bg-gray-400"
                    }`}
                    aria-label={`Go to review ${i + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                data-ocid="testimonials.pagination_next"
                onClick={next}
                className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:border-blue-300 transition-colors shadow-sm"
                aria-label="Next reviews"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
