"use client";

import {
  useAgentContext,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
import type {
  AgentPhase,
  AvailabilityChange,
  CodePatch,
  NavigationPatch,
  WebsiteContext,
} from "@/lib/contracts";

interface BridgeProps {
  context: WebsiteContext;
  phase: AgentPhase;
  proposal: AvailabilityChange | null;
  codePatch: CodePatch | null;
  navigationPatch: NavigationPatch | null;
}

function EnabledCopilotBridge({
  context,
  phase,
  proposal,
  codePatch,
  navigationPatch,
}: BridgeProps) {
  useAgentContext({
    description:
      "Allowlisted Luma Salon page context and safe diagnostic event journal",
    value: context,
  });

  useAgentContext({
    description:
      "Current JustAsk visual workflow state and exact pending approval diff",
    value: {
      phase,
      proposal,
      codePatch,
      navigationPatch,
      explicitApprovalRequired:
        (proposal !== null ||
          codePatch !== null ||
          navigationPatch !== null) &&
        phase === "waiting-for-approval",
    },
  });

  useFrontendTool({
    name: "show_registered_code_patch_approval",
    description:
      "Surface the existing registered booking code patch. This cannot execute code and never applies the patch without the owner-facing approval button.",
    parameters: z.object({
      patchType: z.literal("UPDATE_BOOKING_DURATION_LIMIT"),
    }),
    handler: async () => ({
      shown: codePatch !== null,
      applied: false,
      instruction: "Wait for explicit approval in the JustAsk panel.",
    }),
  });

  useFrontendTool({
    name: "show_artists_navigation_fix_approval",
    description:
      "Surface the selected registered JavaScript fix for the Artists link. Never executes arbitrary code and never applies without owner approval.",
    parameters: z.object({
      patchType: z.literal("FIX_ARTISTS_ROUTE"),
    }),
    handler: async () => ({
      shown: navigationPatch !== null,
      applied: false,
      instruction: "Wait for explicit approval in the JustAsk panel.",
    }),
  });

  useFrontendTool({
    name: "show_availability_approval",
    description:
      "Surface the existing availability proposal in JustAsk Owner Mode. This tool never applies the change; only the owner-facing Approve button can do that.",
    parameters: z.object({
      staffId: z.literal("sara"),
    }),
    handler: async () => ({
      shown: proposal !== null,
      applied: false,
      instruction: "Wait for explicit approval in the JustAsk panel.",
    }),
  });

  return null;
}

export function CopilotContextBridge(props: BridgeProps) {
  if (!process.env.NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL) return null;
  return <EnabledCopilotBridge {...props} />;
}
