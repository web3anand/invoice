import { useEffect, useState } from "react";
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
    <section className="rounded-xl border border-line bg-surface p-3">
      <h2 className="text-lg font-semibold tracking-tight">Extra backup</h2>
      <p className="mt-1 text-sm text-muted">
        Bills already save to your cloud workspace automatically. This keeps an extra copy in
        Google Drive or a file you can move to another device.
      </p>
      <p className="mt-2 text-sm font-medium">{when(last)}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-olive px-3 text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] active:bg-olive-deep disabled:opacity-40"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await backupToDrive(false);
              setNote("Backed up to Google Drive.");
            })
          }
        >
          Back up
        </button>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-field px-3 text-base font-medium text-ink transition-colors hover:bg-hover active:bg-active disabled:opacity-40"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const ok = window.confirm("Replace this workspace's bills with the Google Drive backup?");
              if (!ok) return;
              await restoreFromDrive();
              setNote("Restored from Google Drive.");
            })
          }
        >
          Restore
        </button>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-field px-3 text-base font-medium text-ink transition-colors hover:bg-hover active:bg-active"
          onClick={() => downloadBackup()}
        >
          Save file
        </button>
        <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-field px-3 text-base font-medium text-ink transition-colors hover:bg-hover active:bg-active">
          Open file
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
                setNote("Restored from the backup file.");
              });
            }}
          />
        </label>
      </div>
      {note ? <p className="mt-2 text-sm">{note}</p> : null}
      <details className="mt-3">
        <summary className="flex min-h-12 cursor-pointer items-center text-base font-medium text-ink transition-colors hover:text-olive">Google Drive setup</summary>
        <p className="mt-1 text-sm text-muted">
          In Google Cloud, create a Web client ID and allow this site. Paste it here once. After that, turn on
          automatic backup and it keeps a copy in your Drive.
        </p>
        <label className="mt-2 block">
          <span className="mb-1 block text-xs font-medium text-muted">Google client ID</span>
          <input
            className="min-h-12 w-full rounded-xl border border-line bg-field px-3 text-base text-ink outline-none transition-colors placeholder:text-[#a39a8b] focus-visible:border-olive focus-visible:ring-2 focus-visible:ring-olive/15"
            value={clientId}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setClientId(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-line bg-field px-3 text-base font-medium text-ink transition-colors hover:bg-hover active:bg-active sm:w-auto"
          onClick={() => {
            setGoogleClientId(clientId);
            setNote("Google client ID saved on this phone.");
          }}
        >
          Save client ID
        </button>
        <label className="mt-3 flex min-h-12 items-center gap-3 text-base">
          <input
            type="checkbox"
            className="size-6 shrink-0 accent-olive"
            checked={auto}
            onChange={(event) => {
              setDriveAuto(event.target.checked);
              setAuto(event.target.checked);
            }}
          />
          Back up automatically after each change
        </label>
      </details>
    </section>
  );
}
