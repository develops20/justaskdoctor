import { NextResponse } from "next/server";
import { WebsiteContextSchema } from "@/lib/contracts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Live voice is not configured. Use the typed demo, or add OPENAI_API_KEY.",
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const context = WebsiteContextSchema.safeParse(body?.context);
  if (!context.success) {
    return NextResponse.json({ error: "Invalid page context." }, { status: 400 });
  }

  const model = process.env.OPENAI_LIVE_MODEL ?? "gpt-realtime-2.1";
  const response = await fetch(
    "https://api.openai.com/v1/realtime/client_secrets",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
        },
      }),
      signal: AbortSignal.timeout(8000),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error("[live] Client secret creation failed:", response.status, detail);
    return NextResponse.json(
      { error: "OpenAI Live could not start. The typed demo is still available." },
      { status: 502 },
    );
  }

  const session = (await response.json()) as { value?: string };
  if (!session.value?.startsWith("ek_")) {
    return NextResponse.json(
      { error: "OpenAI returned an invalid client secret." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    clientSecret: session.value,
    model,
  });
}
