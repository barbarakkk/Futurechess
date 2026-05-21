-- Explicit deny policies for PostgREST roles (backend-only DB access via Prisma).
-- Clears Supabase "RLS Enabled No Policy" while keeping direct API access blocked.

CREATE POLICY "block_direct_api_access"
  ON "public"."users"
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "block_direct_api_access"
  ON "public"."games"
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "block_direct_api_access"
  ON "public"."ai_games"
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "block_direct_api_access"
  ON "public"."user_hidden_games"
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "block_direct_api_access"
  ON "public"."_prisma_migrations"
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Indexes for unindexed foreign keys (Supabase performance advisor)
CREATE INDEX "games_white_player_id_idx" ON "public"."games"("white_player_id");
CREATE INDEX "games_black_player_id_idx" ON "public"."games"("black_player_id");
CREATE INDEX "ai_games_user_id_idx" ON "public"."ai_games"("user_id");
CREATE INDEX "user_hidden_games_user_id_idx" ON "public"."user_hidden_games"("user_id");
CREATE INDEX "user_hidden_games_game_id_idx" ON "public"."user_hidden_games"("game_id");
