import { NextResponse } from "next/server";
import { z } from "zod";
import { ResearchSourceSchema, type ResearchSource } from "@/lib/contracts";
import { DEMO_MODE } from "@/lib/config";

export const runtime = "nodejs";

const RequestSchema = z.object({
  query: z.literal("official booking availability schedule no slots"),
});

const fallbackSources: ResearchSource[] = [
  {
    title: "Set up your availability",
    url: "https://cal.com/help/availabilities/set-up-your-availability",
    extract:
      "Availability schedules define the days and times when a team member can accept bookings.",
    domain: "cal.com",
    isFallback: true,
  },
  {
    title: "Troubleshooting event type display issues",
    url: "https://cal.com/help/event-types/display-issues",
    extract:
      "When slots do not display, verify the host's schedule and event availability settings.",
    domain: "cal.com",
    isFallback: true,
  },
];

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid research request." }, { status: 400 });
  }

  if (!process.env.EXA_API_KEY) {
    console.info(
      `[research] ${DEMO_MODE ? "DEMO_MODE active and " : ""}EXA_API_KEY missing; using bundled official sources.`,
    );
    return NextResponse.json({ sources: fallbackSources });
  }

  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.EXA_API_KEY,
      },
      body: JSON.stringify({
        query:
          "Official guidance for availability schedules when booking slots do not appear",
        type: "auto",
        numResults: 3,
        includeDomains: ["cal.com"],
        contents: { highlights: { maxCharacters: 500 } },
      }),
      signal: AbortSignal.timeout(3500),
    });

    if (!response.ok) throw new Error(`Exa returned ${response.status}`);
    const payload = (await response.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        highlights?: string[];
        text?: string;
      }>;
    };
    const sources = (payload.results ?? [])
      .map((result) =>
        ResearchSourceSchema.safeParse({
          title: result.title ?? "Availability guidance",
          url: result.url,
          extract:
            result.highlights?.[0] ??
            result.text?.slice(0, 500) ??
            "Official availability documentation.",
          domain: result.url ? new URL(result.url).hostname : "cal.com",
          isFallback: false,
        }),
      )
      .filter((result) => result.success)
      .map((result) => result.data);

    return NextResponse.json({
      sources: sources.length > 0 ? sources : fallbackSources,
    });
  } catch (error) {
    console.warn("[research] Exa unavailable; using bundled sources.", error);
    return NextResponse.json({ sources: fallbackSources });
  }
}
