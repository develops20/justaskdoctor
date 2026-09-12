import { applyAvailabilityChange, runBookingTest } from "@/lib/booking-tools";
import {
  AvailabilityChangeSchema,
  WebsiteContextSchema,
  type AvailabilityChange,
  type DiagnosticEvent,
  type JustAskHostAdapter,
  type WebsiteContext,
} from "@/lib/contracts";
import type { StaffConfiguration } from "@/lib/booking-tools";

interface SalonAdapterOptions {
  getConfiguration: (staffId: string) => StaffConfiguration;
  setSaraConfiguration: (configuration: StaffConfiguration) => void;
  getContextSnapshot: () => Omit<WebsiteContext, "recentEvents">;
  getEvents: () => DiagnosticEvent[];
  recordEvent: (event: DiagnosticEvent) => void;
}

export class SalonHostAdapter implements JustAskHostAdapter {
  private readonly pendingApprovals = new Map<string, AvailabilityChange>();

  private readonly usedApprovals = new Set<string>();

  constructor(private readonly options: SalonAdapterOptions) {}

  getContext(): WebsiteContext {
    return WebsiteContextSchema.parse({
      ...this.options.getContextSnapshot(),
      recentEvents: this.options.getEvents().slice(-20),
    });
  }

  async runBookingTest(input: { serviceId: string; staffId: string }) {
    if (!["haircut", "color"].includes(input.serviceId)) {
      throw new Error("Unknown service.");
    }
    if (!["sara", "maya"].includes(input.staffId)) {
      throw new Error("Unknown staff member.");
    }

    const result = runBookingTest(
      this.options.getConfiguration(input.staffId),
      input.serviceId,
      input.staffId,
    );
    this.options.recordEvent({
      timestamp: new Date().toISOString(),
      type: "api-response",
      operation: "getAvailableSlots",
      status: 200,
      summary: `Returned ${result.availableSlotCount} slots for service=${input.serviceId}, staff=${input.staffId}`,
    });
    return result;
  }

  async proposeAvailabilityChange(input: AvailabilityChange) {
    const safeChange = AvailabilityChangeSchema.parse(input);
    const approvalId = crypto.randomUUID();
    this.pendingApprovals.set(approvalId, safeChange);
    return { approvalId };
  }

  async applyApprovedAvailabilityChange(input: { approvalId: string }) {
    if (this.usedApprovals.has(input.approvalId)) {
      throw new Error("This approval has already been used.");
    }
    const change = this.pendingApprovals.get(input.approvalId);
    if (!change) {
      throw new Error("A valid explicit approval is required.");
    }

    const updated = applyAvailabilityChange(
      this.options.getConfiguration(change.staffId),
      change,
    );
    this.options.setSaraConfiguration(updated);
    this.pendingApprovals.delete(input.approvalId);
    this.usedApprovals.add(input.approvalId);
    this.options.recordEvent({
      timestamp: new Date().toISOString(),
      type: "configuration-change",
      operation: "applyAvailabilitySchedule",
      status: 200,
      summary: `Applied approved schedule to staff=${change.staffId}`,
    });
    return { applied: true as const };
  }
}
