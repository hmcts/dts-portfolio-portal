import { PageHeader } from "@/components/ui/page-header";
import { UploadForm } from "./upload-form";

// Upload screen per requirements spec §7.1. Accepts either a dropped
// markdown file or pasted markdown. Routes through the server action
// in ./actions.ts which identity-parses, AI-parses, and writes to
// the append-only audit log. Phase 2 task 2.6 wires the approval
// screen on top of the returned submission ID.

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader
        eyebrow="Add content"
        title="Upload a markdown file"
        lede="To add or update a Team, Product or Domain, drop in its markdown file (or paste the content). An AI helper parses the body; the original bytes are stored append-only for audit; you review and approve the parsed fields before publishing."
      />

      <div className="mt-10">
        <UploadForm />
      </div>
    </div>
  );
}
