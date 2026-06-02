import { useEffect, useState } from 'react';
import { getBudget, updateScenario } from '../api';
import { Pencil, Check, X, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const fmtCLP = (n: number | null) =>
  n != null ? `$${Math.round(n).toLocaleString('es-CL')}` : '—';

interface Scenario {
  id: number;
  year: number;
  name: string;
  amount: number;
  color: string;
  sort_order: number;
}

interface MonthRow {
  mes: string;
  mb_real: number | null;
  eventos: number;
}

// Colores por escenario (de menor a mayor)
const SCENARIO_STYLES: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  green:  { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300',  badge: 'bg-green-500'  },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300',   badge: 'bg-blue-500'   },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', badge: 'bg-yellow-400' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', badge: 'bg-orange-500' },
};

// Determina el escenario alcanzado para un valor de MB
function getScenarioReached(mb: number | null, scenarios: Scenario[]): Scenario | null {
  if (mb == null) return null;
  const sorted = [...scenarios].sort((a, b) => b.amount - a.amount);
  return sorted.find(s => mb >= s.amount) ?? null;
}

// Escenario siguiente al alcanzado
function getNextScenario(reached: Scenario | null, scenarios: Scenario[]): Scenario | null {
  const sorted = [...scenarios].sort((a, b) => a.amount - b.amount);
  if (!reached) return sorted[0] ?? null;
  const idx = sorted.findIndex(s => s.id === reached.id);
  return sorted[idx + 1] ?? null;
}

// Agrupar meses en trimestres
const QUARTERS = [
  { label: 'Q1', months: ['Enero', 'Febrero', 'Marzo'] },
  { label: 'Q2', months: ['Abril', 'Mayo', 'Junio'] },
  { label: 'Q3', months: ['Julio', 'Agosto', 'Septiembre'] },
  { label: 'Q4', months: ['Octubre', 'Noviembre', 'Diciembre'] },
];

const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

const SCENARIO_COLORS_HEX: Record<string, string> = {
  green: '#22c55e', blue: '#3b82f6', yellow: '#eab308', orange: '#f97316',
};

