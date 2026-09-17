import { hasPermission, type Permission } from "@/lib/auth/authorization";

export async function PermissionGate({ schoolId, permission, children, fallback = null }: { schoolId: string; permission: Permission; children: React.ReactNode; fallback?: React.ReactNode }) {
  return (await hasPermission(schoolId, permission)) ? children : fallback;
}