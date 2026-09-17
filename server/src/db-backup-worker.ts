// Keep VACUUM and full snapshot validation off the HTTP event loop.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { createAtomicBackup, pruneDatabaseBackups } from './db-lifecycle.js';

async function sendMessage(message: { target?: string; error?: string; warning?: string }): Promise<void> {
  if (!process.send || !process.connected) return;
  await new Promise<void>(resolve => {
    process.send!(message, () => resolve());
  });
}

let db: InstanceType<typeof Database> | undefined;
try {
  const [source, backupDir] = process.argv.slice(2);
  fs.mkdirSync(backupDir, { recursive: true });
  for (const warning of pruneDatabaseBackups(backupDir)) await sendMessage({ warning });

  db = new Database(source, { fileMustExist: true });
  const target = path.join(backupDir, `streamvault-${new Date().toISOString().slice(0, 10)}.db`);
  createAtomicBackup(db, target);
  db.close();
  db = undefined;

  for (const warning of pruneDatabaseBackups(backupDir)) await sendMessage({ warning });
  await sendMessage({ target });
} catch (error) {
  await sendMessage({ error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
} finally {
  db?.close();
  if (process.connected) process.disconnect?.();
}
