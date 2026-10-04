import { notificationEvents } from "./events";

export type FeeOverdueNotificationDraft = {
  schoolId: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  dueDate?: string | null;
};

export function buildFeeOverdueNotificationPayload({
  schoolId,
  invoiceId,
  invoiceNumber,
  amount,
  dueDate,
}: FeeOverdueNotificationDraft) {
  const safeAmount = Number(amount ?? 0);
  const formattedAmount = safeAmount.toFixed(2);

  return {
    schoolId,
    eventType: notificationEvents.feeOverdue,
    title: "Invoice overdue",
    message: `Invoice ${invoiceNumber} is overdue by ${formattedAmount}. The due date was ${dueDate ?? "unknown"}.`,
    entityType: "fee_invoices",
    entityId: invoiceId,
    metadata: {
      invoice_number: invoiceNumber,
      amount: safeAmount,
      due_date: dueDate ?? null,
    },
  };
}

export function shouldDispatchFeeOverdueNotification(
  notifications: Array<{ created_at?: string | null }>,
) {
  if (!notifications.length) {
    return true;
  }

  const now = Date.now();
  const cooldownMs = 7 * 24 * 60 * 60 * 1000;

  return !notifications.some((notification) => {
    if (!notification.created_at) {
      return false;
    }

    const timestamp = new Date(notification.created_at).getTime();
    if (!Number.isFinite(timestamp)) {
      return false;
    }

    return now - timestamp < cooldownMs;
  });
}

type NotificationRole = { slug?: string | null };
type NotificationMembership = { user_id: string; roles?: NotificationRole | NotificationRole[] | null };
type NotificationSupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => Promise<{ data: NotificationMembership[] | null; error: unknown }>;
    };
  };
  rpc: <FnName extends string, Args extends Record<string, unknown> = Record<string, unknown>>(
    fn: FnName,
    args?: Args,
    options?: Record<string, unknown>,
  ) => PromiseLike<unknown> | unknown;
};

export async function dispatchFeeOverdueNotifications(supabase: NotificationSupabaseClient, invoice: FeeOverdueNotificationDraft) {
  const { data: roleMemberships } = await supabase
    .from("user_roles")
    .select("user_id, roles!inner(slug)")
    .eq("school_id", invoice.schoolId);

  const recipientIds = Array.from(new Set((roleMemberships ?? [])
    .map((membership) => {
      const roles = Array.isArray(membership.roles) ? membership.roles : membership.roles ? [membership.roles] : [];
      const isRelevantRole = roles.some((role) => role?.slug && ["school_admin", "accountant"].includes(role.slug));
      return isRelevantRole ? membership.user_id : null;
    })
    .filter((userId: string | null): userId is string => Boolean(userId))));

  const payload = buildFeeOverdueNotificationPayload(invoice);

  const results = [] as Array<PromiseLike<unknown>>;
  for (const recipientId of recipientIds) {
    results.push(
      supabase.rpc("create_in_app_notification", {
        target_school_id: invoice.schoolId,
        target_profile_id: recipientId,
        target_event_type: payload.eventType,
        target_title: payload.title,
        target_message: payload.message,
        target_entity_type: payload.entityType,
        target_entity_id: payload.entityId,
        target_metadata: payload.metadata,
      }) as PromiseLike<unknown>,
    );
  }

  if (!results.length) {
    return [];
  }

  return Promise.all(results);
}
