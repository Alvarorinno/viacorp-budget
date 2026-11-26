const key = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9&]/g, '');

const ALIASES = {
  'P&G': 'PYG',
  BANCOESTADO: 'BANCO ESTADO',
  PAPAJHONS: 'PAPA JOHNS',
  PAPAJOHNS: 'PAPA JOHNS',
  TSGROUPSPA: 'TS GROUP',
  TSGROUP: 'TS GROUP',
  VINAVALDIVIESO: 'GRUPO VALDIVIESO',
  GRUPOVALDIVIESO: 'GRUPO VALDIVIESO',
};

export function normalizeCliente(name) {
  const clean = String(name).trim().replace(/\s+/g, ' ');
  return ALIASES[key(clean)] ?? clean.toUpperCase();
}
