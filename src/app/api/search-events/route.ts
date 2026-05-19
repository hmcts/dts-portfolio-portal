import { NextResponse } from "next/server";
import { z } from "zod";
import { recordSearchClick } from "@/lib/search/analytics";

// POST handler for client-side search-click beacons.
//
// The overlay's onClick handler should call this with the query + the
// entity that was opened, before navigating. We swallow recording
// errors with a 204 so a transient DB blip doesn't surface as a
// visible failure to the user — analytics loss is preferable to
// breaking the click.

const ClickEventSchema = z.object({
  kind: z.literal("click"),
  query: z.string().min(1).max(500),
  clickedEntityType: z.enum([
    "jurisdiction",
    "domain",
    "team",
    "product",
    "initiative",
  ]),
  clickedEntityId: z.string().min(1).max(64),
  clickedPosition: z.number().int().min(0).max(100),
});

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be valid JSON" },
      { status: 400 },
    );
  }
  const parsed = ClickEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event shape", details: parsed.error.format() },
      { status: 400 },
    );
  }
  try {
    await recordSearchClick({
      query: parsed.data.query,
      clickedEntityType: parsed.data.clickedEntityType,
      clickedEntityId: parsed.data.clickedEntityId,
      clickedPosition: parsed.data.clickedPosition,
    });
  } catch {
    // Swallow — analytics loss is preferable to a click failing.
    // The platform's observability picks up the underlying DB error.
  }
  return new Response(null, { status: 204 });
}
