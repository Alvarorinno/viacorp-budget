import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// GET /api/budget/:year — escenarios + MB real por mes
router.get('/:year', (req, res) => {
  if (!['director', 'viewer'].includes(req.user.role)) return res.status(403).json({ error: 'Sin permiso' });

  const year = Number(req.params.year);

  // Si no existen escenarios para este año, copiar desde 2026 (o crear vacíos)
  const count = db.prepare('SELECT COUNT(*) as n FROM budget_scenarios WHERE year = ?').get(year);
  if (count.n === 0) {
    const base = db.prepare('SELECT * FROM budget_scenarios WHERE year = 2026 ORDER BY sort_order').all();
    const ins = db.prepare(`INSERT INTO budget_scenarios (year, name, amount, color, sort_order) VALUES (?, ?, ?, ?, ?)`);
    db.exec('BEGIN');
    for (const s of base) ins.run(year, s.name, s.amount, s.color, s.sort_order);
    db.exec('COMMIT');
  }

  const scenarios = db.prepare('SELECT * FROM budget_scenarios WHERE year = ? ORDER BY sort_order').all(year);

  // MB real por mes (todos los eventos del año filtrados por mes_evento)
  const mbByMonth = db.prepare(`
    SELECT mes_evento, SUM(presupuesto - costo) as mb_real, COUNT(*) as eventos
    FROM events
    WHERE mes_evento IS NOT NULL AND mes_evento != ''
    GROUP BY mes_evento
  `).all();

  // Convertir a mapa mes → datos
  const mbMap = {};
  for (const row of mbByMonth) mbMap[row.mes_evento] = { mb_real: row.mb_real, eventos: row.eventos };

  // Construir tabla mensual ordenada
  const monthly = MONTHS.map(mes => ({
    mes,
    mb_real: mbMap[mes]?.mb_real ?? null,
    eventos: mbMap[mes]?.eventos ?? 0,
  }));

  res.json({ scenarios, monthly });
});

// PUT /api/budget/scenarios/:id — editar monto de un escenario
router.put('/scenarios/:id', (req, res) => {
  if (!['director'].includes(req.user.role)) return res.status(403).json({ error: 'Sin permiso para editar escenarios' });
  const { amount, name } = req.body;
  const id = Number(req.params.id);
  if (amount == null || isNaN(amount)) return res.status(400).json({ error: 'Monto inválido' });

  db.prepare('UPDATE budget_scenarios SET amount = ?, name = COALESCE(?, name) WHERE id = ?')
    .run(Number(amount), name ?? null, id);

  const updated = db.prepare('SELECT * FROM budget_scenarios WHERE id = ?').get(id);
  res.json(updated);
});

// POST /api/budget/:year/copy — copiar escenarios a un nuevo año
router.post('/:year/copy', (req, res) => {
  if (req.user.role !== 'director') return res.status(403).json({ error: 'Sin permiso' });
  const year = Number(req.params.year);
  const { fromYear } = req.body;

  db.prepare('DELETE FROM budget_scenarios WHERE year = ?').run(year);
  const base = db.prepare('SELECT * FROM budget_scenarios WHERE year = ? ORDER BY sort_order').all(fromYear || 2026);
  const ins = db.prepare(`INSERT INTO budget_scenarios (year, name, amount, color, sort_order) VALUES (?, ?, ?, ?, ?)`);
  db.exec('BEGIN');
  for (const s of base) ins.run(year, s.name, s.amount, s.color, s.sort_order);
  db.exec('COMMIT');

  const scenarios = db.prepare('SELECT * FROM budget_scenarios WHERE year = ? ORDER BY sort_order').all(year);
  res.json(scenarios);
});

export default router;
