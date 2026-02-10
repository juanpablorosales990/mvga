import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('Connecting to database...');
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