export default function BudgetMO() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [monthly, setMonthly] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Edición de escenarios
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getBudget(year);
      setScenarios(data.scenarios);
      setMonthly(data.monthly);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year]);

  const startEdit = (s: Scenario) => {
    setEditId(s.id);
    setEditName(s.name);
    setEditAmount(String(Math.round(s.amount)));
  };

  const saveEdit = async () => {
    if (!editId) return;
    const amount = Number(editAmount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return;
    setSaving(true);
    try {
      const updated = await updateScenario(editId, { amount, name: editName });
      setScenarios(prev => prev.map(s => s.id === editId ? { ...s, ...updated } : s));
      setEditId(null);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => setEditId(null);

  // Totales
  const totalMB = monthly.reduce((sum, m) => sum + (m.mb_real ?? 0), 0);
  const scenarioReachedTotal = getScenarioReached(totalMB, scenarios);

  // ── Gráficos superiores ──────────────────────────────────────────────────
  // 1. MB acumulado a la fecha: suma meses con datos vs escenario × nMeses
  const monthsWithData = monthly.filter(m => m.mb_real != null);
  const nMeses = monthsWithData.length;
  const mbAcumulado = monthsWithData.reduce((s, m) => s + (m.mb_real ?? 0), 0);

  // Comparar acumulado vs escenario × nMeses (umbral proporcional)
  const sortedScenarios = [...scenarios].sort((a, b) => a.amount - b.amount);
  const scenarioAcum = getScenarioReached(
    mbAcumulado,
    sortedScenarios.map(s => ({ ...s, amount: s.amount * nMeses }))
  );
  // Obtener el escenario original correspondiente (mismo id)
  const scenarioAcumOriginal = scenarioAcum
    ? scenarios.find(s => s.id === scenarioAcum.id) ?? null
    : null;

  // 2. Diferencia vs siguiente escenario (proporcional a meses con datos)
  const nextScenario = getNextScenario(scenarioAcumOriginal, scenarios);
  const nextTarget = nextScenario ? nextScenario.amount * nMeses : null;
  const gapToNext = nextTarget != null ? mbAcumulado - nextTarget : null;

  // 3. Datos trimestrales
  const quarterData = QUARTERS.map(q => {
    const mb = q.months.reduce((sum, mes) => {
      const row = monthly.find(m => m.mes === mes);
      return sum + (row?.mb_real ?? 0);
    }, 0);
    const hasSomeData = q.months.some(mes => monthly.find(m => m.mes === mes)?.mb_real != null);
    const reached = hasSomeData ? getScenarioReached(mb, scenarios.map(s => ({ ...s, amount: s.amount * 3 }))) : null;
    const reachedOriginal = reached ? scenarios.find(s => s.id === reached.id) ?? null : null;
    return { label: q.label, mb, color: reachedOriginal ? SCENARIO_COLORS_HEX[reachedOriginal.color] ?? '#94a3b8' : '#e2e8f0', hasSomeData };
  });

  const acumStyle = scenarioAcumOriginal ? SCENARIO_STYLES[scenarioAcumOriginal.color] : null;
  const nextStyle = nextScenario ? SCENARIO_STYLES[nextScenario.color] : null;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header + selector año */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Presupuesto Margen Bruto</h2>
          <p className="text-sm text-gray-500 mt-0.5">MB real mensual vs escenarios presupuestados</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Año:</span>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-brand-400 outline-none"
          >
            {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── 3 gráficos superiores ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Columna izquierda: KPI 1 + KPI 2 */}
        <div className="flex flex-col gap-4">

          {/* KPI 1 — MB Acumulado */}
          <div className={`flex-1 rounded-2xl border p-5 flex flex-col gap-2 ${acumStyle ? `${acumStyle.bg} ${acumStyle.border}` : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className={acumStyle ? acumStyle.text : 'text-gray-400'} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${acumStyle ? acumStyle.text : 'text-gray-400'}`}>
                MB Acumulado ({nMeses} {nMeses === 1 ? 'mes' : 'meses'})
              </span>
            </div>
            <p className={`text-3xl font-bold ${acumStyle ? acumStyle.text : 'text-gray-500'}`}>
              {fmtCLP(mbAcumulado)}
            </p>
            {scenarioAcumOriginal ? (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full text-white w-fit ${acumStyle!.badge}`}>
                ✓ {scenarioAcumOriginal.name}
              </span>
            ) : (
              <span className="inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-600 w-fit">
                Bajo Break Even
              </span>
            )}
          </div>

          {/* KPI 2 — Diferencia vs siguiente escenario */}
          <div className={`flex-1 rounded-2xl border p-5 flex flex-col gap-2 ${nextStyle ? `${nextStyle.bg} ${nextStyle.border}` : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <Target size={16} className={nextStyle ? nextStyle.text : 'text-gray-400'} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${nextStyle ? nextStyle.text : 'text-gray-400'}`}>
                {nextScenario ? `Brecha → ${nextScenario.name}` : 'Escenario máximo alcanzado'}
              </span>
            </div>
            {gapToNext != null ? (
              <>
                <p className={`text-3xl font-bold flex items-center gap-2 ${gapToNext >= 0 ? 'text-green-700' : nextStyle ? nextStyle.text : 'text-gray-700'}`}>
                  {gapToNext >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                  {gapToNext >= 0 ? '+' : ''}{fmtCLP(gapToNext)}
                </p>
                <p className={`text-xs ${nextStyle ? nextStyle.text : 'text-gray-500'}`}>
                  {gapToNext >= 0
                    ? `Superaste el objetivo de ${nextScenario!.name}`
                    : `Faltan ${fmtCLP(Math.abs(gapToNext))} para alcanzar ${nextScenario!.name}`}
                </p>
                <p className="text-xs text-gray-400">
                  Objetivo proporcional: {fmtCLP(nextTarget)} ({nMeses} meses × {fmtCLP(nextScenario!.amount)}/mes)
                </p>
              </>
            ) : (
              <p className="text-xl font-bold text-emerald-700">🏆 Sobre todos los escenarios</p>
            )}
          </div>
        </div>

        {/* Columna derecha — Gráfico Trimestral */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">MB por Trimestre {year}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={quarterData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtM} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
              <Tooltip
                formatter={(v: number) => [fmtCLP(v), 'MB']}
                labelStyle={{ fontWeight: 700 }}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              {/* Líneas de referencia por escenario × 3 meses */}
              {sortedScenarios.map(s => (
                <ReferenceLine
                  key={s.id}
                  y={s.amount * 3}
                  stroke={SCENARIO_COLORS_HEX[s.color] ?? '#94a3b8'}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: s.name, position: 'insideTopRight', fontSize: 9, fill: SCENARIO_COLORS_HEX[s.color] ?? '#94a3b8' }}
                />
              ))}
              <Bar dataKey="mb" radius={[6, 6, 0, 0]}>
                {quarterData.map((q, i) => (
                  <Cell key={i} fill={q.hasSomeData ? q.color : '#e2e8f0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {sortedScenarios.map(s => (
              <span key={s.id} className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-3 h-0.5 inline-block border-t-2 border-dashed" style={{ borderColor: SCENARIO_COLORS_HEX[s.color] }} />
                {s.name} ({fmtM(s.amount * 3)})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Escenarios editables */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Escenarios presupuestados {year}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {scenarios.map(s => {
            const style = SCENARIO_STYLES[s.color] ?? SCENARIO_STYLES.green;
            const isEditing = editId === s.id;
            return (
              <div key={s.id} className={`rounded-xl border p-4 ${style.bg} ${style.border}`}>
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1 outline-none"
                      placeholder="Nombre escenario"
                    />
                    <input
                      value={editAmount}
                      onChange={e => setEditAmount(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1 outline-none font-mono"
                      placeholder="Monto"
                    />
                    <div className="flex gap-1 pt-1">
                      <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1 bg-gray-700 text-white text-xs px-2 py-1 rounded hover:bg-gray-800 disabled:opacity-50">
                        <Check size={11} /> Guardar
                      </button>
                      <button onClick={cancelEdit} className="flex items-center gap-1 border border-gray-300 text-xs px-2 py-1 rounded hover:bg-gray-50">
                        <X size={11} /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-xs font-semibold ${style.text} mb-1`}>{s.name}</p>
                      <p className={`text-base font-bold ${style.text}`}>{fmtCLP(s.amount)}</p>
                    </div>
                    <button
                      onClick={() => startEdit(s)}
                      className={`p-1.5 rounded-lg hover:bg-white/50 ${style.text}`}
                      title="Editar escenario"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabla mensual */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="py-3 px-5 text-left text-xs font-semibold text-gray-500 uppercase">Mes</th>
              <th className="py-3 px-5 text-right text-xs font-semibold text-gray-500 uppercase">MB Real</th>
              {scenarios.map(s => (
                <th key={s.id} className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                  vs {s.name}
                </th>
              ))}
              <th className="py-3 px-5 text-center text-xs font-semibold text-gray-500 uppercase">Escenario</th>
              <th className="py-3 px-5 text-center text-xs font-semibold text-gray-500 uppercase">Eventos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {monthly.map(row => {
              const reached = getScenarioReached(row.mb_real, scenarios);
              const style = reached ? (SCENARIO_STYLES[reached.color] ?? SCENARIO_STYLES.green) : null;

              return (
                <tr key={row.mes} className={`transition-colors ${style ? style.bg : 'hover:bg-gray-50'}`}>
                  <td className={`py-3 px-5 font-semibold ${style ? style.text : 'text-gray-400 italic'}`}>
                    {row.mes}
                  </td>
                  <td className={`py-3 px-5 text-right font-bold text-base ${style ? style.text : 'text-gray-400'}`}>
                    {fmtCLP(row.mb_real)}
                  </td>
                  {scenarios.map(s => {
                    const diff = row.mb_real != null ? row.mb_real - s.amount : null;
                    return (
                      <td key={s.id} className={`py-3 px-4 text-right text-xs font-medium ${diff == null ? 'text-gray-300' : diff >= 0 ? 'text-green-700' : 'text-red-500'}`}>
                        {diff == null ? '—' : `${diff >= 0 ? '+' : ''}${fmtCLP(diff)}`}
                      </td>
                    );
                  })}
                  <td className="py-3 px-5 text-center">
                    {reached ? (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold text-white ${style!.badge}`}>
                        {reached.name}
                      </span>
                    ) : (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
                        {row.mb_real != null ? 'Bajo Break Even' : 'Sin datos'}
                      </span>
                    )}
                  </td>
                  <td className={`py-3 px-5 text-center text-xs ${style ? style.text : 'text-gray-400'}`}>
                    {row.eventos > 0 ? row.eventos : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Total */}
          <tfoot className="border-t-2 border-gray-300 bg-gray-100">
            <tr>
              <td className="py-3 px-5 font-bold text-gray-800">Total Año</td>
              <td className="py-3 px-5 text-right font-bold text-gray-900 text-base">{fmtCLP(totalMB)}</td>
              {scenarios.map(s => {
                const diff = totalMB - s.amount * 12;
                return (
                  <td key={s.id} className={`py-3 px-4 text-right text-xs font-semibold ${diff >= 0 ? 'text-green-700' : 'text-red-500'}`}>
                    {diff >= 0 ? '+' : ''}{fmtCLP(diff)}
                  </td>
                );
              })}
              <td className="py-3 px-5 text-center text-xs text-gray-400">—</td>
              <td className="py-3 px-5 text-center text-xs text-gray-500">
                {monthly.reduce((s, m) => s + m.eventos, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
