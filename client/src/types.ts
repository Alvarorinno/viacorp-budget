export interface Event {
  id: number;
  estimacion: string | null;
  cliente: string;
  descripcion: string | null;
  presupuesto: number;
  costo: number;
  mb: number;
  factura: string | null;
  fecha_facturacion: string | null;
  mes_evento: string | null;
  mes_facturacion: string | null;
  por_cobrar: string | null;
  estado_pago: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  username: string;
  role: 'director' | 'finanzas' | 'viewer';
  nombre: string;
}

export interface KPIs {
  totalPresupuesto: number;
  totalCosto: number;
  totalMB: number;
  mbPct: number;
  totalFacturado: number;
  pendienteFacturar: number;
  totalEventos: number;
}

export interface MonthlyData {
  mes: string;
  presupuesto: number;
  costo: number;
  mb: number;
  facturado: number;
  mbPct: number;
  count: number;
}

export interface ClientData {
  cliente: string;
  presupuesto: number;
  mb: number;
  count: number;
  pct: number;
}

export interface Stats {
  kpis: KPIs;
  monthlyData: MonthlyData[];
  clientData: ClientData[];
  billingStatus: { conFactura: number; sinFactura: number };
}
