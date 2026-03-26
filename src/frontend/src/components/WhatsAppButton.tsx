import { motion } from "motion/react";

const WHATSAPP_SUPPORT_URL =
  "https://wa.me/919508911400?text=Hello%20Smart%20Online%20Service%20Center%2C%20I%20need%20help%20with...";

export default function WhatsAppFloatingButton() {
  return (
    <a
      href={WHATSAPP_SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-ocid="whatsapp.support.button"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-6 right-6 z-50"
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl"
        style={{ backgroundColor: "#25D366" }}
      >
        {/* Pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: "#25D366" }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
          transition={{
            duration: 2.4,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
        {/* WhatsApp SVG icon */}
        <svg
          viewBox="0 0 24 24"
          className="w-8 h-8 relative z-10"
          fill="white"
          role="img"
          aria-label="WhatsApp"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.117 1.524 5.847L.057 23.5l5.802-1.522A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.81 9.81 0 0 1-5.007-1.373l-.36-.213-3.44.903.916-3.354-.234-.373A9.789 9.789 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
        </svg>
      </motion.div>
    </a>
  );
}

export function WhatsAppShareButton({
  orderId,
  label = "Share on WhatsApp",
  className = "",
}: {
  orderId: string;
  label?: string;
  className?: string;
}) {
  const text = encodeURIComponent(
    `My order #SO-${orderId} has been placed at Smart Online Service Center (ClikMate). Order ID: #SO-${orderId}`,
  );
  const url = `https://wa.me/?text=${text}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-ocid="whatsapp.order_share.button"
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-95 ${className}`}
      style={{ backgroundColor: "#25D366" }}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-4 h-4"
        fill="white"
        role="img"
        aria-label="WhatsApp"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.117 1.524 5.847L.057 23.5l5.802-1.522A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.81 9.81 0 0 1-5.007-1.373l-.36-.213-3.44.903.916-3.354-.234-.373A9.789 9.789 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
      </svg>
      {label}
    </a>
  );
}

export function InvoiceHeader() {
  return (
    <div className="text-center border-b border-gray-200 pb-4 mb-4">
      <h2 className="text-lg font-bold text-gray-900 leading-tight">
        Smart Online Service Center (ClikMate)
      </h2>
      <p className="text-xs text-gray-500 mt-0.5">
        Krish PG, Geetanjali Colony, Awanti Vihar, Raipur 492001
      </p>
    </div>
  );
}

export function InvoiceFooter() {
  return (
    <div className="text-center border-t border-gray-200 pt-4 mt-4">
      <p className="text-xs italic text-gray-500 leading-relaxed">
        Thank you for trusting us with your secure printing &amp; digital needs.
        <br />
        <span className="font-medium">100% Data Privacy Maintained.</span>
      </p>
    </div>
  );
}
