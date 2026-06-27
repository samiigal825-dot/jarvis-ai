import { Pool } from '@neondatabase/serverless';

if (!process.env.NEON_API_KEY) {
  console.warn('⚠️ NEON_API_KEY is not set. Database features will not work.');
}

export const pool = new Pool({
  connectionString: process.env.NEON_API_KEY || 'postgres://user:pass@ep-fake.neon.tech/db'
});

export async function query(text: string, params: any[] = []) {
  try {
    const res = await pool.query(text, params);
    return res.rows;
  } catch (e) {
    console.error('Database Query Error:', e);
    return [];
  }
}
