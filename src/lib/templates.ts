export interface TemplateLine {
    desc: string;
    qty: number;
    unit: string;
    rate: number;
}

export interface TemplateItem {
    name: string;
    cost: number;
    lines: TemplateLine[];
}

export interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    projectTypes: string[];
    items: TemplateItem[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
    {
        id: "blank",
        name: "Blank Project",
        description: "Start from scratch with an empty schedule.",
        projectTypes: [],
        items: []
    },
    {
        id: "extension_1",
        name: "Single Storey Extension (Standard)",
        description: "Full schedule for a 20-30m² rear extension.",
        projectTypes: ["Extension", "Single Storey Extension", "General Builder / Extensions"],
        items: [
            {
                name: "1. Preliminaries & Site Setup", cost: 2500, lines: [
                    { desc: "Skip Hire (6 yards)", qty: 2, unit: "nr", rate: 250 },
                    { desc: "Heras Fencing", qty: 4, unit: "weeks", rate: 50 },
                    { desc: "Insurance & Admin", qty: 1, unit: "sum", rate: 1000 }
                ]
            },
            {
                name: "2. Substructure / Foundations", cost: 4500, lines: [
                    { desc: "Excavation (Machine & Driver)", qty: 3, unit: "days", rate: 450 },
                    { desc: "Concrete (C25 Gen 3)", qty: 6, unit: "m3", rate: 140 },
                    { desc: "Muck Away (Grab Lorry)", qty: 2, unit: "load", rate: 280 }
                ]
            },
            {
                name: "3. Superstructure (Walls)", cost: 6000, lines: [
                    { desc: "Blocks (7N Dense)", qty: 400, unit: "nr", rate: 1.50 },
                    { desc: "Brickwork (Facing)", qty: 1200, unit: "nr", rate: 1.20 },
                    { desc: "Cavity Insulation (100mm)", qty: 40, unit: "m2", rate: 12.00 },
                    { desc: "Bricklayer Labour", qty: 8, unit: "days", rate: 250 }
                ]
            },
            {
                name: "4. Roof Structure & Cover", cost: 5500, lines: [
                    { desc: "Timber Trusses / Joists", qty: 1, unit: "sum", rate: 1500 },
                    { desc: "Roof Tiles / Slate", qty: 45, unit: "m2", rate: 45 },
                    { desc: "Fascia & Soffit", qty: 12, unit: "m", rate: 35 }
                ]
            },
            {
                name: "5. First Fix (Elec & Plumbing)", cost: 2000, lines: [
                    { desc: "Electrician First Fix", qty: 2, unit: "days", rate: 300 },
                    { desc: "Plumber First Fix (Rads)", qty: 2, unit: "days", rate: 300 }
                ]
            }
        ]
    },
    {
        id: "renovation",
        name: "Full House Renovation",
        description: "Internal strip out and refurb of a 3-bed semi.",
        projectTypes: ["Renovation", "Full Renovation", "General Works"],
        items: [
            { name: "1. Strip Out & Demo", cost: 3000, lines: [] },
            { name: "2. First Fix Carpentry", cost: 4000, lines: [] },
            { name: "3. Plastering", cost: 5000, lines: [] },
            { name: "4. Kitchen Fit", cost: 3500, lines: [] },
            { name: "5. Decoration", cost: 2500, lines: [] }
        ]
    },
    {
        id: "loft_conversion",
        name: "Loft Conversion",
        description: "Standard dormer or Velux loft conversion schedule.",
        projectTypes: ["Loft Conversion"],
        items: [
            {
                name: "1. Preliminaries & Scaffold", cost: 3500, lines: [
                    { desc: "Scaffold Erection & Hire (8 weeks)", qty: 8, unit: "weeks", rate: 300 },
                    { desc: "Skip Hire", qty: 2, unit: "nr", rate: 280 }
                ]
            },
            {
                name: "2. Structural Works", cost: 5500, lines: [
                    { desc: "Steel Beam (RSJ) Supply & Fit", qty: 2, unit: "nr", rate: 1800 },
                    { desc: "Structural Engineer Certification", qty: 1, unit: "sum", rate: 800 }
                ]
            },
            {
                name: "3. Dormer / Roof Works", cost: 7000, lines: [
                    { desc: "Dormer Frame Construction", qty: 1, unit: "sum", rate: 4000 },
                    { desc: "EPDM / Lead Flat Roof", qty: 15, unit: "m2", rate: 120 },
                    { desc: "Velux Windows", qty: 2, unit: "nr", rate: 800 }
                ]
            },
            {
                name: "4. Flooring & Staircase", cost: 4000, lines: [
                    { desc: "Staircase Supply & Fit", qty: 1, unit: "sum", rate: 2500 },
                    { desc: "Floor Joists & Boarding", qty: 25, unit: "m2", rate: 60 }
                ]
            },
            {
                name: "5. First Fix (Elec & Plumbing)", cost: 2500, lines: [
                    { desc: "Electrical First Fix", qty: 3, unit: "days", rate: 300 },
                    { desc: "Plumbing First Fix (En-Suite)", qty: 2, unit: "days", rate: 350 }
                ]
            },
            { name: "6. Plastering & Finishing", cost: 3500, lines: [] }
        ]
    },
    {
        id: "driveway",
        name: "Driveway (Block Paving)",
        description: "Standard residential block paving driveway.",
        projectTypes: ["Driveway", "Groundworks & Civils"],
        items: [
            {
                name: "1. Excavation & Preparation", cost: 1800, lines: [
                    { desc: "Machine Excavation", qty: 1, unit: "days", rate: 650 },
                    { desc: "Muck Away", qty: 1, unit: "load", rate: 300 },
                    { desc: "Hardcore Compaction (MOT Type 1)", qty: 8, unit: "tonnes", rate: 45 }
                ]
            },
            {
                name: "2. Edging & Drainage", cost: 1200, lines: [
                    { desc: "Concrete Edging Kerbs", qty: 30, unit: "m", rate: 25 },
                    { desc: "Channel Drain Supply & Fit", qty: 6, unit: "m", rate: 85 }
                ]
            },
            {
                name: "3. Block Paving", cost: 3500, lines: [
                    { desc: "Block Paving (Charcoal, 200x100)", qty: 50, unit: "m2", rate: 55 },
                    { desc: "Sand Blinding & Jointing", qty: 50, unit: "m2", rate: 15 }
                ]
            }
        ]
    },
    {
        id: "consumer_unit",
        name: "Consumer Unit Upgrade",
        description: "Full consumer unit replacement with RCBOs.",
        projectTypes: ["Consumer Unit Upgrade", "Electrical"],
        items: [
            {
                name: "1. Consumer Unit Replacement", cost: 1200, lines: [
                    { desc: "18-Way Consumer Unit (RCBO)", qty: 1, unit: "nr", rate: 350 },
                    { desc: "Electrician Labour (2 days)", qty: 2, unit: "days", rate: 350 },
                    { desc: "EICR / Certification", qty: 1, unit: "sum", rate: 150 }
                ]
            },
            {
                name: "2. Remedial Works", cost: 600, lines: [
                    { desc: "Bonding & Earth Works", qty: 1, unit: "sum", rate: 250 },
                    { desc: "Smoke / CO Detector Installation", qty: 3, unit: "nr", rate: 80 }
                ]
            }
        ]
    },
    {
        id: "bathroom",
        name: "Full Bathroom Installation",
        description: "Strip and replace full bathroom with tiling.",
        projectTypes: ["Full Bathroom", "Bathroom & Kitchen Fitting", "Bathroom Installation"],
        items: [
            {
                name: "1. Strip Out", cost: 800, lines: [
                    { desc: "Demo & Strip Existing Suite", qty: 1, unit: "sum", rate: 500 },
                    { desc: "Skip Hire / Disposal", qty: 1, unit: "nr", rate: 280 }
                ]
            },
            {
                name: "2. First Fix (Plumbing & Elec)", cost: 1500, lines: [
                    { desc: "Plumber First Fix", qty: 2, unit: "days", rate: 350 },
                    { desc: "Electrician (Lighting, Extraction)", qty: 1, unit: "days", rate: 320 }
                ]
            },
            {
                name: "3. Tiling & Waterproofing", cost: 2800, lines: [
                    { desc: "Waterproof Tanking", qty: 12, unit: "m2", rate: 45 },
                    { desc: "Wall Tiling (100x300)", qty: 25, unit: "m2", rate: 55 },
                    { desc: "Floor Tiling", qty: 6, unit: "m2", rate: 60 }
                ]
            },
            {
                name: "4. Suite Installation", cost: 2200, lines: [
                    { desc: "Sanitary Suite Supply & Fit", qty: 1, unit: "sum", rate: 1200 },
                    { desc: "Plumber Second Fix", qty: 2, unit: "days", rate: 350 }
                ]
            },
            { name: "5. Plastering & Decoration", cost: 800, lines: [] }
        ]
    },
];
