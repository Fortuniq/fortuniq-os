import { describe, it, expect } from "vitest";
import { computeComplianceStatus, isComplianceComplete, outstandingComplianceCount } from "./compliance-status-core";

describe("computeComplianceStatus", () => {
  it("always includes the standing items regardless of acknowledgements", () => {
    const items = computeComplianceStatus({ hasEmergencyContact: true, equipmentIssued: false, requiredAcknowledgements: [] });
    expect(items).toEqual([
      { label: "Emergency Contact Captured", complete: true },
      { label: "Company Equipment Issued", complete: false },
    ]);
  });

  it("adds one item per required acknowledgement, reflecting its own status", () => {
    const items = computeComplianceStatus({
      hasEmergencyContact: true,
      equipmentIssued: true,
      requiredAcknowledgements: [
        { label: "Employee Handbook", acknowledged: true },
        { label: "POPIA Policy", acknowledged: false },
      ],
    });
    expect(items).toContainEqual({ label: "Employee Handbook Acknowledged", complete: true });
    expect(items).toContainEqual({ label: "POPIA Policy Acknowledged", complete: false });
  });
});

describe("isComplianceComplete", () => {
  it("is true only when every item is complete", () => {
    expect(isComplianceComplete([{ label: "a", complete: true }, { label: "b", complete: true }])).toBe(true);
    expect(isComplianceComplete([{ label: "a", complete: true }, { label: "b", complete: false }])).toBe(false);
  });

  it("is false for an empty list — nothing tracked isn't the same as everything complete", () => {
    expect(isComplianceComplete([])).toBe(false);
  });
});

describe("outstandingComplianceCount", () => {
  it("counts only incomplete items", () => {
    const items = [{ label: "a", complete: true }, { label: "b", complete: false }, { label: "c", complete: false }];
    expect(outstandingComplianceCount(items)).toBe(2);
  });
});
