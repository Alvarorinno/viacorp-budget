import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';
import statsRouter from './routes/stats.js';
import budgetRouter from './routes/budget.js';
import reportRouter from './routes/report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
const isVercel = !!process.env.VERCEL;

if (!isVercel) {
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
  }));
}

app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/budget', budgetRouter);
app.use('/api/report', reportRouter);
app.get('/api/setup/unify-pyg', async (req, res) => {
  if (req.query.secret !== 'e02e52ef027b115a816c41e43eed45eb') return res.status(403).json({ error: 'Forbidden' });
  try {
    const { default: sql } = await import('./db.js');
    const changed = await sql`UPDATE events SET cliente = 'PYG', updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      WHERE regexp_replace(upper(cliente), '[^A-Z&]', '', 'g') IN ('PYG', 'P&G') AND cliente <> 'PYG'
      RETURNING id, estimacion, mes_evento`;
    const total = await sql`SELECT COUNT(*) AS n FROM events WHERE cliente = 'PYG'`;
    res.json({ ok: true, changed, totalPYG: Number(total[0].n) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }); }
});
app.get('/api/health', (_, res) => res.json({ ok: true, platform: isVercel ? 'vercel' : 'local' }));

if (isProd && !isVercel) {
  const distPath = join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
}

if (!isVercel) {
  app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
}

export default app;
