import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('Set DATABASE_URL env var');

const sql = neon(DATABASE_URL);

console.log('Creating tables...');
await sql`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    nombre TEXT
  )
`;
await sql`
  CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
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
    created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
    updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
  )
`;
await sql`
  CREATE TABLE IF NOT EXISTS budget_scenarios (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL DEFAULT 2026,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  )
`;
console.log('✓ Tables created');

console.log('Seeding users...');
const dirPass = process.env.DIRECTOR_PASS || 'dir2026';
const finPass = process.env.FINANZAS_PASS || 'fin2026';
const cotoPass = process.env.COTO_PASS || 'cotobtl';
await sql`INSERT INTO users (username, password, role, nombre) VALUES ('director', ${dirPass}, 'director', 'Director') ON CONFLICT (username) DO NOTHING`;
await sql`INSERT INTO users (username, password, role, nombre) VALUES ('finanzas', ${finPass}, 'finanzas', 'Gerente de Finanzas') ON CONFLICT (username) DO NOTHING`;
await sql`INSERT INTO users (username, password, role, nombre) VALUES ('coto', ${cotoPass}, 'viewer', 'Coto') ON CONFLICT (username) DO NOTHING`;
await sql`INSERT INTO users (username, password, role, nombre) VALUES ('supervisor', 'supervisor123', 'director', 'Supervisor') ON CONFLICT (username) DO NOTHING`;
console.log('✓ Users seeded');

console.log('Seeding budget scenarios...');
const sc = await sql`SELECT COUNT(*) as n FROM budget_scenarios WHERE year = 2026`;
if (Number(sc[0].n) === 0) {
  await sql`INSERT INTO budget_scenarios (year, name, amount, color, sort_order) VALUES (2026, 'Break Even', 33800000, 'green', 1)`;
  await sql`INSERT INTO budget_scenarios (year, name, amount, color, sort_order) VALUES (2026, 'Promedio Histórico', 39500000, 'blue', 2)`;
  await sql`INSERT INTO budget_scenarios (year, name, amount, color, sort_order) VALUES (2026, 'Promedio + 15%', 45425000, 'yellow', 3)`;
  await sql`INSERT INTO budget_scenarios (year, name, amount, color, sort_order) VALUES (2026, '2023', 55000000, 'orange', 4)`;
  console.log('✓ Budget scenarios seeded');
}

console.log('Seeding events...');
const evCount = await sql`SELECT COUNT(*) as n FROM events`;
if (Number(evCount[0].n) === 0) {
  const seedFile = join(__dirname, 'eventos_2026.json');
  if (existsSync(seedFile)) {
    const data = JSON.parse(readFileSync(seedFile, 'utf-8'));
    for (const r of data) {
      await sql`
        INSERT INTO events (estimacion, cliente, descripcion, presupuesto, costo, factura, fecha_facturacion, mes_evento, por_cobrar, estado_pago)
        VALUES (
          ${r.estimacion ? String(r.estimacion) : null},
          ${r.cliente},
          ${r.descripcion ?? null},
          ${r.presupuesto || 0},
          ${r.costo || 0},
          ${r.factura ?? null},
          ${r.fecha_facturacion ?? null},
          ${r.mes_evento ?? null},
          ${r.por_cobrar ?? null},
          ${r.pagado ?? null}
        )
      `;
    }
    console.log(`✓ ${data.length} events seeded from eventos_2026.json`);
  }
}

console.log('✅ Neon DB initialized successfully!');
