import { useEffect, useRef, useState } from 'react';
import { getStats, getBudget } from '../api';
import type { Stats } from '../types';
import SalesByClientPie from '../components/charts/SalesByClientPie';
import SalesByMonthLine from '../components/charts/SalesByMonthLine';
import MarginByMonth from '../components/charts/MarginByMonth';
import BillingStatusChart from '../components/charts/BillingStatusChart';
import FacturadoVsPresupuesto from '../components/charts/FacturadoVsPresupuesto';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp, DollarSign, BarChart2, Receipt, AlertCircle, Layers, FileDown, X, Download, Building2, Mail, CheckCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts';
import { sendReportByEmail } from '../api';

const fmt  = (n: number) => `$${n.toLocaleString('es-CL')}`;
const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const fmtCLP = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;

// ── Reporte ──────────────────────────────────────────────────────────────────
interface Scenario { id: number; name: string; amount: number; color: string; sort_order: number; }
interface MonthRow  { mes: string; mb_real: number | null; eventos: number; }

const QUARTERS = [
  { label: 'Q1', months: ['Enero','Febrero','Marzo'] },
  { label: 'Q2', months: ['Abril','Mayo','Junio'] },
  { label: 'Q3', months: ['Julio','Agosto','Septiembre'] },
  { label: 'Q4', months: ['Octubre','Noviembre','Diciembre'] },
];
const SC_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  green:  { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
  blue:   { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  yellow: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  orange: { bg: '#ffedd5', text: '#9a3412', dot: '#f97316' },
};
function scenarioReached(mb: number | null, scenarios: Scenario[]): Scenario | null {
  if (mb == null) return null;
  return [...scenarios].sort((a, b) => b.amount - a.amount).find(s => mb >= s.amount) ?? null;
}

function ReportModal({ onClose, stats }: { onClose: () => void; stats: Stats }) {
  const year = new Date().getFullYear();
  const today = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
  const reportRef = useRef<HTMLDivElement>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [monthly, setMonthly]     = useState<MonthRow[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [sendMode, setSendMode]   = useState<'idle' | 'email'>('idle');
  const [emailTo, setEmailTo]     = useState('');
  const [sending, setSending]     = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loadingB, setLoadingB]   = useState(true);

  useEffect(() => {
    getBudget(year).then(d => { setScenarios(d.scenarios); setMonthly(d.monthly); }).finally(() => setLoadingB(false));
  }, []);

  const filename = `VíaCorp_Reporte_${year}_${new Date().toISOString().slice(0,10)}.pdf`;

  const generatePdfBase64 = async (): Promise<{ base64: string; blob: Blob } | null> => {
    if (!reportRef.current) return null;
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const el = reportRef.current;
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: el.scrollWidth,
      height: el.scrollHeight,
      windowWidth: el.scrollWidth,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();   // 210mm
    const pdfH = pdf.internal.pageSize.getHeight();  // 297mm
    const ratio = canvas.height / canvas.width;
    const imgH = pdfW * ratio;
    // Escalar manteniendo proporción para que quepa en una sola página
    if (imgH <= pdfH) {
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, imgH);
    } else {
      // Escalar por alto: mantiene aspect ratio centrado horizontalmente
      const scaledW = pdfH / ratio;
      const x = (pdfW - scaledW) / 2;
      pdf.addImage(imgData, 'PNG', x, 0, scaledW, pdfH);
    }
    const blob = pdf.output('blob');
    const base64 = pdf.output('datauristring').split(',')[1];
    return { base64, blob };
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const result = await generatePdfBase64();
      if (!result) return;
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim()) return;
    setSending(true); setSendResult(null);
    try {
      const result = await generatePdfBase64();
      if (!result) return;
      await sendReportByEmail({ to: emailTo.trim(), pdfBase64: result.base64, filename });
      setSendResult({ ok: true, msg: `✓ Reporte enviado a ${emailTo.trim()}` });
      setEmailTo('');
      setSendMode('idle');
    } catch (err: any) {
      setSendResult({ ok: false, msg: err?.response?.data?.error || 'Error al enviar el correo.' });
    } finally { setSending(false); }
  };

  const kpis = stats.kpis;
  const sortedSc = [...scenarios].sort((a, b) => a.amount - b.amount);
  const mwData = monthly.filter(m => m.mb_real != null);
  const nMeses = mwData.length;
  const mbAcum = mwData.reduce((s, m) => s + (m.mb_real ?? 0), 0);
  const scAcum = scenarioReached(mbAcum, sortedSc.map(s => ({ ...s, amount: s.amount * nMeses })));
  const scAcumOrig = scAcum ? scenarios.find(s => s.id === scAcum.id) ?? null : null;
  const nextSc = scAcumOrig ? sortedSc[sortedSc.findIndex(s => s.id === scAcumOrig.id) + 1] ?? null : sortedSc[0] ?? null;
  const gapToNext = nextSc ? mbAcum - nextSc.amount * nMeses : null;
  const acumStyle = scAcumOrig ? SC_STYLES[scAcumOrig.color] : SC_STYLES.green;
  const nextStyle = nextSc ? SC_STYLES[nextSc.color] : null;
  const top5 = [...stats.clientData].sort((a, b) => b.mb - a.mb).slice(0, 5);
  const quarterData = QUARTERS.map(q => {
    const mb = q.months.reduce((sum, mes) => sum + (monthly.find(m => m.mes === mes)?.mb_real ?? 0), 0);
    const has = q.months.some(mes => monthly.find(m => m.mes === mes)?.mb_real != null);
    const r = has ? scenarioReached(mb, sortedSc.map(s => ({ ...s, amount: s.amount * 3 }))) : null;
    const o = r ? scenarios.find(s => s.id === r.id) ?? null : null;
    return { label: q.label, mb, color: o ? SC_STYLES[o.color]?.dot ?? '#94a3b8' : '#e2e8f0', has };
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-gray-100 rounded-2xl w-full max-w-3xl my-4 shadow-2xl">
        {/* Barra superior del modal */}
        <div className="flex items-center justify-between px-6 py-4 bg-white rounded-t-2xl border-b border-gray-200">
          <div>
            <h2 className="text-base font-bold text-gray-900">Reporte Ejecutivo</h2>
            <p className="text-xs text-gray-400">{today} — previsualización PDF</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">

            {/* Resultado envío */}
            {sendResult && (
              <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ${sendResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {sendResult.ok && <CheckCircle size={13} />}
                {sendResult.msg}
              </span>
            )}

            {/* Modo email: input + botón enviar */}
            {sendMode === 'email' && (
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
                  placeholder="correo@ejemplo.com"
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-52 outline-none focus:ring-2 focus:ring-brand-400"
                  autoFocus
                />
                <button onClick={handleSendEmail} disabled={sending || loadingB || !emailTo.trim()}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50">
                  <Mail size={13} />
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
                <button onClick={() => { setSendMode('idle'); setEmailTo(''); setSendResult(null); }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">
                  Cancelar
                </button>
              </div>
            )}

            {/* Botones principales */}
            {sendMode === 'idle' && (
              <>
                <button onClick={handleDownload} disabled={downloading || loadingB}
                  className="flex items-center gap-1.5 bg-brand-800 hover:bg-brand-900 text-white px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50">
                  <Download size={13} />
                  {downloading ? 'Generando...' : 'Descargar PDF'}
                </button>
                <button onClick={() => { setSendMode('email'); setSendResult(null); }} disabled={loadingB}
                  className="flex items-center gap-1.5 border border-gray-300 hover:border-emerald-400 hover:text-emerald-700 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50">
                  <Mail size={13} />
                  Enviar por mail
                </button>
              </>
            )}

            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 ml-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Contenido del reporte */}
        <div className="p-4">
          {loadingB ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
            </div>
          ) : (
            <div ref={reportRef} className="bg-white rounded-xl p-8" style={{ fontFamily: 'system-ui, sans-serif', width: '720px', minWidth: '720px' }}>

              {/* Encabezado */}
              <div className="flex items-center justify-between pb-5 border-b border-gray-200 mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-800 p-2.5 rounded-xl">
                    <Building2 size={22} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">VíaCorp</h1>
                    <p className="text-xs text-gray-500">Control Presupuesto Fauna BTL</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">Reporte Ejecutivo {year}</p>
                  <p className="text-xs text-gray-400">{today}</p>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Presupuesto Total', value: fmtCLP(kpis.totalPresupuesto), sub: `${kpis.totalEventos} eventos` },
                  { label: 'Costo Total',       value: fmtCLP(kpis.totalCosto),        sub: 'acumulado año' },
                  { label: 'MB Total',          value: fmtCLP(kpis.totalMB),           sub: `${kpis.mbPct.toFixed(1)}% del presupuesto` },
                  { label: 'Facturado',         value: fmtCLP(kpis.totalFacturado),    sub: `Pendiente: ${fmtCLP(kpis.pendienteFacturar)}` },
                ].map(k => (
                  <div key={k.label} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">{k.label}</p>
                    <p className="text-lg font-bold text-gray-900">{k.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
                  </div>
                ))}
              </div>

              {/* MB Acumulado + Brecha + Trimestral */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex flex-col gap-3">
                  <div className="flex-1 rounded-xl border p-4" style={{ background: acumStyle.bg, borderColor: acumStyle.dot }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: acumStyle.text }}>MB Acumulado ({nMeses} meses)</p>
                    <p className="text-2xl font-bold" style={{ color: acumStyle.text }}>{fmtCLP(mbAcum)}</p>
                    {scAcumOrig && <span className="inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: acumStyle.dot }}>✓ {scAcumOrig.name}</span>}
                  </div>
                  {nextSc && gapToNext != null && (
                    <div className="flex-1 rounded-xl border p-4" style={{ background: nextStyle?.bg ?? '#f9fafb', borderColor: nextStyle?.dot ?? '#e2e8f0' }}>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: nextStyle?.text ?? '#374151' }}>Brecha → {nextSc.name}</p>
                      <p className="text-2xl font-bold" style={{ color: gapToNext >= 0 ? '#166534' : nextStyle?.text ?? '#374151' }}>
                        {gapToNext >= 0 ? '+' : ''}{fmtCLP(gapToNext)}
                      </p>
                      <p className="text-xs mt-1" style={{ color: nextStyle?.text ?? '#6b7280' }}>
                        {gapToNext >= 0 ? 'Superado ✓' : `Faltan ${fmtCLP(Math.abs(gapToNext))}`}
                      </p>
                      <p className="text-xs text-gray-400">Objetivo: {fmtCLP(nextSc.amount * nMeses)} ({nMeses} meses)</p>
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">MB por Trimestre {year}</p>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <BarChart width={320} height={160} data={quarterData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtM} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip formatter={(v: number) => [fmtCLP(v), 'MB']} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                      {sortedSc.map(s => (
                        <ReferenceLine key={s.id} y={s.amount * 3} stroke={SC_STYLES[s.color]?.dot ?? '#94a3b8'} strokeDasharray="4 3" strokeWidth={1.5} />
                      ))}
                      <Bar dataKey="mb" radius={[4, 4, 0, 0]}>
                        {quarterData.map((q, i) => <Cell key={i} fill={q.has ? q.color : '#e2e8f0'} />)}
                      </Bar>
                    </BarChart>
                  </div>
                  {/* Leyenda líneas de referencia */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {sortedSc.map(s => (
                      <span key={s.id} className="flex items-center gap-1" style={{ fontSize: '9px', color: '#6b7280' }}>
                        <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: SC_STYLES[s.color]?.dot }} />
                        {s.name} ({fmtM(s.amount * 3)})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tabla mensual + Top clientes */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">MB Real por Mes vs Escenarios</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="py-1.5 px-3 text-left font-semibold text-gray-500">Mes</th>
                        <th className="py-1.5 px-3 text-right font-semibold text-gray-500">MB Real</th>
                        <th className="py-1.5 px-3 text-center font-semibold text-gray-500">Escenario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.map(row => {
                        const r = scenarioReached(row.mb_real, scenarios);
                        const st = r ? SC_STYLES[r.color] : null;
                        return (
                          <tr key={row.mes} style={{ background: st?.bg ?? 'transparent' }}>
                            <td className="py-1.5 px-3 font-semibold" style={{ color: st?.text ?? '#9ca3af' }}>{row.mes}</td>
                            <td className="py-1.5 px-3 text-right font-bold" style={{ color: st?.text ?? '#9ca3af' }}>
                              {row.mb_real != null ? fmtCLP(row.mb_real) : '—'}
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              {r
                                ? <span className="px-2 py-0.5 rounded-full text-white text-xs font-semibold" style={{ background: SC_STYLES[r.color]?.dot }}>{r.name}</span>
                                : <span className="text-xs text-gray-300">{row.mb_real != null ? 'Bajo BE' : '—'}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Top 5 Clientes por MB</p>
                  <div className="space-y-2">
                    {top5.map((c, i) => (
                      <div key={c.cliente} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs font-semibold text-gray-700 truncate max-w-[100px]">{c.cliente}</span>
                            <span className="text-xs font-bold text-gray-900">{fmtM(c.mb)}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                            <div className="h-1.5 bg-brand-600 rounded-full" style={{ width: `${(c.mb / top5[0].mb) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Escenarios</p>
                    {sortedSc.map(s => (
                      <div key={s.id} className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: SC_STYLES[s.color]?.dot }} />
                          <span className="text-xs text-gray-600">{s.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-700">{fmtM(s.amount)}/mes</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

function KpiCard({ label, value, sub, icon, color, bg }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`${bg} p-3 rounded-xl`}>{icon}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    getStats().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!stats) return <p className="text-red-500">Error al cargar estadísticas</p>;

  const { kpis, monthlyData, clientData, billingStatus } = stats;

  return (
    <div className="space-y-6">
      {/* Modal reporte */}
      {showReport && <ReportModal onClose={() => setShowReport(false)} stats={stats!} />}

      {/* Botón Generar Reporte (solo Director) */}
      {user?.role === 'director' && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:border-brand-400 hover:text-brand-700 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            <FileDown size={15} />
            Generar Reporte PDF
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Total Presupuesto"
          value={fmtM(kpis.totalPresupuesto)}
          sub={fmt(kpis.totalPresupuesto)}
          icon={<DollarSign size={20} className="text-blue-600" />}
          color="text-blue-700"
          bg="bg-blue-50"
        />
        <KpiCard
          label="Total Costo"
          value={fmtM(kpis.totalCosto)}
          sub={fmt(kpis.totalCosto)}
          icon={<Layers size={20} className="text-slate-600" />}
          color="text-slate-700"
          bg="bg-slate-50"
        />
        <KpiCard
          label="Margen Bruto"
          value={fmtM(kpis.totalMB)}
          sub={`MB% ${kpis.mbPct.toFixed(1)}%`}
          icon={<TrendingUp size={20} className="text-emerald-600" />}
          color="text-emerald-700"
          bg="bg-emerald-50"
        />
        <KpiCard
          label="MB%"
          value={`${kpis.mbPct.toFixed(1)}%`}
          sub="Promedio 2026"
          icon={<BarChart2 size={20} className="text-amber-600" />}
          color="text-amber-700"
          bg="bg-amber-50"
        />
        <KpiCard
          label="Total Facturado"
          value={fmtM(kpis.totalFacturado)}
          sub={`${kpis.totalEventos} eventos`}
          icon={<Receipt size={20} className="text-violet-600" />}
          color="text-violet-700"
          bg="bg-violet-50"
        />
        <KpiCard
          label="Pdte. Facturar"
          value={fmtM(kpis.pendienteFacturar)}
          sub={`${billingStatus.sinFactura} sin factura`}
          icon={<AlertCircle size={20} className="text-orange-500" />}
          color="text-orange-600"
          bg="bg-orange-50"
        />
      </div>

      {/* Row 1: Ventas por mes + Estado facturación */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ChartCard title="Presupuesto vs Costo por Mes — con MB%">
            <SalesByMonthLine data={monthlyData} />
          </ChartCard>
        </div>
        <ChartCard title="Estado de Facturación (N° Eventos)">
          <BillingStatusChart
            conFactura={billingStatus.conFactura}
            sinFactura={billingStatus.sinFactura}
          />
        </ChartCard>
      </div>

      {/* Row 2: Pie clientes + MB por mes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="% Venta por Cliente">
          <SalesByClientPie data={clientData} />
        </ChartCard>
        <ChartCard title="Margen Bruto por Mes — con MB%">
          <MarginByMonth data={monthlyData} />
        </ChartCard>
      </div>

      {/* Row 3: Facturado vs Presupuesto + Top clientes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Facturado vs Presupuesto por Mes">
          <FacturadoVsPresupuesto data={monthlyData} />
        </ChartCard>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Ranking de Clientes por Venta</h3>
          <div className="space-y-3">
            {clientData.slice(0, 8).map((c, i) => (
              <div key={c.cliente}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span className="font-medium">{i + 1}. {c.cliente}</span>
                  <span>{fmtM(c.presupuesto)} — <span className="text-emerald-600">MB {(c.mb / c.presupuesto * 100).toFixed(1)}%</span></span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600 rounded-full transition-all duration-500"
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Tabla resumen mensual */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Resumen Mensual</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Mes</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Presupuesto</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Costo</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">MB $</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">MB %</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Facturado</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">N°</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map(m => (
                <tr key={m.mes} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-gray-700">{m.mes}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{fmtM(m.presupuesto)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-500">{fmtM(m.costo)}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-600 font-medium">{fmtM(m.mb)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      m.mbPct >= 40 ? 'bg-emerald-100 text-emerald-700' :
                      m.mbPct >= 30 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {m.mbPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-violet-600">{fmtM(m.facturado)}</td>
                  <td className="py-2.5 px-3 text-right text-orange-500">{fmtM(m.presupuesto - m.facturado)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-500">{m.count}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="py-2.5 px-3 text-gray-700">TOTAL</td>
                <td className="py-2.5 px-3 text-right text-blue-700">{fmtM(kpis.totalPresupuesto)}</td>
                <td className="py-2.5 px-3 text-right text-gray-600">{fmtM(kpis.totalCosto)}</td>
                <td className="py-2.5 px-3 text-right text-emerald-700">{fmtM(kpis.totalMB)}</td>
                <td className="py-2.5 px-3 text-right">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    {kpis.mbPct.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right text-violet-700">{fmtM(kpis.totalFacturado)}</td>
                <td className="py-2.5 px-3 text-right text-orange-600">{fmtM(kpis.pendienteFacturar)}</td>
                <td className="py-2.5 px-3 text-right text-gray-700">{kpis.totalEventos}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
