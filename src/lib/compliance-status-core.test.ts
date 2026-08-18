import { describe, it, expect } from "vitest";
import { computeComplianceStatus, isComplianceComplete, outstandingComplianceCount } from "./compliance-status-core";

describe("computeComplianceStatus", () => {
  it("always includes the standing items regardless of acknowledgements", () => {
    const items = computeComplianceStatus({
      hasEmergencyContact: true, equipmentIssued: false, hasSkillsOrCertifications: true, requiredAcknowledgements: [],
    });
    expect(items).toEqual([
      { label: "Emergency Contact Captured", complete: true },
      { label: "Company Equipment Issued", complete: false },
    ]);
  });

  it("adds one item per required acknowledgement, reflecting its own status", () => {
    const items = computeComplianceStatus({
      hasEmergencyContact: true,
      equipmentIssued: true,
      hasSkillsOrCertifications: true,
      requiredAcknowledgements: [
        { label: "Employee Handbook", acknowledged: true },
        { label: "POPIA Policy", acknowledged: false },
      ],
    });
    expect(items).toContainEqual({ label: "Employee Handbook Acknowledged", complete: true });
    expect(items).toContainEqual({ label: "POPIA Policy Acknowledged", complete: false });
  });

  it("adds a Skills & Certifications Outstanding item only when nothing is on file yet", () => {
    const withNothing = computeComplianceStatus({
      hasEmergencyContact: true, equipmentIssued: true, hasSkillsOrCertifications: false, requiredAcknowledgements: [],
    });
    expect(withNothing).toContainEqual({ label: "Skills & Certifications Outstanding", complete: false });
  });

  it("omits the Skills & Certifications line entirely once at least one is on file — matching the brief's 'if applicable'", () => {
    const withSomething = computeComplianceStatus({
      hasEmergencyContact: true, equipmentIssued: true, hasSkillsOrCertifications: true, requiredAcknowledgements: [],
    });
    expect(withSomething.some((i) => i.label.includes("Skills & Certifications"))).toBe(false);
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
