# CONSTRUCTA - PRODUCT VISION & ARCHITECTURE

## 1. The Core Philosophy
Constructa is not just an estimating tool; it is a **Vertical ERP for Construction**.
Our strategy is the **"Golden Thread" of Data**:
1.  **Estimating:** We capture atomic resources (Labor hours, Plant days).
2.  **Scheduling:** We use those estimated hours to auto-generate Gantt charts.
3.  **Reconciliation:** We match actual invoices against the original estimate line items.
4.  **Accounting:** We initially bridge to Xero/Sage, but eventually replace them.

## 2. The Data Architecture (The "Atomic" Rule)
* **NEVER** store flat costs (e.g., "Wall: £500").
* **ALWAYS** store the recipe (e.g., "Wall: 4 hours Labour @ £25 + 100 Bricks @ £1").
* **WHY?** Because we need the *Hours* for the Schedule and the *Material Qty* for the Orders.

## 3. The Roadmap (Sequential Build)
1.  **Estimator (DONE):** Create quotes using first-principles recipes.
2.  **Resource Manager (DONE):** Manage Staff/Plant rates centrally.
3.  **The Proposal (IN PROGRESS):** Generate professional PDF contracts.
4.  **Project CRM:** Capture client details and site metadata.
5.  **Scheduler:** Auto-convert "Estimated Hours" into "Calendar Days."
6.  **Cost Capture:** Upload invoices/timesheets to track "Actuals."
7.  **Reconciliation:** Dashboard showing "Estimated vs Actual" variance.
8.  **The Shield:** AI review of incoming contracts (PDF analysis).

## 4. Strategic Integration
* **Current State:** We are the "Pre-Accounting" layer. We export CSVs to Xero.
* **Future State:** We become the Ledger. We serve as the primary financial OS.

## 5. Technical Constraints
* **Database:** Supabase (PostgreSQL). All tables must have RLS enabled.
* **Auth:** Supabase Auth.
* **Export:** Data must always be exportable (CSV/Excel) to maintain trust.
