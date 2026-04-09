-- Sprint 50: Material Rates & Procurement
-- Indicative UK material prices by region and trade category

CREATE TABLE IF NOT EXISTS material_prices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_category  TEXT NOT NULL,        -- e.g. 'Groundworks', 'Brickwork', 'Timber Frame'
  material        TEXT NOT NULL,        -- e.g. 'Engineering Brick (Class B)'
  description     TEXT,                 -- optional longer description
  unit            TEXT NOT NULL,        -- e.g. 'm²', 'nr', 'tonne', 'm', 'litre'
  region          TEXT NOT NULL,        -- e.g. 'National', 'London', 'South East', 'Midlands'
  price_low       NUMERIC(10,2),        -- lower end of indicative price range
  price_mid       NUMERIC(10,2) NOT NULL, -- mid-point used as default
  price_high      NUMERIC(10,2),        -- upper end of indicative price range
  supplier_note   TEXT,                 -- e.g. 'Travis Perkins / Jewson indicative'
  source_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- No RLS — read-only reference data, visible to all authenticated users
ALTER TABLE material_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read material_prices"
  ON material_prices FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_mat_prices_trade    ON material_prices(trade_category);
CREATE INDEX IF NOT EXISTS idx_mat_prices_region   ON material_prices(region);
CREATE INDEX IF NOT EXISTS idx_mat_prices_material ON material_prices(material);

-- ── Seed: indicative UK prices (April 2026, incl. VAT where noted, ex-VAT default) ──

INSERT INTO material_prices (trade_category, material, unit, region, price_low, price_mid, price_high, supplier_note) VALUES

-- ── GROUNDWORKS ───────────────────────────────────────────────────────────────
('Groundworks', 'Type 1 MOT Sub-base', 'tonne', 'National',  22.00,  28.00,  35.00, 'Local quarry / builders merchant'),
('Groundworks', 'Type 1 MOT Sub-base', 'tonne', 'London',    28.00,  36.00,  44.00, 'London / South East premium'),
('Groundworks', 'Sharp Sand', 'tonne', 'National',            18.00,  22.00,  28.00, 'Builders merchant'),
('Groundworks', 'Ballast (20mm)', 'tonne', 'National',        20.00,  25.00,  32.00, 'Builders merchant'),
('Groundworks', 'Lean Mix Concrete (C10)', 'm³', 'National',  90.00, 105.00, 125.00, 'Ready-mix supply'),
('Groundworks', 'Lean Mix Concrete (C10)', 'm³', 'London',   105.00, 125.00, 145.00, 'Ready-mix London'),
('Groundworks', 'Structural Concrete (C25)', 'm³', 'National', 105.00, 125.00, 148.00, 'Ready-mix supply'),
('Groundworks', 'Structural Concrete (C25)', 'm³', 'London',  120.00, 148.00, 175.00, 'Ready-mix London'),
('Groundworks', 'Steel Mesh Reinforcement A142', 'm²', 'National', 4.20, 5.50, 7.00, 'Steel stockholder'),
('Groundworks', 'Steel Mesh Reinforcement A193', 'm²', 'National', 5.50, 6.80, 8.50, 'Steel stockholder'),
('Groundworks', 'Damp Proof Membrane (1200g)', 'm²', 'National', 0.45, 0.65, 0.90, 'Builders merchant'),
('Groundworks', 'Hardcore Fill (broken brick)', 'tonne', 'National', 12.00, 18.00, 24.00, 'Local supplier'),

