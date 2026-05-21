-- Harden tables exposed through Supabase PostgREST.
-- This app uses Prisma from the backend, so public API roles should not access data directly.

-- Enable RLS on exposed application tables
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ai_games" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_hidden_games" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Revoke default privileges from PostgREST roles
REVOKE ALL ON TABLE "public"."users" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."games" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."ai_games" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."user_hidden_games" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."_prisma_migrations" FROM anon, authenticated;
