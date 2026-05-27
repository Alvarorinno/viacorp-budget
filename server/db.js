import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// En producción (Railway) usa /data/database.db (volumen persistente)
const DB_PATH = process.env.DB_PATH || join(__dirname, 'data.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estimacion TEXT,
    cliente TEXT NOT NULL,
    descripcion TEXT,
    presupuesto REAL DEFAULT 0,
    costo REAL DEFAULT 0,
    factura TEXT,
    fecha_facturacion TEXT,
    mes_evento TEXT,
    mes_facturacion TEXT,
    por_cobrar TEXT,
    estado_pago TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    nombre TEXT
  );
`);

// Usuarios por defecto
const insertUser = db.prepare(`INSERT OR IGNORE INTO users (username, password, role, nombre) VALUES (?, ?, ?, ?)`);
insertUser.run('director', process.env.DIRECTOR_PASS || 'dir2026', 'director', 'Director');
insertUser.run('finanzas', process.env.FINANZAS_PASS || 'fin2026', 'finanzas', 'Gerente de Finanzas');

// Auto-seed en primer arranque si la BD está vacía
const count = db.prepare('SELECT COUNT(*) as n FROM events').get();
if (count.n === 0) {
  const seedFile = join(__dirname, '../scripts/eventos_2026.json');
  if (existsSync(seedFile)) {
    const data = JSON.parse(readFileSync(seedFile, 'utf-8'));
    const insert = db.prepare(`
      INSERT INTO events (estimacion, cliente, descripcion, presupuesto, costo, factura, fecha_facturacion, mes_evento, por_cobrar, estado_pago)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.exec('BEGIN');
    for (const r of data) {
      insert.run(
        r.estimacion ? String(r.estimacion) : null,
        r.cliente,
        r.descripcion ?? null,
        r.presupuesto || 0,
        r.costo || 0,
        r.factura ?? null,
        r.fecha_facturacion ?? null,
        r.mes_evento ?? null,
        r.por_cobrar ?? null,
        r.pagado ?? null
      );
    }
    db.exec('COMMIT');
    console.log(`✓ Auto-seed: ${data.length} eventos cargados desde eventos_2026.json`);
  }
}

export function dbTransaction(fn) {
  db.exec('BEGIN');
  try { fn(); db.exec('COMMIT'); }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

export default db;
