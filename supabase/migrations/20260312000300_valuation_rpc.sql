-- RPC: create_valuation_and_invoice
-- Ensures atomic creation of interim invoices (Valuations)
CREATE OR REPLACE FUNCTION public.create_valuation_and_invoice(
    p_project_id UUID,
    p_organization_id UUID,
    p_invoice_number TEXT,
    p_amount NUMERIC,
    p_type TEXT DEFAULT 'Interim'
)
RETURNS UUID AS $$
DECLARE
    new_invoice_id UUID;
BEGIN
    -- 1. Insert the invoice
    INSERT INTO public.invoices (
        project_id, 
        organization_id, 
        invoice_number, 
        amount, 
        status, 
        type
    )
    VALUES (
        p_project_id, 
        p_organization_id, 
        p_invoice_number, 
        p_amount, 
        'Draft', 
        p_type
    )
    RETURNING id INTO new_invoice_id;

    -- Note: In future phases, we will also expand this to handle 
    -- 'valuation_lines' to snapshot the progress amounts.

    RETURN new_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
