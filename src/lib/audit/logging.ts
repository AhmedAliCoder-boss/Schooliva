export type AuditLogPayload = {
  target_school_id: string;
  target_action: string;
  target_entity_type: string;
  target_entity_id?: string | null;
  target_metadata: Record<string, unknown>;
  target_actor_id?: string | null;
};

export function buildAuditLogPayload({
  schoolId,
  action,
  entityType,
  entityId,
  metadata,
  actorId,
}: {
  schoolId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
}): AuditLogPayload {
  const normalizedMetadata = metadata && typeof metadata === "object" ? metadata : {};

  return {
    target_school_id: schoolId,
    target_action: String(action).trim() || "update",
    target_entity_type: String(entityType).trim() || "record",
    target_entity_id: entityId ?? null,
    target_metadata: normalizedMetadata,
    target_actor_id: actorId ?? null,
  };
}

type AuditSupabaseClient = {
  rpc: <FnName extends string, Args extends Record<string, unknown> = Record<string, unknown>>(
    fn: FnName,
    args?: Args,
    options?: Record<string, unknown>,
  ) => unknown;
};

export async function recordAuditEvent(
  supabase: AuditSupabaseClient,
  input: {
    schoolId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown> | null;
    actorId?: string | null;
  }
) {
  const payload = buildAuditLogPayload(input);
  const response = (await supabase.rpc("write_audit_log", payload)) as { data: unknown; error: unknown };
  return { data: response.data, error: response.error };
}
