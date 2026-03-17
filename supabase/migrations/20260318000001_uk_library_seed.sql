-- Sprint 1: UK Construction Method of Measurement Library
-- Seeds 13 categories and ~330 items as system defaults
DO $$
DECLARE
    cat_prelims UUID := gen_random_uuid();
    cat_scaff   UUID := gen_random_uuid();
    cat_gnd     UUID := gen_random_uuid();
    cat_brick   UUID := gen_random_uuid();
    cat_carp    UUID := gen_random_uuid();
    cat_roof    UUID := gen_random_uuid();
    cat_plast   UUID := gen_random_uuid();
    cat_plumb   UUID := gen_random_uuid();
    cat_elec    UUID := gen_random_uuid();
    cat_floor   UUID := gen_random_uuid();
    cat_deco    UUID := gen_random_uuid();
    cat_kit     UUID := gen_random_uuid();
    cat_land    UUID := gen_random_uuid();
BEGIN
    -- =====================
    -- CATEGORIES
    -- =====================
    INSERT INTO public.mom_categories (id, code, name, description, sort_order, organization_id) VALUES
        (cat_prelims, 'CAT-PRELIMS', 'Preliminaries',             NULL, 1,  NULL),
        (cat_scaff,   'CAT-SCAFF',   'Scaffolding & Access',      NULL, 2,  NULL),
        (cat_gnd,     'CAT-GND',     'Groundworks & Drainage',    NULL, 3,  NULL),
        (cat_brick,   'CAT-BRICK',   'Brickwork & Masonry',       NULL, 4,  NULL),
        (cat_carp,    'CAT-CARP',    'Carpentry & Joinery',       NULL, 5,  NULL),
        (cat_roof,    'CAT-ROOF',    'Roofing',                   NULL, 6,  NULL),
        (cat_plast,   'CAT-PLAST',   'Plastering & Rendering',    NULL, 7,  NULL),
        (cat_plumb,   'CAT-PLUMB',   'Plumbing & Heating',        NULL, 8,  NULL),
        (cat_elec,    'CAT-ELEC',    'Electrical',                NULL, 9,  NULL),
        (cat_floor,   'CAT-FLOOR',   'Flooring',                  NULL, 10, NULL),
        (cat_deco,    'CAT-DECO',    'Decorating',                NULL, 11, NULL),
        (cat_kit,     'CAT-KIT',     'Kitchen & Bathroom Fitting',NULL, 12, NULL),
        (cat_land,    'CAT-LAND',    'Landscaping & External Works',NULL,13, NULL)
    ON CONFLICT DO NOTHING;

    -- =====================
    -- ITEMS: Preliminaries
    -- =====================
    INSERT INTO public.mom_items (id, category_id, code, description, unit, base_rate, is_featured, is_system_default, organization_id) VALUES
        (gen_random_uuid(), cat_prelims, 'P.01', 'Site Manager / Foreman',               'Day',  320.00, true,  true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.02', 'Site Cabin Hire (6m)',                  'Week',  85.00, true,  true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.03', 'Portaloo Hire + Servicing',             'Week',  35.00, true,  true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.04', 'Heras Fencing (per panel/week)',         'Week',   2.50, true,  true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.05', 'Skip Hire (8-yard)',                    'Each', 280.00, true,  true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.06', 'Skip Hire (12-yard)',                   'Each', 380.00, false, true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.07', 'Temporary Power Setup',                 'Sum',  450.00, true,  true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.08', 'Site Signage Pack',                     'Sum',  120.00, true,  true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.09', 'Traffic Management (basic)',             'Day',  180.00, true,  true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.10', 'Site Clearance / Strip Out',            'm²',    12.50, true,  true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.11', 'Deep Strip Out / Demolition',           'm²',    28.00, true,  true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.12', 'Asbestos Survey (domestic)',             'Sum',  350.00, false, true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.13', 'Asbestos Removal (licensed, per m²)',   'm²',    85.00, false, true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.14', 'Structural Engineer Report',            'Sum',  850.00, false, true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.15', 'Building Control Application (domestic)','Sum',  600.00, false, true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.16', 'Party Wall Notice / Surveyor',          'Sum',  750.00, false, true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.17', 'Temporary Works / Propping',            'Sum', 1200.00, false, true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.18', 'Dust Sheets & Protection',              'Sum',   85.00, true,  true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.19', 'Welfare Facilities (toilets, wash)',     'Week',  45.00, false, true, NULL),
        (gen_random_uuid(), cat_prelims, 'P.20', 'CCTV Drain Survey',                     'Sum',  280.00, false, true, NULL)
    ON CONFLICT DO NOTHING;

    -- =====================
    -- ITEMS: Scaffolding & Access
    -- =====================
    INSERT INTO public.mom_items (id, category_id, code, description, unit, base_rate, is_featured, is_system_default, organization_id) VALUES
        (gen_random_uuid(), cat_scaff, 'SC.01', 'Scaffold — Standard Independent (1 lift, per week)', 'Week',  280.00, true,  true, NULL),
        (gen_random_uuid(), cat_scaff, 'SC.02', 'Scaffold — Standard Independent (2 lift, per week)', 'Week',  420.00, true,  true, NULL),
        (gen_random_uuid(), cat_scaff, 'SC.03', 'Scaffold — Standard Independent (3 lift, per week)', 'Week',  560.00, true,  true, NULL),
        (gen_random_uuid(), cat_scaff, 'SC.04', 'Scaffold — Temporary Roof (per m²/week)',            'm²/wk',  28.00, true,  true, NULL),
        (gen_random_uuid(), cat_scaff, 'SC.05', 'Scaffold — Chimney Stack Access',                    'Sum',   650.00, true,  true, NULL),
        (gen_random_uuid(), cat_scaff, 'SC.06', 'Scaffold — Birdcage (internal, per m²/week)',        'm²/wk',  18.00, false, true, NULL),
        (gen_random_uuid(), cat_scaff, 'SC.07', 'Scaffold — Tower (aluminium, per week hire)',         'Week',   95.00, true,  true, NULL),
        (gen_random_uuid(), cat_scaff, 'SC.08', 'Scaffold — Erect & Dismantle (flat charge)',          'Sum',   380.00, true,  true, NULL),
        (gen_random_uuid(), cat_scaff, 'SC.09', 'Scaffold — Loading Bay (per week)',                   'Week',  120.00, false, true, NULL),
        (gen_random_uuid(), cat_scaff, 'SC.10', 'Scaffold — Debris Netting (per m²)',                 'm²',      4.50, false, true, NULL),
        (gen_random_uuid(), cat_scaff, 'SC.11', 'MEWP / Cherry Picker Hire (per day)',                'Day',   320.00, true,  true, NULL),
        (gen_random_uuid(), cat_scaff, 'SC.12', 'Rope Access (per operative/day)',                     'Day',   450.00, false, true, NULL)
    ON CONFLICT DO NOTHING;

    -- =====================
    -- ITEMS: Groundworks & Drainage
    -- =====================
    INSERT INTO public.mom_items (id, category_id, code, description, unit, base_rate, is_featured, is_system_default, organization_id) VALUES
        (gen_random_uuid(), cat_gnd, 'G.01', 'Excavation — topsoil (machine)',              'm³',    18.00, true,  true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.02', 'Excavation — bulk (machine)',                 'm³',    22.00, true,  true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.03', 'Excavation — hand dig',                      'm³',    55.00, true,  true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.04', 'Disposal of excavated material (off-site)',   'm³',    32.00, true,  true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.05', 'Hardcore Fill (Type 1 MOT)',                  'm³',    42.00, true,  true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.06', 'Sand Blinding (50mm)',                        'm²',     6.00, false, true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.07', 'Concrete Strip Foundation (plain)',            'm³',   145.00, true,  true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.08', 'Concrete Pad Foundation',                     'm³',   155.00, false, true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.09', 'Concrete Raft Foundation',                    'm²',   145.00, false, true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.10', 'Concrete Slab (150mm RC, mesh reinforced)',   'm²',    75.00, true,  true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.11', 'Damp Proof Membrane (1200g)',                 'm²',     3.50, true,  true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.12', 'Drainage — 110mm UPVC pipe (laid)',           'm',     22.00, true,  true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.13', 'Drainage — 160mm UPVC pipe (laid)',           'm',     32.00, false, true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.14', 'Drainage — 110mm Inspection Chamber',        'Each', 185.00, true,  true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.15', 'Drainage — Rodding Eye',                     'Each',  95.00, false, true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.16', 'Soakaway (1m³ crate system)',                'Each', 320.00, true,  true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.17', 'Land Drain (perforated 110mm, laid)',         'm',     18.00, false, true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.18', 'Backfill & Compact (to excavation)',          'm³',    25.00, true,  true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.19', 'Steel Reinforcement Bar (10mm)',              'm',      4.50, false, true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.20', 'Steel Mesh (A142)',                           'm²',     6.50, false, true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.21', 'Ready Mix Concrete (C25, per m³)',           'm³',   135.00, true,  true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.22', 'Concrete pump hire (per day)',                'Day',  750.00, false, true, NULL),
        (gen_random_uuid(), cat_gnd, 'G.23', 'Mini excavator hire (1.5T, per day)',         'Day',  285.00, true,  true, NULL)
    ON CONFLICT DO NOTHING;

    -- =====================
    -- ITEMS: Brickwork & Masonry
    -- =====================
    INSERT INTO public.mom_items (id, category_id, code, description, unit, base_rate, is_featured, is_system_default, organization_id) VALUES
        (gen_random_uuid(), cat_brick, 'B.01', 'Bricklayer (Labour only)',                       'Hour',   28.00, true,  true, NULL),
        (gen_random_uuid(), cat_brick, 'B.02', 'Labourer (general)',                             'Hour',   20.00, true,  true, NULL),
        (gen_random_uuid(), cat_brick, 'B.03', 'Facing Brickwork — half brick (102mm)',         'm²',     85.00, true,  true, NULL),
        (gen_random_uuid(), cat_brick, 'B.04', 'Facing Brickwork — one brick (215mm)',          'm²',    145.00, true,  true, NULL),
        (gen_random_uuid(), cat_brick, 'B.05', 'Blockwork (100mm dense, coursed)',               'm²',     42.00, true,  true, NULL),
        (gen_random_uuid(), cat_brick, 'B.06', 'Blockwork (140mm dense, coursed)',               'm²',     52.00, true,  true, NULL),
        (gen_random_uuid(), cat_brick, 'B.07', 'Blockwork (100mm thermalite / aircrete)',        'm²',     48.00, false, true, NULL),
        (gen_random_uuid(), cat_brick, 'B.08', 'Cavity Wall Construction (inc. insulation, ties)','m²',   165.00, true,  true, NULL),
        (gen_random_uuid(), cat_brick, 'B.09', 'Cavity Wall Insulation (partial fill, 75mm PIR)','m²',     22.00, false, true, NULL),
        (gen_random_uuid(), cat_brick, 'B.10', 'Facing Brick — supply (standard, per 1000)',    '1000',   650.00, true,  true, NULL),
        (gen_random_uuid(), cat_brick, 'B.11', 'Facing Brick — supply (premium, per 1000)',     '1000',  1100.00, false, true, NULL),
        (gen_random_uuid(), cat_brick, 'B.12', 'Dense Block (7N, 440x215x100mm)',               'Each',     2.20, false, true, NULL),
        (gen_random_uuid(), cat_brick, 'B.13', 'Mortar (premix 25kg bag)',                       'Bag',      8.50, true,  true, NULL),
        (gen_random_uuid(), cat_brick, 'B.14', 'Lintel — steel (1200mm standard)',              'Each',    45.00, true,  true, NULL),
        (gen_random_uuid(), cat_brick, 'B.15', 'Lintel — steel (1800mm heavy)',                 'Each',    85.00, false, true, NULL),
        (gen_random_uuid(), cat_brick, 'B.16', 'Padstone (engineering brick, 440x215mm)',        'Each',    35.00, true,  true, NULL),
        (gen_random_uuid(), cat_brick, 'B.17', 'DPC (damp proof course, 112mm)',                 'm',        3.50, true,  true, NULL),
        (gen_random_uuid(), cat_brick, 'B.18', 'Engineering Bricks (Class B, per 1000)',         '1000',   550.00, false, true, NULL),
        (gen_random_uuid(), cat_brick, 'B.19', 'Repointing (hand, per m²)',                     'm²',     45.00, false, true, NULL),
        (gen_random_uuid(), cat_brick, 'B.20', 'Brick Cleaning (chemical, per m²)',             'm²',     18.00, false, true, NULL),
        (gen_random_uuid(), cat_brick, 'B.21', 'Structural Steel Beam — supply (per 100kg)',    '100kg',  280.00, false, true, NULL),
        (gen_random_uuid(), cat_brick, 'B.22', 'Steel Beam — install (crane/lift)',             'Each',   850.00, false, true, NULL)
    ON CONFLICT DO NOTHING;

    -- =====================
    -- ITEMS: Carpentry & Joinery
    -- =====================
    INSERT INTO public.mom_items (id, category_id, code, description, unit, base_rate, is_featured, is_system_default, organization_id) VALUES
        (gen_random_uuid(), cat_carp, 'C.01', 'Carpenter / Joiner (Labour only)',             'Hour',    32.00, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.02', 'Structural Timber C16 (47x100mm)',             'm',        3.80, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.03', 'Structural Timber C24 (47x150mm)',             'm',        5.50, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.04', 'Structural Timber C24 (47x200mm)',             'm',        7.20, false, true, NULL),
        (gen_random_uuid(), cat_carp, 'C.05', 'Flat Roof Decking (18mm OSB3)',                'm²',      18.00, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.06', 'Pitched Roof — cut & pitch (labour)',         'm²',      65.00, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.07', 'Pitched Roof — trussed rafter (supply & fix)','m²',      48.00, false, true, NULL),
        (gen_random_uuid(), cat_carp, 'C.08', 'Stud Partition Wall (100mm)',                  'm²',      38.00, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.09', 'Stud Partition Wall (75mm)',                   'm²',      32.00, false, true, NULL),
        (gen_random_uuid(), cat_carp, 'C.10', 'Loft Boarding (25mm, inc. legs)',              'm²',      28.00, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.11', 'Loft Hatch — supply & fit',                  'Each',    180.00, false, true, NULL),
        (gen_random_uuid(), cat_carp, 'C.12', 'Internal Door (hollow core) — supply & hang', 'Each',    220.00, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.13', 'Internal Door (solid core) — supply & hang',  'Each',    320.00, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.14', 'Internal Door (fire door FD30) — supply & hang','Each',  420.00, false, true, NULL),
        (gen_random_uuid(), cat_carp, 'C.15', 'External Composite Door — supply & fit',      'Each',    950.00, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.16', 'External Timber Door — supply & fit',         'Each',   1200.00, false, true, NULL),
        (gen_random_uuid(), cat_carp, 'C.17', 'UPVC Window (standard) — supply & fit',      'Each',    550.00, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.18', 'Aluminium Window (standard) — supply & fit',  'Each',    850.00, false, true, NULL),
        (gen_random_uuid(), cat_carp, 'C.19', 'Velux Roof Window — supply & fit',           'Each',    650.00, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.20', 'Timber Skirting Board MDF (95mm)',             'm',       12.00, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.21', 'Timber Architrave (door set)',                 'Set',     18.00, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.22', 'Staircase (softwood, straight flight)',        'Each',  1400.00, true,  true, NULL),
        (gen_random_uuid(), cat_carp, 'C.23', 'Staircase (oak, straight flight)',             'Each',  2800.00, false, true, NULL),
        (gen_random_uuid(), cat_carp, 'C.24', 'Handrail (softwood, per m)',                   'm',       22.00, false, true, NULL),
        (gen_random_uuid(), cat_carp, 'C.25', 'Balustrade (glass panel, per m)',              'm',      320.00, false, true, NULL),
        (gen_random_uuid(), cat_carp, 'C.26', 'Decking (softwood, supply & fix)',             'm²',      65.00, false, true, NULL),
        (gen_random_uuid(), cat_carp, 'C.27', 'OSB3 Sheeting (18mm, 2400x1200 sheet)',       'Sheet',    22.00, false, true, NULL),
        (gen_random_uuid(), cat_carp, 'C.28', 'Plywood (18mm structural, sheet)',             'Sheet',    35.00, false, true, NULL)
    ON CONFLICT DO NOTHING;

    -- =====================
    -- ITEMS: Roofing
    -- =====================
    INSERT INTO public.mom_items (id, category_id, code, description, unit, base_rate, is_featured, is_system_default, organization_id) VALUES
        (gen_random_uuid(), cat_roof, 'R.01', 'Roofer (Labour only)',                         'Hour',    30.00, true,  true, NULL),
        (gen_random_uuid(), cat_roof, 'R.02', 'Concrete Interlocking Tiles — supply & fix',  'm²',      42.00, true,  true, NULL),
        (gen_random_uuid(), cat_roof, 'R.03', 'Concrete Plain Tiles — supply & fix',         'm²',      52.00, false, true, NULL),
        (gen_random_uuid(), cat_roof, 'R.04', 'Natural Slate Tiles — supply & fix',          'm²',      95.00, true,  true, NULL),
        (gen_random_uuid(), cat_roof, 'R.05', 'Artificial Slate — supply & fix',             'm²',      68.00, false, true, NULL),
        (gen_random_uuid(), cat_roof, 'R.06', 'Clay Pantiles — supply & fix',                'm²',      85.00, false, true, NULL),
        (gen_random_uuid(), cat_roof, 'R.07', 'Flat Roof (GRP Fibreglass, full system)',      'm²',      95.00, true,  true, NULL),
        (gen_random_uuid(), cat_roof, 'R.08', 'Flat Roof (EPDM Rubber, full system)',         'm²',      80.00, true,  true, NULL),
        (gen_random_uuid(), cat_roof, 'R.09', 'Flat Roof (felt, 3-layer)',                    'm²',      55.00, false, true, NULL),
        (gen_random_uuid(), cat_roof, 'R.10', 'Flat Roof — Insulation (PIR, 100mm)',         'm²',      38.00, false, true, NULL),
        (gen_random_uuid(), cat_roof, 'R.11', 'Roofing Felt (vapour check)',                  'm²',       4.50, true,  true, NULL),
        (gen_random_uuid(), cat_roof, 'R.12', 'Roof Batten (treated 25x50mm)',                'm',        1.20, true,  true, NULL),
        (gen_random_uuid(), cat_roof, 'R.13', 'Lead Flashing (code 4)',                       'm',       65.00, true,  true, NULL),
        (gen_random_uuid(), cat_roof, 'R.14', 'Lead Valley (code 4)',                         'm',       75.00, false, true, NULL),
        (gen_random_uuid(), cat_roof, 'R.15', 'UPVC Fascia (200mm)',                          'm',       18.00, true,  true, NULL),
        (gen_random_uuid(), cat_roof, 'R.16', 'UPVC Soffit (300mm)',                          'm',       15.00, true,  true, NULL),
        (gen_random_uuid(), cat_roof, 'R.17', 'UPVC Half-Round Gutter',                       'm',       12.00, true,  true, NULL),
        (gen_random_uuid(), cat_roof, 'R.18', 'UPVC Downpipe (68mm)',                         'm',       10.00, true,  true, NULL),
        (gen_random_uuid(), cat_roof, 'R.19', 'Ridge Tiles (inc. bedding & pointing)',        'm',       32.00, true,  true, NULL),
        (gen_random_uuid(), cat_roof, 'R.20', 'Hip Tiles (inc. bedding & pointing)',          'm',       38.00, false, true, NULL),
        (gen_random_uuid(), cat_roof, 'R.21', 'Verge (dry fix system)',                       'm',       18.00, false, true, NULL),
        (gen_random_uuid(), cat_roof, 'R.22', 'Eaves Felt Support Tray',                     'm',        4.00, false, true, NULL),
        (gen_random_uuid(), cat_roof, 'R.23', 'Breathable Roofing Membrane',                  'm²',       3.50, false, true, NULL),
        (gen_random_uuid(), cat_roof, 'R.24', 'Chimney Stack Repoint & Cap',                  'Sum',    850.00, false, true, NULL),
        (gen_random_uuid(), cat_roof, 'R.25', 'Chimney Stack Demolish & Rebuild',             'Sum',   2800.00, false, true, NULL)
    ON CONFLICT DO NOTHING;

    -- =====================
    -- ITEMS: Plastering & Rendering
    -- =====================
    INSERT INTO public.mom_items (id, category_id, code, description, unit, base_rate, is_featured, is_system_default, organization_id) VALUES
        (gen_random_uuid(), cat_plast, 'PL.01', 'Plasterer (Labour only)',                     'Hour',    30.00, true,  true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.02', 'Skim Coat (2-coat finish to walls)',          'm²',      18.00, true,  true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.03', 'Skim Coat (ceiling)',                         'm²',      22.00, true,  true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.04', 'Dot & Dab Plasterboard to masonry',          'm²',      28.00, true,  true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.05', 'Stud Wall Board (taped & jointed)',           'm²',      24.00, true,  true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.06', 'Ceiling Board (taped & jointed)',             'm²',      26.00, false, true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.07', 'Thistle Bonding Coat (pre-mix, 25kg)',        'Bag',     14.00, true,  true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.08', 'Thistle MultiFinish (25kg)',                  'Bag',     13.00, true,  true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.09', 'Plasterboard (12.5mm, 2400x1200)',           'Sheet',    14.00, true,  true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.10', 'Plasterboard (15mm fire, 2400x1200)',        'Sheet',    18.00, false, true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.11', 'Sand & Cement Render (2-coat external)',      'm²',      42.00, true,  true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.12', 'Monocouche Render (coloured, inc. bead)',     'm²',      65.00, true,  true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.13', 'External Wall Insulation (EWI, 90mm)',        'm²',     110.00, false, true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.14', 'Coving (plaster, 90mm, supply & fix)',        'm',       12.00, false, true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.15', 'Beads (angle, stop, stainless)',              'm',        3.50, false, true, NULL),
        (gen_random_uuid(), cat_plast, 'PL.16', 'Mesh (fibreglass render)',                    'm²',       4.50, false, true, NULL)
    ON CONFLICT DO NOTHING;

    -- =====================
    -- ITEMS: Plumbing & Heating
    -- =====================
    INSERT INTO public.mom_items (id, category_id, code, description, unit, base_rate, is_featured, is_system_default, organization_id) VALUES
        (gen_random_uuid(), cat_plumb, 'PH.01', 'Plumber (Labour only)',                       'Hour',    55.00, true,  true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.02', 'Gas Safe Engineer (Labour only)',             'Hour',    65.00, true,  true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.03', 'Boiler — Combi (35kW) supply & install',    'Each',  2200.00, true,  true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.04', 'Boiler — System (12kW) supply & install',   'Each',  1800.00, false, true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.05', 'Radiator (double panel, standard) supply & fit','Each', 320.00, true,  true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.06', 'Radiator (towel rail) supply & fit',         'Each',   280.00, false, true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.07', 'Full Bathroom Suite — supply & fit',        'Each',  1800.00, true,  true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.08', 'WC (close-coupled, supply & fit)',            'Each',   380.00, true,  true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.09', 'Basin (pedestal, supply & fit)',              'Each',   280.00, true,  true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.10', 'Bath (steel, supply & fit)',                  'Each',   450.00, true,  true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.11', 'Shower Enclosure (1200x900, supply & fit)',   'Each',   750.00, true,  true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.12', 'Electric Shower (supply & fit)',              'Each',   480.00, false, true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.13', 'Copper Pipe (22mm, per m)',                   'm',        6.50, true,  true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.14', 'Copper Pipe (15mm, per m)',                   'm',        4.80, true,  true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.15', 'UPVC Soil Pipe (110mm)',                      'm',       18.00, true,  true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.16', 'Underfloor Heating (wet system, per m²)',    'm²',      95.00, true,  true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.17', 'Underfloor Heating (electric mat, per m²)',  'm²',      65.00, false, true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.18', 'Pressure Test (water system)',                'Sum',    180.00, false, true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.19', 'Isolation Valve',                             'Each',    45.00, false, true, NULL),
        (gen_random_uuid(), cat_plumb, 'PH.20', 'Hot Water Cylinder (unvented, 180L)',         'Each',  1200.00, false, true, NULL)
    ON CONFLICT DO NOTHING;

    -- =====================
    -- ITEMS: Electrical
    -- =====================
    INSERT INTO public.mom_items (id, category_id, code, description, unit, base_rate, is_featured, is_system_default, organization_id) VALUES
        (gen_random_uuid(), cat_elec, 'E.01', 'Electrician (Labour only)',                      'Hour',     55.00, true,  true, NULL),
        (gen_random_uuid(), cat_elec, 'E.02', 'Consumer Unit (18-way RCBO) supply & fit',      'Each',    550.00, true,  true, NULL),
        (gen_random_uuid(), cat_elec, 'E.03', 'Lighting Circuit (full ring)',                   'Circuit', 320.00, true,  true, NULL),
        (gen_random_uuid(), cat_elec, 'E.04', 'Power Circuit (full ring)',                      'Circuit', 380.00, true,  true, NULL),
        (gen_random_uuid(), cat_elec, 'E.05', 'Double Socket Outlet (supply & fit)',            'Each',     55.00, true,  true, NULL),
        (gen_random_uuid(), cat_elec, 'E.06', 'Single Socket Outlet (supply & fit)',            'Each',     45.00, false, true, NULL),
        (gen_random_uuid(), cat_elec, 'E.07', 'USB Socket (double, supply & fit)',              'Each',     75.00, false, true, NULL),
        (gen_random_uuid(), cat_elec, 'E.08', 'Ceiling Rose & Pendant',                        'Each',     40.00, true,  true, NULL),
        (gen_random_uuid(), cat_elec, 'E.09', 'Downlight (LED, recessed, supply & fit)',        'Each',     65.00, true,  true, NULL),
        (gen_random_uuid(), cat_elec, 'E.10', 'Dimmer Switch',                                  'Each',     55.00, false, true, NULL),
        (gen_random_uuid(), cat_elec, 'E.11', 'Smoke Alarm (interlinked, supply & fit)',        'Each',     85.00, true,  true, NULL),
        (gen_random_uuid(), cat_elec, 'E.12', 'Heat Alarm (supply & fit)',                      'Each',     85.00, false, true, NULL),
        (gen_random_uuid(), cat_elec, 'E.13', 'CO Alarm (supply & fit)',                        'Each',     65.00, false, true, NULL),
        (gen_random_uuid(), cat_elec, 'E.14', 'External Security Light (supply & fit)',         'Each',    120.00, true,  true, NULL),
        (gen_random_uuid(), cat_elec, 'E.15', 'EV Charger (7kW, supply & install)',             'Each',    950.00, true,  true, NULL),
        (gen_random_uuid(), cat_elec, 'E.16', 'Solar PV (per kWp installed, excl. scaffolding)','kWp',    1200.00, false, true, NULL),
        (gen_random_uuid(), cat_elec, 'E.17', 'CCTV System (4 camera, supply & install)',       'Sum',     850.00, false, true, NULL),
        (gen_random_uuid(), cat_elec, 'E.18', 'Data Point (Cat6, supply & fit)',                'Each',     65.00, false, true, NULL),
        (gen_random_uuid(), cat_elec, 'E.19', 'Electrical Certificate (EICR / Installation)',   'Sum',     280.00, true,  true, NULL),
        (gen_random_uuid(), cat_elec, 'E.20', 'First Fix Wiring (per point)',                   'Point',    45.00, false, true, NULL)
    ON CONFLICT DO NOTHING;

    -- =====================
    -- ITEMS: Flooring
    -- =====================
    INSERT INTO public.mom_items (id, category_id, code, description, unit, base_rate, is_featured, is_system_default, organization_id) VALUES
        (gen_random_uuid(), cat_floor, 'F.01', 'Floor Fitter (Labour only)',                     'Hour',    28.00, true,  true, NULL),
        (gen_random_uuid(), cat_floor, 'F.02', 'Ceramic Floor Tiles (supply & fix, std)',        'm²',      55.00, true,  true, NULL),
        (gen_random_uuid(), cat_floor, 'F.03', 'Porcelain Floor Tiles (supply & fix, std)',      'm²',      75.00, true,  true, NULL),
        (gen_random_uuid(), cat_floor, 'F.04', 'Porcelain Floor Tiles (large format, supply & fix)','m²',   95.00, false, true, NULL),
        (gen_random_uuid(), cat_floor, 'F.05', 'Natural Stone (slate/travertine, supply & fix)', 'm²',     120.00, false, true, NULL),
        (gen_random_uuid(), cat_floor, 'F.06', 'Engineered Oak Flooring (supply & fix)',         'm²',      90.00, true,  true, NULL),
        (gen_random_uuid(), cat_floor, 'F.07', 'Solid Oak Flooring (supply & fix)',              'm²',     130.00, false, true, NULL),
        (gen_random_uuid(), cat_floor, 'F.08', 'Laminate Flooring (supply & fix)',               'm²',      35.00, true,  true, NULL),
        (gen_random_uuid(), cat_floor, 'F.09', 'LVT / Luxury Vinyl Tile (supply & fix)',        'm²',      50.00, true,  true, NULL),
        (gen_random_uuid(), cat_floor, 'F.10', 'Carpet (supply & fix, inc. underlay, mid-range)','m²',      38.00, true,  true, NULL),
        (gen_random_uuid(), cat_floor, 'F.11', 'Carpet (supply & fix, inc. underlay, wool)',     'm²',      65.00, false, true, NULL),
        (gen_random_uuid(), cat_floor, 'F.12', 'Liquid Screed (65mm, pumped)',                   'm²',      30.00, true,  true, NULL),
        (gen_random_uuid(), cat_floor, 'F.13', 'Sand & Cement Screed (75mm)',                    'm²',      28.00, false, true, NULL),
        (gen_random_uuid(), cat_floor, 'F.14', 'Flexible Tile Adhesive (20kg bag)',              'Bag',     12.00, true,  true, NULL),
        (gen_random_uuid(), cat_floor, 'F.15', 'Grout (5kg bag)',                                'Bag',      8.00, true,  true, NULL),
        (gen_random_uuid(), cat_floor, 'F.16', 'Floor Levelling Compound (25kg)',                'Bag',     18.00, false, true, NULL),
        (gen_random_uuid(), cat_floor, 'F.17', 'Hardwood Threshold Strip',                      'Each',    22.00, false, true, NULL),
        (gen_random_uuid(), cat_floor, 'F.18', 'Underlay (standard, per m²)',                   'm²',       4.50, false, true, NULL)
    ON CONFLICT DO NOTHING;

    -- =====================
    -- ITEMS: Decorating
    -- =====================
    INSERT INTO public.mom_items (id, category_id, code, description, unit, base_rate, is_featured, is_system_default, organization_id) VALUES
        (gen_random_uuid(), cat_deco, 'D.01', 'Decorator (Labour only)',                   'Hour',    26.00, true,  true, NULL),
        (gen_random_uuid(), cat_deco, 'D.02', 'Internal Walls — mist & 2 coats',         'm²',       8.00, true,  true, NULL),
        (gen_random_uuid(), cat_deco, 'D.03', 'Ceiling — mist & 2 coats',                'm²',      10.00, true,  true, NULL),
        (gen_random_uuid(), cat_deco, 'D.04', 'Woodwork (doors, skirtings) — 2 coats gloss','m',      8.00, true,  true, NULL),
        (gen_random_uuid(), cat_deco, 'D.05', 'External Masonry — 2 coats',              'm²',      14.00, true,  true, NULL),
        (gen_random_uuid(), cat_deco, 'D.06', 'Wallpaper (lining, supply & hang)',         'm²',      14.00, false, true, NULL),
        (gen_random_uuid(), cat_deco, 'D.07', 'Wallpaper (feature, supply & hang)',        'm²',      28.00, false, true, NULL),
        (gen_random_uuid(), cat_deco, 'D.08', 'Interior Emulsion (10L, supply)',           'Can',     38.00, true,  true, NULL),
        (gen_random_uuid(), cat_deco, 'D.09', 'Exterior Masonry Paint (10L, supply)',      'Can',     45.00, true,  true, NULL),
        (gen_random_uuid(), cat_deco, 'D.10', 'Eggshell Woodwork Paint (1L)',              'Can',     22.00, false, true, NULL),
        (gen_random_uuid(), cat_deco, 'D.11', 'Filler (fine surface, 1L)',                 'Tub',      7.00, true,  true, NULL),
        (gen_random_uuid(), cat_deco, 'D.12', 'Primer (multi-surface, 5L)',                'Can',     32.00, false, true, NULL),
        (gen_random_uuid(), cat_deco, 'D.13', 'Sanding (floors, belt sander, per m²)',    'm²',      18.00, false, true, NULL)
    ON CONFLICT DO NOTHING;

    -- =====================
    -- ITEMS: Kitchen & Bathroom Fitting
    -- =====================
    INSERT INTO public.mom_items (id, category_id, code, description, unit, base_rate, is_featured, is_system_default, organization_id) VALUES
        (gen_random_uuid(), cat_kit, 'K.01', 'Kitchen Fitter (Labour only)',                'Hour',    35.00, true,  true, NULL),
        (gen_random_uuid(), cat_kit, 'K.02', 'Base Unit (600mm, supply & fit)',             'Each',   180.00, true,  true, NULL),
        (gen_random_uuid(), cat_kit, 'K.03', 'Wall Unit (600mm, supply & fit)',             'Each',   140.00, true,  true, NULL),
        (gen_random_uuid(), cat_kit, 'K.04', 'Tower Unit (600mm, supply & fit)',            'Each',   280.00, false, true, NULL),
        (gen_random_uuid(), cat_kit, 'K.05', 'Worktop (laminate, per m run)',               'm',       90.00, true,  true, NULL),
        (gen_random_uuid(), cat_kit, 'K.06', 'Worktop (solid timber, per m run)',           'm',      230.00, false, true, NULL),
        (gen_random_uuid(), cat_kit, 'K.07', 'Worktop (quartz/granite, per m run)',         'm',      420.00, false, true, NULL),
        (gen_random_uuid(), cat_kit, 'K.08', 'Kitchen Sink & Tap (supply & fit)',           'Each',   380.00, true,  true, NULL),
        (gen_random_uuid(), cat_kit, 'K.09', 'Appliance Installation (integrated)',         'Each',    85.00, true,  true, NULL),
        (gen_random_uuid(), cat_kit, 'K.10', 'Kitchen Extractor Fan (supply & fit)',        'Each',   280.00, false, true, NULL),
        (gen_random_uuid(), cat_kit, 'K.11', 'Splashback Tiling (supply & fix)',            'm²',      85.00, true,  true, NULL),
        (gen_random_uuid(), cat_kit, 'K.12', 'Bathroom Fitter (Labour only)',               'Hour',    35.00, true,  true, NULL),
        (gen_random_uuid(), cat_kit, 'K.13', 'Wet Room (full waterproof system)',           'm²',     135.00, false, true, NULL),
        (gen_random_uuid(), cat_kit, 'K.14', 'En-suite Fit Out (labour, exc. sanitaryware)','Sum',   1800.00, false, true, NULL),
        (gen_random_uuid(), cat_kit, 'K.15', 'Full Bathroom Refurb (labour, exc. sanitaryware)','Sum',2400.00, false, true, NULL)
    ON CONFLICT DO NOTHING;

    -- =====================
    -- ITEMS: Landscaping & External Works
    -- =====================
    INSERT INTO public.mom_items (id, category_id, code, description, unit, base_rate, is_featured, is_system_default, organization_id) VALUES
        (gen_random_uuid(), cat_land, 'L.01', 'Landscaper (Labour only)',                      'Hour',    24.00, true,  true, NULL),
        (gen_random_uuid(), cat_land, 'L.02', 'Patio (Indian sandstone, supply & fix)',        'm²',      90.00, true,  true, NULL),
        (gen_random_uuid(), cat_land, 'L.03', 'Patio (porcelain, supply & fix)',               'm²',     120.00, true,  true, NULL),
        (gen_random_uuid(), cat_land, 'L.04', 'Block Paving Driveway (supply & fix)',          'm²',     100.00, true,  true, NULL),
        (gen_random_uuid(), cat_land, 'L.05', 'Tarmac Driveway (supply & lay, new)',           'm²',      50.00, true,  true, NULL),
        (gen_random_uuid(), cat_land, 'L.06', 'Tarmac Driveway (resurface only)',              'm²',      32.00, false, true, NULL),
        (gen_random_uuid(), cat_land, 'L.07', 'Resin Bound Driveway (supply & lay)',           'm²',      85.00, false, true, NULL),
        (gen_random_uuid(), cat_land, 'L.08', 'Timber Fence Panel (1800mm, supply & erect)',   'Panel',    90.00, true,  true, NULL),
        (gen_random_uuid(), cat_land, 'L.09', 'Concrete Post (100x100mm, supply & install)',   'Each',     38.00, true,  true, NULL),
        (gen_random_uuid(), cat_land, 'L.10', 'Close-Board Fencing (1800mm, per m run)',       'm',        65.00, false, true, NULL),
        (gen_random_uuid(), cat_land, 'L.11', 'Decorative Gravel (40mm, 850kg bag)',           'Bag',      90.00, true,  true, NULL),
        (gen_random_uuid(), cat_land, 'L.12', 'Turf (cultivate, supply & lay)',                'm²',       14.00, true,  true, NULL),
        (gen_random_uuid(), cat_land, 'L.13', 'Retaining Wall (concrete block, excl. found.)', 'm²',     130.00, true,  true, NULL),
        (gen_random_uuid(), cat_land, 'L.14', 'Sleeper Raised Bed (supply & build)',           'm',        95.00, false, true, NULL),
        (gen_random_uuid(), cat_land, 'L.15', 'Garden Shed Base (concrete, excl. slab)',       'Each',    380.00, false, true, NULL),
        (gen_random_uuid(), cat_land, 'L.16', 'Gate (timber, supply & hang, 900mm)',           'Each',    290.00, true,  true, NULL),
        (gen_random_uuid(), cat_land, 'L.17', 'Gate (automated, supply & fit)',                'Each',   2800.00, false, true, NULL),
        (gen_random_uuid(), cat_land, 'L.18', 'Brick/Block Wall (garden, half-brick)',         'm²',       95.00, true,  true, NULL),
        (gen_random_uuid(), cat_land, 'L.19', 'Topsoil (20mm depth, supply & spread)',         'm²',        8.00, false, true, NULL),
        (gen_random_uuid(), cat_land, 'L.20', 'Tree Removal (standard, per tree)',             'Each',    480.00, false, true, NULL)
    ON CONFLICT DO NOTHING;

END $$;
