# JustAsk Site Doctor

> **Your website can explain what is wrong.**

## Instruction for Cursor

You are the sole implementation owner for this hackathon project. Build the entire MVP described in this document in one repository and one branch. Work vertically in the order given. Do not create speculative abstractions, extra dashboards or additional use cases until the complete demonstration passes.

After every phase:

1. Run the application.
2. Run type checking and relevant tests.
3. Fix all blocking errors.
4. Report what works and continue immediately to the next phase.

Use official sponsor quickstarts and the versions installed by the starter kit. Do not invent SDK methods. Keep the deterministic demo path working even when an external API is unavailable.

## Project concept

JustAsk is a voice-first website first-aid agent for nontechnical small-business owners. It lives inside the owner’s real website, understands the current page and can test the same journey a customer is trying to complete.

When customers report a problem, the business owner activates **Owner Mode** and asks:

> “Customers say they can’t book an appointment. Can you check?”

JustAsk inspects the current page, runs a customer-journey test and reads diagnostic events exposed by the website. It explains the failure in business language, researches trusted documentation, and proposes a safe configuration change. The owner can interrupt the voice response, change the instruction and approve the final action. JustAsk then applies the change and verifies that the customer journey works.

## Target user

The primary user is a small-business owner who depends on a website for bookings or sales but does not understand browser logs, APIs or application configuration.

JustAsk should resolve safe configuration problems without requiring a developer. When the cause requires code or credentials, it should stop and produce a developer-ready report containing the reproduction steps, evidence and likely cause.

## Hackathon demonstration

Build a fictional salon website called **Luma Salon**.

The public site looks professional and includes:

- Home page
- Services and prices
- Staff profiles
- Booking journey
- A hidden Owner Mode available only for the demo

The booking interface appears healthy, but customers cannot find any appointment slots for the stylist Sara. The backend deliberately contains this configuration problem:

```ts
{
  staffId: "sara",
  availabilityScheduleId: null,
  enabledDays: []
}
```

The API returns successfully but produces zero slots. This represents a realistic business configuration failure rather than a crashed website.

### Exact demo sequence

1. Open Luma Salon as a customer.
2. Choose **Haircut**, select **Sara**, and show that no appointments are available.
3. Activate Owner Mode.
4. Ask: **“Customers say they can’t book Sara. Can you check?”**
5. JustAsk receives the current route, selected service, selected staff member and recent diagnostic events.
6. It calls `runBookingTest()` and reproduces the empty-slot result.
7. It calls `diagnoseBookingProblem()` and identifies the missing availability schedule.
8. Exa searches trusted booking documentation and returns a visible source.
9. JustAsk begins explaining the proposed Monday-to-Friday schedule.
10. Interrupt it naturally with: **“We are closed on Friday now.”**
11. JustAsk updates the proposal to Monday-to-Thursday, 09:00–17:00.
12. CopilotKit displays the exact configuration change with **Approve** and **Cancel**.
13. Approve the action.
14. JustAsk calls `applyAvailabilitySchedule()`.
15. It reruns `runBookingTest()`.
16. The website displays real appointment slots and **Test booking successful**.
17. Stretch goal: create a resolution record in Ambiguous AI.

## What makes the environment essential

The user never has to identify the component, copy an error or explain the website architecture. Owner Mode supplies:

- The current route
- The selected service and staff member
- Recent customer-journey events
- Whitelisted diagnostics
- Safe actions registered by the host application

The phrase “customers cannot book Sara” has a precise meaning because JustAsk lives inside the website where the failure occurs.

## Positioning

JustAsk does not claim to repair every website. It:

- Detects customer-facing failures
- Resolves safe configuration problems
- Explains technical evidence in business language
- Verifies the result through the customer journey
- Produces a developer-ready report when code changes are required

Existing platform assistants generally operate inside one website builder. Developer observability products generally speak to engineers and codebases. JustAsk demonstrates a small, platform-independent runtime that works from the live website and serves its business owner.

## Non-negotiable MVP

- Responsive Luma Salon website
- Working booking flow backed by local mock data
- Deliberately broken availability configuration for Sara
- Owner Mode with visible diagnostics
- Context adapter that publishes the active page and selected booking data
- `runBookingTest()` tool that reproduces the failure
- Structured diagnosis with visible evidence
- GPT‑Live‑1 voice session through WebRTC
- Natural interruption during speech
- Exa research with at least one visible source
- CopilotKit approval interaction
- Approved configuration update
- Automated retest that shows available slots
- Deterministic fallback for voice, research and diagnosis

## Out of scope

- Crawling or repairing arbitrary third-party websites
- Editing source code or opening pull requests
- Real payment processing
- Real customer records
- Real Cal.com credentials or production APIs
- Unapproved state changes
- Autonomous changes to domains, payments, authentication or credentials
- Multiple business templates before the salon demo works

