export const PROJECT_TEMPLATES = [
    {
        id: "blank",
        name: "Blank Project",
        description: "Start from scratch with an empty schedule.",
        items: []
    },
    {
        id: "extension_1",
        name: "Single Storey Extension (Standard)",
        description: "Full schedule for a 20-30m² rear extension.",
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
        items: [
            { name: "1. Strip Out & Demo", cost: 3000, lines: [] },
            { name: "2. First Fix Carpentry", cost: 4000, lines: [] },
            { name: "3. Plastering", cost: 5000, lines: [] },
            { name: "4. Kitchen Fit", cost: 3500, lines: [] },
            { name: "5. Decoration", cost: 2500, lines: [] }
        ]
    }
];