-- ── BRICKWORK & BLOCKWORK ─────────────────────────────────────────────────────
('Brickwork & Blockwork', 'Common Brick (Ibstock / Wienerberger)', 'nr', 'National', 0.45, 0.62, 0.85, 'Travis Perkins / Jewson indicative'),
('Brickwork & Blockwork', 'Common Brick (Ibstock / Wienerberger)', 'nr', 'London', 0.55, 0.78, 1.05, 'London premium'),
('Brickwork & Blockwork', 'Facing Brick (mid-range)', 'nr', 'National', 0.65, 0.92, 1.35, 'Builders merchant'),
('Brickwork & Blockwork', 'Engineering Brick (Class B)', 'nr', 'National', 0.75, 1.05, 1.45, 'Builders merchant'),
('Brickwork & Blockwork', 'Concrete Block 100mm (7N)', 'nr', 'National', 1.45, 1.85, 2.40, 'Travis Perkins indicative'),
('Brickwork & Blockwork', 'Concrete Block 140mm (7N)', 'nr', 'National', 1.95, 2.45, 3.10, 'Builders merchant'),
('Brickwork & Blockwork', 'Thermalite Block 100mm', 'nr', 'National', 2.10, 2.75, 3.50, 'Builders merchant'),
('Brickwork & Blockwork', 'Thermalite Block 215mm', 'nr', 'National', 4.20, 5.20, 6.50, 'Builders merchant'),
('Brickwork & Blockwork', 'Mortar (ready-mix bag 20kg)', 'bag', 'National', 5.50, 6.80, 8.50, 'Builders merchant'),
('Brickwork & Blockwork', 'Wall Tie (stainless, Type 2)', 'nr', 'National', 0.18, 0.28, 0.42, 'Fixings supplier'),
('Brickwork & Blockwork', 'Cavity Insulation (100mm PIR)', 'm²', 'National', 8.50, 11.00, 14.50, 'Insulation distributor'),

-- ── ROOFING ───────────────────────────────────────────────────────────────────
('Roofing', 'Plain Clay Tile', 'nr', 'National', 0.85, 1.20, 1.75, 'Roofing merchant'),
('Roofing', 'Concrete Interlocking Tile', 'nr', 'National', 0.55, 0.75, 1.05, 'Roofing merchant'),
('Roofing', 'Natural Slate (Welsh)', 'nr', 'National', 2.80, 3.80, 5.20, 'Specialist supplier'),
('Roofing', 'Natural Slate (Spanish)', 'nr', 'National', 1.60, 2.20, 3.00, 'Roofing merchant'),
('Roofing', 'Roofing Underlay (Tyvek equiv.)', 'm²', 'National', 1.20, 1.65, 2.20, 'Builders merchant'),
('Roofing', 'Ridge Tile (concrete)', 'nr', 'National', 3.50, 4.80, 6.50, 'Roofing merchant'),
('Roofing', 'EPDM Membrane (1.2mm)', 'm²', 'National', 8.50, 12.00, 16.00, 'Flat roofing specialist'),
('Roofing', 'GRP Roofing System (inc. topcoat)', 'm²', 'National', 22.00, 30.00, 40.00, 'GRP supplier'),
('Roofing', 'Celotex / PIR Roof Insulation 100mm', 'm²', 'National', 12.00, 16.50, 22.00, 'Insulation distributor'),
('Roofing', 'Lead Flashing (code 4)', 'm', 'National', 18.00, 24.00, 32.00, 'Plumbers merchant'),

-- ── CARPENTRY & TIMBER ────────────────────────────────────────────────────────
('Carpentry & Timber', 'C16 Regularised Timber 47x100mm', 'm', 'National', 1.80, 2.40, 3.20, 'Timber merchant'),
('Carpentry & Timber', 'C16 Regularised Timber 47x150mm', 'm', 'National', 2.60, 3.40, 4.50, 'Timber merchant'),
('Carpentry & Timber', 'C16 Regularised Timber 47x200mm', 'm', 'National', 3.40, 4.50, 6.00, 'Timber merchant'),
('Carpentry & Timber', 'OSB3 18mm Sheet', 'sheet', 'National', 18.00, 24.00, 32.00, 'Travis Perkins / Jewson'),
('Carpentry & Timber', 'Plywood 18mm Structural', 'sheet', 'National', 28.00, 36.00, 48.00, 'Timber merchant'),
('Carpentry & Timber', 'Plasterboard 12.5mm', 'sheet', 'National', 7.50, 9.50, 12.50, 'Builders merchant'),
('Carpentry & Timber', 'Plasterboard 15mm', 'sheet', 'National', 9.50, 12.00, 15.50, 'Builders merchant'),
('Carpentry & Timber', 'Stud Partitioning 70mm C-Section', 'm', 'National', 1.80, 2.40, 3.20, 'Drylining merchant'),
('Carpentry & Timber', 'Studwork Door Lining Set (softwood)', 'set', 'National', 28.00, 38.00, 52.00, 'Joinery supplier'),
('Carpentry & Timber', 'Staircase (straight, softwood, budget)', 'nr', 'National', 380.00, 520.00, 750.00, 'Joinery manufacturer'),

