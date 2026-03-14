-- Seed Data for UK SME Preliminaries (Category 1)
INSERT INTO cost_library (category, sub_category, item_code, short_name, description, unit, rate, is_system)
VALUES 
    ('1. Preliminaries', 'Site Setup & Welfare', '1.1.01', 'Site Cabin (6m)', 'Weekly hire of standard site office with furniture.', 'Week', 85.00, true),
    ('1. Preliminaries', 'Site Setup & Welfare', '1.1.02', 'Portaloo Hire', 'Weekly hire of single chemically treated portaloo including servicing.', 'Week', 25.00, true),
    ('1. Preliminaries', 'Site Protection', '1.2.01', 'Heras Fencing', 'Weekly hire of standard mesh fencing panels including feet and clips (per 3.5m panel).', 'Week', 2.50, true),
    ('1. Preliminaries', 'Site Setup & Welfare', '1.3.01', 'Site Signage Pack', 'One-off cost for mandatory health & safety and site identification signs.', 'Sum', 120.00, true),
    ('1. Preliminaries', 'Site Setup & Welfare', '1.4.01', 'Temporary Power Setup', 'Initial provision and setup of temporary site power and lighting (non-recurring).', 'Sum', 450.00, true);
