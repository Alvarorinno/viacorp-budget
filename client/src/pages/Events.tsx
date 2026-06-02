import { useEffect, useState, useMemo } from 'react';
import { getEvents, updateEvent, createEvent, deleteEvent } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Event } from '../types';
import { Plus, Pencil, Trash2, Check, X, Search, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fmtCLP = (n: number | null) => n != null ? `$${n.toLocaleString('es-CL')}` : '—';
const fmtDate = (s: string | null) => {
  if (!s) return '—';
  const dateOnly = s.split('T')[0].split(' ')[0]; // Soporta "YYYY-MM-DD" y "YYYY-MM-DD HH:MM:SS"
  const d = new Date(dateOnly + 'T12:00:00');
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('es-CL');
};
const mbPct = (e: Event) => e.presupuesto > 0 ? ((e.mb / e.presupuesto) * 100).toFixed(1) + '%' : '—';

// Deriva el mes en español desde una fecha string "YYYY-MM-DD"
const getMesFromDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const dateOnly = dateStr.split('T')[0].split(' ')[0];
  const d = new Date(dateOnly + 'T12:00:00');
  return isNaN(d.getTime()) ? '' : MONTHS[d.getMonth()];
};

// Muestra el mes de facturación: prioriza el calculado desde la fecha
const mesFact = (e: Event) =>
  e.fecha_facturacion ? getMesFromDate(e.fecha_facturacion) : (e.mes_facturacion || '—');

const EMPTY: Partial<Event> = {
  estimacion: '', cliente: '', descripcion: '', presupuesto: 0, costo: 0,
  mes_evento: 'Enero', factura: '', fecha_facturacion: '', mes_facturacion: '', estado_pago: ''
};

