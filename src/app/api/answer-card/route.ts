import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAnswerCardSynthesiser,
  type AnswerCardResult,
  type AnswerCardResultInput,
} from "@/lib/ai-answer/answer-card";

// POST handler for the LLM answer-card endpoint (Phase 3 task 3.3).
//
// The overlay calls this after the ranked /api/search results return.
// Body: { query, results: [{entityType, name, description?, href?}] }
// Response: AnswerCardResult — either {source:"azure-openai",
// answer, citations} or {source:"unavailable", answer:null, reason}.
//
// When Azure OpenAI isn't configured (no env vars), the synthesiser
// is null and we return "unavailable" with a reason. The overlay
// uses that to hide the card and fall through to the ranked list.

const ResultSchema = z.object({
  entityType: z.string().min(1).max(64),
  name: z.string().min(1).max(280),
  description: z.string().max(2_000).nullish(),
  href: z.string().max(500).nullish(),
});

const RequestSchema = z.object({
  query: z.string().min(1).max(500),
  // Hard cap the input — the answer card is meant to summarise the
  // top results, not the whole corpus. Anything beyond a handful is
  // dropped on the server side regardless of what the client sent.
  results: z.array(ResultSchema).min(0).max(20),
});

// Synthesiser shape consumed by the handler. `null` means Azure
// OpenAI isn't configured (no endpoint/deployment env vars set);
// the handler turns that into a clean "unavailable" response.
export type AnswerCardSynth = {
  synthesise(
    query: string,
    results: AnswerCardResultInput[],
  ): Promise<AnswerCardResult>;
} | null;

// Core handler — exposed for unit tests so a hand-written synth stub
// can be injected directly. POST() below wires the real synthesiser.
export async function handleAnswerCard(
  req: Request,
  synth: AnswerCardSynth,
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be valid JSON" },
      { status: 400 },
    );
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request shape", details: parsed.error.format() },
      { status: 400 },
    );
  }

  if (synth === null) {
    // Tier-2 degradation per ADR-011: surface the unavailable state
    // explicitly so the overlay can hide the card and show the
    // ranked list alone, with a visible "answer card unavailable"
    // note.
    return NextResponse.json(
      {
        source: "unavailable",
        answer: null,
        reason: "Azure OpenAI is not configured",
      } satisfies AnswerCardResult,
      { status: 200 },
    );
  }

  const result = await synth.synthesise(parsed.data.query, parsed.data.results);
  return NextResponse.json(result, { status: 200 });
}

export async function POST(req: Request): Promise<Response> {
  return handleAnswerCard(req, getAnswerCardSynthesiser());
}
