import pg from 'pg';

const DB_URL = 'postgresql://admin:password123@localhost:5433/alentapp_test_db';

export async function truncateAllTables(): Promise<void> {
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();
    try {
        const res = await client.query(`
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename != '_prisma_migrations';
        `);
        const tables = res.rows.map(row => `"${row.tablename}"`).join(', ');
        if (tables) {
            await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
        }
    } finally {
        await client.end();
    }
}
