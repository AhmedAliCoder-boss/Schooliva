"use client";

import { useActionState } from "react";

import { initialAccountActionState, type AccountActionState } from "@/lib/admin/account-action-state";

type AccountAction = (
  previousState: AccountActionState,
  formData: FormData,
) => Promise<AccountActionState>;

export function AccountActionForm({
  action,
  children,
  className,
  submitLabel,
  pendingLabel = "Saving...",
  confirmMessage,
}: {
  action: AccountAction;
  children: React.ReactNode;
  className?: string;
  submitLabel: string;
  pendingLabel?: string;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialAccountActionState);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {children}
      {state.message && (
        <p className={state.status === "success" ? "auth-success" : "auth-error"} role="status" aria-live="polite">
          {state.message}
        </p>
      )}
      <button type="submit" className="admin-button admin-button--primary" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
