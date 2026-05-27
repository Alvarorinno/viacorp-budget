import db, { dbTransaction } from './db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, '../scripts/eventos_2026.json'), 'utf-8'));

db.prepare('DELETE FROM events').run();

const insert = db.prepare(`
  INSERT INTO events (estimacion, cliente, descripcion, presupuesto, costo, factura, fecha_facturacion, mes_evento, por_cobrar, estado_pago)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

dbTransaction(() => {
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
});

console.log(`✓ Importados ${data.length} registros a la base de datos`);
