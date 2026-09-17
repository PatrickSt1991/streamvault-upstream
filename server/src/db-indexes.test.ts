// @vitest-environment node
import { test, expect } from 'vitest';
import Database from 'better-sqlite3';
import { ensureBrowseIndexes } from './db-indexes.js';

test('browse pages use indexes instead of temporary full-catalogue sorts', () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE channels(id TEXT PRIMARY KEY, content_type TEXT, grp TEXT, added INTEGER, sort_order INTEGER, name TEXT)');
  ensureBrowseIndexes(db);
  ensureBrowseIndexes(db);
  for (const filter of ["content_type = 'movies'", "grp = 'Movies'"]) {
    for (const ordering of ['added DESC, name', 'sort_order, name']) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT * FROM channels WHERE ${filter} ORDER BY ${ordering} LIMIT 20`).all() as { detail: string }[];
      expect(plan.some(row => row.detail.includes('USING INDEX'))).toBe(true);
      expect(plan.some(row => row.detail.includes('TEMP B-TREE'))).toBe(false);
    }
  }
  const plan = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM channels ORDER BY sort_order, name LIMIT 20').all() as { detail: string }[];
  expect(plan.some(row => row.detail.includes('TEMP B-TREE'))).toBe(false);
  db.close();
});
