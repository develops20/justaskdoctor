import { describe, expect, it } from "vitest";
import {
  BROKEN_SARA_CONFIGURATION,
  MAYA_CONFIGURATION,
  applyAvailabilityChange,
  diagnoseBookingProblem,
  runBookingTest,
} from "@/lib/booking-tools";
import type { AvailabilityChange, ResearchSource } from "@/lib/contracts";

const source: ResearchSource = {
  title: "Set up your availability",
  url: "https://cal.com/help/availabilities/set-up-your-availability",
  extract: "Configure an availability schedule.",
  domain: "cal.com",
  isFallback: true,
};

describe("deterministic demo flow", () => {
  it("reproduces Sara's failure while another stylist remains bookable", () => {
    const saraResult = runBookingTest(
      BROKEN_SARA_CONFIGURATION,
      "haircut",
      "sara",
    );
    const mayaResult = runBookingTest(
      MAYA_CONFIGURATION,
      "haircut",
      "maya",
    );

    expect(saraResult.availableSlotCount).toBe(0);
    expect(saraResult.errorCode).toBe("NO_AVAILABILITY");
    expect(mayaResult.availableSlotCount).toBeGreaterThanOrEqual(8);
  });

  it("diagnoses, revises, applies, and verifies the approved repair", () => {
    const firstTest = runBookingTest(
      BROKEN_SARA_CONFIGURATION,
      "haircut",
      "sara",
    );
    const diagnosis = diagnoseBookingProblem(
      firstTest,
      BROKEN_SARA_CONFIGURATION,
      [source],
    );

    expect(diagnosis.confidence).toBe("high");
    expect(diagnosis.proposedAction?.enabledDays).toContain("friday");

    const correctedChange: AvailabilityChange = {
      ...diagnosis.proposedAction!,
      enabledDays: diagnosis.proposedAction!.enabledDays.filter(
        (day) => day !== "friday",
      ),
    };
    const repaired = applyAvailabilityChange(
      BROKEN_SARA_CONFIGURATION,
      correctedChange,
    );
    const repeatedTest = runBookingTest(repaired, "haircut", "sara");

    expect(repaired.enabledDays).toEqual([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
    ]);
    expect(repeatedTest.success).toBe(true);
    expect(repeatedTest.availableSlotCount).toBeGreaterThanOrEqual(8);
  });
});
