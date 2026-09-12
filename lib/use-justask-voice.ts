"use client";

import { RealtimeAgent, RealtimeSession, tool } from "@openai/agents/realtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { WebsiteContext } from "@/lib/contracts";

export type VoiceConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

interface VoiceOptions {
  getContext: () => WebsiteContext;
  onInvestigate: (utterance: string) => Promise<string>;
  onFridayCorrection: (utterance: string) => Promise<void>;
  onInterrupted: () => void;
}

interface ClientToken {
  clientSecret: string;
  model: string;
  contextKey: string;
  createdAt: number;
}

export function useJustAskVoice(options: VoiceOptions) {
  const [connectionState, setConnectionState] =
    useState<VoiceConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<RealtimeSession | null>(null);
  const tokenRef = useRef<ClientToken | null>(null);
  const tokenRequestRef = useRef<Promise<ClientToken> | null>(null);
  const connectionAttemptRef = useRef(0);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const disconnect = useCallback(() => {
    connectionAttemptRef.current += 1;
    const session = sessionRef.current;
    if (session) {
      try {
        session.interrupt();
        session.mute(true);
      } catch {
        // A transport can close between the checks above.
      }
      session.close();
    }
    sessionRef.current = null;
    tokenRef.current = null;
    if (typeof document !== "undefined") {
      document.querySelectorAll("audio").forEach((audio) => {
        audio.pause();
        audio.srcObject = null;
      });
    }
    setConnectionState("disconnected");
  }, []);

  useEffect(() => disconnect, [disconnect]);

  const getClientToken = useCallback(async (): Promise<ClientToken> => {
    const context = optionsRef.current.getContext();
    const contextKey = JSON.stringify(context);
    const cached = tokenRef.current;
    if (
      cached &&
      cached.contextKey === contextKey &&
      Date.now() - cached.createdAt < 30_000
    ) {
      return cached;
    }
    if (tokenRequestRef.current) return tokenRequestRef.current;

    const request = (async () => {
      const tokenResponse = await fetch("/api/live/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      const token = (await tokenResponse.json()) as {
        clientSecret?: string;
        model?: string;
        error?: string;
      };
      if (!tokenResponse.ok || !token.clientSecret || !token.model) {
        throw new Error(token.error ?? "Live voice could not start.");
      }
      const cachedToken: ClientToken = {
        clientSecret: token.clientSecret,
        model: token.model,
        contextKey,
        createdAt: Date.now(),
      };
      tokenRef.current = cachedToken;
      return cachedToken;
    })();
    tokenRequestRef.current = request;
    try {
      return await request;
    } finally {
      tokenRequestRef.current = null;
    }
  }, []);

  const preload = useCallback(async () => {
    if (sessionRef.current) return;
    try {
      await getClientToken();
    } catch {
      // connect() surfaces errors; speculative preload stays silent.
    }
  }, [getClientToken]);

  const connect = useCallback(async () => {
    if (sessionRef.current) return;
    const attempt = connectionAttemptRef.current + 1;
    connectionAttemptRef.current = attempt;
    setConnectionState("connecting");
    setError(null);

    try {
      const context = optionsRef.current.getContext();
      const token = await getClientToken();
      tokenRef.current = null;
      if (connectionAttemptRef.current !== attempt) return;

      const investigateTool = tool({
        name: "run_registered_booking_test",
        description:
          "Run the host application's registered customer booking test for the problem the owner reports. It supports Haircut with Sara and Dimensional color with Maya.",
        parameters: z.object({
          ownerRequest: z.string().max(200),
        }),
        execute: async ({ ownerRequest }) => {
          return optionsRef.current.onInvestigate(ownerRequest);
        },
      });

      const fridayCorrectionTool = tool({
        name: "remove_friday_from_pending_schedule",
        description:
          "Revise the pending availability proposal when the owner says the salon is closed Friday. This creates an approval request but does not apply it.",
        parameters: z.object({
          ownerCorrection: z.string().max(200),
        }),
        execute: async ({ ownerCorrection }) => {
          await optionsRef.current.onFridayCorrection(ownerCorrection);
          return "Friday was removed. The owner must use the visual approval control before anything changes.";
        },
      });

      const agent = new RealtimeAgent({
        name: "JustAsk Site Doctor",
        instructions: `You are a concise voice assistant for a nontechnical salon owner.
You can only inspect the two registered booking journeys, explain their registered fixes, and revise the pending safe schedule.
Never say a repair was applied until the app verifies it. Never request or repeat personal data, credentials, cookies, or payment details.
When asked about either booking problem, call run_registered_booking_test and explain the exact structured result it returns.
For Sara's missing schedule, propose Monday through Friday, 09:00–17:00. If the owner asks you to propose a fix later, repeat this safe proposal and direct them to the visual options.
For the Dimensional color problem, explain the registered 90-to-180-minute code patch and direct the owner to its visual approval card.
If interrupted with a Friday closure, immediately call remove_friday_from_pending_schedule.
Never apply either fix yourself. Tell the owner to review and explicitly approve the exact visual change.
Current allowlisted page context: ${JSON.stringify(context)}`,
        tools: [investigateTool, fridayCorrectionTool],
      });
      const session = new RealtimeSession(agent, { model: token.model });
      session.on("audio_interrupted", () => {
        optionsRef.current.onInterrupted();
      });
      session.on("error", (voiceError) => {
        console.error("[live] Realtime session error:", voiceError);
        setError("Live voice had a problem. You can continue with typed input.");
        setConnectionState("error");
      });
      await session.connect({ apiKey: token.clientSecret });
      if (connectionAttemptRef.current !== attempt) {
        session.close();
        return;
      }
      sessionRef.current = session;
      setConnectionState("connected");
      session.sendMessage(
        "Greet the salon owner now. Say only: Hi, I’m JustAsk. How can I help you?",
      );
    } catch (cause) {
      if (connectionAttemptRef.current !== attempt) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Live voice could not start. Use typed input.",
      );
      setConnectionState("error");
    }
  }, [getClientToken]);

  const sendText = useCallback((text: string) => {
    if (!sessionRef.current) return false;
    sessionRef.current.sendMessage(text);
    return true;
  }, []);

  return { connectionState, error, preload, connect, disconnect, sendText };
}
