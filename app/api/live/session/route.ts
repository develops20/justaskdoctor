import { NextResponse } from "next/server";
import { WebsiteContextSchema } from "@/lib/contracts";

export const runtime = "nodejs";

const investigationTool = {
  type: "function",
  name: "run_registered_customer_test",
  description:
    "Run the host application's registered customer journey test for the problem the owner reports. It supports Haircut with Sara, Dimensional color with Maya, and the Artists menu exception.",
  parameters: {
    type: "object",
    properties: {
      ownerRequest: { type: "string", maxLength: 200 },
    },
    required: ["ownerRequest"],
    additionalProperties: false,
  },
  strict: true,
};

const fridayCorrectionTool = {
  type: "function",
  name: "remove_friday_from_pending_schedule",
  description:
    "Revise the pending availability proposal when the owner says the salon is closed Friday. This creates an approval request but does not apply it.",
  parameters: {
    type: "object",
    properties: {
      ownerCorrection: { type: "string", maxLength: 200 },
    },
    required: ["ownerCorrection"],
    additionalProperties: false,
  },
  strict: true,
};

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
  if (
    !context.success ||
    typeof body?.sdp !== "string" ||
    !body.sdp.trim()
  ) {
    return NextResponse.json(
      { error: "A valid page context and SDP offer are required." },
      { status: 400 },
    );
  }

  const model = process.env.OPENAI_LIVE_MODEL || "gpt-live-1";
  const reasoningModel =
    process.env.OPENAI_REASONING_MODEL || "gpt-5.6-terra";
  const response = await fetch(
    "https://api.openai.com/v1/live/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          model,
          instructions: `You are JustAsk, a concise voice assistant for a nontechnical salon owner.
Keep spoken replies brief and conversational. Delegate registered customer-journey tests and requested proposal corrections to the backend.
Never say a repair was applied until the backend reports that the app verified it. Never request or repeat personal data, credentials, cookies, or payment details.
Ask the owner to review and explicitly approve any visual change; never claim approval on their behalf.`,
          delegation: {
            type: "responses",
            responses: {
              model: reasoningModel,
              instructions: `Use the registered tools for the salon owner's request and accurately summarize their verified results.
For Sara's missing schedule, propose Monday through Friday, 09:00–17:00, and direct the owner to the visual approval options.
For the Dimensional color problem, explain the registered 90-to-180-minute code patch and direct the owner to its visual approval card.
For an Artists-link JavaScript exception, explain the exact TypeError, summarize the returned trusted sources, and ask the owner to choose one of the visual JavaScript fixes.
If the owner says the salon is closed Friday, call remove_friday_from_pending_schedule.
Never apply a fix or claim it was approved. Current allowlisted page context: ${JSON.stringify(context.data)}`,
              tools: [investigationTool, fridayCorrectionTool],
              tool_choice: "auto",
              parallel_tool_calls: false,
            },
          },
        },
        transport: {
          type: "webrtc",
          sdp: body.sdp,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error("[live] Session creation failed:", response.status, detail);
    let upstreamMessage = detail;
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string } };
      upstreamMessage = parsed.error?.message ?? detail;
    } catch {
      // Keep the plain-text upstream response.
    }
    return NextResponse.json(
      {
        error: `OpenAI Live could not start (${response.status}): ${upstreamMessage}`,
      },
      { status: 502 },
    );
  }

  const session = (await response.json()) as {
    session?: { id?: string };
    transport?: { type?: string; sdp?: string };
  };
  if (!session.session?.id || !session.transport?.sdp) {
    return NextResponse.json(
      { error: "OpenAI returned an invalid Live session." },
      { status: 502 },
    );
  }

  return NextResponse.json(session, { status: 201 });
}
