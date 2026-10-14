"use client";

import { useState, type FormEvent } from "react";

type Status = { kind: "success" | "error"; message: string } | null;

async function readApiError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error ?? `The request failed (${response.status}). Please try again.`;
}

export function SchoolBackupPanel({ canRestore }: { canRestore: boolean }) {
  const [restoring, setRestoring] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function restoreBackup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setRestoring(true);
    setStatus(null);
    try {
      const response = await fetch("/api/setup/backup", {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
      });
      if (!response.ok) {
        setStatus({ kind: "error", message: await readApiError(response) });
        return;
      }
      const result = await response.json() as {
        restored_rows?: number;
        restored_files?: number;
        failed_files?: number;
        storage_errors?: string[];
      };
      const rowCount = result.restored_rows ?? 0;
      const fileCount = result.restored_files ?? 0;
      if ((result.failed_files ?? 0) > 0) {
        const failures = result.storage_errors?.slice(0, 3).join("; ");
        setStatus({
          kind: "error",
          message: `Database restore completed with ${rowCount} rows and ${fileCount} files, but ${result.failed_files} files failed to restore.${failures ? ` ${failures}` : ""}`,
        });
      } else {
        setStatus({
          kind: "success",
          message: `Restore complete: ${rowCount} rows and ${fileCount} uploaded files merged. Newer records were not deleted; refresh other pages to see restored data.`,
        });
      }
      form.reset();
    } catch (error) {
      console.error("School backup restore request failed.", error);
      setStatus({ kind: "error", message: "Could not reach the restore service. Check your connection and try again." });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <section className="setup-card setup-backup-card" aria-labelledby="setup-backup-title">
      <div className="setup-backup-heading">
        <div>
          <p className="settings-overview-kicker">Data portability</p>
          <h3 id="setup-backup-title">Create or restore a school backup</h3>
          <p>Download this school&apos;s database records as a compressed JSON file and merge a valid Schooliva backup when needed.</p>
        </div>
        <span className="setup-backup-format" aria-label="Gzip-compressed JSON format">JSON.GZ</span>
      </div>
      <div className="setup-backup-details">
        <div><strong>Whole school records and files</strong><p>Includes all school-scoped public database rows and uploaded files referenced by those rows or stored in this school&apos;s private storage folders. Schooliva imposes no file-size cap.</p></div>
        <div><strong>Excluded for safety</strong><p>Authentication credentials, project configuration, and data not associated with this school are not included.</p></div>
      </div>
      <p className="setup-backup-warning">This export may contain confidential student, staff, academic, and financial information. Save it only in encrypted, access-controlled storage.</p>
      <a className="setup-backup-download" href="/api/setup/backup" aria-disabled={restoring}>
        Download school backup <span aria-hidden="true">↓</span>
      </a>
      <div className="setup-backup-restore">
        <h4>Restore from a backup</h4>
        <p>Restore accepts this school&apos;s Schooliva JSON or JSON.GZ export only. The backup must be from this same school. It merges records by their original IDs, updates matching records, and does not delete newer data.</p>
        {canRestore ? (
          <form onSubmit={restoreBackup}>
            <label className="setup-backup-file">Backup file<input name="backup" type="file" accept=".json,.gz,application/json,application/gzip" required disabled={restoring} /></label>
            <label className="setup-backup-confirm"><input name="confirmRestore" type="checkbox" required disabled={restoring} />I understand this will add or update records for the currently selected school.</label>
            <button className="setup-backup-restore-button" type="submit" disabled={restoring}>{restoring ? "Restoring backup..." : "Restore school data"}</button>
          </form>
        ) : (
          <p className="setup-backup-permission">Only a Master Admin or this school&apos;s School Admin can download or restore backups.</p>
        )}
      </div>
      {status && <p className={`setup-backup-status ${status.kind}`} role={status.kind === "error" ? "alert" : "status"}>{status.message}</p>}
    </section>
  );
}
