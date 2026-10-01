import { describe, expect, it } from "vitest";

import { resolveSchoolLifecycle } from "../../src/lib/school-lifecycle";

describe("school lifecycle resolution", () => {
  it("prioritizes an active contract over a trial state", () => {
    expect(resolveSchoolLifecycle({
      contractStatus: "active",
      trialStatus: "pending",
      contractPlanName: "Starter",
      trialName: "Onboarding Trial",
    })).toMatchObject({
      stage: "contract",
      status: "active",
      label: "Active contract",
      planName: "Starter",
    });
  });

  it("marks an active trial as the current lifecycle state when no contract is active", () => {
    expect(resolveSchoolLifecycle({
      contractStatus: "draft",
      trialStatus: "active",
      contractPlanName: "Starter",
      trialName: "Onboarding Trial",
    })).toMatchObject({
      stage: "trial",
      status: "active",
      label: "Trial active",
      planName: "Starter",
    });
  });

  it("returns inactive when no tenant lifecycle is active", () => {
    expect(resolveSchoolLifecycle({
      contractStatus: "draft",
      trialStatus: "expired",
      contractPlanName: "Starter",
      trialName: "Onboarding Trial",
    })).toMatchObject({
      stage: "inactive",
      status: "inactive",
      label: "No active lifecycle",
    });
  });
});
