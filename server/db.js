import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.warn('⚠ DATABASE_URL not set — DB calls will fail');
}

const sql = neon(process.env.DATABASE_URL || '');

// Helper for dynamic parameterized queries (e.g. dynamic SET clauses)
export async function query(text, params = []) {
  return sql.unsafe(text, params);
}

export default sql;
