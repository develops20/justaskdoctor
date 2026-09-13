"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

interface LiveSessionResponse {
  session?: { id?: string };
  transport?: { type?: string; sdp?: string };
  error?: string;
}

interface FunctionCallItem {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
}

interface LiveServerEvent {
  type?: string;
  error?: { message?: string };
  event?: {
    type?: string;
    item?: FunctionCallItem;
  };
}

export function useJustAskVoice(options: VoiceOptions) {
  const [connectionState, setConnectionState] =
    useState<VoiceConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const connectionAttemptRef = useRef(0);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const releaseTransport = useCallback(() => {
    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    microphoneRef.current = null;
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    connectionAttemptRef.current += 1;
    const channel = channelRef.current;
    if (channel?.readyState === "open") {
      channel.send(JSON.stringify({ type: "session.close" }));
    }
    releaseTransport();
    setConnectionState("disconnected");
  }, [releaseTransport]);

  useEffect(() => disconnect, [disconnect]);

  const preload = useCallback(async () => {
    // GPT-Live session creation requires a browser SDP offer, so it begins
    // only after the user grants microphone access.
  }, []);

  const connect = useCallback(async () => {
    if (peerRef.current) return;
    const attempt = connectionAttemptRef.current + 1;
    connectionAttemptRef.current = attempt;
    setConnectionState("connecting");
    setError(null);

    try {
      const context = optionsRef.current.getContext();
      const peer = new RTCPeerConnection();
      peerRef.current = peer;

      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      peer.addEventListener("track", (event) => {
        audio.srcObject =
          event.streams[0] ?? new MediaStream([event.track]);
        void audio.play().catch(() => {
          setError("Live voice connected, but the browser blocked audio playback.");
        });
      });

      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      microphoneRef.current = microphone;
      microphone.getAudioTracks().forEach((track) => {
        peer.addTrack(track, microphone);
      });

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      let startedResolve: (() => void) | undefined;
      let startedReject: ((reason: Error) => void) | undefined;
      const started = new Promise<void>((resolve, reject) => {
        startedResolve = resolve;
        startedReject = reject;
      });

      const send = (event: object) => {
        if (channel.readyState !== "open") {
          throw new Error("The GPT-Live event channel is not open.");
        }
        channel.send(JSON.stringify(event));
      };

      const handleFunctionCall = async (
        item: FunctionCallItem,
      ): Promise<void> => {
        if (!item.call_id || !item.name) return;
        let output: string;
        try {
          const args = JSON.parse(item.arguments ?? "{}") as Record<
            string,
            unknown
          >;
          if (item.name === "run_registered_customer_test") {
            output = await optionsRef.current.onInvestigate(
              String(args.ownerRequest ?? ""),
            );
          } else if (item.name === "remove_friday_from_pending_schedule") {
            await optionsRef.current.onFridayCorrection(
              String(args.ownerCorrection ?? ""),
            );
            output =
              "Friday was removed. The owner must use the visual approval control before anything changes.";
          } else {
            output = JSON.stringify({ error: `Unknown tool: ${item.name}` });
          }
        } catch (cause) {
          output = JSON.stringify({
            error:
              cause instanceof Error ? cause.message : "Tool execution failed.",
          });
        }

        send({
          type: "response.item.create",
          event_id: crypto.randomUUID(),
          item: {
            type: "function_call_output",
            call_id: item.call_id,
            output,
          },
        });
        send({ type: "response.create", event_id: crypto.randomUUID() });
      };

      channel.addEventListener("message", ({ data }) => {
        let event: LiveServerEvent;
        try {
          event = JSON.parse(String(data)) as LiveServerEvent;
        } catch {
          return;
        }
        if (event.type === "session.started") {
          startedResolve?.();
        } else if (event.type === "session.closed") {
          releaseTransport();
          setConnectionState("disconnected");
        } else if (event.type === "error") {
          const message = event.error?.message ?? "GPT-Live session error.";
          console.error("[live] Session error:", event);
          startedReject?.(new Error(message));
          setError(message);
          setConnectionState("error");
        } else if (
          event.type === "response.event" &&
          event.event?.type === "response.output_item.done" &&
          event.event.item?.type === "function_call"
        ) {
          void handleFunctionCall(event.event.item);
        } else if (event.type === "session.input_transcript.delta") {
          optionsRef.current.onInterrupted();
        }
      });
      channel.addEventListener("close", () => {
        if (connectionAttemptRef.current === attempt) {
          releaseTransport();
          setConnectionState("disconnected");
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (peer.iceGatheringState !== "complete") {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            peer.removeEventListener("icegatheringstatechange", onState);
            reject(new Error("Timed out while gathering ICE candidates."));
          }, 10_000);
          function onState() {
            if (peer.iceGatheringState !== "complete") return;
            window.clearTimeout(timeout);
            peer.removeEventListener("icegatheringstatechange", onState);
            resolve();
          }
          peer.addEventListener("icegatheringstatechange", onState);
        });
      }

      const sdp = peer.localDescription?.sdp;
      if (!sdp) throw new Error("The browser did not create an SDP offer.");
      const sessionResponse = await fetch("/api/live/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, sdp }),
      });
      const session = (await sessionResponse.json()) as LiveSessionResponse;
      if (!sessionResponse.ok || !session.transport?.sdp) {
        throw new Error(session.error ?? "OpenAI Live could not start.");
      }
      await peer.setRemoteDescription({
        type: "answer",
        sdp: session.transport.sdp,
      });
      await Promise.race([
        started,
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("GPT-Live did not finish connecting.")),
            10_000,
          ),
        ),
      ]);
      if (connectionAttemptRef.current !== attempt) return;

      setConnectionState("connected");
      send({
        type: "session.instructions.append",
        event_id: crypto.randomUUID(),
        delegation_id: null,
        content:
          "Greet immediately without waiting for the owner. Say: Hi, I’m JustAsk. How can I help you? Then pause and listen.",
      });
    } catch (cause) {
      if (connectionAttemptRef.current !== attempt) return;
      releaseTransport();
      setError(
        cause instanceof Error
          ? cause.message
          : "Live voice could not start. Use typed input.",
      );
      setConnectionState("error");
    }
  }, [releaseTransport]);

  const sendText = useCallback((text: string) => {
    // Typed input follows the app's existing deterministic workflow. GPT-Live
    // receives user turns from its negotiated audio track.
    void text;
    return true;
  }, []);

  return { connectionState, error, preload, connect, disconnect, sendText };
}
