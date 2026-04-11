-- Sprint 58 Phase 2 item #10 — Quick Quote templates.
--
-- Lets a contractor go from "click Quick Quote" to a branded proposal
-- PDF in under 5 minutes by seeding a project with a pre-built brief,
-- trade sections, and placeholder estimate lines. The full 5-step
-- wizard remains available for larger jobs — this is additive, not a
-- replacement. Projects created from a template still write to the
-- same projects / estimates / estimate_lines / programme_phases tables
-- so the Golden Thread stays intact and the project can "graduate" to
-- the full wizard by clicking any pre-construction tab.

-- ── 1. project_templates table ────────────────────────────────────────
create table if not exists public.project_templates (
    id                      uuid primary key default gen_random_uuid(),
    user_id                 uuid references auth.users(id) on delete cascade,
    -- Null user_id + is_system = true marks the 6 seed templates that
    -- every contractor can see. Custom contractor-saved templates will
    -- set user_id to their own id and is_system to false.
    is_system               boolean not null default false,
    name                    text not null,
    description             text,
    icon                    text,
    project_type            text,
    default_scope           text,
    default_trade_sections  text[] default '{}'::text[],
    -- Flat JSONB array of estimate line placeholders:
    -- [{ trade_section, description, quantity, unit, unit_rate }, ...]
    default_line_items      jsonb default '[]'::jsonb,
    default_prelims_pct     numeric default 10,
    default_overhead_pct    numeric default 10,
    default_risk_pct        numeric default 5,
    default_profit_pct      numeric default 15,
    created_at              timestamptz default now()
);

create index if not exists project_templates_user_id_idx
    on public.project_templates(user_id)
    where user_id is not null;

create index if not exists project_templates_is_system_idx
    on public.project_templates(is_system)
    where is_system = true;

-- ── 2. proposal_complexity + template_id on projects ────────────────
-- 'quick' = created via Quick Quote path; full editor still available
-- 'full'  = created via 5-step wizard; default for existing rows
alter table public.projects
    add column if not exists proposal_complexity text
        not null default 'full'
        check (proposal_complexity in ('quick', 'full'));

alter table public.projects
    add column if not exists template_id uuid
        references public.project_templates(id) on delete set null;

-- ── 3. RLS ────────────────────────────────────────────────────────────
alter table public.project_templates enable row level security;

-- Everyone (authenticated) can SELECT system templates + their own.
drop policy if exists "project_templates_select" on public.project_templates;
create policy "project_templates_select"
    on public.project_templates for select
    to authenticated
    using (is_system = true or user_id = auth.uid());

-- Only owners can INSERT / UPDATE / DELETE their own templates.
-- System templates are seeded via this migration and are never
-- mutated from the app layer.
drop policy if exists "project_templates_insert_own" on public.project_templates;
create policy "project_templates_insert_own"
    on public.project_templates for insert
    to authenticated
    with check (user_id = auth.uid() and is_system = false);

drop policy if exists "project_templates_update_own" on public.project_templates;
create policy "project_templates_update_own"
    on public.project_templates for update
    to authenticated
    using (user_id = auth.uid() and is_system = false)
    with check (user_id = auth.uid() and is_system = false);

drop policy if exists "project_templates_delete_own" on public.project_templates;
create policy "project_templates_delete_own"
    on public.project_templates for delete
    to authenticated
    using (user_id = auth.uid() and is_system = false);

-- ── 4. Seed 6 system templates ───────────────────────────────────────
-- Idempotent: delete+reinsert on re-run so the seed is always fresh.
delete from public.project_templates where is_system = true;

