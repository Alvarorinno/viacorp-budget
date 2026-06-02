import { Router } from 'express';
import { Resend } from 'resend';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

// POST /api/report/email
router.post('/email', async (req, res) => {
  if (req.user.role !== 'director') return res.status(403).json({ error: 'Sin permiso' });

  const { to, pdfBase64, filename } = req.body;
  if (!to || !pdfBase64) return res.status(400).json({ error: 'Faltan datos: to y pdfBase64 son requeridos' });

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Servicio de correo no configurado (RESEND_API_KEY).' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  const today = new Date().toLocaleDateString('es-CL');
  const safeFilename = filename || `VíaCorp_Reporte_${today.replace(/\//g, '-')}.pdf`;

  try {
    const { error } = await resend.emails.send({
      from:    'VíaCorp Reporte <onboarding@resend.dev>',
      to:      [to],
      subject: `Reporte Ejecutivo VíaCorp — ${today}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
          <div style="background:#1e3a5f;padding:24px 32px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">VíaCorp</h1>
            <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">Control Presupuesto Fauna BTL</p>
          </div>
          <div style="background:#f9fafb;padding:24px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
            <p style="margin:0 0 12px">Hola,</p>
            <p style="margin:0 0 12px">Adjunto encontrarás el <strong>Reporte Ejecutivo</strong> generado el <strong>${today}</strong>.</p>
            <p style="margin:0 0 24px">Incluye resumen de presupuesto, margen bruto acumulado, comparación de escenarios y desempeño trimestral.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px"/>
            <p style="margin:0;font-size:12px;color:#9ca3af">Enviado desde VíaCorp — Control Presupuesto Fauna BTL</p>
          </div>
        </div>
      `,
      attachments: [{
        filename:    safeFilename,
        content:     pdfBuffer.toString('base64'),
      }],
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: error.message || 'Error al enviar el correo.' });
    }

    res.json({ ok: true, message: `Reporte enviado a ${to}` });
  } catch (err) {
    console.error('Error enviando email:', err);
    res.status(500).json({ error: 'No se pudo enviar el correo.' });
  }
});

export default router;
