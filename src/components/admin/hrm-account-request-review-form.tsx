"use client";

import { useActionState } from "react";

import { resolveHrmEmployeeAccountRequest } from "@/app/actions/account-management";
import { initialAccountActionState } from "@/lib/admin/account-action-state";

export function HrmAccountRequestReviewForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(resolveHrmEmployeeAccountRequest, initialAccountActionState);

  return <form action={action} className="hrm-account-request-review">
    <input type="hidden" name="requestId" value={requestId} />
    {state.message && <p className={state.status === "error" ? "auth-error" : "auth-success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    <button className="admin-button" type="submit" name="decision" value="reject" disabled={pending}>Reject request</button>
    <button className="admin-button admin-button--primary" type="submit" name="decision" value="approve" disabled={pending}>{pending ? "Processing..." : "Approve and invite"}</button>
  </form>;
}
