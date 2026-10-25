import { db } from '../db';
import { RecordConflict, MutationRecord, TutorSettings } from '../types';

const FORMAT_VERSION = 1;
let driveAccessToken: string | null = null;

export function setDriveAccessToken(token: string | null): void {
  driveAccessToken = token;
}

export function getDriveAccessToken(): string | null {
  return driveAccessToken;
}

// Dynamically load Google Identity Services client script if not already present
export async function loadGapiScript(): Promise<void> {
  if (typeof window === 'undefined') return;
  if ((window as any).google?.accounts?.oauth2) return;

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('google-client-script');
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-client-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Échec du chargement de Google Identity Services'));
    document.head.appendChild(script);
  });
}

// Request access token using Google Identity Services (token client)
export async function requestGoogleDriveAuth(clientId: string): Promise<string> {
  await loadGapiScript();

  return new Promise((resolve, reject) => {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services non disponible.'));
      return;
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.appdata',
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        setDriveAccessToken(response.access_token);
        resolve(response.access_token);
      },
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

// Helper: Drive API Headers
function getHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// Find a file by name inside appDataFolder
async function findFileInAppData(fileName: string, token: string): Promise<{ id: string; name: string } | null> {
  const query = encodeURIComponent(`name = '${fileName}' and 'appDataFolder' in parents and trashed = false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name)`, {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    throw new Error(`Erreur Drive API (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

// List all files with a given prefix in appDataFolder
async function listFilesInAppData(token: string): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=100`, {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    throw new Error(`Erreur Drive API (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  return data.files || [];
}

// Read file content from Drive
async function readFileContent(fileId: string, token: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Erreur lecture fichier Drive (${res.status})`);
  }

  return await res.text();
}

// Create a file in appDataFolder (multipart upload)
async function createFileInAppData(name: string, content: string, token: string): Promise<string> {
  const metadata = {
    name,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    content +
    closeDelimiter;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) {
    throw new Error(`Erreur création fichier Drive: ${await res.text()}`);
  }

  const data = await res.json();
  return data.id;
}

// Update file content in Drive
async function updateFileContent(fileId: string, content: string, token: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: content,
  });

  if (!res.ok) {
    throw new Error(`Erreur mise à jour fichier Drive: ${await res.text()}`);
  }
}

// Delete file in Drive
async function deleteFileInDrive(fileId: string, token: string): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export interface SyncResult {
  success: boolean;
  reason?: 'offline' | 'unauthorized' | 'format_too_new' | 'error';
  errorMessage?: string;
  pushedCount?: number;
  pulledCount?: number;
  conflicts?: RecordConflict[];
}

// Core Serverless Sync Function
export async function performDriveSync(
  onProgress?: (status: string, percentage: number) => void
): Promise<SyncResult> {
  if (!navigator.onLine) {
    return { success: false, reason: 'offline' };
  }

  const token = driveAccessToken;
  if (!token) {
    return { success: false, reason: 'unauthorized' };
  }

  try {
    onProgress?.('Vérification du manifeste Drive...', 10);

    const settings = await db.settings.get('current');
    const deviceId = settings?.deviceId || 'device_local';

    // 1. Check or create manifest
    let manifestFile = await findFileInAppData('manifest.json', token);
    if (!manifestFile) {
      const initialManifest = {
        formatVersion: FORMAT_VERSION,
        createdAt: new Date().toISOString(),
        authorDevice: deviceId,
      };
      await createFileInAppData('manifest.json', JSON.stringify(initialManifest, null, 2), token);
    } else {
      const manifestText = await readFileContent(manifestFile.id, token);
      const manifest = JSON.parse(manifestText);
      if (manifest.formatVersion > FORMAT_VERSION) {
        return { success: false, reason: 'format_too_new' };
      }
    }

    onProgress?.('Récupération des journaux distants...', 30);

    // 2. Pull remote changelogs from other devices
    const allFiles = await listFilesInAppData(token);
    const otherDeviceChangelogs = allFiles.filter(
      (f) => f.name.startsWith('changelog_') && f.name !== `changelog_${deviceId}.json`
    );

    const conflicts: RecordConflict[] = [];
    let pulledCount = 0;

    for (const remoteFile of otherDeviceChangelogs) {
      const changelogText = await readFileContent(remoteFile.id, token);
      let remoteMutations: MutationRecord[] = [];
      try {
        remoteMutations = JSON.parse(changelogText);
      } catch {
        continue;
      }

      for (const mutation of remoteMutations) {
        const table = (db as any)[mutation.entityType];
        if (!table) continue;

        const localRecord = await table.get(mutation.entityId);

        if (!localRecord) {
          // Record doesn't exist locally: safe insert
          await table.put(mutation.payload);
          pulledCount++;
        } else {
          // Compare revisions
          if (localRecord.revision <= mutation.basedOnRevision) {
            // Local hasn't changed since base: fast-forward remote change
            await table.put(mutation.payload);
            pulledCount++;
          } else if (localRecord.revision > mutation.basedOnRevision) {
            // Both sides modified record! Detect differing fields
            const diffKeys = Object.keys(mutation.payload).filter((k) => {
              if (k === 'updatedAt' || k === 'revision' || k === 'editingDevice') return false;
              return JSON.stringify(localRecord[k]) !== JSON.stringify(mutation.payload[k]);
            });

            if (diffKeys.length > 0) {
              conflicts.push({
                entityType: mutation.entityType,
                entityId: mutation.entityId,
                localRecord,
                remoteRecord: mutation.payload,
                differingFields: diffKeys,
              });
            } else {
              // Same contents, just bump revision
              await table.put({
                ...localRecord,
                revision: Math.max(localRecord.revision, mutation.newRevision) + 1,
              });
            }
          }
        }
      }
    }

    onProgress?.('Envoi des modifications locales...', 65);

    // 3. Push this device's unsynced mutations
    const unsyncedMutations = await db.mutations.filter((m) => !m.synced).toArray();
    let pushedCount = 0;

    if (unsyncedMutations.length > 0) {
      const myChangelogName = `changelog_${deviceId}.json`;
      const myChangelogFile = await findFileInAppData(myChangelogName, token);

      let existingMutations: MutationRecord[] = [];
      if (myChangelogFile) {
        try {
          const raw = await readFileContent(myChangelogFile.id, token);
          existingMutations = JSON.parse(raw);
        } catch {
          existingMutations = [];
        }
      }

      const mergedMutations = [...existingMutations, ...unsyncedMutations];
      const serialized = JSON.stringify(mergedMutations, null, 2);

      if (myChangelogFile) {
        await updateFileContent(myChangelogFile.id, serialized, token);
      } else {
        await createFileInAppData(myChangelogName, serialized, token);
      }

      // Mark all pushed mutations as synced
      for (const m of unsyncedMutations) {
        await db.mutations.update(m.id, { synced: true });
      }
      pushedCount = unsyncedMutations.length;
    }

    onProgress?.('Vérification et compaction des instantanés...', 85);

    // 4. Compact snapshot if total local mutations > 50 or on demand
    const totalMutationsCount = await db.mutations.count();
    const existingSnapshots = allFiles
      .filter((f) => f.name.startsWith('snapshot_'))
      .sort((a, b) => (b.name > a.name ? 1 : -1));

    if (existingSnapshots.length === 0 || totalMutationsCount % 50 === 0) {
      const snapshotPayload = {
        snapshotDate: new Date().toISOString(),
        formatVersion: FORMAT_VERSION,
        deviceId,
        settings: await db.settings.toArray(),
        students: await db.students.toArray(),
        trials: await db.trials.toArray(),
        lessons: await db.lessons.toArray(),
        lessonSnapshots: await db.lessonSnapshots.toArray(),
        vocabulary: await db.vocabulary.toArray(),
        bookings: await db.bookings.toArray(),
        exercises: await db.exercises.toArray(),
        templates: await db.templates.toArray(),
      };

      const snapName = `snapshot_${Date.now()}.json`;
      await createFileInAppData(snapName, JSON.stringify(snapshotPayload, null, 2), token);

      // Keep only last 10 snapshots (PRD Section 3.3)
      if (existingSnapshots.length >= 10) {
        for (const oldSnap of existingSnapshots.slice(9)) {
          await deleteFileInDrive(oldSnap.id, token);
        }
      }
    }

    // 5. Update settings lastSyncedAt
    const nowIso = new Date().toISOString();
    if (settings) {
      await db.settings.put({
        ...settings,
        lastSyncedAt: nowIso,
        googleDriveConnected: true,
      });
    }

    onProgress?.('Synchronisation terminée avec succès !', 100);

    return {
      success: true,
      pushedCount,
      pulledCount,
      conflicts,
    };
  } catch (error: any) {
    return {
      success: false,
      reason: 'error',
      errorMessage: error.message || String(error),
    };
  }
}

// Fetch list of available Drive snapshots for restore UI
export async function getDriveSnapshots(): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
  const token = driveAccessToken;
  if (!token) return [];
  const files = await listFilesInAppData(token);
  return files.filter((f) => f.name.startsWith('snapshot_')).sort((a, b) => (b.name > a.name ? 1 : -1));
}

// Restore a snapshot from Drive (PRD Section 3.3)
export async function restoreDriveSnapshot(fileId: string): Promise<boolean> {
  const token = driveAccessToken;
  if (!token) throw new Error('Non authentifié sur Google Drive');

  const content = await readFileContent(fileId, token);
  const data = JSON.parse(content);

  if (data.students) await db.students.bulkPut(data.students);
  if (data.trials) await db.trials.bulkPut(data.trials);
  if (data.lessons) await db.lessons.bulkPut(data.lessons);
  if (data.lessonSnapshots) await db.lessonSnapshots.bulkPut(data.lessonSnapshots);
  if (data.vocabulary) await db.vocabulary.bulkPut(data.vocabulary);
  if (data.bookings) await db.bookings.bulkPut(data.bookings);
  if (data.exercises) await db.exercises.bulkPut(data.exercises);
  if (data.templates) await db.templates.bulkPut(data.templates);
  if (data.settings) await db.settings.bulkPut(data.settings);

  return true;
}