## Technology

- **Next.js and React:** Salon website and reusable JustAsk widget
- **TypeScript:** Shared contracts and safe tool interfaces
- **OpenAI GPT‑Live‑1:** Full-duplex voice and interruption handling
- **Backend reasoning model:** Structured diagnosis and tool delegation when required
- **Exa:** Trusted documentation research
- **CopilotKit:** Application context, rendered diagnosis and human approval
- **Ambiguous AI:** Optional resolution record
- **Tailwind CSS:** Fast responsive styling
- **Zod:** Runtime validation for every tool input and output

## Architecture

```text
Luma Salon page
  ├── Booking state
  ├── Diagnostic event journal
  ├── Owner Mode
  └── JustAsk widget
          │
          ├── GPT‑Live‑1 WebRTC session
          ├── Website context adapter
          ├── Booking-test tool
          ├── Diagnosis endpoint
          ├── Exa research endpoint
          └── CopilotKit approval action
                    │
                    ├── Apply availability schedule
                    ├── Retest booking flow
                    └── Optional Ambiguous resolution record
```

OpenAI provides the single voice experience. Do not create a second competing chatbot. CopilotKit connects the agent workflow to application context, rendered findings and the approval interface.

## Repository structure

```text
justask/
├── app/
│   ├── api/
│   │   ├── live/session/route.ts
│   │   ├── diagnose/route.ts
│   │   ├── research/route.ts
│   │   ├── booking/test/route.ts
│   │   ├── booking/availability/route.ts
│   │   └── incident/route.ts
│   ├── book/page.tsx
│   ├── owner/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── salon/
│   │   ├── Header.tsx
│   │   ├── ServicePicker.tsx
│   │   ├── StaffPicker.tsx
│   │   ├── BookingCalendar.tsx
│   │   └── BookingResult.tsx
│   └── justask/
│       ├── JustAskWidget.tsx
│       ├── VoiceButton.tsx
│       ├── VoiceStatus.tsx
│       ├── DiagnosisPanel.tsx
│       ├── EvidenceList.tsx
│       └── ApprovalCard.tsx
├── lib/
│   ├── contracts.ts
│   ├── booking-store.ts
│   ├── diagnostic-journal.ts
│   ├── context-adapter.ts
│   ├── booking-tools.ts
│   ├── openai-live.ts
│   ├── exa.ts
│   ├── ambiguous.ts
│   └── fallbacks.ts
├── fixtures/
│   ├── salon.json
│   ├── services.json
│   ├── staff.json
│   └── diagnostic-events.json
├── tests/
│   ├── booking-tools.test.ts
│   └── demo-flow.test.ts
├── public/
├── .env.example
└── README.md
```

## Data contracts

### Website context

```ts
export const WebsiteContextSchema = z.object({
  siteId: z.string(),
  businessName: z.string(),
  businessType: z.literal("salon"),
  currentRoute: z.string(),
  ownerMode: z.boolean(),
  selectedServiceId: z.string().nullable(),
  selectedStaffId: z.string().nullable(),
  visibleMessage: z.string().nullable(),
  recentEvents: z.array(z.object({
    timestamp: z.string(),
    type: z.string(),
    operation: z.string(),
    status: z.number(),
    summary: z.string()
  })).max(20)
});
```

### Booking-test result

```ts
export const BookingTestResultSchema = z.object({
  success: z.boolean(),
  serviceId: z.string(),
  staffId: z.string(),
  availableSlotCount: z.number(),
  evidence: z.array(z.object({
    source: z.string(),
    message: z.string()
  })),
  errorCode: z.string().nullable()
});
```

### Diagnosis

```ts
export const DiagnosisResultSchema = z.object({
  summaryForOwner: z.string(),
  technicalCause: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(z.object({
    label: z.string(),
    value: z.string()
  })),
  proposedAction: z.object({
    type: z.literal("SET_STAFF_AVAILABILITY"),
    staffId: z.string(),
    enabledDays: z.array(z.enum([
      "monday", "tuesday", "wednesday", "thursday",
      "friday", "saturday", "sunday"
    ])),
    startTime: z.string(),
    endTime: z.string()
  }).nullable(),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string().url()
  }))
});
```

## Host integration contract

Implement the JustAsk widget against an explicit host adapter:

```ts
export interface JustAskHostAdapter {
  getContext(): WebsiteContext;
  runBookingTest(input: {
    serviceId: string;
    staffId: string;
  }): Promise<BookingTestResult>;
  proposeAvailabilityChange(input: AvailabilityChange): Promise<{
    approvalId: string;
  }>;
  applyApprovedAvailabilityChange(input: {
    approvalId: string;
  }): Promise<{ applied: true }>;
}
```

The reusable widget must depend on this interface rather than importing salon-specific state directly.

## Diagnostic event journal

