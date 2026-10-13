"use client";

import { useActionState } from "react";
import { deleteFeeStructure, setFeeStructureActive } from "@/app/actions/finance";
import type { FinanceFormState } from "@/lib/finance/schemas";

function Feedback({ state }: { state: FinanceFormState | undefined }) {
  return <>{state?.error && <span className="student-error" role="alert">{state.error}</span>}{state?.success && <span className="student-success" role="status">{state.success}</span>}</>;
}

export function FeeStructureActions({ feeStructureId, isActive }: { feeStructureId: string; isActive: boolean }) {
  const [status, updateStatus] = useActionState(setFeeStructureActive, undefined);
  const [removal, removeFeeStructure] = useActionState(deleteFeeStructure, undefined);

  return <div className="finance-structure-actions">
    <form action={updateStatus}>
      <input type="hidden" name="feeStructureId" value={feeStructureId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <button type="submit">{isActive ? "Set inactive" : "Set active"}</button>
      <Feedback state={status} />
    </form>
    <form
      action={removeFeeStructure}
      onSubmit={(event) => {
        if (!window.confirm("Remove this fee structure? This cannot be undone.")) event.preventDefault();
      }}
    >
      <input type="hidden" name="feeStructureId" value={feeStructureId} />
      <button type="submit" className="finance-structure-actions__remove">Remove</button>
      <Feedback state={removal} />
    </form>
  </div>;
}
