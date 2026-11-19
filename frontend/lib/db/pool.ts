import { Pool, type PoolClient } from "pg";

const globalForPg = globalThis as unknown as { rangoPool?: Pool };

/** Pool único por processo (também no modo dev, onde o código recarrega). */
export function getPool(): Pool {
  if (!globalForPg.rangoPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL não definida. Veja frontend/.env.example.");
    globalForPg.rangoPool = new Pool({ connectionString, max: 10 });
  }
  return globalForPg.rangoPool;
}

/** Executa o trabalho numa transação: tudo ou nada. */
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