Do not attempt arbitrary browser spying. The host application should intentionally record a small, safe event journal:

```ts
{
  timestamp: "2026-09-12T11:42:00Z",
  type: "api-response",
  operation: "getAvailableSlots",
  status: 200,
  summary: "Returned 0 slots for service=haircut, staff=sara"
}
```

Also expose the relevant safe configuration fact:

```ts
{
  source: "staff-configuration",
  message: "Sara has no availability schedule assigned"
}
```

Never capture passwords, cookies, authorization headers, payment details, form contents or customer personal data.

## Tool behaviour

### `runBookingTest`

Simulate the exact customer journey against application state:

1. Select Haircut.
2. Select Sara.
3. Request slots for the next seven days.
4. Record returned slot count and relevant evidence.
5. Return a typed `BookingTestResult`.

Before the fix, the result must contain zero slots. After approval, the same test must return multiple slots.

### `diagnoseBookingProblem`

Use the website context and booking-test result. The deterministic rule should identify the missing schedule before calling a model:

```ts
if (
  result.availableSlotCount === 0 &&
  staff.availabilityScheduleId === null
) {
  return MISSING_AVAILABILITY_DIAGNOSIS;
}
```

The model may improve the explanation, but the demo must not depend on probabilistic diagnosis.

### `researchDocumentation`

Use Exa to find trusted documentation about booking availability. Prefer official domains. For the demo, Cal.com availability guidance is an appropriate real-world reference:

- https://cal.com/help/availabilities/set-up-your-availability
- https://cal.com/help/event-types/display-issues

If Exa fails or exceeds the timeout, return a cached source object using the official URL above and clearly mark the result as cached in developer logs, not in the user-facing explanation.

### `proposeAvailabilityChange`

Create an approval object but do not mutate state:

```ts
{
  staffId: "sara",
  enabledDays: ["monday", "tuesday", "wednesday", "thursday"],
  startTime: "09:00",
  endTime: "17:00"
}
```

### `applyApprovedAvailabilityChange`

Require a valid, unused approval ID. Apply the configuration exactly once. Reject requests that attempt to update another action or execute without approval.

## Voice requirements

- Connect GPT‑Live‑1 through WebRTC using the official OpenAI voice-agent quickstart.
- Create ephemeral session credentials on the server. Never expose the permanent OpenAI API key.
- Keep the live model identifier in an environment variable.
- Provide the current `WebsiteContext` when Owner Mode starts.
- Register tools with strict schemas.
- Allow the user to interrupt while JustAsk is speaking.
- When the user says Friday is closed, update the pending proposal before rendering approval.
- Keep spoken answers short. Detailed evidence belongs in the UI.
- Display transcript and connection state for debugging.
- Provide a typed demo input button when microphone access fails.

GPT‑Live‑1 should remain the voice layer. Delegate structured diagnosis to a backend model only when useful. The deterministic diagnosis remains the fallback.

## CopilotKit requirements

Use CopilotKit for the application-facing agent experience:

- Publish Owner Mode context through the current supported context API.
- Render the diagnosis, evidence and sources in the page.
- Implement the availability proposal as a human-in-the-loop approval interaction.
- Update shared UI state after approval and retest.

Do not create a separate CopilotKit chatbot. The owner should experience one JustAsk voice agent and one synchronized visual panel.

## Ambiguous AI stretch goal

After a successful retest, create a resolution record containing:

- Business and affected page
- Reported symptom
- Reproduction steps
- Evidence
- Root cause
- Approved change
- Verification result
- Research sources

If Ambiguous integration is not complete, show a disabled **Save resolution record** action. Do not let it block the MVP.

## Visual design

### Luma Salon

- Warm neutral background
- Elegant serif headings with clean sans-serif body text
- High-quality salon imagery from permitted remote sources or local placeholders
- Mobile responsive booking flow
- Clear empty-slot failure without making the site look intentionally broken

### JustAsk Owner Mode

- Floating microphone button
- Compact live status: listening, speaking, investigating or awaiting approval
- Diagnosis panel written for a business owner
- Expandable technical evidence
- Visible sources
- Exact approval diff
- Strong success state after retest

## Environment variables

