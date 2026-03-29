export const PROJECT_TYPES_BY_TRADE: Record<string, string[]> = {
    "General Builder / Extensions": ["Single Storey Extension", "Double Storey Extension", "Loft Conversion", "Garage Conversion", "New Build", "Full Renovation", "Structural Alterations", "Other"],
    "Electrical": ["Consumer Unit Upgrade", "Full Rewire", "EV Charger Installation", "Solar PV Installation", "Lighting Design", "Smart Home", "Commercial Electrical", "Other"],
    "Plumbing & Heating": ["Boiler Replacement", "Central Heating System", "Bathroom Installation", "Kitchen Plumbing", "Underfloor Heating", "Heat Pump", "Leak Repair", "Other"],
    "Roofing": ["Full Roof Replacement", "Flat Roof", "Roof Repair", "Fascia & Guttering", "Velux Windows", "Green Roof", "Other"],
    "Groundworks & Civils": ["Foundations", "Drainage & Utilities", "Driveway", "Retaining Wall", "Earthworks", "Concrete Slab", "Piling", "Other"],
    "Painting & Decorating": ["Interior Decoration", "Exterior Decoration", "Wallpaper", "Commercial Decorating", "Other"],
    "Joinery & Carpentry": ["Kitchen Installation", "Staircase", "Fitted Wardrobes", "Window & Door Fitting", "Flooring", "Bespoke Joinery", "Other"],
    "Bathroom & Kitchen Fitting": ["Full Bathroom", "En-Suite", "Full Kitchen", "Kitchen Refresh", "Utility Room", "Other"],
    "Landscaping & Fencing": ["Garden Design & Build", "Patio & Decking", "Fencing & Gates", "Artificial Grass", "Irrigation", "Other"],
    "Multi-trade / Other": ["Extension", "Renovation", "New Build", "Maintenance & Repair", "Commercial Works", "Other"],
    "default": ["Extension", "Loft Conversion", "New Build", "Renovation", "Bathroom/Kitchen", "Roofing", "General Works", "Other"],
};

export function getProjectTypes(businessType?: string | null): string[] {
    if (businessType && PROJECT_TYPES_BY_TRADE[businessType]) {
        return PROJECT_TYPES_BY_TRADE[businessType];
    }
    return PROJECT_TYPES_BY_TRADE["default"];
}
