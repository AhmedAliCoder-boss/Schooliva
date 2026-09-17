export const notificationEvents = {
  studentAbsent: "student_absent",
  feeOverdue: "fee_overdue",
  paymentReceived: "payment_received",
  assignmentCreated: "assignment_created",
  assignmentDue: "assignment_due",
  examPublished: "exam_published",
  resultPublished: "result_published",
  announcement: "announcement",
  leaveStatusChanged: "leave_status_changed",
} as const;

export type NotificationEvent = typeof notificationEvents[keyof typeof notificationEvents];

export type NotificationPayload = {
  schoolId: string;
  recipientProfileId: string;
  eventType: NotificationEvent;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};
