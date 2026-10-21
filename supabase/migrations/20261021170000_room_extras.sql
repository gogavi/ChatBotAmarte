-- Extras de suite (persona adicional, decoración, hora suelta).
-- Proyecto: dftbelnombbtjryqphaa.
--
-- NO APLICAR desde este PR. Guillermo debe confirmar los montos semilla
-- y a qué suites aplica cada fila antes de ejecutar este archivo a mano.
-- Un segundo run reescribe estas filas (upsert por code).
--
-- La V2 traía dos montos de decoración. `code` es único, así que son dos
-- filas: decoracion_sencillas_cabana (100000) y
-- decoracion_vip_tematicas_jacuzzi_sauna (120000).
-- 100000 aplica a la categoría Sencillas: Suite Amarte, Suite Cabaña,
-- Suite Movimiento y Suite Sencilla.
-- 120000 aplica a Deluxe (Suite Diamante, Suite Gold, Suite Rubí,
-- Suite Zafiro), temáticas (Suite Árabe, Suite Gótica, Suite Queen) y
-- Suite Jacuzzi, que es el room type (el nombre comercial del catálogo
-- no se guarda aquí). La V2 también nombraba sauna; no hay room type "sauna"
-- (la landing suite-sauna-jacuzzi es Gold, Rubí y Zafiro), así que sauna
-- no entra en applies_to.
-- hora_adicional (30000) aplica a Suite Sencilla, el room type de la
-- venta interna de la V2. Suite Gamer y los planes no entran en ninguna
-- decoración hasta que Guillermo lo diga.
-- Suite Sencilla también entra en la decoración de 100000 (grupo sencillas).
-- persona_adicional (60000) aplica a cualquier suite (applies_to '*').
-- Las tarifas de lista siguen siendo para 2 personas.
--
-- Las landings no leen esta tabla. El chatbot la consulta en el servidor
-- con SUPABASE_SERVICE_ROLE_KEY. service_role tiene BYPASSRLS.
--
-- El 30-oct-2026 Supabase deja de conceder grants por defecto a anon,
-- authenticated y service_role sobre tablas NUEVAS del schema public
-- (https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
-- Este archivo nombra los tres roles: REVOKE a anon y authenticated,
-- GRANT ALL a service_role.

create table if not exists public.room_extras (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  nombre text not null,
  precio numeric not null,
  applies_to text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_extras_code_key unique (code),
  constraint room_extras_precio_check check (precio >= 0)
);

alter table public.room_extras enable row level security;

revoke all on public.room_extras from anon, authenticated;

grant all on public.room_extras to service_role;

insert into public.room_extras (code, nombre, precio, applies_to, activo)
values
  (
    'persona_adicional',
    'Persona adicional',
    60000,
    '*',
    true
  ),
  (
    'decoracion_sencillas_cabana',
    'Decoración sencillas y cabaña',
    100000,
    'Suite Amarte,Suite Cabaña,Suite Movimiento,Suite Sencilla',
    true
  ),
  (
    'decoracion_vip_tematicas_jacuzzi_sauna',
    'Decoración VIP, temáticas, jacuzzi y sauna',
    120000,
    'Suite Diamante,Suite Gold,Suite Rubí,Suite Zafiro,Suite Árabe,Suite Gótica,Suite Queen,Suite Jacuzzi',
    true
  ),
  (
    'hora_adicional',
    'Hora suelta',
    30000,
    'Suite Sencilla',
    true
  )
on conflict (code) do update set
  nombre = excluded.nombre,
  precio = excluded.precio,
  applies_to = excluded.applies_to,
  activo = excluded.activo,
  updated_at = now();
