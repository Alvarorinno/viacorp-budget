import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import type { MonthlyData } from '../../types';

const fmt = (v: number) => `$${(v / 1_000_000).toFixed(0)}M`;

interface Props { data: MonthlyData[] }

export default function MarginByMonth({ data }: Props) {
  const avgMbPct = data.length > 0
    ? data.reduce((s, d) => s + d.mbPct, 0) / data.length
    : 0;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="left" tickFormatter={fmt} tick={{ fontSize: 11 }} width={55} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} width={40} />
        <Tooltip
          formatter={(v: number, name: string) => {
            if (name === 'MB%') return [`${v.toFixed(1)}%`, name];
            return [fmt(v), name];
          }}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="mb" name="Margen Bruto ($)" fill="#059669" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="left" dataKey="facturado" name="Facturado" fill="#6ee7b7" radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="mbPct" name="MB%" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 4 }} />
        <ReferenceLine yAxisId="right" y={avgMbPct} stroke="#dc2626" strokeDasharray="4 4" label={{ value: `Prom. ${avgMbPct.toFixed(1)}%`, fontSize: 11, fill: '#dc2626' }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
