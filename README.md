# JustAsk Site Doctor

JustAsk is an embedded voice-first site doctor for nontechnical website owners. This prototype runs inside the fictional **Luma Salon** booking page, reproduces a customer problem, explains the cause, proposes a narrowly scoped configuration repair, waits for explicit approval, applies it, and repeats the original customer test.

The full demonstration remains deterministic without API credentials.

## Quick start

Requirements: Node.js 20.9 or newer and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000/book](http://localhost:3000/book).

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Demo walkthrough

1. Select **Signature haircut** and **Sara**, then click **Check availability**. The page returns zero appointments.
2. Open **Owner Mode**.
3. Click **Run demo without microphone**, or enter: “Customers say they can’t book Sara. Can you check?”
4. JustAsk repeats the registered customer test, identifies Sara’s missing schedule, and shows trusted sources.
5. While the proposal says Monday–Friday, click the interruption control or say: “We are closed on Friday now.”
6. Confirm that the exact proposal changes to Monday–Thursday, 09:00–17:00.
7. Click **Approve change**.
8. JustAsk applies the approved schedule once, repeats the same test, and displays available appointments plus **Customer test passed**.
9. Click **Book a test appointment**, choose an available time, and confirm the booking.
10. Use **Reset demo** to remove the test booking and restore Sara’s missing schedule.

### Coding-issue demo

1. Select **Dimensional color** and **Maya**, then check availability.
2. Open JustAsk and report that customers cannot book color with Maya.
3. JustAsk proves the booking API has slots but the widget rejects the 120-minute service because its code limit is 90 minutes.
4. Review the exact registered patch changing `MAX_ONLINE_DURATION_MINUTES` from `90` to `180`, then explicitly approve it.
5. JustAsk applies only that patch, repeats the original test, and exposes bookable times.
6. **Reset demo** restores both this code defect and Sara’s missing schedule.

## Configuration

All supported values are documented in `.env.example`.

- `DEMO_MODE=true` keeps the deterministic diagnosis, repair, and fallback research path available.
- `OPENAI_API_KEY` enables live voice. It is used only by the server route that mints a short-lived client secret.
- `OPENAI_LIVE_MODEL` defaults to the currently supported `gpt-realtime-2.1`. Set it to another Realtime model only if it is enabled for your OpenAI project.
- `EXA_API_KEY` enables live trusted-domain research. Without it, the same official Cal.com sources are returned from the bundled fallback.
- `NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL` enables the optional CopilotKit v2 bridge. Without it, the local adapter preserves the same context and approval interfaces.

No permanent secret belongs in a `NEXT_PUBLIC_` variable.

## Architecture

- `components/salon/SalonExperience.tsx` owns the Luma booking UI and deterministic demonstration state.
- `lib/contracts.ts` contains Zod-validated context, booking, diagnosis, research, proposal, and approval contracts.
- `lib/context-adapter.ts` implements `JustAskHostAdapter`. The widget uses this interface rather than mutating salon state directly.
- `lib/booking-tools.ts` implements slot generation, the registered customer test, deterministic diagnosis, and allowlisted schedule mutation.
- `lib/code-tools.ts` implements the second registered code diagnosis, exact patch validation, and repeat customer test.
- `app/api/live/session/route.ts` creates OpenAI Realtime ephemeral client secrets server-side.
- `lib/use-justask-voice.ts` uses the official OpenAI Agents SDK browser WebRTC transport, local typed tools, and automatic interruption handling.
- `app/api/research/route.ts` calls Exa server-side with a Cal.com domain allowlist and a short timeout.
- `components/justask/CopilotContextBridge.tsx` publishes page context, workflow state, and the exact pending diff through CopilotKit v2 when a runtime is configured.

The local state layer intentionally mirrors a future platform adapter. A WordPress implementation could provide the same `JustAskHostAdapter` methods without changing the JustAsk workflow UI.

## Sponsor integrations

### OpenAI GPT-Live-1

The browser preloads a short-lived `ek_` client secret when the owner approaches the JustAsk control; the permanent OpenAI key never reaches client code. On click it connects with `RealtimeAgent` and `RealtimeSession` from `@openai/agents/realtime`, which use WebRTC and support speech interruption. Closing Owner Mode interrupts, mutes, closes, and removes live audio. Typed input remains available if credentials, microphone access, or the network fails.

### Exa

Research runs only on the server. The request is constrained to trusted Cal.com documentation, result fields are normalized to title, URL, extract, and source domain, and failures return clearly logged bundled sources without blocking repair.

### CopilotKit

The v2 bridge uses application context and frontend-tool interfaces while keeping one visible JustAsk experience. Explicit approval remains enforced by the host adapter even if an agent requests the approval UI.

## Safety properties

- Only allowlisted route, selection, visible message, and diagnostic journal fields enter agent context.
- The journal never includes cookies, headers, credentials, payments, form contents, or customer personal data.
- Tool inputs and outputs are typed and runtime-validated.
- Research is restricted to trusted domains; there is no arbitrary URL fetch, SQL, shell, or code-execution tool.
- A proposal creates no mutation. Only the owner’s **Approve change** action receives an approval ID.
- Approval IDs are single-use, and the original customer test always runs again after a repair.

## Known limitations

- Salon data is in browser memory and resets on refresh; this is intentional for the hackathon demo.
- The real voice path requires an OpenAI project with access to the configured Realtime model.
- The deterministic UI, rather than a remote CopilotKit runtime, is authoritative for approvals so the no-credential path cannot be blocked.
- Times are demonstration UTC slots rather than a production timezone-aware booking calendar.
- There is no authentication, persistence, payment flow, arbitrary-site crawling, or WordPress plugin.
