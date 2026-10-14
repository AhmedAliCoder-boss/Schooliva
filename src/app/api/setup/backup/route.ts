import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import { NextResponse } from "next/server";

import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { isSchoolAdminUser } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export const runtime = "nodejs";

const STORAGE_BUCKETS = [
  "admission-documents",
  "assignment-files",
  "assignment-submissions",
  "employee-resignations",
  "employee-verification",
  "generated-certificates",
  "inventory-purchase-bills",
  "leave-attachments",
  "private-documents",
  "profile-avatars",
  "school-branding",
] as const;

const STORAGE_REFERENCES = [
  ["admission-documents", "admission_documents", "storage_path"],
  ["admission-documents", "admissions", "student_photo_url"],
  ["admission-documents", "student_documents", "storage_path"],
  ["assignment-files", "assignment_attachments", "file_path"],
  ["assignment-submissions", "submission_attachments", "file_path"],
  ["employee-resignations", "hrm_employee_terminations", "resignation_file_path"],
  ["employee-verification", "hrm_employee_documents", "storage_path"],
  ["generated-certificates", "certificate_records", "storage_path"],
  ["inventory-purchase-bills", "inventory_transactions", "bill_storage_path"],
  ["leave-attachments", "leave_attachments", "file_path"],
  ["leave-attachments", "leave_requests", "attachment_path"],
  ["private-documents", "document_records", "storage_path"],
  ["private-documents", "school_documents", "storage_path"],
  ["private-documents", "student_documents", "storage_path"],
  ["profile-avatars", "staff", "photo_path"],
  ["profile-avatars", "students", "photo_path"],
  ["profile-avatars", "teachers", "photo_path"],
  ["school-branding", "school_branding", "logo_path"],
] as const;

type StorageBucket = (typeof STORAGE_BUCKETS)[number];
type StorageBackupFile = {
  bucket: StorageBucket;
  path: string;
  content_type: string;
  data_base64: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStorageBucket(value: unknown): value is StorageBucket {
  return typeof value === "string" && STORAGE_BUCKETS.some((bucket) => bucket === value);
}

function isSafeStoragePath(path: string) {
  return path.length > 0
    && !path.startsWith("/")
    && !path.includes("\\")
    && path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function getBackupTables(document: unknown): Record<string, unknown> | null {
  if (!isRecord(document) || !isRecord(document.tables)) return null;
  return document.tables;
}

function getReferencedStoragePaths(tables: Record<string, unknown>) {
  const paths = new Map<StorageBucket, Set<string>>();
  for (const bucket of STORAGE_BUCKETS) paths.set(bucket, new Set());

  for (const [bucket, tableName, columnName] of STORAGE_REFERENCES) {
    const rows = tables[tableName];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const path = row[columnName];
      if (typeof path === "string" && isSafeStoragePath(path)) {
        paths.get(bucket)?.add(path);
      }
    }
  }

  return paths;
}

async function listSchoolFolderFiles(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  bucket: StorageBucket,
  schoolId: string,
) {
  const paths = new Set<string>();
  const pendingFolders = [schoolId];
  const pageSize = 1000;

  while (pendingFolders.length > 0) {
    const folder = pendingFolders.pop()!;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await admin.storage.from(bucket).list(folder, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        throw new Error(`Could not list ${bucket} storage for this school: ${error.message}`);
      }

      for (const entry of data ?? []) {
        if (!entry.name || entry.name === "." || entry.name === "..") continue;
        const path = `${folder}/${entry.name}`;
        if (!isSafeStoragePath(path) || !path.startsWith(`${schoolId}/`)) continue;
        if (entry.id === null && !entry.metadata) {
          pendingFolders.push(path);
        } else {
          paths.add(path);
        }
      }

      if ((data?.length ?? 0) < pageSize) break;
    }
  }

  return paths;
}

async function getSchoolStorageFiles(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  schoolId: string,
  tables: Record<string, unknown>,
): Promise<StorageBackupFile[]> {
  const pathsByBucket = getReferencedStoragePaths(tables);

  const profileIds = new Set<string>();
  for (const tableName of ["user_roles", "teachers", "staff", "students"]) {
    const rows = tables[tableName];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!isRecord(row)) continue;
      for (const columnName of ["user_id", "profile_id"]) {
        const profileId = row[columnName];
        if (typeof profileId === "string") profileIds.add(profileId);
      }
    }
  }

  const profileIdList = [...profileIds];
  for (let start = 0; start < profileIdList.length; start += 500) {
    const { data, error } = await admin
      .from("profiles")
      .select("avatar_path")
      .in("id", profileIdList.slice(start, start + 500));
    if (error) {
      throw new Error(`Could not read this school’s profile photo references: ${error.message}`);
    }
    for (const profile of data ?? []) {
      if (typeof profile.avatar_path === "string" && isSafeStoragePath(profile.avatar_path)) {
        pathsByBucket.get("profile-avatars")?.add(profile.avatar_path);
      }
    }
  }

  for (const bucket of STORAGE_BUCKETS) {
    const folderPaths = await listSchoolFolderFiles(admin, bucket, schoolId);
    for (const path of folderPaths) pathsByBucket.get(bucket)?.add(path);
  }

  const backupFiles: StorageBackupFile[] = [];
  for (const bucket of STORAGE_BUCKETS) {
    for (const path of pathsByBucket.get(bucket) ?? []) {
      const { data, error } = await admin.storage.from(bucket).download(path);
      if (error) {
        throw new Error(`Could not download ${bucket}/${path}: ${error.message}`);
      }
      backupFiles.push({
        bucket,
        path,
        content_type: data.type || "application/octet-stream",
        data_base64: Buffer.from(await data.arrayBuffer()).toString("base64"),
      });
    }
  }

  return backupFiles;
}