-- ── PLASTERING ────────────────────────────────────────────────────────────────
('Plastering', 'Thistle Browning Plaster 25kg', 'bag', 'National', 9.50, 12.50, 16.00, 'Builders merchant'),
('Plastering', 'Thistle Board Finish Plaster 25kg', 'bag', 'National', 11.00, 14.00, 18.00, 'Builders merchant'),
('Plastering', 'Bonding Coat 25kg', 'bag', 'National', 8.00, 11.00, 14.50, 'Builders merchant'),
('Plastering', 'Scrim Tape 90mm', 'roll', 'National', 2.50, 3.50, 5.00, 'Drylining merchant'),
('Plastering', 'Angle Bead (2.4m)', 'nr', 'National', 1.20, 1.65, 2.30, 'Builders merchant'),

-- ── PLUMBING ──────────────────────────────────────────────────────────────────
('Plumbing', 'Copper Pipe 15mm (3m length)', 'nr', 'National', 9.50, 13.00, 17.50, 'Plumbers merchant'),
('Plumbing', 'Copper Pipe 22mm (3m length)', 'nr', 'National', 15.00, 20.00, 27.00, 'Plumbers merchant'),
('Plumbing', 'Copper Pipe 28mm (3m length)', 'nr', 'National', 22.00, 30.00, 40.00, 'Plumbers merchant'),
('Plumbing', 'Speedfit / Push-fit 15mm Coupler', 'nr', 'National', 1.20, 1.75, 2.50, 'Plumbers merchant'),
('Plumbing', 'Combi Boiler (mid-range, 30kW)', 'nr', 'National', 650.00, 850.00, 1100.00, 'Plumbers merchant'),
('Plumbing', 'Unvented Cylinder 150L', 'nr', 'National', 420.00, 580.00, 750.00, 'Plumbers merchant'),
('Plumbing', 'Thermostatic Radiator Valve (TRV)', 'nr', 'National', 8.00, 12.00, 18.00, 'Plumbers merchant'),
('Plumbing', 'Double Panel Radiator 600x1000mm', 'nr', 'National', 85.00, 120.00, 165.00, 'Plumbers merchant'),
('Plumbing', 'Soil Pipe 110mm PVC (3m)', 'nr', 'National', 12.00, 16.50, 22.00, 'Builders merchant'),
('Plumbing', 'WC Suite (close-coupled, mid-range)', 'nr', 'National', 95.00, 145.00, 220.00, 'Plumbers merchant / trade'),

-- ── ELECTRICAL ───────────────────────────────────────────────────────────────
('Electrical', 'Twin & Earth Cable 2.5mm (100m drum)', 'drum', 'National', 55.00, 72.00, 95.00, 'Electrical wholesaler'),
('Electrical', 'Twin & Earth Cable 6mm (50m drum)', 'drum', 'National', 55.00, 72.00, 95.00, 'Electrical wholesaler'),
('Electrical', 'Metal Back Box 35mm 1-gang', 'nr', 'National', 1.20, 1.65, 2.30, 'Electrical wholesaler'),
('Electrical', 'White Double Socket (screwless)', 'nr', 'National', 4.50, 7.00, 11.00, 'Electrical wholesaler'),
('Electrical', 'White 1-gang Dimmer Switch', 'nr', 'National', 8.00, 14.00, 22.00, 'Electrical wholesaler'),
('Electrical', 'Consumer Unit 18-way RCBO (MK/Hager)', 'nr', 'National', 95.00, 135.00, 185.00, 'Electrical wholesaler'),
('Electrical', 'LED Downlight IP65 (fire-rated)', 'nr', 'National', 7.50, 11.00, 16.00, 'Electrical wholesaler'),
('Electrical', 'EV Charger Unit (7kW, untethered)', 'nr', 'National', 350.00, 480.00, 650.00, 'EV specialist'),

