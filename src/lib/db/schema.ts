import { pgTable, uuid, text, timestamp, numeric, boolean, jsonb, integer } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
    id: uuid('id').primaryKey(),
    email: text('email'),
    fullName: text('full_name'),
    companyName: text('company_name'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const projects = pgTable('projects', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),
    name: text('name'),
    address: text('address'),
    status: text('status'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const estimates = pgTable('estimates', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    versionName: text('version_name'),
    totalCost: numeric('total_cost', { precision: 12, scale: 2 }),
    overheadPct: numeric('overhead_pct', { precision: 5, scale: 2 }),
    profitPct: numeric('profit_pct', { precision: 5, scale: 2 }),
    createdAt: timestamp('created_at').defaultNow(),
});

export const costLibraryItems = pgTable('cost_library_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    tenantId: uuid('tenant_id'),
    code: text('code'),
    description: text('description'),
    unit: text('unit'),
    baseRate: numeric('base_rate', { precision: 12, scale: 2 }),
    category: text('category'),
    isSystemDefault: boolean('is_system_default').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const assemblies = pgTable('assemblies', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    tenantId: uuid('tenant_id'),
    code: text('code'),
    name: text('name'),
    category: text('category'),
    requiredInputs: jsonb('required_inputs'),
    isSystemDefault: boolean('is_system_default').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const assemblyItems = pgTable('assembly_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    assemblyId: uuid('assembly_id').notNull().references(() => assemblies.id, { onDelete: 'cascade' }),
    costLibraryItemId: uuid('cost_library_item_id').notNull().references(() => costLibraryItems.id, { onDelete: 'cascade' }),
    quantityFormula: text('quantity_formula'),
    formulaValidatedAt: timestamp('formula_validated_at'),
    sortOrder: integer('sort_order'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const estimateLines = pgTable('estimate_lines', {
    id: uuid('id').defaultRandom().primaryKey(),
    estimateId: uuid('estimate_id').notNull().references(() => estimates.id, { onDelete: 'cascade' }),
    costLibraryItemId: uuid('cost_library_item_id').references(() => costLibraryItems.id),
    assemblyId: uuid('assembly_id').references(() => assemblies.id),
    description: text('description'),
    unit: text('unit'),
    quantity: numeric('quantity', { precision: 12, scale: 4 }),
    unitRate: numeric('unit_rate', { precision: 12, scale: 2 }),
    lineTotal: numeric('line_total', { precision: 12, scale: 2 }),
    sortOrder: integer('sort_order'),
    createdAt: timestamp('created_at').defaultNow(),
});
