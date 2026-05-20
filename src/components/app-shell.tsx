import { Sidebar } from "./sidebar";
import { SystemBanner } from "./system-banner";
import { Topbar } from "./topbar";

// Outer layout: fixed-width sidebar on the left, topbar across the top
// of the main column, then scrollable main content. The shell is the
// only place that knows about the chrome — pages render their own
// content into the main slot via Next.js layout composition.
//
// <SystemBanner /> sits above the topbar and renders null when all
// external dependencies are healthy. ADR-011 tier 3 visible-
// degradation: when AI is kill-switched or unconfigured, the
// operator sees it on every page load rather than having to spot
// the per-submission pill.

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-dvw overflow-hidden bg-[var(--color-canvas)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <SystemBanner />
        <Topbar />
        <main
          id="main"
          tabIndex={0}
          aria-label="Main content"
          className="flex-1 overflow-y-auto px-8 py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
