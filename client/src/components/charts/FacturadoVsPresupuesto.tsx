import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { MonthlyData } from '../../types';

const fmt = (v: number) => `$${(v / 1_000_000).toFixed(0)}M`;

interface Props { data: MonthlyData[] }

export default function FacturadoVsPresupuesto({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={55} />
        <Tooltip
          formatter={(v: number, name) => [fmt(v), name]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="presupuesto" name="Presupuesto" fill="#1e40af" radius={[4, 4, 0, 0]} />
        <Bar dataKey="facturado" name="Facturado" fill="#34d399" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
