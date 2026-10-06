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
app.get('/api/setup/create-lucia', async (req, res) => {
  if (req.query.secret !== 'setup_lucia_2026') return res.status(403).json({ error: 'Forbidden' });
  try {
    const { default: sql } = await import('./db.js');
    await sql`INSERT INTO users (username, password, role, nombre)
      VALUES ('lucia', 'LU123', 'eventos', 'Lucia')
      ON CONFLICT (username) DO UPDATE SET password = 'LU123', role = 'eventos', nombre = 'Lucia'`;
    const users = await sql`SELECT id, username, role, nombre FROM users ORDER BY id`;
    res.json({ ok: true, users });
  } catch (err) { res.status(500).json({ error: String(err) }); }
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
