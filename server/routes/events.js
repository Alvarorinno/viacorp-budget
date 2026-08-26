import { Router } from 'express';
import sql, { query } from '../db.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

const DIRECTOR_FIELDS = ['estimacion', 'cliente', 'descripcion', 'presupuesto', 'costo', 'mes_evento'];
const FINANCE_FIELDS  = ['factura', 'fecha_facturacion', 'mes_facturacion', 'estado_pago'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Meses anteriores al mes previo al actual están bloqueados para el director.
// Ejemplo: si hoy es Agosto (idx 7), minEditableIdx = 6 (Julio). Junio y antes = bloqueado.
const isDirectorMonthLocked = (mes_evento) => {
  if (!mes_evento) return false;
  const idx = MONTHS.indexOf(mes_evento);
  const minEditableIdx = new Date().getMonth() - 1;
  return idx !== -1 && idx < minEditableIdx;
};

const toObj = row => row ? { ...row, mb: Number(row.presupuesto || 0) - Number(row.costo || 0) } : null;

router.get('/', async (req, res) => {
  try {
    const events = await sql`SELECT *, (presupuesto - costo) as mb FROM events ORDER BY mes_evento, id`;
    res.json(events.map(toObj));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }); }
});

router.post('/', async (req, res) => {
  if (req.user.role !== 'director') return res.status(403).json({ error: 'Sin permiso para crear eventos' });
  const { estimacion, cliente, descripcion, presupuesto, costo, mes_evento } = req.body;
  if (!cliente) return res.status(400).json({ error: 'Cliente es requerido' });
  try {
    const rows = await sql`
      INSERT INTO events (estimacion, cliente, descripcion, presupuesto, costo, mes_evento)
      VALUES (${estimacion ?? null}, ${cliente}, ${descripcion ?? null}, ${presupuesto || 0}, ${costo || 0}, ${mes_evento ?? null})
      RETURNING id
    `;
    const event = (await sql`SELECT *, (presupuesto - costo) as mb FROM events WHERE id = ${rows[0].id}`)[0];
    res.status(201).json(toObj(event));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }); }
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = (await sql`SELECT * FROM events WHERE id = ${id}`)[0];
  if (!existing) return res.status(404).json({ error: 'Evento no encontrado' });
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Sin permiso para editar' });

  // Bloqueo temporal: directores no pueden editar meses cerrados (antes del mes anterior al actual)
  if (req.user.role === 'director' && isDirectorMonthLocked(existing.mes_evento)) {
    return res.status(403).json({ error: `Mes cerrado — solo editable desde ${MONTHS[new Date().getMonth() - 1]} en adelante` });
  }

  const allowedFields = req.user.role === 'director' ? DIRECTOR_FIELDS : FINANCE_FIELDS;
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Sin campos para actualizar' });

  try {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    await query(
      `UPDATE events SET ${setClause}, updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') WHERE id = $${keys.length + 1}`,
      [...values, id]
    );
    const updated = (await sql`SELECT *, (presupuesto - costo) as mb FROM events WHERE id = ${id}`)[0];
    res.json(toObj(updated));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }); }
});

router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'director') return res.status(403).json({ error: 'Sin permiso' });
  try {
    await sql`DELETE FROM events WHERE id = ${Number(req.params.id)}`;
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }); }
});

export default router;
