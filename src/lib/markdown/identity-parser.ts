import matter from "gray-matter";
import { z } from "zod";
import { JurisdictionSlug } from "@/lib/entities";

// Markdown identity parser per requirements spec §7.1. Extracts the
// strict YAML front-matter that every uploaded markdown file must
// carry: `type` (jurisdiction | domain | team | product), `name`,
// and the parent reference appropriate to the type.
//
// This parser is deterministic — no AI involvement. It runs as the
// first stage of every upload, before the AI parser sees the body.
// Malformed front-matter is rejected here so the AI never sees a
// document with an ambiguous identity.

const TeamFrontMatter = z.object({
  type: z.literal("team"),
  name: z.string().min(1, "name must not be empty"),
  // Tolerant on the parent: accept either a slug or a human name.
  // Slug normalisation happens at approve time, not at parse time.
  domain: z.string().min(1, "team must reference a parent domain"),
});

const ProductFrontMatter = z.object({
  type: z.literal("product"),
  name: z.string().min(1, "name must not be empty"),
  domain: z.string().min(1, "product must reference a parent domain"),
});

const DomainFrontMatter = z.object({
  type: z.literal("domain"),
  name: z.string().min(1, "name must not be empty"),
  jurisdiction: JurisdictionSlug,
});

const JurisdictionFrontMatter = z.object({
  type: z.literal("jurisdiction"),
  name: z.string().min(1, "name must not be empty"),
});

export const FrontMatter = z.discriminatedUnion("type", [
  TeamFrontMatter,
  ProductFrontMatter,
  DomainFrontMatter,
  JurisdictionFrontMatter,
]);
export type FrontMatter = z.infer<typeof FrontMatter>;

export interface ParsedIdentity {
  frontMatter: FrontMatter;
  body: string;
}

export class IdentityParseError extends Error {
  readonly issues: z.core.$ZodIssue[] | undefined;
  constructor(message: string, issues?: z.core.$ZodIssue[]) {
    super(message);
    this.name = "IdentityParseError";
    this.issues = issues;
  }
}

// Parse the front-matter from a raw markdown string. Throws
// IdentityParseError when:
//   - the document has no front-matter block
//   - the front-matter is not valid YAML
//   - the `type` field is missing or unknown
//   - the required fields for the declared type are missing or empty
export function parseIdentity(rawMarkdown: string): ParsedIdentity {
  if (typeof rawMarkdown !== "string" || rawMarkdown.trim() === "") {
    throw new IdentityParseError("Empty document — no markdown to parse.");
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(rawMarkdown);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new IdentityParseError(`Front-matter is not valid YAML: ${message}`);
  }

  if (parsed.matter.trim() === "") {
    throw new IdentityParseError(
      "No YAML front-matter found. Every uploaded markdown file must start with a `---` delimited block declaring `type`, `name`, and a parent reference.",
    );
  }

  const data = parsed.data as Record<string, unknown>;
  if (typeof data.type !== "string") {
    throw new IdentityParseError(
      "Front-matter is missing the required `type` field.",
    );
  }

  const result = FrontMatter.safeParse(data);
  if (!result.success) {
    throw new IdentityParseError(
      `Front-matter does not match the expected shape for type "${data.type}".`,
      result.error.issues,
    );
  }

  return {
    frontMatter: result.data,
    body: parsed.content,
  };
}
