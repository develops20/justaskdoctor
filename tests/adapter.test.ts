import { describe, expect, it } from "vitest";
import {
  BROKEN_SARA_CONFIGURATION,
  MAYA_CONFIGURATION,
  type StaffConfiguration,
} from "@/lib/booking-tools";
import { SalonHostAdapter } from "@/lib/context-adapter";
import type { DiagnosticEvent } from "@/lib/contracts";

describe("SalonHostAdapter approval boundary", () => {
  it("rejects mutation without approval and consumes an approval once", async () => {
    let sara: StaffConfiguration = { ...BROKEN_SARA_CONFIGURATION };
    const events: DiagnosticEvent[] = [];
    const adapter = new SalonHostAdapter({
      getConfiguration: (staffId) =>
        staffId === "sara" ? sara : MAYA_CONFIGURATION,
      setSaraConfiguration: (configuration) => {
        sara = configuration;
      },
      getContextSnapshot: () => ({
        siteId: "test",
        businessName: "Luma Salon",
        businessType: "salon",
        currentRoute: "/book",
        ownerMode: true,
        selectedServiceId: "haircut",
        selectedStaffId: "sara",
        visibleMessage: null,
      }),
      getEvents: () => events,
      recordEvent: (event) => events.push(event),
    });

    await expect(
      adapter.applyApprovedAvailabilityChange({ approvalId: "not-approved" }),
    ).rejects.toThrow("explicit approval");

    const { approvalId } = await adapter.proposeAvailabilityChange({
      type: "SET_STAFF_AVAILABILITY",
      staffId: "sara",
      enabledDays: ["monday", "tuesday", "wednesday", "thursday"],
      startTime: "09:00",
      endTime: "17:00",
    });

    await expect(
      adapter.applyApprovedAvailabilityChange({ approvalId }),
    ).resolves.toEqual({ applied: true });
    expect(sara.availabilityScheduleId).toBe("schedule-sara-approved");
    await expect(
      adapter.applyApprovedAvailabilityChange({ approvalId }),
    ).rejects.toThrow("already been used");
  });
});
