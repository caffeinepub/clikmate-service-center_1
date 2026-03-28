import { useNavigate } from "@/utils/router";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  /** Hide button when a form is actively being edited */
  disabled?: boolean;
  label?: string;
}

export default function BackButton({
  disabled = false,
  label = "Back",
}: BackButtonProps) {
  if (disabled) return null;
  return (
    <button
      type="button"
      data-ocid="nav.back.button"
      onClick={() => window.history.back()}
      className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 transition-colors px-3 py-1.5 rounded-lg border border-cyan-500/30 hover:border-cyan-400/50 bg-cyan-500/10 hover:bg-cyan-500/20"
      style={{ backdropFilter: "blur(8px)" }}
    >
      <ChevronLeft size={16} />
      {label}
    </button>
  );
}
