import {
  BookingTestResultSchema,
  CodePatchSchema,
  type BookingTestResult,
  type CodePatch,
} from "@/lib/contracts";
import { MAYA_CONFIGURATION, runBookingTest } from "@/lib/booking-tools";
import { MAX_ONLINE_DURATION_MINUTES } from "@/lib/booking-policy";

export const BROKEN_MAX_ONLINE_DURATION = MAX_ONLINE_DURATION_MINUTES;
export const FIXED_MAX_ONLINE_DURATION = 180;
export const COLOR_SERVICE_DURATION = 120;

export interface CodeDiagnosis {
  summaryForOwner: string;
  technicalCause: string;
  confidence: "high";
  evidence: Array<{ label: string; value: string }>;
  proposedPatch: CodePatch;
}

export function runColorBookingTest(
  maxOnlineDuration: number,
): BookingTestResult {
  const apiResult = runBookingTest(
    MAYA_CONFIGURATION,
    "color",
    "maya",
  );

  if (COLOR_SERVICE_DURATION > maxOnlineDuration) {
    return BookingTestResultSchema.parse({
      success: false,
      serviceId: "color",
      staffId: "maya",
      availableSlotCount: 0,
      slots: [],
      evidence: [
        {
          source: "booking-widget",
          message: `Rejected ${COLOR_SERVICE_DURATION}-minute service because MAX_ONLINE_DURATION_MINUTES=${maxOnlineDuration}`,
        },
        {
          source: "booking-api",
          message: `API has ${apiResult.availableSlotCount} valid slots for service=color, staff=maya`,
        },
      ],
      errorCode: "CLIENT_DURATION_LIMIT",
    });
  }

  return apiResult;
}

export function diagnoseCodeProblem(
  result: BookingTestResult,
): CodeDiagnosis {
  if (result.errorCode !== "CLIENT_DURATION_LIMIT") {
    throw new Error("The registered coding diagnosis did not match.");
  }

  return {
    summaryForOwner:
      "Maya has appointment times, but the booking page rejects color services longer than 90 minutes before customers can see them.",
    technicalCause:
      "MAX_ONLINE_DURATION_MINUTES is incorrectly set to 90 while Dimensional color requires 120 minutes.",
    confidence: "high",
    evidence: [
      { label: "Color service", value: "120 minutes" },
      { label: "Booking page limit", value: "90 minutes" },
      {
        label: "Booking API",
        value: "Healthy; appointment slots are available",
      },
    ],
    proposedPatch: {
      type: "UPDATE_BOOKING_DURATION_LIMIT",
      file: "lib/booking-policy.ts",
      constant: "MAX_ONLINE_DURATION_MINUTES",
      before: 90,
      after: 180,
    },
  };
}

export function applyRegisteredCodePatch(
  currentLimit: number,
  patch: CodePatch,
): number {
  const safePatch = CodePatchSchema.parse(patch);
  if (currentLimit !== safePatch.before) {
    throw new Error("The code no longer matches the reviewed patch.");
  }
  return safePatch.after;
}
