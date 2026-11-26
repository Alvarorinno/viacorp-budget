import { useState } from 'react';
import { X } from 'lucide-react';

const NEW = '__new__';

interface Props {
  clients: string[];
  value: string;
  onChange: (value: string) => void;
  className: string;
}

export default function ClientSelect({ clients, value, onChange, className }: Props) {
  const [isNew, setIsNew] = useState(false);
  const [previous, setPrevious] = useState('');

  if (isNew) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          placeholder="Nombre del nuevo cliente"
          value={value}
          onChange={e => onChange(e.target.value.toUpperCase())}
          className={`${className} flex-1 min-w-0`}
        />
        <button
          type="button"
          title="Volver a la lista"
          onClick={() => { setIsNew(false); onChange(previous); }}
          className="p-1 text-gray-500 hover:text-gray-800"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={e => {
        if (e.target.value !== NEW) return onChange(e.target.value);
        setPrevious(value);
        setIsNew(true);
        onChange('');
      }}
      className={`${className} bg-white`}
    >
      <option value="" disabled>Cliente *</option>
      <option value={NEW}>+ Nuevo cliente</option>
      {clients.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}