function databaseErrorResponse(error: { code?: string }) {
  if (error.code === "42501") {
    return NextResponse.json(
      { error: "You do not have permission to manage backups for this school." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (error.code === "PGRST202") {
    return NextResponse.json(
      { error: "The school backup database migration has not been applied yet. Ask your administrator to deploy the latest Supabase migration." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return null;
}

async function getSchoolId() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return {
      error: NextResponse.json(
        { error: "Authentication required." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(supabase, user.id);
  if (!schoolId) {
    return {
      error: NextResponse.json(
        { error: "Select a school before downloading or restoring its backup." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  if (!isMasterAdmin) {
    try {
      if (!(await isSchoolAdminUser(supabase, user.id, schoolId))) {
        return {
          error: NextResponse.json(
            { error: "Only a Master Admin or this school’s School Admin can manage backups." },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          ),
        };
      }
    } catch (authorizationError) {
      console.error("School backup administrator access could not be verified.", { schoolId, authorizationError });
      return {
        error: NextResponse.json(
          { error: "Backup administrator access could not be verified. Please try again." },
          { status: 500, headers: { "Cache-Control": "no-store" } },
        ),
      };
    }
  }

  return { supabase, schoolId, isMasterAdmin };
}

export async function GET() {
  const context = await getSchoolId();
  if ("error" in context) return context.error;
  const { supabase, schoolId } = context;

  const { data, error } = await supabase.rpc("export_school_backup", {
    target_school_id: schoolId,
  });
  if (error) {
    const knownError = databaseErrorResponse(error);
    if (knownError) return knownError;

    console.error("School database backup could not be generated.", { schoolId, error });
    return NextResponse.json(
      { error: "School backup could not be generated. Please try again or contact an administrator." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!data || typeof data !== "object") {
    console.error("School database backup returned an empty or invalid payload.", { schoolId });
    return NextResponse.json(
      { error: "School backup returned no data. Please try again or contact an administrator." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const tables = getBackupTables(data);
    const admin = createSupabaseAdminClient();
    if (!tables || !admin) {
      console.error("School backup could not include its storage files.", {
        schoolId,
        missingTables: !tables,
        adminClientAvailable: Boolean(admin),
      });
      return NextResponse.json(
        { error: "School backup could not include uploaded files. Verify the server-side Supabase service key and try again." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const storageFiles = await getSchoolStorageFiles(admin, schoolId, tables);
    const scope = isRecord(data) && isRecord(data.scope) ? data.scope : {};
    const priorExcluded = Array.isArray(scope.excluded) ? scope.excluded : [];
    const json = Buffer.from(JSON.stringify({
      ...data,
      scope: {
        ...scope,
        storage_files: "School-prefixed files and files referenced by this school's exported records in Schooliva-managed buckets",
        excluded: priorExcluded.filter((item) => item !== "Supabase Storage file contents"),
      },
      storage_files: storageFiles,
    }), "utf8");
    const archive = await gzipAsync(json);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(archive), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="schooliva-school-backup-${date}.json.gz"`,
        "Content-Type": "application/gzip",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (backupError) {
    console.error("School database backup could not be completed.", { schoolId, backupError });
    return NextResponse.json(
      { error: "School backup could not be completed, including its uploaded files. Check the server logs and try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  const context = await getSchoolId();
  if ("error" in context) return context.error;
  const { supabase, schoolId } = context;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (formError) {
    console.error("School backup upload could not be read as a form.", { schoolId, formError });
    return NextResponse.json(
      { error: "Backup upload could not be read. Select a JSON or .json.gz backup and try again." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const file = formData.get("backup");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Select a non-empty backup file to restore." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (formData.get("confirmRestore") !== "on") {
    return NextResponse.json(
      { error: "Confirm that you want to merge this backup into the currently selected school." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let backupBytes: Buffer;
  try {
    backupBytes = Buffer.from(await file.arrayBuffer());
  } catch (fileError) {
    console.error("School backup file could not be read.", { schoolId, fileError });
    return NextResponse.json(
      { error: "The selected backup file could not be read. Try selecting it again." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const isGzip = backupBytes[0] === 0x1f && backupBytes[1] === 0x8b;
  if (isGzip) {
    try {
      backupBytes = await gunzipAsync(backupBytes);
    } catch (decompressionError) {
      console.error("School backup upload could not be decompressed.", { schoolId, decompressionError });
      return NextResponse.json(
        { error: "This compressed backup is invalid or damaged." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  let backupDocument: unknown;
  try {
    backupDocument = JSON.parse(backupBytes.toString("utf8"));
  } catch (parseError) {
    console.error("School backup upload is not valid JSON.", { schoolId, parseError });
    return NextResponse.json(
      { error: "This is not a valid JSON school backup." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!backupDocument || typeof backupDocument !== "object" || Array.isArray(backupDocument)) {
    return NextResponse.json(
      { error: "Backup file must contain a Schooliva school backup object." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const backupTables = getBackupTables(backupDocument);
  const storageFilesValue = isRecord(backupDocument) ? backupDocument.storage_files : undefined;
  if (
    isRecord(backupDocument)
    && (
      backupDocument.format !== "schooliva-school-database-backup-v1"
      || backupDocument.school_id !== schoolId
      || !backupTables
    )
  ) {
    return NextResponse.json(
      { error: "Backup is invalid or belongs to a different school." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const storageFiles: StorageBackupFile[] = [];
  const admin = createSupabaseAdminClient();
  if (storageFilesValue !== undefined) {
    if (!Array.isArray(storageFilesValue) || !backupTables) {
      return NextResponse.json(
        { error: "Backup uploaded-file manifest is invalid." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const allowedPaths = getReferencedStoragePaths(backupTables);
    for (const tableName of ["user_roles", "teachers", "staff", "students"]) {
      const rows = backupTables[tableName];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!isRecord(row)) continue;
        for (const columnName of ["user_id", "profile_id"]) {
          const profileId = row[columnName];
          if (typeof profileId === "string" && isSafeStoragePath(profileId)) {
            allowedPaths.get("profile-avatars")?.add(profileId);
          }
        }
      }
    }

    for (const entry of storageFilesValue) {
      if (!isRecord(entry)) {
        return NextResponse.json(
          { error: "Backup contains an invalid uploaded-file entry." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }

      const { bucket, path, content_type: contentType, data_base64: dataBase64 } = entry;
      if (!isStorageBucket(bucket)
        || typeof path !== "string"
        || !isSafeStoragePath(path)
        || typeof dataBase64 !== "string"
        || typeof contentType !== "string") {
        return NextResponse.json(
          { error: "Backup contains an invalid uploaded-file entry." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }

      const isSchoolFolderPath = path.startsWith(`${schoolId}/`);
      const isReferencedPath = allowedPaths.get(bucket)?.has(path) ?? false;
      const isSchoolMemberAvatar = bucket === "profile-avatars"
        && [...allowedPaths.get(bucket) ?? []].some((profileId) => path.startsWith(`${profileId}/`));
      if (!isSchoolFolderPath && !isReferencedPath && !isSchoolMemberAvatar) {
        return NextResponse.json(
          { error: "Backup contains an uploaded file that is not associated with the selected school." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }

      const bytes = Buffer.from(dataBase64, "base64");
      if (bytes.toString("base64") !== dataBase64) {
        return NextResponse.json(
          { error: "Backup contains invalid uploaded-file data." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      storageFiles.push({
        bucket,
        path,
        content_type: contentType,
        data_base64: dataBase64,
      });
    }

    if (storageFiles.length > 0 && !admin) {
      return NextResponse.json(
        { error: "Uploaded files cannot be restored because the server-side Supabase service key is not configured." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  const { data, error } = await supabase.rpc("restore_school_backup", {
    target_school_id: schoolId,
    backup_document: backupDocument,
  });
  if (error) {
    const knownError = databaseErrorResponse(error);
    if (knownError) return knownError;
    if (error.code === "22023") {
      return NextResponse.json(
        { error: "Backup is invalid, belongs to a different school, or its table structure is not supported." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    console.error("School database backup could not be restored.", { schoolId, error });
    return NextResponse.json(
      { error: "Restore could not be completed. No partial database changes were saved; check that this backup matches the current database schema." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!data || typeof data !== "object") {
    console.error("School database restore returned an empty or invalid result.", { schoolId });
    return NextResponse.json(
      { error: "Restore did not return a completion result. Contact an administrator before retrying." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const storageErrors: string[] = [];
  if (admin) {
    for (const file of storageFiles) {
      const { error: uploadError } = await admin.storage.from(file.bucket).upload(
        file.path,
        Buffer.from(file.data_base64, "base64"),
        { contentType: file.content_type, upsert: true },
      );
      if (uploadError) {
        storageErrors.push(`${file.bucket}/${file.path}: ${uploadError.message}`);
      }
    }
  }

  if (storageErrors.length > 0) {
    console.error("School database rows were restored, but some school files could not be restored.", {
      schoolId,
      restoredFiles: storageFiles.length - storageErrors.length,
      failedFiles: storageErrors.length,
    });
  }

  return NextResponse.json(
    {
      ...data,
      restored_files: storageFiles.length - storageErrors.length,
      failed_files: storageErrors.length,
      storage_errors: storageErrors.slice(0, 5),
    },
    { status: storageErrors.length > 0 ? 207 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
