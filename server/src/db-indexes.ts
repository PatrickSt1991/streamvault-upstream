import type Database from 'better-sqlite3';

// Match browse filters AND ordering so a page never sorts the whole catalogue.
export function ensureBrowseIndexes(db: InstanceType<typeof Database>): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_channels_type_newest ON channels(content_type, added DESC, name);
    CREATE INDEX IF NOT EXISTS idx_channels_group_newest ON channels(grp, added DESC, name);
    CREATE INDEX IF NOT EXISTS idx_channels_type_order ON channels(content_type, sort_order, name);
    CREATE INDEX IF NOT EXISTS idx_channels_group_order ON channels(grp, sort_order, name);
    CREATE INDEX IF NOT EXISTS idx_channels_order ON channels(sort_order, name);
  `);
}
