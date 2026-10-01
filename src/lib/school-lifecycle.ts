export type SchoolLifecycleStage = "contract" | "trial" | "inactive";

export function resolveSchoolLifecycle({
  contractStatus,
  trialStatus,
  contractPlanName,
  trialName,
}: {
  contractStatus?: string | null;
  trialStatus?: string | null;
  contractPlanName?: string | null;
  trialName?: string | null;
}) {
  const normalizedContractStatus = String(contractStatus ?? "").toLowerCase();
  const normalizedTrialStatus = String(trialStatus ?? "").toLowerCase();
  const activeContract = ["active", "paused"].includes(normalizedContractStatus);
  const activeTrial = ["active", "pending"].includes(normalizedTrialStatus);

  if (activeContract) {
    return {
      stage: "contract" as SchoolLifecycleStage,
      status: normalizedContractStatus || "active",
      label: "Active contract",
      planName: contractPlanName || "Starter",
    };
  }

  if (activeTrial) {
    return {
      stage: "trial" as SchoolLifecycleStage,
      status: normalizedTrialStatus || "active",
      label: normalizedTrialStatus === "pending" ? "Trial pending" : "Trial active",
      planName: contractPlanName || trialName || "Starter",
    };
  }

  return {
    stage: "inactive" as SchoolLifecycleStage,
    status: "inactive",
    label: "No active lifecycle",
    planName: contractPlanName || trialName || "Starter",
  };
}
