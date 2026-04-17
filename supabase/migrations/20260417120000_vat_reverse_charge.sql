-- P1-1 — VAT Domestic Reverse Charge flag on projects.
--
-- HMRC VAT Notice 735 (effective 1 March 2021): construction services
-- supplied between CIS-registered businesses within the scope of CIS
-- are subject to the Domestic Reverse Charge. The supplier (contractor)
-- does NOT charge VAT on the invoice; the customer self-accounts for
-- it on their own VAT return.
--
-- Default false — the most common Constructa customer is an SME
-- contractor invoicing a DOMESTIC CLIENT (end user), in which case
-- standard VAT applies. The toggle flips on when the client is also
-- CIS-registered (main contractor → subcontractor supply chains).

alter table public.projects
    add column if not exists is_vat_reverse_charge boolean not null default false;

comment on column public.projects.is_vat_reverse_charge is
    'HMRC Domestic Reverse Charge applies (VAT Notice 735). When true, proposal and invoice PDFs show DRC wording instead of VAT @ 20%.';
