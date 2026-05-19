import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

// Outer layout: fixed-width sidebar on the left, topbar across the top
// of the main column, then scrollable main content. The shell is the
// only place that knows about the chrome — pages render their own
// content into the main slot via Next.js layout composition.

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-dvw overflow-hidden bg-[var(--color-canvas)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 overflow-y-auto px-8 py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
