import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  }
  return Response.json({
    ok: true,
    configured: Boolean(
      Netlify.env.get("APINEX_API_KEY") && Netlify.env.get("APINEX_BASE_URL"),
    ),
  });
};

export const config: Config = { path: "/api/health" };