```bash
OPENAI_API_KEY=
OPENAI_LIVE_MODEL=gpt-live-1
OPENAI_REASONING_MODEL=
EXA_API_KEY=
AMBIGUOUS_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Treat `AMBIGUOUS_API_KEY` as optional. Confirm the exact GPT‑Live‑1 model identifier from the hackathon account or current official documentation rather than assuming the example string.

## Implementation sequence

### Phase 1: Deterministic salon application

- Scaffold Next.js with TypeScript and Tailwind.
- Build the public salon pages and booking flow.
- Add local state and the deliberately missing Sara schedule.
- Confirm that Sara returns zero slots while another stylist returns slots.
- Add a reset-demo control.

**Exit condition:** The booking failure and reset behaviour work without AI.

### Phase 2: Context and diagnostic tools

- Add `WebsiteContext` and the diagnostic event journal.
- Implement the host adapter.
- Implement the booking test and deterministic diagnosis.
- Display evidence and the proposed configuration change.

**Exit condition:** A button can reproduce, diagnose and explain the problem without external APIs.

### Phase 3: Approval and repair

- Add CopilotKit context and approval UI using the installed supported API.
- Require approval before mutation.
- Apply Monday-to-Thursday availability.
- Rerun the same booking test.
- Display appointment slots and success.

**Exit condition:** The complete text-driven demo works reliably.

### Phase 4: GPT‑Live‑1

- Add the server session endpoint and WebRTC client.
- Send Owner Mode context.
- Connect voice utterances to the existing tools.
- Implement interruption and proposal correction.
- Add transcript and typed demo fallback.

**Exit condition:** The owner can perform the complete workflow by voice and interrupt the proposal.

### Phase 5: Exa

- Add the research endpoint.
- Search official documentation with a strict timeout.
- Display source title and URL.
- Fall back to the cached Cal.com documentation source.

**Exit condition:** The demonstration always shows a valid trusted source.

### Phase 6: Polish and optional Ambiguous integration

- Add loading and tool-progress states.
- Improve responsive layout and accessibility.
- Add Ambiguous only if every MVP acceptance test already passes.
- Write the README and record the demonstration.

**Exit condition:** The full demo passes three consecutive runs.

## Reliability requirements

- Include **Reset demo** and **Run demo without microphone** controls.
- Keep the known diagnosis and research source cached.
- Use short timeouts for sponsor APIs.
- Show progress instead of allowing silent waits.
- Never let Exa or Ambiguous failure block the booking repair.
- Keep all secrets server-side.
- Prevent duplicate approval execution.
- Preserve the Friday correction after interruption.
- Disable arbitrary code execution and unrestricted browser control.

## Acceptance tests

The MVP is complete only when all of the following pass:

- Sara initially has zero appointment slots.
- Another stylist has slots, proving the booking system itself works.
- Owner Mode identifies the current route, service and staff member.
- The booking test reproduces the same customer problem.
- The diagnosis identifies the missing availability schedule.
- The explanation uses business language and exposes technical evidence separately.
- At least one trusted source appears.
- The owner can interrupt the voice response.
- The phrase “We are closed on Friday” removes Friday from the proposal.
- The configuration remains unchanged before approval.
- Approval applies Monday-to-Thursday availability exactly once.
- The repeated booking test returns available slots.
- The UI displays **Test booking successful**.
- Reset restores the broken demo state.
- The complete flow works through the typed deterministic fallback.

## Cursor start prompt

Paste this into Cursor with this file open:

> You own the complete JustAsk Site Doctor implementation. Read `JUSTASK_BUILD_PLAN.md` fully before editing. Build the phases in order and continue autonomously until every acceptance test passes. Start with the deterministic salon and typed demo path. Integrate GPT‑Live‑1, CopilotKit and Exa only after the local workflow works end to end. Use the current official sponsor quickstarts and the versions installed by the starter kit; never invent SDK APIs. Keep secrets server-side and preserve the fallback path. Do not stop to propose optional features. After each phase, run the application, type checking and tests, fix failures, briefly report progress, and proceed to the next phase.

## Two-minute pitch

### Opening

“Small businesses lose bookings when their website fails, but the owner often cannot tell whether the problem is code, configuration or a connected service. Finding out can require hiring a developer.”

### Demonstration

Show that customers cannot book Sara. Activate Owner Mode and ask, “Customers say they can’t book Sara. Can you check?” Let JustAsk reproduce the problem, identify the missing schedule and show the source. Interrupt with, “We are closed on Friday now.” Approve the corrected Monday-to-Thursday schedule. Show the successful retest and available appointments.

### Closing

“JustAsk gives small-business websites a voice. It resolves safe configuration problems immediately and prepares a complete technical report when a developer is genuinely required.”

## Official resources

- GPT‑Live‑1 announcement: https://openai.com/index/introducing-gpt-live-1-in-the-api/
- OpenAI voice agents quickstart: https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/
- CopilotKit quickstart: https://docs.copilotkit.ai/quickstart
- CopilotKit shared state: https://docs.copilotkit.ai/shared-state
- CopilotKit human-in-the-loop: https://docs.copilotkit.ai/a2a/human-in-the-loop
- Exa documentation: https://exa.ai/docs
- Ambiguous AI agent workspace: https://www.ambiguous.ai/agents
- Cal.com availability guidance: https://cal.com/help/availabilities/set-up-your-availability
- Cal.com slot troubleshooting: https://cal.com/help/event-types/display-issues
