import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const client = new Client({
  host: 'aws-1-us-east-1.pooler.supabase.com',
  port: 5432,
  user: 'cli_login_postgres.shborjdsuszykdnnvugu',
  password: 'xfqrQHxrSUfWeNbKdSPPfINERqCKoisf',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Connecting to Supabase database...');
  await client.connect();
  console.log('Connected!\n');

  const sql = fs.readFileSync('/tmp/mvga-migration-clean.sql', 'utf-8');

  console.log('Running migration...');
  try {
    await client.query(sql);
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('⚠️ Some tables already exist, which is fine.');
    } else {
      console.error('Error:', error.message);
    }
  }

  // Verify tables
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log('\n📋 Tables in database:');
  result.rows.forEach(row => console.log('  -', row.table_name));

  await client.end();
}

main().catch(console.error);
