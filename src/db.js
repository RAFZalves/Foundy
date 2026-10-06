const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'foundy.db'));
db.pragma('foreign_keys = ON');

// Core schema. Migrations below keep existing Foundy databases usable.
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','cleaning','admin')),
 cgm TEXT,
 turma TEXT,
 active INTEGER NOT NULL DEFAULT 1,
 deleted_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('lost','found')),
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 color TEXT,
 location TEXT,
 room TEXT,
 details TEXT,
 image_filename TEXT,
 status TEXT NOT NULL DEFAULT 'open',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS notifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 link TEXT,
 is_read INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS support_tickets (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 subject TEXT NOT NULL,
 message TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','closed')),
 response_text TEXT,
 answered_at TEXT,
 closed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
);
`);

function columns(table) {
    return db.pragma(`table_info(${table})`);
}

function ensureColumn(table, column, definition) {
    if (!columns(table).some(c => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

// Existing 2.0 databases.
ensureColumn('users', 'cgm', 'TEXT');
ensureColumn('users', 'turma', 'TEXT');
ensureColumn('users', 'active', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('users', 'deleted_at', 'TEXT');
ensureColumn('support_tickets', 'response_text', 'TEXT');
ensureColumn('support_tickets', 'answered_at', 'TEXT');
ensureColumn('support_tickets', 'closed_at', 'TEXT');

// The original items table used a CHECK that did not include "found".
// Rebuild only when needed, preserving all existing rows.
const itemSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'").get();
const statusConstraint = String(itemSql?.sql || '').match(/status[\s\S]*?CHECK\s*\(\s*status\s+IN\s*\(([^)]*)\)/i);
const hasFoundStatus = Boolean(statusConstraint && statusConstraint[1].includes("'found'"));
if (itemSql && !hasFoundStatus) {
    const rows = db.prepare(`SELECT id,user_id,type,title,description,color,location,room,details,image_filename,status,created_at,updated_at FROM items`).all();
    const rebuild = db.transaction(() => {
        db.exec(`
            CREATE TABLE items_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('lost','found')),
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                color TEXT,
                location TEXT,
                room TEXT,
                details TEXT,
                image_filename TEXT,
                status TEXT NOT NULL DEFAULT 'open',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
            )
        `);
        const insert = db.prepare(`INSERT INTO items_new(id,user_id,type,title,description,color,location,room,details,image_filename,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
        for (const r of rows) insert.run(r.id,r.user_id,r.type,r.title,r.description,r.color,r.location,r.room,r.details,r.image_filename,r.status,r.created_at,r.updated_at);
        db.exec('DROP TABLE items');
        db.exec('ALTER TABLE items_new RENAME TO items');
    });
    rebuild();
}

// Remove the accidental old CHECK constraint from migrated databases if necessary.
// New statuses used by Foundy: open, matching, found, resolved, archived.

// Withdrawal records are created after any legacy items-table migration,
// because the table references items.
db.exec(`
CREATE TABLE IF NOT EXISTS item_withdrawals (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 item_id INTEGER NOT NULL UNIQUE,
 name TEXT NOT NULL,
 turma TEXT NOT NULL,
 cgm TEXT NOT NULL,
 recorded_by INTEGER NOT NULL,
 withdrawn_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE RESTRICT,
 FOREIGN KEY(recorded_by) REFERENCES users(id) ON DELETE RESTRICT
);
`);

// Helpful indexes.
db.exec(`
CREATE INDEX IF NOT EXISTS idx_users_cgm ON users(cgm);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_support_user ON support_tickets(user_id);
`);

module.exports = db;