-- ── EXTERNAL WORKS ────────────────────────────────────────────────────────────
('External Works', 'Block Paving (60mm, standard range)', 'm²', 'National', 18.00, 26.00, 36.00, 'Landscape merchant'),
('External Works', 'Block Paving (60mm, standard range)', 'm²', 'London', 24.00, 34.00, 46.00, 'London premium'),
('External Works', 'Tarmac/Macadam Surface Course', 'tonne', 'National', 65.00, 85.00, 110.00, 'Specialist contractor supply'),
('External Works', 'Edging Kerb (concrete, 125x255mm)', 'nr', 'National', 3.50, 5.00, 7.00, 'Landscape merchant'),
('External Works', 'Topsoil (screened, bulk bag)', 'bag', 'National', 55.00, 75.00, 100.00, 'Landscape merchant'),
('External Works', 'Turf (cultivated)', 'm²', 'National', 2.80, 3.80, 5.20, 'Turf supplier'),
('External Works', 'Close Board Fencing Panel 1.8x1.8m', 'nr', 'National', 28.00, 38.00, 52.00, 'Fencing merchant'),
('External Works', 'Concrete Fence Post 100x100mm 2.4m', 'nr', 'National', 14.00, 19.00, 26.00, 'Fencing merchant'),

-- ── FLOORING ─────────────────────────────────────────────────────────────────
('Flooring', 'Screed (semi-dry, 75mm) — supply', 'm²', 'National', 8.50, 12.00, 16.00, 'Screed specialist'),
('Flooring', 'Floor Tile (mid-range ceramic 600x600)', 'm²', 'National', 14.00, 22.00, 38.00, 'Tile merchant'),
('Flooring', 'Luxury Vinyl Tile (LVT, click)', 'm²', 'National', 18.00, 28.00, 45.00, 'Flooring merchant'),
('Flooring', 'Engineered Wood Flooring (14mm)', 'm²', 'National', 28.00, 42.00, 65.00, 'Flooring merchant'),
('Flooring', 'Carpet (mid-range, residential)', 'm²', 'National', 12.00, 18.00, 28.00, 'Carpet merchant'),
('Flooring', 'Acoustic Underlay 5mm', 'm²', 'National', 2.20, 3.20, 4.50, 'Flooring merchant'),

-- ── WINDOWS & DOORS ───────────────────────────────────────────────────────────
('Windows & Doors', 'uPVC Window 1200x1200mm (A-rated)', 'nr', 'National', 220.00, 320.00, 450.00, 'Window fabricator trade'),
('Windows & Doors', 'uPVC Window 600x1200mm (A-rated)', 'nr', 'National', 155.00, 220.00, 310.00, 'Window fabricator trade'),
('Windows & Doors', 'Aluminium Bi-fold Door (per leaf)', 'nr', 'National', 380.00, 520.00, 720.00, 'Aluminium fabricator'),
('Windows & Doors', 'uPVC French Door 1790x2090mm', 'nr', 'National', 450.00, 620.00, 850.00, 'Window fabricator trade'),
('Windows & Doors', 'Composite Front Door (mid-range)', 'nr', 'National', 750.00, 1050.00, 1500.00, 'Door supplier trade'),
('Windows & Doors', 'Internal Door (softwood, pre-hung)', 'nr', 'National', 85.00, 125.00, 185.00, 'Joinery supplier'),
('Windows & Doors', 'Internal Door Handle Set (chrome)', 'nr', 'National', 8.00, 14.00, 22.00, 'Builders merchant'),

-- ── INSULATION ────────────────────────────────────────────────────────────────
('Insulation', 'Celotex / PIR Board 100mm', 'm²', 'National', 12.00, 16.50, 22.00, 'Insulation distributor'),
('Insulation', 'Celotex / PIR Board 150mm', 'm²', 'National', 17.00, 23.00, 30.00, 'Insulation distributor'),
('Insulation', 'Rockwool Slab 100mm (cavity)', 'm²', 'National', 5.50, 7.50, 10.00, 'Insulation distributor'),
('Insulation', 'EPS Expanded Polystyrene 100mm', 'm²', 'National', 5.00, 6.80, 9.00, 'Insulation distributor'),
('Insulation', 'Spray Foam Insulation (per applicator day)', 'day', 'National', 450.00, 650.00, 900.00, 'Spray foam specialist'),
('Insulation', 'Loft Insulation Roll 200mm', 'roll', 'National', 18.00, 24.00, 32.00, 'Builders merchant');
