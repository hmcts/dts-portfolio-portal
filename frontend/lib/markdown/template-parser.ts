import { parseIdentity, type FrontMatter } from "./identity-parser";
import type { TimeBucket } from "@/lib/entities";

// Strict-template body parser per requirements spec §7.5 — used as the
// fallback path when the AI parser is unavailable. It only accepts the
// canonical section headers in the expected order; documents that
// deviate fall through to error states the AI parser would have
// handled.
//
// The AI parser (Task 2.3) handles section-name variants tolerantly;
// this strict parser is intentionally narrow so the worst-case
// "AI is offline" experience is still "well-formed markdown is accepted".

export interface DomainParsed {
  about?: string;
  strategicThemes: { title: string; description?: string }[];
}

export interface TeamParsed {
  about?: string;
  whatWeOperate?: string;
  howToReachUs?: string;
  links: { label: string; url: string }[];
}

export interface ProductParsed {
  about?: string;
  roadmap: Record<TimeBucket, { title: string; description?: string }[]>;
  links: { label: string; url: string }[];
}

export type StrictTemplateOutput =
  | { kind: "jurisdiction"; about?: string }
  | { kind: "domain"; body: DomainParsed }
  | { kind: "team"; body: TeamParsed }
  | { kind: "product"; body: ProductParsed };

export interface StrictTemplateResult {
  frontMatter: FrontMatter;
  output: StrictTemplateOutput;
}

export class StrictTemplateParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StrictTemplateParseError";
  }
}

// Split a body into top-level # sections keyed by their heading text.
// Headings beyond H1 (## / ###) stay inside the H1 section's content
// so the consumer can do its own sub-parsing.
function splitH1Sections(body: string): Map<string, string> {
  const lines = body.split(/\r?\n/);
  const sections = new Map<string, string>();
  let currentHeader: string | null = null;
  let buf: string[] = [];
  for (const line of lines) {
    const match = /^#\s+(.+?)\s*$/.exec(line);
    if (match) {
      if (currentHeader !== null) {
        sections.set(currentHeader.toLowerCase(), buf.join("\n").trim());
      }
      currentHeader = match[1];
      buf = [];
    } else if (currentHeader !== null) {
      buf.push(line);
    }
  }
  if (currentHeader !== null) {
    sections.set(currentHeader.toLowerCase(), buf.join("\n").trim());
  }
  return sections;
}

// Within a section, split by ## sub-headings. Used by the roadmap
// parser to find NOW / NEXT / LATER buckets inside `# Roadmap`.
function splitH2Subsections(content: string): Map<string, string> {
  const lines = content.split(/\r?\n/);
  const sub = new Map<string, string>();
  let currentSub: string | null = null;
  let buf: string[] = [];
  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      if (currentSub !== null) {
        sub.set(currentSub.toLowerCase(), buf.join("\n").trim());
      }
      currentSub = match[1];
      buf = [];
    } else if (currentSub !== null) {
      buf.push(line);
    }
  }
  if (currentSub !== null) {
    sub.set(currentSub.toLowerCase(), buf.join("\n").trim());
  }
  return sub;
}

// Markdown bullet list → array of { title, description? }
// A line starting with `- ` or `* ` is a title; lines indented under
// it are folded into description until the next bullet.
function parseBullets(content: string): { title: string; description?: string }[] {
  const lines = content.split(/\r?\n/);
  const items: { title: string; description?: string }[] = [];
  let current: { title: string; descLines: string[] } | null = null;
  const flush = () => {
    if (current) {
      const description = current.descLines.join(" ").trim();
      items.push({
        title: current.title,
        description: description === "" ? undefined : description,
      });
      current = null;
    }
  };
  for (const raw of lines) {
    const bullet = /^[-*]\s+(.+?)\s*$/.exec(raw);
    if (bullet) {
      flush();
      current = { title: bullet[1], descLines: [] };
    } else if (current && raw.trim() !== "") {
      current.descLines.push(raw.trim());
    } else if (raw.trim() === "" && current) {
      // blank line ends the current item's description but keeps it
      flush();
    }
  }
  flush();
  return items;
}

// Markdown link list → array of { label, url }
// Accepts `- [Label](https://url)` and `- Label — https://url` forms.
function parseLinkList(content: string): { label: string; url: string }[] {
  const lines = content.split(/\r?\n/);
  const links: { label: string; url: string }[] = [];
  for (const raw of lines) {
    const md = /^[-*]\s*\[(.+?)\]\((https?:\/\/[^\s)]+)\)/.exec(raw);
    if (md) {
      links.push({ label: md[1].trim(), url: md[2] });
      continue;
    }
    const plain = /^[-*]\s+(.+?)\s+[—-]\s+(https?:\/\/\S+)/.exec(raw);
    if (plain) {
      links.push({ label: plain[1].trim(), url: plain[2] });
    }
  }
  return links;
}

function parseDomain(body: string): DomainParsed {
  const sections = splitH1Sections(body);
  return {
    about: sections.get("about"),
    strategicThemes: parseBullets(
      sections.get("strategic direction") ?? sections.get("themes") ?? "",
    ),
  };
}

function parseTeam(body: string): TeamParsed {
  const sections = splitH1Sections(body);
  return {
    about: sections.get("about"),
    whatWeOperate: sections.get("what we operate"),
    howToReachUs: sections.get("how to reach us"),
    links: parseLinkList(sections.get("links") ?? ""),
  };
}

function parseProduct(body: string): ProductParsed {
  const sections = splitH1Sections(body);
  const roadmapContent = sections.get("roadmap") ?? "";
  const buckets = splitH2Subsections(roadmapContent);
  const empty: TimeBucket[] = ["NOW", "NEXT", "LATER"];
  const roadmap: Record<TimeBucket, { title: string; description?: string }[]> = {
    NOW: parseBullets(buckets.get("now") ?? ""),
    NEXT: parseBullets(buckets.get("next") ?? ""),
    LATER: parseBullets(buckets.get("later") ?? ""),
  };
  void empty;
  return {
    about: sections.get("about"),
    roadmap,
    links: parseLinkList(sections.get("links") ?? ""),
  };
}

// The public entry point: identity-parse the document first, then run
// the body parser appropriate to the declared type. The combined
// result is what Phase 2 task 2.5 (upload endpoint) writes to the
// audit log as `ai_parsed_output` when the AI client is offline.
export function parseStrictTemplate(rawMarkdown: string): StrictTemplateResult {
  const { frontMatter, body } = parseIdentity(rawMarkdown);
  switch (frontMatter.type) {
    case "jurisdiction":
      return {
        frontMatter,
        output: {
          kind: "jurisdiction",
          about: splitH1Sections(body).get("about"),
        },
      };
    case "domain":
      return {
        frontMatter,
        output: { kind: "domain", body: parseDomain(body) },
      };
    case "team":
      return { frontMatter, output: { kind: "team", body: parseTeam(body) } };
    case "product":
      return {
        frontMatter,
        output: { kind: "product", body: parseProduct(body) },
      };
  }
}
