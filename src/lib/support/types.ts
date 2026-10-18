export type SupportCategory =
  | "complaint"
  | "issue"
  | "feature_request"
  | "policy_question"
  | "account_access"
  | "billing"
  | "other";

export type SupportPriority = "normal" | "high" | "urgent";

export type SupportStatus =
  | "open"
  | "in_review"
  | "planned"
  | "in_progress"
  | "resolved"
  | "declined";

export type SupportActionState = {
  error?: string;
  success?: string;
  warning?: string;
};

export const supportCategories: Array<{ value: SupportCategory; label: string }> = [
  { value: "issue", label: "Something is not working" },
  { value: "complaint", label: "Complaint" },
  { value: "feature_request", label: "Request a feature" },
  { value: "policy_question", label: "Policy question" },
  { value: "account_access", label: "Account or access" },
  { value: "billing", label: "Billing" },
  { value: "other", label: "Other support" },
];

export const supportStatuses: Array<{ value: SupportStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_review", label: "In review" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "declined", label: "Declined" },
];