type SortKey = keyof Event;

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Event>>({});
  const [showNew, setShowNew] = useState(false);
  const [newData, setNewData] = useState<Partial<Event>>(EMPTY);
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'mes_evento', dir: 'asc' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editError, setEditError] = useState('');

  const isDirector = user?.role === 'director';
  const isFinance  = user?.role === 'finanzas';

  const load = () => getEvents().then(setEvents).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const clients = useMemo(() => [...new Set(events.map(e => e.cliente))].sort(), [events]);

  const filtered = useMemo(() => {
    let data = events.filter(e => {
      const term = search.toLowerCase();
      return (!term || e.cliente.toLowerCase().includes(term) || (e.descripcion || '').toLowerCase().includes(term) || (e.estimacion || '').includes(term))
        && (!filterMonth || e.mes_evento === filterMonth)
        && (!filterClient || e.cliente === filterClient);
    });
    data = [...data].sort((a, b) => {
      // Para columnas de mes, ordenar por orden calendario en vez de alfabético
      if (sort.key === 'mes_evento' || sort.key === 'mes_facturacion') {
        const ai = MONTHS.indexOf(String(a[sort.key] ?? ''));
        const bi = MONTHS.indexOf(String(b[sort.key] ?? ''));
        const cmp = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        return sort.dir === 'asc' ? cmp : -cmp;
      }
      const av = a[sort.key] ?? '';
      const bv = b[sort.key] ?? '';
      const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return data;
  }, [events, search, filterMonth, filterClient, sort]);

  const handleSort = (key: SortKey) => {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const startEdit = (e: Event) => { setEditId(e.id); setEditData({ ...e }); setEditError(''); };
  const cancelEdit = () => { setEditId(null); setEditData({}); setEditError(''); };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    setEditError('');
    try {
      const updated = await updateEvent(editId, editData);
      setEvents(prev => prev.map(e => e.id === editId ? updated : e));
      cancelEdit();
    } catch (err: any) {
      setEditError(err?.response?.data?.error || 'Error al guardar. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const saveNew = async () => {
    setFormError('');
    if (!newData.cliente?.trim()) { setFormError('El campo Cliente es obligatorio.'); return; }
    if (!newData.presupuesto || newData.presupuesto <= 0) { setFormError('Ingresa un Presupuesto válido mayor a 0.'); return; }
    setSaving(true);
    try {
      const created = await createEvent(newData);
      setEvents(prev => [...prev, created]);
      setShowNew(false);
      setNewData(EMPTY);
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Error al crear el evento. Verifica los datos e intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelNew = () => { setShowNew(false); setNewData(EMPTY); setFormError(''); };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este evento?')) return;
    await deleteEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      className="py-2.5 px-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:text-gray-700 select-none"
      onClick={() => handleSort(k)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sort.key === k ? (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronUp size={12} className="opacity-20" />}
      </span>
    </th>
  );

  const isEditing = (e: Event) => editId === e.id;

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cliente, descripción..."
              className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-400 outline-none w-56"
            />
          </div>
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-400 outline-none bg-white"
          >
            <option value="">Todos los meses</option>
            {MONTHS.map(m => <option key={m}>{m}</option>)}
          </select>
          <select
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-400 outline-none bg-white"
          >
            <option value="">Todos los clientes</option>
            {clients.map(c => <option key={c}>{c}</option>)}
          </select>
          <span className="text-xs text-gray-400">{filtered.length} registros</span>
        </div>
        {isDirector && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-brand-800 hover:bg-brand-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Nuevo Evento
          </button>
        )}
      </div>

      {/* Leyenda roles */}
      <div className="flex gap-4 text-xs items-center">
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${isDirector ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' : 'text-gray-400'}`}>
          <span className="w-2.5 h-2.5 rounded bg-blue-400 inline-block" /> Campos Director {isDirector && '← tú editas estos'}
        </span>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${isFinance ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' : 'text-gray-400'}`}>
          <span className="w-2.5 h-2.5 rounded bg-emerald-400 inline-block" /> Campos Finanzas {isFinance && '← tú editas estos'}
        </span>
      </div>

      {/* New event form */}
      {showNew && isDirector && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">Nuevo Evento</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              placeholder="Estimación"
              value={newData.estimacion || ''}
              onChange={e => setNewData(p => ({ ...p, estimacion: e.target.value }))}
              className="text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
            />
            <input
              placeholder="Cliente *"
              value={newData.cliente || ''}
              onChange={e => { setNewData(p => ({ ...p, cliente: e.target.value })); setFormError(''); }}
              className={`text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-none ${formError && !newData.cliente?.trim() ? 'border-red-400 bg-red-50' : ''}`}
            />
            <input
              placeholder="Descripción"
              value={newData.descripcion || ''}
              onChange={e => setNewData(p => ({ ...p, descripcion: e.target.value }))}
              className="text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-none col-span-2"
            />
            <input
              type="number"
              placeholder="Presupuesto *"
              value={newData.presupuesto || ''}
              onChange={e => { setNewData(p => ({ ...p, presupuesto: Number(e.target.value) })); setFormError(''); }}
              className={`text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-none ${formError && !newData.presupuesto ? 'border-red-400 bg-red-50' : ''}`}
            />
            <input
              type="number"
              placeholder="Costo"
              value={newData.costo || ''}
              onChange={e => setNewData(p => ({ ...p, costo: Number(e.target.value) }))}
              className="text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
            />
            <select
              value={newData.mes_evento || 'Enero'}
              onChange={e => setNewData(p => ({ ...p, mes_evento: e.target.value }))}
              className="text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-none bg-white"
            >
              {MONTHS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          {formError && (
            <div className="flex items-center gap-2 mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="shrink-0" />
              {formError}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button
              onClick={saveNew}
              disabled={saving}
              className="flex items-center gap-1 bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={14} />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={handleCancelNew}
              disabled={saving}
              className="flex items-center gap-1 border border-gray-300 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <X size={14} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-260px)]">
          <table className="w-full text-sm min-w-[1200px]">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <Th k="estimacion" label="Estim." />
                <Th k="cliente" label="Cliente" />
                <Th k="descripcion" label="Descripción" />
                <Th k="mes_evento" label="Mes Evento" />
                <Th k="presupuesto" label="Presupuesto" />
                <Th k="costo" label="Costo" />
                <th className="py-2.5 px-3 text-left text-xs font-semibold text-gray-500 uppercase">MB $</th>
                <th className="py-2.5 px-3 text-left text-xs font-semibold text-gray-500 uppercase">MB %</th>
                <Th k="factura" label="Factura" />
                <Th k="fecha_facturacion" label="Fec. Fact." />
                <Th k="mes_facturacion" label="Mes Fact." />
                <Th k="estado_pago" label="Estado Pago" />
                <th className="py-2.5 px-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(e => (
                <tr key={e.id} className={`hover:bg-gray-50 transition-colors ${isEditing(e) ? 'bg-yellow-50' : ''}`}>
                  {/* Director fields */}
                  <td className="py-2 px-3 bg-blue-50/30">
                    {isEditing(e) && isDirector
                      ? <input value={editData.estimacion ?? ''} onChange={ev => setEditData(p => ({ ...p, estimacion: ev.target.value }))} className="w-20 text-xs border border-blue-300 rounded px-1.5 py-1 outline-none" />
                      : <span className="text-gray-600 font-mono text-xs">{e.estimacion || '—'}</span>}
                  </td>
                  <td className="py-2 px-3 bg-blue-50/30">
                    {isEditing(e) && isDirector
                      ? <input value={editData.cliente ?? ''} onChange={ev => setEditData(p => ({ ...p, cliente: ev.target.value }))} className="w-28 text-xs border border-blue-300 rounded px-1.5 py-1 outline-none" />
                      : <span className="font-semibold text-gray-800">{e.cliente}</span>}
                  </td>
                  <td className="py-2 px-3 max-w-xs bg-blue-50/30">
                    {isEditing(e) && isDirector
                      ? <input value={editData.descripcion ?? ''} onChange={ev => setEditData(p => ({ ...p, descripcion: ev.target.value }))} className="w-full text-xs border border-blue-300 rounded px-1.5 py-1 outline-none" />
                      : <span className="text-gray-600 text-xs line-clamp-2">{e.descripcion || '—'}</span>}
                  </td>
                  <td className="py-2 px-3 bg-blue-50/30">
                    {isEditing(e) && isDirector
                      ? <select value={editData.mes_evento ?? ''} onChange={ev => setEditData(p => ({ ...p, mes_evento: ev.target.value }))} className="text-xs border border-blue-300 rounded px-1 py-1 outline-none bg-white">
                          {MONTHS.map(m => <option key={m}>{m}</option>)}
                        </select>
                      : <span className="text-gray-600">{e.mes_evento || '—'}</span>}
                  </td>
                  <td className="py-2 px-3 text-right bg-blue-50/30">
                    {isEditing(e) && isDirector
                      ? <input type="number" value={editData.presupuesto ?? 0} onChange={ev => setEditData(p => ({ ...p, presupuesto: Number(ev.target.value) }))} className="w-28 text-xs border border-blue-300 rounded px-1.5 py-1 outline-none text-right" />
                      : <span className="text-gray-700">{fmtCLP(e.presupuesto)}</span>}
                  </td>
                  <td className="py-2 px-3 text-right bg-blue-50/30">
                    {isEditing(e) && isDirector
                      ? <input type="number" value={editData.costo ?? 0} onChange={ev => setEditData(p => ({ ...p, costo: Number(ev.target.value) }))} className="w-28 text-xs border border-blue-300 rounded px-1.5 py-1 outline-none text-right" />
                      : <span className="text-gray-600">{fmtCLP(e.costo)}</span>}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-emerald-600">
                    {fmtCLP(e.mb)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      e.presupuesto > 0 && e.mb / e.presupuesto >= 0.4 ? 'bg-emerald-100 text-emerald-700' :
                      e.presupuesto > 0 && e.mb / e.presupuesto >= 0.25 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {mbPct(e)}
                    </span>
                  </td>

                  {/* Finance fields — solo editables por rol Finanzas */}
                  <td className="py-2 px-3 bg-emerald-50/30">
                    {isEditing(e) && isFinance
                      ? <input value={editData.factura ?? ''} onChange={ev => setEditData(p => ({ ...p, factura: ev.target.value }))} className="w-24 text-xs border border-emerald-300 rounded px-1.5 py-1 outline-none" placeholder="N° Factura" />
                      : <span className="text-gray-600 font-mono text-xs">{e.factura || <span className="text-orange-400">Pendiente</span>}</span>}
                  </td>
                  <td className="py-2 px-3 bg-emerald-50/30">
                    {isEditing(e) && isFinance
                      ? <input
                          type="date"
                          value={editData.fecha_facturacion ?? ''}
                          onChange={ev => {
                            const fecha = ev.target.value;
                            const mes = getMesFromDate(fecha);
                            setEditData(p => ({ ...p, fecha_facturacion: fecha, mes_facturacion: mes }));
                          }}
                          className="text-xs border border-emerald-300 rounded px-1.5 py-1 outline-none"
                        />
                      : <span className="text-gray-500 text-xs">{fmtDate(e.fecha_facturacion)}</span>}
                  </td>
                  {/* Mes facturación: siempre auto-derivado de la fecha, solo lectura */}
                  <td className="py-2 px-3 bg-emerald-50/30">
                    {isEditing(e) && isFinance
                      ? <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-medium">
                          {getMesFromDate(editData.fecha_facturacion) || '—'}
                        </span>
                      : <span className="text-gray-500 text-xs">{mesFact(e)}</span>}
                  </td>
                  <td className="py-2 px-3 bg-emerald-50/30">
                    {isEditing(e) && isFinance
                      ? <select
                          value={editData.estado_pago ?? ''}
                          onChange={ev => setEditData(p => ({ ...p, estado_pago: ev.target.value }))}
                          className="text-xs border border-emerald-300 rounded px-1.5 py-1 outline-none bg-white"
                        >
                          <option value="">— Seleccionar —</option>
                          <option value="PAGADO">PAGADO</option>
                          <option value="PENDIENTE">PENDIENTE</option>
                          <option value="SALDO X FACTURAR">SALDO X FACTURAR</option>
                          <option value="PARCIAL">PARCIAL</option>
                        </select>
                      : <span className={`text-xs px-2 py-0.5 rounded-full ${
                          e.estado_pago?.toLowerCase() === 'pagado' ? 'bg-emerald-100 text-emerald-700' :
                          e.estado_pago ? 'bg-amber-100 text-amber-700' : 'text-gray-400'
                        }`}>{e.estado_pago || '—'}</span>}
                  </td>

                  {/* Actions */}
                  <td className="py-2 px-3">
                    {isEditing(e) ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1">
                          <button onClick={saveEdit} disabled={saving} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"><Check size={13} /></button>
                          <button onClick={cancelEdit} disabled={saving} className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"><X size={13} /></button>
                        </div>
                        {editError && editId === e.id && (
                          <p className="text-xs text-red-500 max-w-[120px] leading-tight">{editError}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(e)}
                          title={isDirector ? 'Editar datos del evento' : 'Editar facturación'}
                          className={`p-1.5 rounded-lg ${isDirector ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                        >
                          <Pencil size={13} />
                        </button>
                        {isDirector && (
                          <button onClick={() => handleDelete(e.id)} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"><Trash2 size={13} /></button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
