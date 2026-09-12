"use client";

import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  ExternalLink,
  Mic,
  MicOff,
  RotateCcw,
  Scissors,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BROKEN_SARA_CONFIGURATION,
  MAYA_CONFIGURATION,
  diagnoseBookingProblem,
  type StaffConfiguration,
} from "@/lib/booking-tools";
import { SalonHostAdapter } from "@/lib/context-adapter";
import { useJustAskVoice } from "@/lib/use-justask-voice";
import { CopilotContextBridge } from "@/components/justask/CopilotContextBridge";
import {
  BROKEN_MAX_ONLINE_DURATION,
  applyRegisteredCodePatch,
  diagnoseCodeProblem,
  runColorBookingTest,
  type CodeDiagnosis,
} from "@/lib/code-tools";
import {
  applyRegisteredNavigationPatch,
  diagnoseArtistsNavigation,
  runArtistsNavigationTest,
  type NavigationDiagnosis,
} from "@/lib/navigation-tools";
import type {
  AgentPhase,
  AvailabilityChange,
  BookingTestResult,
  CodePatch,
  NavigationPatch,
  DiagnosisResult,
  DiagnosticEvent,
  ResearchSource,
} from "@/lib/contracts";

const FALLBACK_SOURCES: ResearchSource[] = [
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
      "When no slots appear, verify that the host has an active availability schedule.",
    domain: "cal.com",
    isFallback: true,
  },
];

const NAVIGATION_FALLBACK_SOURCES: ResearchSource[] = [
  {
    title: "TypeError: can’t access property — object is undefined",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Unexpected_type",
    extract:
      "A TypeError occurs when code accesses a property or method on an undefined value.",
    domain: "developer.mozilla.org",
    isFallback: true,
  },
  {
    title: "Next.js Linking and Navigating",
    url: "https://nextjs.org/docs/app/getting-started/linking-and-navigating",
    extract:
      "Next.js client navigation requires a valid route path passed to Link or the router.",
    domain: "nextjs.org",
    isFallback: true,
  },
];

const phaseLabels: Record<AgentPhase, string> = {
  idle: "Idle",
  listening: "Listening",
  investigating: "Investigating",
  researching: "Researching",
  "diagnosis-ready": "Diagnosis ready",
  "waiting-for-approval": "Waiting for approval",
  "applying-change": "Applying change",
  verifying: "Verifying",
  resolved: "Resolved",
  error: "Error — retry available",
};

const services = [
  {
    id: "haircut",
    name: "Signature haircut",
    durationMinutes: 60,
    duration: "60 min",
    price: "$85",
  },
  {
    id: "color",
    name: "Dimensional color",
    durationMinutes: 120,
    duration: "120 min",
    price: "$165",
  },
];

const staff = [
  {
    id: "sara",
    name: "Sara",
    role: "Senior stylist",
    image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80",
  },
  {
    id: "maya",
    name: "Maya",
    role: "Color specialist",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
  },
];

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function formatSlot(slot: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(slot));
}

