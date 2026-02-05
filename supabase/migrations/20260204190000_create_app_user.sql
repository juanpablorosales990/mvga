-- Create application role for Prisma access
-- Password is set via Supabase dashboard or deployment env
-- CREATE ROLE mvga_app WITH LOGIN PASSWORD '...';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO mvga_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mvga_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mvga_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mvga_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mvga_app;
GRANT ALL ON SCHEMA public TO mvga_app;
GRANT CREATE ON SCHEMA public TO mvga_app;
