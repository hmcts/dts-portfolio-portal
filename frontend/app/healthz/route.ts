// Health endpoint consumed by App Service / docker-compose / smoke tests.
// Returns 200 with a JSON body once the process is serving HTTP.

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
