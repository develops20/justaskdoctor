import {
  AvailabilityChangeSchema,
  BookingTestResultSchema,
  type AvailabilityChange,
  type BookingTestResult,
  type Day,
  type DiagnosisResult,
  type ResearchSource,
} from "@/lib/contracts";

export interface StaffConfiguration {
  staffId: "sara" | "maya";
  availabilityScheduleId: string | null;
  enabledDays: Day[];
  startTime: string | null;
  endTime: string | null;
}

export const BROKEN_SARA_CONFIGURATION: StaffConfiguration = {
  staffId: "sara",
  availabilityScheduleId: null,
  enabledDays: [],
  startTime: null,
  endTime: null,
};

export const MAYA_CONFIGURATION: StaffConfiguration = {
  staffId: "maya",
  availabilityScheduleId: "schedule-maya-default",
  enabledDays: ["tuesday", "wednesday", "thursday", "friday", "saturday"],
  startTime: "10:00",
  endTime: "18:00",
};

const dayNames: Day[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function generateSlots(
  configuration: StaffConfiguration,
  now = new Date("2026-09-14T08:00:00.000Z"),
): string[] {
  if (
    !configuration.availabilityScheduleId ||
    !configuration.startTime ||
    configuration.enabledDays.length === 0
  ) {
    return [];
  }

  const slots: string[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() + offset);
    const day = dayNames[date.getUTCDay()];
    if (!configuration.enabledDays.includes(day)) continue;

    [9, 10, 11, 14].forEach((hour) => {
      const slot = new Date(date);
      slot.setUTCHours(hour, 0, 0, 0);
      slots.push(slot.toISOString());
    });
  }
  return slots;
}

export function runBookingTest(
  configuration: StaffConfiguration,
  serviceId: string,
  staffId: string,
): BookingTestResult {
  const slots = generateSlots(configuration);
  const missingSchedule = configuration.availabilityScheduleId === null;

  return BookingTestResultSchema.parse({
    success: slots.length > 0,
    serviceId,
    staffId,
    availableSlotCount: slots.length,
    slots,
    evidence: [
      {
        source: "booking-api",
        message: `Returned ${slots.length} slots for service=${serviceId}, staff=${staffId}`,
      },
      ...(missingSchedule
        ? [
            {
              source: "staff-configuration",
              message: "Sara has no availability schedule assigned",
            },
          ]
        : []),
    ],
    errorCode: slots.length === 0 ? "NO_AVAILABILITY" : null,
  });
}

export function diagnoseBookingProblem(
  result: BookingTestResult,
  configuration: StaffConfiguration,
  sources: ResearchSource[],
): DiagnosisResult {
  if (
    result.availableSlotCount === 0 &&
    configuration.availabilityScheduleId === null
  ) {
    return {
      summaryForOwner:
        "Sara is bookable, but no working hours are attached to her profile. That is why customers see no appointments.",
      technicalCause:
        "staff.sara.availabilityScheduleId is null and enabledDays is empty.",
      confidence: "high",
      evidence: [
        { label: "Customer test", value: "0 appointments returned" },
        { label: "Sara’s profile", value: "No availability schedule assigned" },
        { label: "Booking service", value: "Responded normally (HTTP 200)" },
      ],
      proposedAction: {
        type: "SET_STAFF_AVAILABILITY",
        staffId: "sara",
        enabledDays: [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
        ],
        startTime: "09:00",
        endTime: "17:00",
      },
      sources,
    };
  }

  return {
    summaryForOwner: result.success
      ? "The customer booking test is working."
      : "I could not safely identify this problem.",
    technicalCause: result.success
      ? "No fault reproduced."
      : "No deterministic diagnosis matched.",
    confidence: result.success ? "high" : "low",
    evidence: [],
    proposedAction: null,
    sources,
  };
}

export function applyAvailabilityChange(
  configuration: StaffConfiguration,
  input: AvailabilityChange,
): StaffConfiguration {
  const change = AvailabilityChangeSchema.parse(input);
  if (configuration.staffId !== change.staffId) {
    throw new Error("The approved action does not match this staff member.");
  }
  return {
    staffId: "sara",
    availabilityScheduleId: "schedule-sara-approved",
    enabledDays: change.enabledDays,
    startTime: change.startTime,
    endTime: change.endTime,
  };
}