insert into public.project_templates (
    is_system, name, description, icon, project_type,
    default_scope, default_trade_sections,
    default_line_items,
    default_prelims_pct, default_overhead_pct,
    default_risk_pct, default_profit_pct
) values
(
    true,
    'Kitchen Extension',
    'Single-storey rear extension with new kitchen fit-out. Typical 4-6m x 3-4m footprint, steel beam over existing opening, bifold doors, porcelain tile flooring, full kitchen refit.',
    '🍳',
    'Residential Extension',
    'Single storey rear kitchen extension approximately 5m x 4m, including foundations, cavity walls, flat roof, full-width bifold doors, steel beam over the existing opening, structural calculations, underfloor heating, porcelain tiles, and a complete kitchen refit to a high specification.',
    array['Groundworks & Civils', 'Masonry / Brickwork / Blockwork', 'Steel Frame / Steel Erection', 'Roofing', 'Windows, Doors & Glazing', 'Domestic Electrical', 'Domestic Plumbing', 'Plastering & Rendering', 'Tiling', 'Kitchen Installation', 'Painting & Decorating'],
    '[
        {"trade_section": "Groundworks & Civils", "description": "Excavate, concrete foundations and oversite to engineer drawings", "quantity": 20, "unit": "m3", "unit_rate": 180},
        {"trade_section": "Masonry / Brickwork / Blockwork", "description": "Cavity walls to DPC and up to wall plate, inc. insulation", "quantity": 55, "unit": "m2", "unit_rate": 140},
        {"trade_section": "Steel Frame / Steel Erection", "description": "Supply and install structural steel beam over opening", "quantity": 1, "unit": "item", "unit_rate": 1800},
        {"trade_section": "Roofing", "description": "Warm flat roof with GRP membrane, insulation and fall", "quantity": 20, "unit": "m2", "unit_rate": 220},
        {"trade_section": "Windows, Doors & Glazing", "description": "4m full-width aluminium bifold doors, supply and install", "quantity": 1, "unit": "set", "unit_rate": 4500},
        {"trade_section": "Kitchen Installation", "description": "Supply and install new kitchen inc. worktops and appliances", "quantity": 1, "unit": "sum", "unit_rate": 12000},
        {"trade_section": "Tiling", "description": "Porcelain floor tiles with underfloor heating substrate", "quantity": 22, "unit": "m2", "unit_rate": 95},
        {"trade_section": "Painting & Decorating", "description": "Mist coat, two coats emulsion, one coat satinwood to woodwork", "quantity": 1, "unit": "sum", "unit_rate": 1800}
    ]'::jsonb,
    10, 10, 5, 15
),
(
    true,
    'Loft Conversion',
    'Rear dormer loft conversion with bedroom + en-suite. Structural alterations, dormer framing, new stairs, Velux rooflights to front, full second-floor finish.',
    '🏠',
    'Residential Loft Conversion',
    'Rear dormer loft conversion including structural alterations, dormer construction, two Velux rooflights to the front, one bedroom and en-suite shower room, new staircase, insulation to current building regulations, full first fix and second fix M&E, plastering and decoration.',
    array['Temporary Works / Propping / Shoring', 'Structural Timber / Framing', 'Roofing', 'Windows, Doors & Glazing', 'Insulation', 'Drylining & Partitions', 'Domestic Electrical', 'Domestic Plumbing', 'Plastering & Rendering', 'Carpentry & Joinery', 'Bathroom Installation', 'Flooring', 'Painting & Decorating'],
    '[
        {"trade_section": "Structural Timber / Framing", "description": "Dormer framing and floor joists to engineer drawings", "quantity": 1, "unit": "sum", "unit_rate": 5500},
        {"trade_section": "Roofing", "description": "Dormer cheeks, flat roof and tile alterations", "quantity": 1, "unit": "sum", "unit_rate": 3800},
        {"trade_section": "Windows, Doors & Glazing", "description": "Dormer window supply and install + 2nr Velux rooflights", "quantity": 1, "unit": "sum", "unit_rate": 3200},
        {"trade_section": "Insulation", "description": "Warm roof insulation and acoustic insulation to floor", "quantity": 45, "unit": "m2", "unit_rate": 55},
        {"trade_section": "Drylining & Partitions", "description": "Stud partitions, plasterboard and skim throughout", "quantity": 80, "unit": "m2", "unit_rate": 45},
        {"trade_section": "Carpentry & Joinery", "description": "New staircase, doors, architraves and skirting", "quantity": 1, "unit": "sum", "unit_rate": 4500},
        {"trade_section": "Bathroom Installation", "description": "Supply and install en-suite shower room inc. tiling", "quantity": 1, "unit": "sum", "unit_rate": 6500},
        {"trade_section": "Painting & Decorating", "description": "Full redecoration of new loft space", "quantity": 1, "unit": "sum", "unit_rate": 1600}
    ]'::jsonb,
    10, 10, 5, 15
),
(
    true,
    'Bathroom Refurbishment',
    'Full strip-out and refit of a domestic bathroom. New suite, tiling, M&E, waterproofing, decoration.',
    '🚿',
    'Residential Refurbishment',
    'Full strip-out and refurbishment of existing bathroom. Works include removal of existing suite and tiles, replastering where required, new first-fix plumbing and electrics, tanking to wet areas, supply and install of new suite, wall and floor tiling, and decoration.',
    array['Demolition & Strip Out', 'Domestic Plumbing', 'Domestic Electrical', 'Waterproofing', 'Plastering & Rendering', 'Tiling', 'Bathroom Installation', 'Painting & Decorating'],
    '[
        {"trade_section": "Demolition & Strip Out", "description": "Strip out existing suite, tiles and fittings to bare walls", "quantity": 1, "unit": "sum", "unit_rate": 650},
        {"trade_section": "Domestic Plumbing", "description": "First and second fix plumbing to new suite layout", "quantity": 1, "unit": "sum", "unit_rate": 1400},
        {"trade_section": "Domestic Electrical", "description": "First and second fix electrics inc. extractor and lighting", "quantity": 1, "unit": "sum", "unit_rate": 650},
        {"trade_section": "Waterproofing", "description": "Tank shower enclosure and wet zones", "quantity": 6, "unit": "m2", "unit_rate": 55},
        {"trade_section": "Plastering & Rendering", "description": "Make good walls and skim ready for tiling/decoration", "quantity": 1, "unit": "sum", "unit_rate": 550},
        {"trade_section": "Tiling", "description": "Wall and floor tiling, midrange porcelain", "quantity": 25, "unit": "m2", "unit_rate": 85},
        {"trade_section": "Bathroom Installation", "description": "Supply and install new bathroom suite (midrange)", "quantity": 1, "unit": "sum", "unit_rate": 2800},
        {"trade_section": "Painting & Decorating", "description": "Two coats emulsion to walls/ceiling, woodwork", "quantity": 1, "unit": "sum", "unit_rate": 450}
    ]'::jsonb,
    10, 10, 5, 15
),
(
    true,
    'Driveway',
    'New domestic driveway. Groundworks, sub-base, edging, block paving or tarmac surface, drainage.',
    '🚗',
    'Residential Driveway',
    'New domestic driveway including excavation to required levels, Type 1 sub-base, concrete edgings, block paving or tarmac surface finish, and surface water drainage to new or existing soakaway.',
    array['Groundworks & Civils', 'Drainage', 'Surfacing, Paving & Kerbing'],
    '[
        {"trade_section": "Groundworks & Civils", "description": "Excavate and remove arisings to licensed tip", "quantity": 40, "unit": "m3", "unit_rate": 65},
        {"trade_section": "Groundworks & Civils", "description": "Supply and compact Type 1 sub-base, 150mm depth", "quantity": 60, "unit": "m2", "unit_rate": 28},
        {"trade_section": "Drainage", "description": "Linear drainage channel and connection to soakaway", "quantity": 1, "unit": "sum", "unit_rate": 850},
        {"trade_section": "Surfacing, Paving & Kerbing", "description": "Concrete edgings haunched in concrete", "quantity": 40, "unit": "m", "unit_rate": 28},
        {"trade_section": "Surfacing, Paving & Kerbing", "description": "Block paving, laid to herringbone with sanded joints", "quantity": 55, "unit": "m2", "unit_rate": 95}
    ]'::jsonb,
    10, 10, 5, 15
),
(
    true,
    'Garden Room',
    'Insulated garden room or outbuilding. Concrete base, timber frame, cladding, windows, power.',
    '🌿',
    'Residential Outbuilding',
    'Construction of an insulated garden room on a new concrete base. Timber frame structure with external cladding, warm roof, double glazed windows and French doors, insulation to current building regulations, first and second fix electrics, painted internally and ready to use.',
    array['Groundworks & Civils', 'Structural Timber / Framing', 'Cladding & Rainscreen', 'Roofing', 'Windows, Doors & Glazing', 'Insulation', 'Drylining & Partitions', 'Domestic Electrical', 'Flooring', 'Painting & Decorating'],
    '[
        {"trade_section": "Groundworks & Civils", "description": "Concrete base to 150mm depth with mesh reinforcement", "quantity": 18, "unit": "m2", "unit_rate": 120},
        {"trade_section": "Structural Timber / Framing", "description": "Timber stud frame to walls and roof", "quantity": 1, "unit": "sum", "unit_rate": 3200},
        {"trade_section": "Cladding & Rainscreen", "description": "Timber cladding to external walls with breather membrane", "quantity": 45, "unit": "m2", "unit_rate": 85},
        {"trade_section": "Roofing", "description": "Warm flat roof with EPDM membrane", "quantity": 20, "unit": "m2", "unit_rate": 180},
        {"trade_section": "Windows, Doors & Glazing", "description": "Double glazed windows and French doors", "quantity": 1, "unit": "sum", "unit_rate": 2800},
        {"trade_section": "Insulation", "description": "Walls, floor and roof insulation to Part L", "quantity": 60, "unit": "m2", "unit_rate": 35},
        {"trade_section": "Domestic Electrical", "description": "Submain, sockets, lighting and consumer unit", "quantity": 1, "unit": "sum", "unit_rate": 1800},
        {"trade_section": "Flooring", "description": "Engineered oak flooring", "quantity": 18, "unit": "m2", "unit_rate": 75},
        {"trade_section": "Painting & Decorating", "description": "Two coats emulsion internally, exterior wood treatment", "quantity": 1, "unit": "sum", "unit_rate": 1200}
    ]'::jsonb,
    10, 10, 5, 15
),
(
    true,
    'Custom Quote',
    'Blank starting point. Just the brief and a single placeholder line — add your own trades and rates.',
    '📝',
    'Other',
    'Project scope to be defined. Please edit this brief to describe the works.',
    array['Builders / General Building'],
    '[
        {"trade_section": "Builders / General Building", "description": "General builders work — edit to match scope", "quantity": 1, "unit": "sum", "unit_rate": 1000}
    ]'::jsonb,
    10, 10, 5, 15
);
