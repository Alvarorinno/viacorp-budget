import { useEffect, useState } from 'react';
import { getStats } from '../api';
import type { Stats } from '../types';
import SalesByClientPie from '../components/charts/SalesByClientPie';
import SalesByMonthLine from '../components/charts/SalesByMonthLine';
import MarginByMonth from '../components/charts/MarginByMonth';
import BillingStatusChart from '../components/charts/BillingStatusChart';
import FacturadoVsPresupuesto from '../components/charts/FacturadoVsPresupuesto';
import {
  TrendingUp, DollarSign, BarChart2, Receipt, AlertCircle, Layers
} from 'lucide-react';

const fmt = (n: number) => `$${n.toLocaleString('es-CL')}`;
const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

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
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

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
