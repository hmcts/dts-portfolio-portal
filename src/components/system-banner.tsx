import { AlertTriangle } from "lucide-react";
import { getAiParserHealth } from "@/lib/health/ai-parser-health";

// Global system banner — ADR-011 tier 3 visible degradation.
//
// Renders at the top of the AppShell when an external dependency
// has been kill-switched or isn't configured. Today it only watches
// the AI parser; future probes (DB unhealthy, Easy Auth degraded)
// would compose into the same banner.
//
// Returns null when everything is healthy — the AppShell always
// renders <SystemBanner /> so adding a new probe doesn't require
// touching the shell.

interface BannerMessage {
  // Plain English copy the operator / approver sees first.
  title: string;
  // Subtle qualifier the eye lands on second — keeps the banner
  // honest about what is still working.
  detail: string;
}

function messageForAi(): BannerMessage | null {
  const ai = getAiParserHealth();
  if (ai.online) return null;
  if (ai.reason === "kill-switch") {
    return {
      title: "AI helper paused by ops",
      detail:
        "Uploads continue via the strict-template fallback. Approvers will see the parser source on each submission.",
    };
  }
  // not-configured
  return {
    title: "AI helper not configured",
    detail:
      "Uploads continue via the strict-template fallback. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT to enable.",
  };
}

export function SystemBanner() {
  const message = messageForAi();
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 border-b border-[var(--color-border)] bg-[#fff8e6] px-6 py-2.5 text-[13px] text-[#7a5a00]"
      data-testid="system-banner"
    >
      <AlertTriangle
        size={16}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-[#a36b00]"
      />
      <div className="min-w-0">
        <strong className="font-medium">{message.title}</strong>
        <span className="ml-2 text-[#8a6a00]">{message.detail}</span>
      </div>
    </div>
  );
}
