import { useEffect, useRef, useState } from 'react';
import { getBudget } from '../api';
import { getStats } from '../api';
import { Download, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';
import type { Stats } from '../types';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const fmtCLP = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;
const fmtM   = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

interface Scenario { id: number; name: string; amount: number; color: string; sort_order: number; }
interface MonthRow  { mes: string; mb_real: number | null; eventos: number; }

const SCENARIO_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  green:  { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
  blue:   { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  yellow: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  orange: { bg: '#ffedd5', text: '#9a3412', dot: '#f97316' },
};

const QUARTERS = [
  { label: 'Q1', months: ['Enero','Febrero','Marzo'] },
  { label: 'Q2', months: ['Abril','Mayo','Junio'] },
  { label: 'Q3', months: ['Julio','Agosto','Septiembre'] },
  { label: 'Q4', months: ['Octubre','Noviembre','Diciembre'] },
];

function getScenarioReached(mb: number | null, scenarios: Scenario[]): Scenario | null {
  if (mb == null) return null;
  return [...scenarios].sort((a, b) => b.amount - a.amount).find(s => mb >= s.amount) ?? null;
}

export default function Report() {
  const year = new Date().getFullYear();
  const today = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [monthly, setMonthly]     = useState<MonthRow[]>([]);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([getBudget(year), getStats()]).then(([b, s]) => {
      setScenarios(b.scenarios);
      setMonthly(b.monthly);
      setStats(s);
    }).finally(() => setLoading(false));
  }, []);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF }   = await import('jspdf');
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.height / canvas.width;
      const imgH = pdfW * ratio;
      if (imgH <= pdfH) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW, imgH);
      } else {
        // Escalar para que quepa en una página
        const scale = pdfH / imgH;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW * scale, pdfH);
      }
      pdf.save(`VíaCorp_Reporte_${year}_${new Date().toISOString().slice(0,10)}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
    </div>
  );

  const kpis = stats!.kpis;
  const monthsWithData = monthly.filter(m => m.mb_real != null);
  const nMeses = monthsWithData.length;
  const mbAcumulado = monthsWithData.reduce((s, m) => s + (m.mb_real ?? 0), 0);
  const sortedScenarios = [...scenarios].sort((a, b) => a.amount - b.amount);
  const scenarioAcum = getScenarioReached(mbAcumulado, sortedScenarios.map(s => ({ ...s, amount: s.amount * nMeses })));
  const scenarioAcumOriginal = scenarioAcum ? scenarios.find(s => s.id === scenarioAcum.id) ?? null : null;
  const nextScenario = scenarioAcumOriginal
    ? sortedScenarios[sortedScenarios.findIndex(s => s.id === scenarioAcumOriginal.id) + 1] ?? null
    : sortedScenarios[0] ?? null;
  const gapToNext = nextScenario ? mbAcumulado - nextScenario.amount * nMeses : null;

  const acumStyle  = scenarioAcumOriginal ? SCENARIO_STYLES[scenarioAcumOriginal.color] : SCENARIO_STYLES.green;
  const nextStyle  = nextScenario ? SCENARIO_STYLES[nextScenario.color] : null;

  // Datos trimestrales
  const quarterData = QUARTERS.map(q => {
    const mb = q.months.reduce((sum, mes) => sum + (monthly.find(m => m.mes === mes)?.mb_real ?? 0), 0);
    const hasSomeData = q.months.some(mes => monthly.find(m => m.mes === mes)?.mb_real != null);
    const reached = hasSomeData ? getScenarioReached(mb, sortedScenarios.map(s => ({ ...s, amount: s.amount * 3 }))) : null;
    const orig = reached ? scenarios.find(s => s.id === reached.id) ?? null : null;
    return { label: q.label, mb, color: orig ? SCENARIO_STYLES[orig.color]?.dot ?? '#94a3b8' : '#e2e8f0', hasSomeData };
  });

  // Top 5 clientes por MB
  const top5 = [...(stats!.clientData)].sort((a, b) => b.mb - a.mb).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Botón descarga */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reporte Ejecutivo</h2>
          <p className="text-sm text-gray-400">Previsualización del PDF — {today}</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 bg-brand-800 hover:bg-brand-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
        >
          <Download size={16} />
          {downloading ? 'Generando PDF...' : 'Descargar PDF'}
        </button>
      </div>

      {/* ── REPORTE (lo que se captura) ── */}
      <div ref={reportRef} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8" style={{ fontFamily: 'system-ui, sans-serif' }}>

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

        {/* Fila 1: KPIs generales */}
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

        {/* Fila 2: MB Acumulado + Brecha + Trimestral */}
        <div className="grid grid-cols-2 gap-4 mb-6">

          {/* Izquierda: MB acumulado + brecha */}
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border p-4 flex-1" style={{ background: acumStyle.bg, borderColor: acumStyle.dot }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: acumStyle.text }}>
                MB Acumulado ({nMeses} meses)
              </p>
              <p className="text-2xl font-bold" style={{ color: acumStyle.text }}>{fmtCLP(mbAcumulado)}</p>
              {scenarioAcumOriginal && (
                <span className="inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: acumStyle.dot }}>
                  ✓ {scenarioAcumOriginal.name}
                </span>
              )}
            </div>
            {nextScenario && gapToNext != null && (
              <div className="rounded-xl border p-4 flex-1" style={{ background: nextStyle?.bg ?? '#f9fafb', borderColor: nextStyle?.dot ?? '#e2e8f0' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: nextStyle?.text ?? '#374151' }}>
                  Brecha → {nextScenario.name}
                </p>
                <p className="text-2xl font-bold" style={{ color: gapToNext >= 0 ? '#166534' : nextStyle?.text ?? '#374151' }}>
                  {gapToNext >= 0 ? '+' : ''}{fmtCLP(gapToNext)}
                </p>
                <p className="text-xs mt-1" style={{ color: nextStyle?.text ?? '#6b7280' }}>
                  {gapToNext >= 0
                    ? `Superado ✓`
                    : `Faltan ${fmtCLP(Math.abs(gapToNext))}`}
                </p>
                <p className="text-xs text-gray-400">
                  Objetivo: {fmtCLP(nextScenario.amount * nMeses)} ({nMeses} meses)
                </p>
              </div>
            )}
          </div>

          {/* Derecha: Gráfico trimestral */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">MB por Trimestre {year}</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={quarterData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtM} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                <Tooltip formatter={(v: number) => [fmtCLP(v), 'MB']} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                {sortedScenarios.map(s => (
                  <ReferenceLine key={s.id} y={s.amount * 3}
                    stroke={SCENARIO_STYLES[s.color]?.dot ?? '#94a3b8'}
                    strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: s.name, position: 'insideTopRight', fontSize: 8, fill: SCENARIO_STYLES[s.color]?.dot }} />
                ))}
                <Bar dataKey="mb" radius={[4, 4, 0, 0]}>
                  {quarterData.map((q, i) => <Cell key={i} fill={q.hasSomeData ? q.color : '#e2e8f0'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fila 3: Tabla mensual + Top clientes */}
        <div className="grid grid-cols-3 gap-4">

          {/* Tabla mensual (2/3) */}
          <div className="col-span-2">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">MB Real por Mes vs Escenarios</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-1.5 px-2 text-left font-semibold text-gray-500">Mes</th>
                  <th className="py-1.5 px-2 text-right font-semibold text-gray-500">MB Real</th>
                  {sortedScenarios.map(s => (
                    <th key={s.id} className="py-1.5 px-2 text-right font-semibold text-gray-500 whitespace-nowrap">vs {s.name}</th>
                  ))}
                  <th className="py-1.5 px-2 text-center font-semibold text-gray-500">Escenario</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map(row => {
                  const reached = getScenarioReached(row.mb_real, scenarios);
                  const style = reached ? SCENARIO_STYLES[reached.color] : null;
                  return (
                    <tr key={row.mes} style={{ background: style?.bg ?? 'transparent' }}>
                      <td className="py-1 px-2 font-semibold" style={{ color: style?.text ?? '#9ca3af' }}>{row.mes}</td>
                      <td className="py-1 px-2 text-right font-bold" style={{ color: style?.text ?? '#9ca3af' }}>
                        {row.mb_real != null ? fmtCLP(row.mb_real) : '—'}
                      </td>
                      {sortedScenarios.map(s => {
                        const diff = row.mb_real != null ? row.mb_real - s.amount : null;
                        return (
                          <td key={s.id} className="py-1 px-2 text-right" style={{ color: diff == null ? '#d1d5db' : diff >= 0 ? '#166534' : '#dc2626' }}>
                            {diff == null ? '—' : `${diff >= 0 ? '+' : ''}${fmtM(diff)}`}
                          </td>
                        );
                      })}
                      <td className="py-1 px-2 text-center">
                        {reached
                          ? <span className="px-1.5 py-0.5 rounded-full text-white text-xs font-semibold" style={{ background: SCENARIO_STYLES[reached.color]?.dot }}>{reached.name}</span>
                          : <span className="text-gray-300 text-xs">{row.mb_real != null ? 'Bajo BE' : '—'}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Top 5 clientes (1/3) */}
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
                      <div
                        className="h-1.5 bg-brand-600 rounded-full"
                        style={{ width: `${(c.mb / top5[0].mb) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Leyenda escenarios */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Escenarios</p>
              {sortedScenarios.map(s => (
                <div key={s.id} className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: SCENARIO_STYLES[s.color]?.dot }} />
                    <span className="text-xs text-gray-600">{s.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{fmtM(s.amount)}/mes</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>{/* fin reportRef */}
    </div>
  );
}
