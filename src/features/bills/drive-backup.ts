import { makeBackup, useBills, type BackupFile } from "@/features/bills/store";

const CLIENT_KEY = "av-interior-google-client-id";
const FILE_KEY = "av-interior-drive-file-id";
const AUTO_KEY = "av-interior-drive-auto";
const LAST_KEY = "av-interior-drive-last";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FILE_NAME = "AV Interior bills.json";

type TokenResponse = { access_token?: string; error?: string };
type TokenClient = { requestAccessToken: (opts?: { prompt?: string }) => void };

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

export function getGoogleClientId(): string {
  const saved = typeof localStorage === "undefined" ? "" : (localStorage.getItem(CLIENT_KEY) ?? "");
  const fromBuild = (import.meta.env as Record<string, string | undefined>).VITE_GOOGLE_CLIENT_ID ?? "";
  return saved.trim() || fromBuild.trim();
}

export function setGoogleClientId(value: string): void {
  localStorage.setItem(CLIENT_KEY, value.trim());
}

export function driveAutoOn(): boolean {
  return localStorage.getItem(AUTO_KEY) === "1";
}

export function setDriveAuto(on: boolean): void {
  localStorage.setItem(AUTO_KEY, on ? "1" : "0");
}

export function lastDriveBackup(): string {
  return localStorage.getItem(LAST_KEY) ?? "";
}

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-gis]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google sign-in did not load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.gis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google sign-in did not load"));
    document.head.appendChild(script);
  });
}

function requestToken(clientId: string, silent: boolean): Promise<string> {
  return loadGis().then(
    () =>
      new Promise((resolve, reject) => {
        const google = window.google;
        if (!google) {
          reject(new Error("Google sign-in did not load"));
          return;
        }
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback: (response) => {
            if (response.access_token) resolve(response.access_token);
            else reject(new Error(silent ? "Sign in to Google Drive again" : "Google did not allow access"));
          },
        });
        client.requestAccessToken(silent ? { prompt: "" } : { prompt: "consent" });
      }),
  );
}

async function findFile(token: string): Promise<string | null> {
  const saved = localStorage.getItem(FILE_KEY);
  if (saved) {
    const check = await fetch(`https://www.googleapis.com/drive/v3/files/${saved}?fields=id,trashed`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (check.ok) {
      const body = (await check.json()) as { trashed?: boolean };
      if (!body.trashed) return saved;
    }
  }
  const q = encodeURIComponent(`name = '${FILE_NAME}' and trashed = false`);
  const list = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!list.ok) throw new Error("Could not look in Google Drive");
  const body = (await list.json()) as { files?: { id: string }[] };
  const id = body.files?.[0]?.id ?? null;
  if (id) localStorage.setItem(FILE_KEY, id);
  return id;
}

async function upload(token: string, json: string): Promise<void> {
  const id = await findFile(token);
  if (!id) {
    const boundary = "avinterior";
    const meta = JSON.stringify({ name: FILE_NAME, mimeType: "application/json" });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n` +
      `--${boundary}--`;
    const created = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!created.ok) throw new Error("Google Drive did not save the backup");
    const file = (await created.json()) as { id?: string };
    if (file.id) localStorage.setItem(FILE_KEY, file.id);
  } else {
    const updated = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: json,
    });
    if (!updated.ok) throw new Error("Google Drive did not update the backup");
  }
  localStorage.setItem(LAST_KEY, new Date().toISOString());
}

export async function backupToDrive(silent = false): Promise<void> {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error("Add your Google client ID once, under Google Drive setup.");
  const token = await requestToken(clientId, silent);
  await upload(token, JSON.stringify(makeBackup()));
}

export async function restoreFromDrive(): Promise<BackupFile> {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error("Add your Google client ID once, under Google Drive setup.");
  const token = await requestToken(clientId, false);
  const id = await findFile(token);
  if (!id) throw new Error("No backup was found in this Google account yet.");
  const file = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!file.ok) throw new Error("Could not read the Google Drive backup");
  const data = (await file.json()) as BackupFile;
  useBills.getState().importBackup(data);
  return data;
}

export function downloadBackup(): void {
  const blob = new Blob([JSON.stringify(makeBackup())], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

export async function restoreBackupFile(file: File): Promise<void> {
  const text = await file.text();
  useBills.getState().importBackup(JSON.parse(text) as BackupFile);
}
