import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ClientData } from '../../types';

const COLORS = [
  '#1e40af','#0891b2','#059669','#d97706','#dc2626',
  '#7c3aed','#db2777','#65a30d','#ea580c','#0284c7',
  '#6d28d9','#be185d','#15803d','#b45309'
];

const fmt = (v: number) => `$${(v / 1_000_000).toFixed(1)}M`;

interface Props { data: ClientData[] }

const CustomLabel = ({ cx, cy, midAngle, outerRadius, pct }: any) => {
  if (pct < 3) return null;
  const RADIAN = Math.PI / 180;
  const r = outerRadius + 20;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {`${pct.toFixed(1)}%`}
    </text>
  );
};

export default function SalesByClientPie({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={110}
          innerRadius={50}
          dataKey="presupuesto"
          nameKey="cliente"
          labelLine={false}
          label={CustomLabel}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number, name) => [fmt(v), name]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend
          formatter={(value, entry: any) => (
            <span style={{ fontSize: 11, color: '#374151' }}>
              {value} ({entry.payload.pct?.toFixed(1)}%)
            </span>
          )}
          iconSize={10}
          wrapperStyle={{ paddingTop: 8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
