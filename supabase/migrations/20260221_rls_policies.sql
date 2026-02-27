-- ============================================================================
-- RLS POLICIES — restrict all tables to authenticated users only
-- ============================================================================

-- Helper: enable RLS + drop any existing permissive policies, then add auth-only
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'factories','app_users','items','suppliers','customers',
      'bom_master','bom_items',
      'purchase_requisitions','pr_items',
      'rfqs','rfq_suppliers','supplier_quotes',
      'purchase_orders','po_items',
      'gate_entries','grns','grn_items',
      'stock_ledger',
      'work_orders','production_issues','production_punches',
      'sales_orders','so_items',
      'dispatches','dispatch_items',
      'invoices','audit_logs'
    ])
  LOOP
    -- Enable RLS (idempotent)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop legacy wide-open policies if they exist
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all users" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "public_read" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "anon_read" ON public.%I', tbl);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- SELECT: authenticated only
    EXECUTE format(
      'CREATE POLICY "auth_select" ON public.%I FOR SELECT TO authenticated USING (true)',
      tbl
    );

    -- INSERT: authenticated only
    EXECUTE format(
      'CREATE POLICY "auth_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
      tbl
    );

    -- UPDATE: authenticated only
    EXECUTE format(
      'CREATE POLICY "auth_update" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      tbl
    );

    -- DELETE: authenticated only
    EXECUTE format(
      'CREATE POLICY "auth_delete" ON public.%I FOR DELETE TO authenticated USING (true)',
      tbl
    );

    RAISE NOTICE 'RLS configured for %', tbl;
  END LOOP;
END
$$;
