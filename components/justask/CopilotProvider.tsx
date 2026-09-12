"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";

export function JustAskCopilotProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const runtimeUrl = process.env.NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL;
  if (!runtimeUrl) return children;
  return <CopilotKit runtimeUrl={runtimeUrl}>{children}</CopilotKit>;
}
