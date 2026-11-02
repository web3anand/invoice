import { useEffect, useState } from "react";
import {
  CloudDownload,
  CloudUpload,
  Download,
  FolderArchive,
  Loader2,
  Upload,
} from "lucide-react";
import {
  backupToDrive,
  downloadBackup,
  driveAutoOn,
  getGoogleClientId,
  lastDriveBackup,
  restoreBackupFile,
  restoreFromDrive,
  setDriveAuto,
  setGoogleClientId,
} from "@/features/bills/drive-backup";
import { useBills } from "@/features/bills/store";

function when(iso: string): string {
  if (!iso) return "Not backed up to Google yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not backed up to Google yet";
  return `Last Google backup ${date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}`;
}

const inputClass =
  "min-h-10 w-full min-w-0 rounded-xl border border-line/80 bg-field/80 px-3.5 py-2 text-sm text-ink outline-none transition-all duration-200 placeholder:text-muted/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] hover:border-olive/40 hover:bg-surface focus-visible:border-olive focus-visible:bg-surface focus-visible:ring-4 focus-visible:ring-olive/10";
const btnPrimary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-olive px-4 text-sm font-semibold text-white shadow-[0_2px_10px_-2px_rgba(101,77,40,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:bg-olive-deep hover:shadow-[0_4px_14px_-2px_rgba(101,77,40,0.55)] active:scale-[0.97] active:bg-olive-deep disabled:opacity-40 disabled:pointer-events-none";
const btnGhost =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line/85 bg-surface/90 px-3.5 text-sm font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:border-olive/40 hover:bg-hover active:scale-[0.97] active:bg-active disabled:opacity-40 disabled:pointer-events-none";

export function PhoneBackup() {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState("");
  const [auto, setAuto] = useState(false);
  const [last, setLast] = useState("");

  useEffect(() => {
    setClientId(getGoogleClientId());
    setAuto(driveAutoOn());
    setLast(lastDriveBackup());
  }, []);

  useEffect(() => {
    if (!auto || !getGoogleClientId()) return;
    let timer = 0;
    const unsub = useBills.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void backupToDrive(true)
          .then(() => {
            const stamp = lastDriveBackup();
            setLast(stamp);
            setNote("");
          })
          .catch(() => {
            /* Stay quiet. The phone copy is already saved. */
          });
      }, 4000);
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, [auto, clientId]);

  async function run(action: () => Promise<void> | void) {
    setBusy(true);
    setNote("");
    try {
      await action();
      setLast(lastDriveBackup());
    } catch (error) {
      setNote(error instanceof Error ? error.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="beui-card rounded-3xl p-5 shadow-xs sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-cream text-olive shadow-2xs border border-line/50">
          <FolderArchive className="size-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">Extra Backups</h2>
          <p className="mt-0.5 text-xs text-muted leading-relaxed">
            Automatic cloud syncing is already active. This optional tool creates manual offline snapshot files or backups to Google Drive.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line/60 bg-field/60 p-3">
        <span className="block text-xs font-semibold text-muted">Drive Status</span>
        <span className="mt-0.5 block text-sm font-medium text-ink">{when(last)}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          className={btnPrimary}
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await backupToDrive(false);
              setNote("Backed up to Google Drive successfully.");
            })
          }
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CloudUpload className="size-4" />
          )}
          Google Drive Backup
        </button>
        <button
          type="button"
          className={btnGhost}
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const ok = window.confirm("Replace this workspace's bills with the Google Drive backup?");
              if (!ok) return;
              await restoreFromDrive();
              setNote("Restored from Google Drive successfully.");
            })
          }
        >
          <CloudDownload className="size-4" />
          Restore from Drive
        </button>
        <button
          type="button"
          className={btnGhost}
          onClick={() => downloadBackup()}
        >
          <Download className="size-4" />
          Save Backup JSON File
        </button>
        <label className={`${btnGhost} cursor-pointer`}>
          <Upload className="size-4" />
          <span>Restore Backup File</span>
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void run(async () => {
                const ok = window.confirm("Replace this workspace's bills with this backup file?");
                if (!ok) return;
                await restoreBackupFile(file);
                setNote("Restored from the backup file successfully.");
              });
            }}
          />
        </label>
      </div>

      {note ? (
        <p className="mt-3 rounded-xl bg-cream/70 p-2.5 text-xs font-medium text-ink border border-line">
          {note}
        </p>
      ) : null}

      <details className="mt-4 border-t border-line/60 pt-3 group">
        <summary className="flex cursor-pointer items-center text-sm font-semibold text-ink transition-colors hover:text-olive">
          Google Drive API Settings
        </summary>
        <p className="mt-1.5 text-xs text-muted leading-relaxed">
          To enable automated Google Drive sync, register a Web Client ID in Google Cloud Console with your app's origin URL authorized.
        </p>
        <div className="mt-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted uppercase tracking-wider">
              Google Client ID
            </span>
            <input
              className={inputClass}
              value={clientId}
              spellCheck={false}
              autoComplete="off"
              placeholder="e.g. 123456789-xxxx.apps.googleusercontent.com"
              onChange={(event) => setClientId(event.target.value)}
            />
          </label>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                setGoogleClientId(clientId);
                setNote("Google client ID saved on this device.");
              }}
            >
              Save Client ID
            </button>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink select-none">
            <input
              type="checkbox"
              className="size-4 rounded accent-olive"
              checked={auto}
              onChange={(event) => {
                setDriveAuto(event.target.checked);
                setAuto(event.target.checked);
              }}
            />
            <span>Back up automatically to Google Drive on bill changes</span>
          </label>
        </div>
      </details>
    </section>
  );
}
