-- Cierra public.live_conversations al Data API (REST y GraphQL).
-- Proyecto: dftbelnombbtjryqphaa. No aplicar desde el PR: ejecutar a mano.
--
-- Quien escribe la tabla es el backend con SUPABASE_SERVICE_ROLE_KEY
-- (routes/elevenlabsPostCall.js -> conversationStore.savePostCallData).
-- service_role tiene BYPASSRLS, así que no hacen falta políticas.
--
-- El 30-oct-2026 Supabase deja de conceder grants por defecto a anon,
-- authenticated y service_role sobre tablas NUEVAS del schema public
-- (https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
-- Las tablas ya creadas conservan sus grants. Este GRANT ALL deja el
-- acceso de service_role escrito y es idempotente.
--
-- ENABLE ROW LEVEL SECURITY, REVOKE ALL y GRANT ALL se pueden repetir.

alter table public.live_conversations enable row level security;

revoke all on public.live_conversations from anon, authenticated;

grant all on public.live_conversations to service_role;
