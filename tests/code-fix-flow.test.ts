import { describe, expect, it } from "vitest";
import {
  BROKEN_MAX_ONLINE_DURATION,
  FIXED_MAX_ONLINE_DURATION,
  applyRegisteredCodePatch,
  diagnoseCodeProblem,
  runColorBookingTest,
} from "@/lib/code-tools";

describe("registered coding issue flow", () => {
  it("diagnoses, patches, and verifies the color booking defect", () => {
    const failed = runColorBookingTest(BROKEN_MAX_ONLINE_DURATION);
    expect(failed.success).toBe(false);
    expect(failed.errorCode).toBe("CLIENT_DURATION_LIMIT");

    const diagnosis = diagnoseCodeProblem(failed);
    expect(diagnosis.proposedPatch).toEqual({
      type: "UPDATE_BOOKING_DURATION_LIMIT",
      file: "lib/booking-policy.ts",
      constant: "MAX_ONLINE_DURATION_MINUTES",
      before: 90,
      after: 180,
    });

    const updatedLimit = applyRegisteredCodePatch(
      BROKEN_MAX_ONLINE_DURATION,
      diagnosis.proposedPatch,
    );
    expect(updatedLimit).toBe(FIXED_MAX_ONLINE_DURATION);

    const verified = runColorBookingTest(updatedLimit);
    expect(verified.success).toBe(true);
    expect(verified.availableSlotCount).toBeGreaterThanOrEqual(8);
  });

  it("rejects a patch when the reviewed source no longer matches", () => {
    const patch = diagnoseCodeProblem(
      runColorBookingTest(BROKEN_MAX_ONLINE_DURATION),
    ).proposedPatch;

    expect(() => applyRegisteredCodePatch(120, patch)).toThrow(
      "no longer matches",
    );
  });
});
