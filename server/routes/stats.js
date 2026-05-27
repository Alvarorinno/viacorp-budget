import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

const MONTH_ORDER = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

router.get('/', (req, res) => {
  const events = db.prepare('SELECT *, (presupuesto - costo) as mb FROM events').all().map(r => ({ ...r }));

  const totalPresupuesto = events.reduce((s, e) => s + (e.presupuesto || 0), 0);
  const totalCosto = events.reduce((s, e) => s + (e.costo || 0), 0);
  const totalMB = totalPresupuesto - totalCosto;
  const mbPct = totalPresupuesto > 0 ? (totalMB / totalPresupuesto) * 100 : 0;

  const totalFacturado = events.filter(e => e.factura).reduce((s, e) => s + (e.presupuesto || 0), 0);
  const pendienteFacturar = totalPresupuesto - totalFacturado;

  const byMonth = {};
  for (const e of events) {
    const m = e.mes_evento || 'Sin mes';
    if (!byMonth[m]) byMonth[m] = { mes: m, presupuesto: 0, costo: 0, mb: 0, facturado: 0, count: 0 };
    byMonth[m].presupuesto += e.presupuesto || 0;
    byMonth[m].costo += e.costo || 0;
    byMonth[m].mb += e.mb || 0;
    if (e.factura) byMonth[m].facturado += e.presupuesto || 0;
    byMonth[m].count += 1;
  }
  const monthlyData = MONTH_ORDER
    .filter(m => byMonth[m])
    .map(m => ({ ...byMonth[m], mbPct: byMonth[m].presupuesto > 0 ? (byMonth[m].mb / byMonth[m].presupuesto) * 100 : 0 }));

  const byClient = {};
  for (const e of events) {
    const c = e.cliente || 'Sin cliente';
    if (!byClient[c]) byClient[c] = { cliente: c, presupuesto: 0, mb: 0, count: 0 };
    byClient[c].presupuesto += e.presupuesto || 0;
    byClient[c].mb += e.mb || 0;
    byClient[c].count += 1;
  }
  const clientData = Object.values(byClient)
    .sort((a, b) => b.presupuesto - a.presupuesto)
    .map(c => ({ ...c, pct: totalPresupuesto > 0 ? (c.presupuesto / totalPresupuesto) * 100 : 0 }));

  res.json({
    kpis: { totalPresupuesto, totalCosto, totalMB, mbPct, totalFacturado, pendienteFacturar, totalEventos: events.length },
    monthlyData,
    clientData,
    billingStatus: { conFactura: events.filter(e => e.factura).length, sinFactura: events.filter(e => !e.factura).length }
  });
});

export default router;
