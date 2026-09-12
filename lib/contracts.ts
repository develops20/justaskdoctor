import { z } from "zod";

export const DaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const DiagnosticEventSchema = z.object({
  timestamp: z.string(),
  type: z.string(),
  operation: z.string(),
  status: z.number(),
  summary: z.string(),
});

export const WebsiteContextSchema = z.object({
  siteId: z.string(),
  businessName: z.string(),
  businessType: z.literal("salon"),
  currentRoute: z.string(),
  ownerMode: z.boolean(),
  selectedServiceId: z.string().nullable(),
  selectedStaffId: z.string().nullable(),
  visibleMessage: z.string().nullable(),
  recentEvents: z.array(DiagnosticEventSchema).max(20),
});

export const EvidenceSchema = z.object({
  source: z.string(),
  message: z.string(),
});

export const BookingTestResultSchema = z.object({
  success: z.boolean(),
  serviceId: z.string(),
  staffId: z.string(),
  availableSlotCount: z.number().int().nonnegative(),
  slots: z.array(z.string()),
  evidence: z.array(EvidenceSchema),
  errorCode: z.string().nullable(),
});

export const AvailabilityChangeSchema = z.object({
  type: z.literal("SET_STAFF_AVAILABILITY"),
  staffId: z.literal("sara"),
  enabledDays: z.array(DaySchema).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const CodePatchSchema = z.object({
  type: z.literal("UPDATE_BOOKING_DURATION_LIMIT"),
  file: z.literal("lib/booking-policy.ts"),
  constant: z.literal("MAX_ONLINE_DURATION_MINUTES"),
  before: z.literal(90),
  after: z.literal(180),
});

export const ResearchSourceSchema = z.object({
  title: z.string(),
  url: z.url(),
  extract: z.string(),
  domain: z.string(),
  isFallback: z.boolean(),
});

export const DiagnosisResultSchema = z.object({
  summaryForOwner: z.string(),
  technicalCause: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(z.object({ label: z.string(), value: z.string() })),
  proposedAction: AvailabilityChangeSchema.nullable(),
  sources: z.array(ResearchSourceSchema),
});

export const ApprovalSchema = z.object({
  approvalId: z.string(),
  change: AvailabilityChangeSchema,
  used: z.boolean(),
});

export type Day = z.infer<typeof DaySchema>;
export type DiagnosticEvent = z.infer<typeof DiagnosticEventSchema>;
export type WebsiteContext = z.infer<typeof WebsiteContextSchema>;
export type BookingTestResult = z.infer<typeof BookingTestResultSchema>;
export type AvailabilityChange = z.infer<typeof AvailabilityChangeSchema>;
export type CodePatch = z.infer<typeof CodePatchSchema>;
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;
export type DiagnosisResult = z.infer<typeof DiagnosisResultSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;

export type AgentPhase =
  | "idle"
  | "listening"
  | "investigating"
  | "researching"
  | "diagnosis-ready"
  | "waiting-for-approval"
  | "applying-change"
  | "verifying"
  | "resolved"
  | "error";

export interface JustAskHostAdapter {
  getContext(): WebsiteContext;
  runBookingTest(input: {
    serviceId: string;
    staffId: string;
  }): Promise<BookingTestResult>;
  proposeAvailabilityChange(
    input: AvailabilityChange,
  ): Promise<{ approvalId: string }>;
  applyApprovedAvailabilityChange(input: {
    approvalId: string;
  }): Promise<{ applied: true }>;
}
