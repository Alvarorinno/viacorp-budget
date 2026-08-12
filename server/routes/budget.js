import { Router } from 'express';
import sql, { query } from '../db.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

router.get('/:year', async (req, res) => {
  if (!['director', 'viewer'].includes(req.user.role)) return res.status(403).json({ error: 'Sin permiso' });
  const year = Number(req.params.year);
  try {
    const countRes = await sql`SELECT COUNT(*) as n FROM budget_scenarios WHERE year = ${year}`;
    if (Number(countRes[0].n) === 0) {
      const base = await sql`SELECT * FROM budget_scenarios WHERE year = 2026 ORDER BY sort_order`;
      for (const s of base) {
        await sql`INSERT INTO budget_scenarios (year, name, amount, color, sort_order) VALUES (${year}, ${s.name}, ${s.amount}, ${s.color}, ${s.sort_order})`;
      }
    }

    const scenarios = await sql`SELECT * FROM budget_scenarios WHERE year = ${year} ORDER BY sort_order`;
    const mbByMonth = await sql`
      SELECT mes_evento, SUM(presupuesto - costo) as mb_real, COUNT(*) as eventos
      FROM events
      WHERE mes_evento IS NOT NULL AND mes_evento != ''
      GROUP BY mes_evento
    `;

    const mbMap = {};
    for (const row of mbByMonth) mbMap[row.mes_evento] = { mb_real: Number(row.mb_real), eventos: Number(row.eventos) };

    const monthly = MONTHS.map(mes => ({
      mes,
      mb_real: mbMap[mes]?.mb_real ?? null,
      eventos: mbMap[mes]?.eventos ?? 0,
    }));

    res.json({ scenarios: scenarios.map(s => ({ ...s, amount: Number(s.amount) })), monthly });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }); }
});

router.put('/scenarios/:id', async (req, res) => {
  if (req.user.role !== 'director') return res.status(403).json({ error: 'Sin permiso para editar escenarios' });
  const { amount, name } = req.body;
  const id = Number(req.params.id);
  if (amount == null || isNaN(amount)) return res.status(400).json({ error: 'Monto inválido' });
  try {
    await sql`UPDATE budget_scenarios SET amount = ${Number(amount)}, name = COALESCE(${name ?? null}, name) WHERE id = ${id}`;
    const updated = (await sql`SELECT * FROM budget_scenarios WHERE id = ${id}`)[0];
    res.json({ ...updated, amount: Number(updated.amount) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }); }
});

router.post('/:year/copy', async (req, res) => {
  if (req.user.role !== 'director') return res.status(403).json({ error: 'Sin permiso' });
  const year = Number(req.params.year);
  const { fromYear } = req.body;
  try {
    await sql`DELETE FROM budget_scenarios WHERE year = ${year}`;
    const base = await sql`SELECT * FROM budget_scenarios WHERE year = ${fromYear || 2026} ORDER BY sort_order`;
    for (const s of base) {
      await sql`INSERT INTO budget_scenarios (year, name, amount, color, sort_order) VALUES (${year}, ${s.name}, ${s.amount}, ${s.color}, ${s.sort_order})`;
    }
    const scenarios = await sql`SELECT * FROM budget_scenarios WHERE year = ${year} ORDER BY sort_order`;
    res.json(scenarios.map(s => ({ ...s, amount: Number(s.amount) })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }); }
});

export default router;
