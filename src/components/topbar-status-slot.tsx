import { AlertTriangle } from "lucide-react";
import { getAiParserHealth } from "@/lib/health/ai-parser-health";

// The bit of the topbar that switches between the gov.uk-style
// "this is a new service" message and the system-degradation
// chunk. Extracted from Topbar so tests can render it without
// dragging in SearchOverlay (which depends on the App Router
// context, not available under happy-dom).
//
// Future tiers (DB-down, Easy Auth degraded) compose more probes
// in here — the Topbar itself stays untouched.

interface DegradationMessage {
  title: string;
  detail: string;
}

function aiDegradationMessage(): DegradationMessage | null {
  const ai = getAiParserHealth();
  if (ai.online) return null;
  if (ai.reason === "kill-switch") {
    return {
      title: "AI helper paused by ops",
      detail: "Uploads continue via the strict-template fallback.",
    };
  }
  return {
    title: "AI helper not configured",
    detail: "Uploads continue via the strict-template fallback.",
  };
}

// True when the slot is rendering a degradation message rather
// than the new-service copy. Topbar consults this to swap its
// background tone.
export function isTopbarDegraded(): boolean {
  return aiDegradationMessage() !== null;
}

export function TopbarStatusSlot() {
  const degradation = aiDegradationMessage();
  if (degradation === null) {
    return (
      <span className="hidden text-[13px] text-[var(--color-muted)] md:inline">
        This is a new service — your feedback will help us improve it.
      </span>
    );
  }
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="ai-degradation"
      className="hidden min-w-0 items-center gap-2 text-[13px] text-[#7a5a00] md:flex"
    >
      <AlertTriangle
        size={14}
        aria-hidden="true"
        className="shrink-0 text-[#a36b00]"
      />
      <strong className="font-medium">{degradation.title}</strong>
      <span className="truncate text-[#8a6a00]">{degradation.detail}</span>
    </span>
  );
}