export function SalonExperience() {
  const router = useRouter();
  const [selectedServiceId, setSelectedServiceId] = useState("haircut");
  const [selectedStaffId, setSelectedStaffId] = useState("sara");
  const [saraConfiguration, setSaraConfigurationState] =
    useState<StaffConfiguration>({ ...BROKEN_SARA_CONFIGURATION });
  const saraConfigurationRef = useRef(saraConfiguration);
  const [visibleSlots, setVisibleSlots] = useState<string[] | null>(null);
  const [bookedSlot, setBookedSlot] = useState<string | null>(null);
  const [bookingIssue, setBookingIssue] = useState<
    "duration-limit" | null
  >(null);
  const bookingIssueRef = useRef(bookingIssue);
  const [maxOnlineDuration, setMaxOnlineDurationState] = useState(
    BROKEN_MAX_ONLINE_DURATION,
  );
  const maxOnlineDurationRef = useRef(maxOnlineDuration);
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const eventsRef = useRef(events);
  const [ownerMode, setOwnerMode] = useState(false);
  const [phase, setPhase] = useState<AgentPhase>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [message, setMessage] = useState(
    "Customers say they can’t book Sara. Can you check?",
  );
  const [transcript, setTranscript] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<BookingTestResult | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [proposal, setProposal] = useState<AvailabilityChange | null>(null);
  const [codeDiagnosis, setCodeDiagnosis] = useState<CodeDiagnosis | null>(null);
  const [codePatch, setCodePatch] = useState<CodePatch | null>(null);
  const [codeApprovalId, setCodeApprovalId] = useState<string | null>(null);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const navigationErrorRef = useRef(navigationError);
  const [artistsPatchApplied, setArtistsPatchAppliedState] = useState(false);
  const artistsPatchAppliedRef = useRef(artistsPatchApplied);
  const [navigationDiagnosis, setNavigationDiagnosis] =
    useState<NavigationDiagnosis | null>(null);
  const [navigationPatch, setNavigationPatch] =
    useState<NavigationPatch | null>(null);
  const [navigationApprovalId, setNavigationApprovalId] =
    useState<string | null>(null);
  const [activeIncident, setActiveIncident] = useState<
    "availability" | "code" | "navigation"
  >("availability");
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedServiceRef = useRef(selectedServiceId);
  const selectedStaffRef = useRef(selectedStaffId);
  const ownerModeRef = useRef(ownerMode);
  const visibleSlotsRef = useRef(visibleSlots);

  const updateEvents = (event: DiagnosticEvent) => {
    eventsRef.current = [...eventsRef.current, event].slice(-20);
    setEvents(eventsRef.current);
  };

  const updateSaraConfiguration = (configuration: StaffConfiguration) => {
    saraConfigurationRef.current = configuration;
    setSaraConfigurationState(configuration);
  };

  const updateMaxOnlineDuration = (duration: number) => {
    maxOnlineDurationRef.current = duration;
    setMaxOnlineDurationState(duration);
  };

  const updateArtistsPatchApplied = (applied: boolean) => {
    artistsPatchAppliedRef.current = applied;
    setArtistsPatchAppliedState(applied);
  };

  /* The adapter callbacks read refs only when a host tool executes, never while rendering. */
  /* eslint-disable react-hooks/refs */
  const adapter = useMemo(
    () =>
      new SalonHostAdapter({
        getConfiguration: (staffId) =>
          staffId === "sara"
            ? saraConfigurationRef.current
            : MAYA_CONFIGURATION,
        setSaraConfiguration: updateSaraConfiguration,
        getContextSnapshot: () => ({
          siteId: "luma-salon-demo",
          businessName: "Luma Salon",
          businessType: "salon",
          currentRoute:
            typeof window === "undefined" ? "/book" : window.location.pathname,
          ownerMode: ownerModeRef.current,
          selectedServiceId: selectedServiceRef.current,
          selectedStaffId: selectedStaffRef.current,
          visibleMessage:
            navigationErrorRef.current
              ? navigationErrorRef.current
              : bookingIssueRef.current === "duration-limit"
              ? "This service cannot be booked online."
              : visibleSlotsRef.current?.length === 0
                ? "No appointments are available with this stylist."
              : null,
        }),
        getEvents: () => eventsRef.current,
        recordEvent: updateEvents,
      }),
    [],
  );
  /* eslint-enable react-hooks/refs */

  const handleArtistsClick = () => {
    const result = runArtistsNavigationTest(artistsPatchAppliedRef.current);
    if (result.success && result.destination) {
      router.push(result.destination);
      return;
    }

    const message = `${result.errorName}: ${result.errorMessage}`;
    navigationErrorRef.current = message;
    setNavigationError(message);
    setMessage(
      "Clicking Artists causes a JavaScript exception. Can you check and propose fixes?",
    );
    updateEvents({
      timestamp: new Date().toISOString(),
      type: "javascript-exception",
      operation: "navigateToArtists",
      status: 500,
      summary:
        "TypeError: routes.artist is undefined while opening /artists",
    });
    console.warn("[Luma navigation] Captured demo TypeError:", result.errorMessage);
  };

  const updateDemoMessage = (serviceId: string, staffId: string) => {
    setMessage(
      serviceId === "color" && staffId === "maya"
        ? "Customers say they can’t book Dimensional color with Maya. Can you check?"
        : "Customers say they can’t book Sara. Can you check?",
    );
  };

  const selectService = (serviceId: string) => {
    selectedServiceRef.current = serviceId;
    setSelectedServiceId(serviceId);
    updateDemoMessage(serviceId, selectedStaffRef.current);
    setBookedSlot(null);
    bookingIssueRef.current = null;
    setBookingIssue(null);
    setVisibleSlots(null);
    visibleSlotsRef.current = null;
  };

  const selectStaff = (staffId: string) => {
    selectedStaffRef.current = staffId;
    setSelectedStaffId(staffId);
    updateDemoMessage(selectedServiceRef.current, staffId);
    setBookedSlot(null);
    bookingIssueRef.current = null;
    setBookingIssue(null);
    setVisibleSlots(null);
    visibleSlotsRef.current = null;
  };

  const checkAvailability = async () => {
    setBookedSlot(null);
    if (
      selectedServiceRef.current === "color" &&
      selectedStaffRef.current === "maya"
    ) {
      const result = runColorBookingTest(maxOnlineDurationRef.current);
      const hasDurationIssue = result.errorCode === "CLIENT_DURATION_LIMIT";
      bookingIssueRef.current = hasDurationIssue ? "duration-limit" : null;
      setBookingIssue(hasDurationIssue ? "duration-limit" : null);
      visibleSlotsRef.current = result.slots;
      setVisibleSlots(result.slots);
      updateEvents({
        timestamp: new Date().toISOString(),
        type: hasDurationIssue ? "ui-validation" : "booking-test",
        operation: "validateOnlineServiceDuration",
        status: hasDurationIssue ? 422 : 200,
        summary: hasDurationIssue
          ? "Rejected 120-minute color service because the code limit is 90 minutes"
          : `Returned ${result.availableSlotCount} slots for service=color, staff=maya`,
      });
      return;
    }

    bookingIssueRef.current = null;
    setBookingIssue(null);
    const result = await adapter.runBookingTest({
      serviceId: selectedServiceRef.current,
      staffId: selectedStaffRef.current,
    });
    visibleSlotsRef.current = result.slots;
    setVisibleSlots(result.slots);
  };

  const fetchResearch = async (
    topic: "booking-availability" | "javascript-navigation" =
      "booking-availability",
  ): Promise<ResearchSource[]> => {
    const fallback =
      topic === "javascript-navigation"
        ? NAVIGATION_FALLBACK_SOURCES
        : FALLBACK_SOURCES;
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!response.ok) return fallback;
      const payload = (await response.json()) as { sources?: ResearchSource[] };
      return payload.sources?.length ? payload.sources : fallback;
    } catch {
      return fallback;
    }
  };

  const investigate = async (utterance: string): Promise<string> => {
    const normalizedUtterance = utterance.toLowerCase();
    if (
      !["book", "sara", "color", "maya", "artist", "link", "javascript"].some((term) =>
        normalizedUtterance.includes(term),
      )
    ) {
      const guidance =
        "Ask me to check Haircut with Sara or Dimensional color with Maya.";
      setError(guidance);
      setPhase("error");
      return guidance;
    }

    const isCodeIncident =
      (selectedServiceRef.current === "color" &&
        selectedStaffRef.current === "maya") ||
      normalizedUtterance.includes("color") ||
      normalizedUtterance.includes("maya");
    const isNavigationIncident =
      navigationErrorRef.current !== null ||
      normalizedUtterance.includes("artist") ||
      normalizedUtterance.includes("javascript") ||
      normalizedUtterance.includes("link");

    setError(null);
    setActiveIncident(
      isNavigationIncident
        ? "navigation"
        : isCodeIncident
          ? "code"
          : "availability",
    );
    setTranscript((lines) => [...lines, `You: ${utterance}`]);
    setPhase("investigating");
    setIsSpeaking(false);
    try {
      await delay(500);

      if (isNavigationIncident) {
        setTestResult(null);
        setDiagnosis(null);
        setProposal(null);
        setApprovalId(null);
        setCodeDiagnosis(null);
        setCodePatch(null);
        setCodeApprovalId(null);

        const result = runArtistsNavigationTest(
          artistsPatchAppliedRef.current,
        );
        setPhase("researching");
        const sources = await fetchResearch("javascript-navigation");
        await delay(350);
        const finding = diagnoseArtistsNavigation(result, sources);
        setNavigationDiagnosis(finding);
        setNavigationPatch(finding.candidates[0]);
        setTranscript((lines) => [
          ...lines,
          "JustAsk: I reproduced the Artists link failure. The page uses the singular route key “artist”, but the route map defines “artists”.",
          "JustAsk: I found trusted JavaScript and Next.js guidance and prepared two safe fixes for you to choose from.",
        ]);
        setPhase("diagnosis-ready");
        setIsSpeaking(true);
        return JSON.stringify({
          customerTest:
            "Clicking Artists stays on /book and throws a JavaScript TypeError",
          finding: finding.summaryForOwner,
          technicalCause: finding.technicalCause,
          candidateFixes: finding.candidates.map((candidate) => ({
            strategy: candidate.strategy,
            replacement: candidate.after,
          })),
          researchSources: finding.sources.map((source) => ({
            title: source.title,
            url: source.url,
          })),
          mutationApplied: false,
          nextStep:
            "Ask the owner to choose a visual fix and explicitly approve it.",
        });
      }

      if (isCodeIncident) {
        selectedServiceRef.current = "color";
        selectedStaffRef.current = "maya";
        setSelectedServiceId("color");
        setSelectedStaffId("maya");
        setActiveIncident("code");
        setDiagnosis(null);
        setProposal(null);
        setApprovalId(null);
        setNavigationDiagnosis(null);
        setNavigationPatch(null);
        setNavigationApprovalId(null);

        const result = runColorBookingTest(maxOnlineDurationRef.current);
        setTestResult(result);
        visibleSlotsRef.current = result.slots;
        setVisibleSlots(result.slots);
        bookingIssueRef.current = "duration-limit";
        setBookingIssue("duration-limit");
        updateEvents({
          timestamp: new Date().toISOString(),
          type: "source-diagnostic",
          operation: "validateOnlineServiceDuration",
          status: 422,
          summary:
            "120-minute color service rejected by a 90-minute limit in the booking widget",
        });
        const finding = diagnoseCodeProblem(result);
        setCodeDiagnosis(finding);
        setCodePatch(finding.proposedPatch);
        setTranscript((lines) => [
          ...lines,
          "JustAsk: I found a code problem in the booking page. Maya has times available, but a 90-minute limit rejects the 120-minute color service.",
          "JustAsk: I can apply the registered patch to raise that limit to 180 minutes after you approve it.",
        ]);
        setPhase("diagnosis-ready");
        setIsSpeaking(true);
        return JSON.stringify({
          customerTest:
            "Dimensional color with Maya is blocked before slots are shown",
          finding: finding.summaryForOwner,
          technicalCause: finding.technicalCause,
          proposedCodePatch:
            "MAX_ONLINE_DURATION_MINUTES: 90 → 180 in lib/booking-policy.ts",
          mutationApplied: false,
          nextStep: "Ask the owner to review and explicitly approve the patch.",
        });
      }

      setActiveIncident("availability");
      selectedServiceRef.current = "haircut";
      selectedStaffRef.current = "sara";
      setSelectedServiceId("haircut");
      setSelectedStaffId("sara");
      setCodeDiagnosis(null);
      setCodePatch(null);
      setCodeApprovalId(null);
      setNavigationDiagnosis(null);
      setNavigationPatch(null);
      setNavigationApprovalId(null);
      const result = await adapter.runBookingTest({
        serviceId: "haircut",
        staffId: "sara",
      });
      setTestResult(result);
      visibleSlotsRef.current = result.slots;
      setVisibleSlots(result.slots);
      bookingIssueRef.current = null;
      setBookingIssue(null);

      setPhase("researching");
      const sources = await fetchResearch();
      await delay(350);
      const finding = diagnoseBookingProblem(
        result,
        saraConfigurationRef.current,
        sources,
      );
      setDiagnosis(finding);
      setProposal(finding.proposedAction);
      setTranscript((lines) => [
        ...lines,
        "JustAsk: I found the problem. Sara has no working hours attached, so the booking page has nothing to offer.",
        "JustAsk: I recommend Monday through Friday, 9:00 AM to 5:00 PM—",
      ]);
      setPhase("diagnosis-ready");
      setIsSpeaking(true);
      return JSON.stringify({
        customerTest: "0 available appointments for Haircut with Sara",
        finding: finding.summaryForOwner,
        safeProposedFix: "Add working hours Monday–Friday, 09:00–17:00",
        mutationApplied: false,
        nextStep:
          "Ask the owner to review the visual proposal. Explicit approval is required.",
      });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Investigation failed.";
      setError(message);
      setPhase("error");
      return message;
    }
  };

  const requestApproval = async (change: AvailabilityChange) => {
    setIsSpeaking(false);
    const approval = await adapter.proposeAvailabilityChange(change);
    setApprovalId(approval.approvalId);
    setMessage("");
    setPhase("waiting-for-approval");
  };

  const requestCodeApproval = (patch: CodePatch) => {
    setIsSpeaking(false);
    setCodePatch(patch);
    setCodeApprovalId(crypto.randomUUID());
    setMessage("");
    setPhase("waiting-for-approval");
  };

  const requestNavigationApproval = (patch: NavigationPatch) => {
    setIsSpeaking(false);
    setNavigationPatch(patch);
    setNavigationApprovalId(crypto.randomUUID());
    setMessage("");
    setPhase("waiting-for-approval");
  };

  const updateProposalForFridayClosure = async (utterance: string) => {
    if (!proposal) return;
    setTranscript((lines) => [
      ...lines,
      `You (interrupting): ${utterance}`,
      "JustAsk: Understood. I removed Friday. I’ll only apply this after you approve it.",
    ]);
    setIsSpeaking(false);
    const revised: AvailabilityChange = {
      ...proposal,
      enabledDays: proposal.enabledDays.filter((day) => day !== "friday"),
    };
    setProposal(revised);
    setDiagnosis((current) =>
      current ? { ...current, proposedAction: revised } : current,
    );
    await requestApproval(revised);
  };

  const submitMessage = async () => {
    const utterance = message.trim();
    if (!utterance) return;
    if (
      isSpeaking &&
      utterance.toLowerCase().includes("closed") &&
      utterance.toLowerCase().includes("friday")
    ) {
      await updateProposalForFridayClosure(utterance);
      return;
    }
    setPhase("listening");
    await delay(250);
    await investigate(utterance);
  };

  const approveChange = async () => {
    if (!approvalId || !proposal) return;
    setPhase("applying-change");
    try {
      await delay(400);
      await adapter.applyApprovedAvailabilityChange({ approvalId });
      setPhase("verifying");
      await delay(500);
      const verified = await adapter.runBookingTest({
        serviceId: "haircut",
        staffId: "sara",
      });
      if (!verified.success || verified.availableSlotCount < 8) {
        throw new Error("The repeat customer test still found no appointments.");
      }
      setTestResult(verified);
      visibleSlotsRef.current = verified.slots;
      setVisibleSlots(verified.slots);
      setTranscript((lines) => [
        ...lines,
        `JustAsk: The change is live. I repeated the customer test and found ${verified.availableSlotCount} appointments.`,
      ]);
      setPhase("resolved");
      setApprovalId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The repair failed.");
      setPhase("error");
    }
  };

  const approveCodePatch = async () => {
    if (!codeApprovalId || !codePatch) return;
    setCodeApprovalId(null);
    setPhase("applying-change");
    try {
      await delay(400);
      const updatedLimit = applyRegisteredCodePatch(
        maxOnlineDurationRef.current,
        codePatch,
      );
      updateMaxOnlineDuration(updatedLimit);
      updateEvents({
        timestamp: new Date().toISOString(),
        type: "registered-code-patch",
        operation: "updateBookingDurationLimit",
        status: 200,
        summary:
          "Applied approved MAX_ONLINE_DURATION_MINUTES change from 90 to 180",
      });
      setPhase("verifying");
      await delay(500);
      const verified = runColorBookingTest(updatedLimit);
      if (!verified.success || verified.availableSlotCount < 8) {
        throw new Error("The repeated color booking test did not pass.");
      }
      setTestResult(verified);
      bookingIssueRef.current = null;
      setBookingIssue(null);
      visibleSlotsRef.current = verified.slots;
      setVisibleSlots(verified.slots);
      setTranscript((lines) => [
        ...lines,
        `JustAsk: The reviewed code patch is live. I repeated the color booking test and found ${verified.availableSlotCount} appointments with Maya.`,
      ]);
      setPhase("resolved");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The code patch failed.",
      );
      setPhase("error");
    }
  };

  const approveNavigationPatch = async () => {
    if (!navigationApprovalId || !navigationPatch) return;
    setNavigationApprovalId(null);
    setPhase("applying-change");
    try {
      await delay(400);
      const applied = applyRegisteredNavigationPatch(
        artistsPatchAppliedRef.current,
        navigationPatch,
      );
      updateArtistsPatchApplied(applied);
      navigationErrorRef.current = null;
      setNavigationError(null);
      updateEvents({
        timestamp: new Date().toISOString(),
        type: "registered-code-patch",
        operation: "fixArtistsNavigation",
        status: 200,
        summary: `Applied approved Artists route patch using ${navigationPatch.strategy}`,
      });
      setPhase("verifying");
      await delay(500);
      const verified = runArtistsNavigationTest(applied);
      if (!verified.success || verified.destination !== "/artists") {
        throw new Error("The repeated Artists navigation test did not pass.");
      }
      setTranscript((lines) => [
        ...lines,
        "JustAsk: The selected JavaScript fix is live. I repeated the Artists click and it now resolves to the correct /artists page.",
      ]);
      setPhase("resolved");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The Artists navigation patch failed.",
      );
      setPhase("error");
    }
  };

  const resetDemo = () => {
    updateSaraConfiguration({ ...BROKEN_SARA_CONFIGURATION });
    updateMaxOnlineDuration(BROKEN_MAX_ONLINE_DURATION);
    updateArtistsPatchApplied(false);
    eventsRef.current = [];
    setEvents([]);
    setVisibleSlots(null);
    visibleSlotsRef.current = null;
    setBookedSlot(null);
    bookingIssueRef.current = null;
    setBookingIssue(null);
    setOwnerMode(false);
    ownerModeRef.current = false;
    setPhase("idle");
    setIsSpeaking(false);
    setMessage("Customers say they can’t book Sara. Can you check?");
    setTranscript([]);
    setTestResult(null);
    setDiagnosis(null);
    setProposal(null);
    setApprovalId(null);
    setCodeDiagnosis(null);
    setCodePatch(null);
    setCodeApprovalId(null);
    navigationErrorRef.current = null;
    setNavigationError(null);
    setNavigationDiagnosis(null);
    setNavigationPatch(null);
    setNavigationApprovalId(null);
    setActiveIncident("availability");
    setError(null);
    selectService("haircut");
    selectStaff("sara");
  };

  const toggleOwnerMode = () => {
    ownerModeRef.current = !ownerMode;
    setOwnerMode(!ownerMode);
  };

  const voice = useJustAskVoice({
    getContext: () => adapter.getContext(),
    onInvestigate: investigate,
    onFridayCorrection: updateProposalForFridayClosure,
    onInterrupted: () => setIsSpeaking(false),
  });

  return (
    <main>
      <CopilotContextBridge
        context={adapter.getContext()}
        phase={phase}
        proposal={proposal}
        codePatch={codePatch}
        navigationPatch={navigationPatch}
      />
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Luma Salon home">
          <span className="brand-mark">L</span>
          <span>
            <strong>Luma</strong>
            <small>Salon</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#services">Services</a>
          <button onClick={handleArtistsClick}>Artists</button>
          <a href="#book">Book</a>
        </nav>
        <button
          className="owner-link"
          onPointerEnter={() => void voice.preload()}
          onFocus={() => void voice.preload()}
          onPointerDown={() => void voice.preload()}
          onClick={() => {
            toggleOwnerMode();
            if (ownerMode) {
              voice.disconnect();
            } else {
              void voice.connect();
            }
          }}
        >
          <ShieldCheck size={16} />
          {ownerMode ? "Close Owner Mode" : "Owner Mode"}
        </button>
      </header>

      {navigationError && (
        <div className="navigation-error-banner" role="alert">
          <CircleAlert size={20} />
          <span>
            <strong>We couldn’t open Artists</strong>
            A JavaScript error stopped this link. Other booking features still
            work.
          </span>
          <code>{navigationError}</code>
          <button
            onPointerEnter={() => void voice.preload()}
            onClick={() => {
              if (!ownerMode) {
                toggleOwnerMode();
                void voice.connect();
              }
            }}
          >
            Ask JustAsk
          </button>
        </div>
      )}

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Intentional beauty · Brooklyn</p>
          <h1>Hair that feels<br />like you.</h1>
          <p className="hero-description">
            Thoughtful cuts and color in a calm, welcoming studio. Meet your
            stylist and find a time that works for you.
          </p>
          <a className="primary-link" href="#book">
            Book an appointment <span>→</span>
          </a>
        </div>
        <div className="hero-image" role="img" aria-label="Luma Salon interior">
          <div className="availability-badge">
            <Sparkles size={16} />
            New client appointments
          </div>
        </div>
      </section>

      <section className="booking-section" id="book">
        <div className="section-heading">
          <p className="eyebrow">Your next visit</p>
          <h2>Book an appointment</h2>
          <p>Choose a service and stylist. We’ll show you the next available times.</p>
        </div>

        <div className="booking-grid">
          <div className="booking-form">
            <div className="booking-step">
              <span className="step-number">1</span>
              <div>
                <h3>Choose a service</h3>
                <div className="option-list">
                  {services.map((service) => (
                    <button
                      className={`option-card ${selectedServiceId === service.id ? "selected" : ""}`}
                      key={service.id}
                      onClick={() => selectService(service.id)}
                    >
                      <span className="option-icon"><Scissors size={19} /></span>
                      <span className="option-copy">
                        <strong>{service.name}</strong>
                        <small>{service.duration}</small>
                      </span>
                      <b>{service.price}</b>
                      {selectedServiceId === service.id && (
                        <span className="selected-check"><Check size={14} /></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="booking-step">
              <span className="step-number">2</span>
              <div>
                <h3>Choose your stylist</h3>
                <div className="staff-list">
                  {staff.map((person) => (
                    <button
                      className={`staff-card ${selectedStaffId === person.id ? "selected" : ""}`}
                      key={person.id}
                      onClick={() => selectStaff(person.id)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={person.image} alt="" />
                      <span>
                        <strong>{person.name}</strong>
                        <small>{person.role}</small>
                      </span>
                      <span className="radio">
                        {selectedStaffId === person.id && <span />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button className="availability-button" onClick={checkAvailability}>
              <CalendarDays size={18} />
              Check availability
            </button>
          </div>

          <aside
            className="availability-panel"
            id="available-times"
            aria-live="polite"
          >
            <div className="panel-topline">
              <span><CalendarDays size={17} /> Available times</span>
              <span>Next 7 days</span>
            </div>
            {visibleSlots === null ? (
              <div className="availability-placeholder">
                <Clock3 size={34} />
                <h3>Your appointment times will appear here</h3>
                <p>Select a service and stylist, then check availability.</p>
              </div>
            ) : visibleSlots.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon"><CalendarDays size={28} /></span>
                <h3>
                  {bookingIssue === "duration-limit"
                    ? "This service can’t be booked online"
                    : "0 available appointments"}
                </h3>
                {bookingIssue === "duration-limit" ? (
                  <p>
                    Dimensional color is currently blocked by the booking page.
                    Other services remain available.
                  </p>
                ) : (
                  <p>
                    We couldn’t find an appointment with {selectedStaffId === "sara" ? "Sara" : "Maya"} in
                    the next seven days. Try another stylist or check back soon.
                  </p>
                )}
              </div>
            ) : (
              <div className="slot-results">
                {phase === "resolved" && (
                  <div className="test-passed">
                    <CheckCircle2 size={20} />
                    <span><strong>Customer test passed</strong>Test booking successful</span>
                  </div>
                )}
                <h3>{visibleSlots.length} appointments available</h3>
                {bookedSlot && (
                  <div className="booking-confirmed">
                    <CheckCircle2 size={20} />
                    <span>
                      <strong>
                        Test appointment booked with{" "}
                        {selectedStaffId === "sara" ? "Sara" : "Maya"}
                      </strong>
                      {formatSlot(bookedSlot)}
                    </span>
                  </div>
                )}
                <div className="slot-grid">
                  {visibleSlots.slice(0, 8).map((slot) => (
                    <button
                      className={bookedSlot === slot ? "booked" : ""}
                      key={slot}
                      onClick={() => setBookedSlot(slot)}
                    >
                      {bookedSlot === slot ? "Booked · " : ""}
                      {formatSlot(slot)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="salon-story" id="services">
        <div>
          <p className="eyebrow">The Luma approach</p>
          <h2>Expert care, without the fuss.</h2>
        </div>
        <p>
          Our artists pair technical craft with honest conversation, so every
          visit feels considered and every result feels like your own.
        </p>
      </section>

      {ownerMode && (
        <div className="owner-shell">
          <div className="owner-panel">
            <div className="owner-header">
              <div className="agent-identity">
                <span className={`agent-orb ${isSpeaking ? "speaking" : ""}`}>
                  <Sparkles size={18} />
                </span>
                <span>
                  <strong>JustAsk</strong>
                  <small>Site Doctor · Owner Mode</small>
                </span>
              </div>
              <div className={`status-pill status-${phase}`}>
                <span />
                {voice.connectionState === "connecting"
                  ? "Connecting voice"
                  : isSpeaking
                    ? "Speaking — interrupt anytime"
                    : phaseLabels[phase]}
              </div>
              <button
                className="icon-button"
                onClick={() => {
                  voice.disconnect();
                  toggleOwnerMode();
                }}
                aria-label="Close Owner Mode"
              >
                <X size={20} />
              </button>
            </div>

            <div className="owner-context">
              <span><ShieldCheck size={14} /> Safe page context</span>
              <code>/book · {selectedServiceId} · {selectedStaffId}</code>
            </div>

            <div className="owner-body">
              {phase === "idle" && (
                <div className="agent-intro">
                  <button
                    className="intro-icon"
                    onClick={() => void voice.connect()}
                    aria-label="Connect live voice"
                  >
                    <Mic size={24} />
                  </button>
                  <h3>What should I check?</h3>
                  <p>
                    I can see this booking page and its safe diagnostic events.
                    I’ll ask before changing anything.
                  </p>
                  <small className="voice-helper">
                    {voice.connectionState === "connected"
                      ? "Live voice connected — start speaking"
                      : "Tap the microphone for live voice, or use typed input"}
                  </small>
                  {voice.error && <small className="voice-error">{voice.error}</small>}
                  <button
                    className="demo-fallback-button"
                    onClick={() => void investigate(message)}
                  >
                    Run selected demo without microphone
                  </button>
                </div>
              )}

              {["listening", "investigating", "researching"].includes(phase) && (
                <div className="progress-card">
                  <span className="progress-spinner" />
                  <div>
                    <strong>{phaseLabels[phase]}</strong>
                    <p>
                      {phase === "investigating"
                        ? activeIncident === "navigation"
                          ? "Repeating the Artists menu click…"
                          : activeIncident === "code"
                            ? "Repeating the Dimensional color with Maya customer journey…"
                            : "Repeating the Haircut with Sara customer journey…"
                        : phase === "researching"
                          ? activeIncident === "navigation"
                            ? "Exa is checking trusted JavaScript and Next.js guidance…"
                            : "Checking trusted availability guidance…"
                          : "I heard you. Starting the check…"}
                    </p>
                  </div>
                </div>
              )}

              {["applying-change", "verifying"].includes(phase) && (
                <div className="progress-card">
                  <span className="progress-spinner" />
                  <div>
                    <strong>{phaseLabels[phase]}</strong>
                    <p>
                      {phase === "applying-change"
                        ? activeIncident === "navigation"
                          ? "Applying only the JavaScript patch you selected…"
                          : activeIncident === "code"
                            ? "Applying only the registered code patch you approved…"
                            : "Applying only the schedule you approved…"
                        : activeIncident === "navigation"
                          ? "Repeating the original Artists click…"
                          : activeIncident === "code"
                            ? "Repeating the original Dimensional color with Maya test…"
                            : "Repeating the original Haircut with Sara test…"}
                    </p>
                  </div>
                </div>
              )}

              {diagnosis && (
                <div className="diagnosis-card">
                  <div className="finding-heading">
                    <span><CircleAlert size={18} /></span>
                    <div>
                      <small>What I found · {diagnosis.confidence} confidence</small>
                      <h3>Sara’s working hours are missing</h3>
                    </div>
                  </div>
                  <p className="owner-summary">{diagnosis.summaryForOwner}</p>

                  <details>
                    <summary>Technical evidence <ChevronDown size={15} /></summary>
                    <div className="evidence-list">
                      {diagnosis.evidence.map((item) => (
                        <div key={item.label}>
                          <span>{item.label}</span><code>{item.value}</code>
                        </div>
                      ))}
                    </div>
                  </details>

                  <div className="sources">
                    <small>Trusted guidance</small>
                    {diagnosis.sources.map((source) => (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        key={source.url}
                      >
                        <span><strong>{source.title}</strong><small>{source.domain}</small></span>
                        <ExternalLink size={14} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {codeDiagnosis && (
                <div className="diagnosis-card code-diagnosis">
                  <div className="finding-heading">
                    <span><CircleAlert size={18} /></span>
                    <div>
                      <small>
                        Code issue · {codeDiagnosis.confidence} confidence
                      </small>
                      <h3>The booking page rejects long services</h3>
                    </div>
                  </div>
                  <p className="owner-summary">
                    {codeDiagnosis.summaryForOwner}
                  </p>
                  <details>
                    <summary>
                      Technical evidence <ChevronDown size={15} />
                    </summary>
                    <div className="evidence-list">
                      {codeDiagnosis.evidence.map((item) => (
                        <div key={item.label}>
                          <span>{item.label}</span>
                          <code>{item.value}</code>
                        </div>
                      ))}
                    </div>
                  </details>
                  <p className="developer-note">
                    This is a registered, reviewable code patch—not arbitrary
                    code execution.
                  </p>
                </div>
              )}

              {proposal && (
                <div className="proposal-card">
                  <div className="proposal-heading">
                    <span><Clock3 size={17} /></span>
                    <div>
                      <small>Proposed safe change</small>
                      <h3>Add Sara’s working hours</h3>
                    </div>
                  </div>
                  <div className="diff">
                    <div className="diff-before">
                      <span>Before</span>
                      <strong>No schedule</strong>
                    </div>
                    <div className="diff-arrow">→</div>
                    <div className="diff-after">
                      <span>After</span>
                      <strong>
                        {proposal.enabledDays.includes("friday")
                          ? "Monday–Friday"
                          : "Monday–Thursday"}
                      </strong>
                      <small>{proposal.startTime}–{proposal.endTime}</small>
                    </div>
                  </div>

                  {isSpeaking && (
                    <div className="proposal-options">
                      <button
                        className="accept-proposal-button"
                        onClick={() => void requestApproval(proposal)}
                      >
                        <Check size={16} />
                        Use this schedule
                      </button>
                      <button
                        className="interrupt-button"
                        onClick={() =>
                          updateProposalForFridayClosure(
                            "We are closed on Friday now.",
                          )
                        }
                      >
                        <MicOff size={16} />
                        Interrupt: “We are closed on Friday now.”
                      </button>
                    </div>
                  )}

                  {phase === "waiting-for-approval" && (
                    <>
                      <p className="approval-note">
                        <ShieldCheck size={15} />
                        Nothing changes until you approve.
                      </p>
                      <div className="approval-actions">
                        <button className="approve-button" onClick={approveChange}>
                          <Check size={17} /> Approve change
                        </button>
                        <button
                          className="cancel-button"
                          onClick={() => {
                            setApprovalId(null);
                            setProposal(null);
                            setPhase("idle");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {codePatch && (
                <div className="proposal-card code-patch-card">
                  <div className="proposal-heading">
                    <span><Scissors size={17} /></span>
                    <div>
                      <small>Proposed registered code fix</small>
                      <h3>Allow longer online services</h3>
                    </div>
                  </div>
                  <code className="patch-file">{codePatch.file}</code>
                  <div className="code-diff">
                    <code>- {codePatch.constant} = {codePatch.before}</code>
                    <code>+ {codePatch.constant} = {codePatch.after}</code>
                  </div>

                  {isSpeaking && (
                    <button
                      className="accept-proposal-button"
                      onClick={() => requestCodeApproval(codePatch)}
                    >
                      <Check size={16} />
                      Review this code patch
                    </button>
                  )}

                  {phase === "waiting-for-approval" && (
                    <>
                      <p className="approval-note">
                        <ShieldCheck size={15} />
                        The code remains unchanged until you approve.
                      </p>
                      <div className="approval-actions">
                        <button
                          className="approve-button"
                          onClick={approveCodePatch}
                        >
                          <Check size={17} /> Approve code fix
                        </button>
                        <button
                          className="cancel-button"
                          onClick={() => {
                            setCodeApprovalId(null);
                            setCodePatch(null);
                            setPhase("idle");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {navigationDiagnosis && navigationPatch && (
                <>
                  <div className="diagnosis-card code-diagnosis">
                    <div className="finding-heading">
                      <span><CircleAlert size={18} /></span>
                      <div>
                        <small>
                          JavaScript issue · {navigationDiagnosis.confidence} confidence
                        </small>
                        <h3>The Artists link uses the wrong route key</h3>
                      </div>
                    </div>
                    <p className="owner-summary">
                      {navigationDiagnosis.summaryForOwner}
                    </p>
                    <details>
                      <summary>
                        Technical evidence <ChevronDown size={15} />
                      </summary>
                      <div className="evidence-list">
                        {navigationDiagnosis.evidence.map((item) => (
                          <div key={item.label}>
                            <span>{item.label}</span>
                            <code>{item.value}</code>
                          </div>
                        ))}
                      </div>
                    </details>
                    <div className="sources">
                      <small>Exa research · trusted sources</small>
                      {navigationDiagnosis.sources.map((source) => (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          key={source.url}
                        >
                          <span>
                            <strong>{source.title}</strong>
                            <small>{source.domain}</small>
                          </span>
                          <ExternalLink size={14} />
                        </a>
                      ))}
                    </div>
                  </div>

                  <div className="proposal-card navigation-patch-card">
                    <div className="proposal-heading">
                      <span><Scissors size={17} /></span>
                      <div>
                        <small>Choose a researched fix</small>
                        <h3>Repair the Artists navigation</h3>
                      </div>
                    </div>

                    <div className="fix-candidates">
                      {navigationDiagnosis.candidates.map((candidate, index) => (
                        <button
                          className={
                            navigationPatch.strategy === candidate.strategy
                              ? "selected"
                              : ""
                          }
                          key={candidate.strategy}
                          onClick={() => setNavigationPatch(candidate)}
                          disabled={phase === "waiting-for-approval"}
                        >
                          <span className="radio">
                            {navigationPatch.strategy === candidate.strategy && (
                              <span />
                            )}
                          </span>
                          <span>
                            <strong>
                              {index === 0
                                ? "Correct the route key"
                                : "Add a defensive fallback"}
                            </strong>
                            <small>
                              {index === 0
                                ? "Recommended · fixes the underlying typo"
                                : "Prevents the exception if the route is missing"}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>

                    <code className="patch-file">{navigationPatch.file}</code>
                    <div className="code-diff">
                      <code>- {navigationPatch.before}</code>
                      <code>+ {navigationPatch.after}</code>
                    </div>

                    {isSpeaking && (
                      <button
                        className="accept-proposal-button"
                        onClick={() =>
                          requestNavigationApproval(navigationPatch)
                        }
                      >
                        <Check size={16} />
                        Review selected fix
                      </button>
                    )}

                    {phase === "waiting-for-approval" && (
                      <>
                        <p className="approval-note">
                          <ShieldCheck size={15} />
                          The JavaScript remains unchanged until you approve.
                        </p>
                        <div className="approval-actions">
                          <button
                            className="approve-button"
                            onClick={approveNavigationPatch}
                          >
                            <Check size={17} /> Approve selected fix
                          </button>
                          <button
                            className="cancel-button"
                            onClick={() => {
                              setNavigationApprovalId(null);
                              setPhase("diagnosis-ready");
                              setIsSpeaking(true);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {phase === "resolved" &&
                (activeIncident === "navigation" || testResult) && (
                <div className="resolved-card">
                  <CheckCircle2 size={25} />
                  <div>
                    <small>Repair verified</small>
                    <h3>Customer test passed</h3>
                    <p>
                      {activeIncident === "navigation" ? (
                        <>
                          <strong>Artists navigation successful.</strong> The
                          same click now resolves to the real /artists page.
                        </>
                      ) : (
                        <>
                          <strong>Test booking successful.</strong>{" "}
                          The same booking test now finds{" "}
                          {testResult?.availableSlotCount} appointments for{" "}
                          {activeIncident === "code"
                            ? "Dimensional color with Maya."
                            : "Haircut with Sara."}
                        </>
                      )}
                    </p>
                    <button
                      className="book-test-button"
                      onClick={() => {
                        voice.disconnect();
                        if (activeIncident === "navigation") {
                          handleArtistsClick();
                        } else {
                          toggleOwnerMode();
                          window.setTimeout(
                            () =>
                              document
                                .getElementById("available-times")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                }),
                            50,
                          );
                        }
                      }}
                    >
                      {activeIncident === "navigation"
                        ? "Open Artists page"
                        : "Book a test appointment"}
                    </button>
                  </div>
                </div>
                )}

              {phase === "error" && (
                <div className="error-card">
                  <CircleAlert size={20} />
                  <div><strong>Something went wrong</strong><p>{error}</p></div>
                  <button onClick={() => setPhase("idle")}>Retry</button>
                </div>
              )}

              {transcript.length > 0 && (
                <details className="transcript">
                  <summary>Conversation transcript <ChevronDown size={15} /></summary>
                  {transcript.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
                </details>
              )}
            </div>

            {!["applying-change", "verifying", "resolved"].includes(phase) && (
              <div className="composer">
                <button
                  className="mic-button"
                  aria-label="Start voice input"
                  onClick={() =>
                    voice.connectionState === "connected"
                      ? voice.disconnect()
                      : void voice.connect()
                  }
                >
                  <Mic size={20} />
                </button>
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitMessage();
                  }}
                  aria-label="Message JustAsk"
                  placeholder={
                    isSpeaking ? "Interrupt JustAsk…" : "Ask JustAsk to check the page…"
                  }
                />
                <button className="send-button" onClick={submitMessage}>
                  {isSpeaking ? "Interrupt" : "Send"}
                </button>
              </div>
            )}
          </div>
          <button
            className="reset-button"
            onClick={() => {
              voice.disconnect();
              resetDemo();
            }}
          >
            <RotateCcw size={15} /> Reset demo
          </button>
        </div>
      )}

      {!ownerMode && (
        <button
          className="floating-owner-button"
          onPointerEnter={() => void voice.preload()}
          onFocus={() => void voice.preload()}
          onPointerDown={() => void voice.preload()}
          onClick={() => {
            toggleOwnerMode();
            void voice.connect();
          }}
        >
          <span><Sparkles size={19} /></span>
          <span><strong>JustAsk</strong><small>Open Owner Mode</small></span>
        </button>
      )}

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark">L</span>
          <span><strong>Luma</strong><small>Salon</small></span>
        </div>
        <p>128 North 6th Street · Brooklyn, NY</p>
        <p>© 2026 Luma Salon</p>
      </footer>
    </main>
  );
}
