import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

const DIRECTOR_FIELDS = ['estimacion', 'cliente', 'descripcion', 'presupuesto', 'costo', 'mes_evento'];
const FINANCE_FIELDS = ['factura', 'fecha_facturacion', 'mes_facturacion', 'por_cobrar', 'estado_pago'];

const toObj = row => row ? { ...row } : null;

router.get('/', (req, res) => {
  const events = db.prepare('SELECT *, (presupuesto - costo) as mb FROM events ORDER BY mes_evento, id').all();
  res.json(events.map(toObj));
});

router.post('/', (req, res) => {
  if (req.user.role !== 'director') return res.status(403).json({ error: 'Solo el director puede crear eventos' });
  const { estimacion, cliente, descripcion, presupuesto, costo, mes_evento } = req.body;
  if (!cliente) return res.status(400).json({ error: 'Cliente es requerido' });
  const result = db.prepare(`
    INSERT INTO events (estimacion, cliente, descripcion, presupuesto, costo, mes_evento)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(estimacion ?? null, cliente, descripcion ?? null, presupuesto || 0, costo || 0, mes_evento ?? null);
  const event = db.prepare('SELECT *, (presupuesto - costo) as mb FROM events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(toObj(event));
});

router.put('/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(Number(req.params.id));
  if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

  const allowedFields = req.user.role === 'director'
    ? [...DIRECTOR_FIELDS, ...FINANCE_FIELDS]
    : FINANCE_FIELDS;

  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Sin campos para actualizar' });

  const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE events SET ${setClause}, updated_at = datetime('now') WHERE id = ?`)
    .run(...Object.values(updates), Number(req.params.id));

  const updated = db.prepare('SELECT *, (presupuesto - costo) as mb FROM events WHERE id = ?').get(Number(req.params.id));
  res.json(toObj(updated));
});

router.delete('/:id', (req, res) => {
  if (req.user.role !== 'director') return res.status(403).json({ error: 'Sin permiso' });
  db.prepare('DELETE FROM events WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
