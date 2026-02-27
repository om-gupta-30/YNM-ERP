-- ============================================================================
-- Soft-delete columns for child tables that previously used hard DELETE
-- ============================================================================

ALTER TABLE pr_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE supplier_quotes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_pr_items_active ON pr_items (pr_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_active ON supplier_quotes (rfq_supplier_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- Referential integrity helper functions
-- These are called from the application layer before deactivating master records
-- to ensure no active dependencies exist. They are pure read functions.
-- ============================================================================

-- Check if an item is referenced by active BOMs, open PRs, open POs, or active Work Orders
CREATE OR REPLACE FUNCTION check_item_dependencies(p_item_id UUID)
RETURNS TABLE(dependency_type TEXT, ref_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 'Active BOM Lines'::TEXT, COUNT(*)
    FROM bom_items bi
    JOIN bom_master bm ON bm.id = bi.bom_id
   WHERE bi.component_item_id = p_item_id
     AND bm.status = 'active'
  UNION ALL
  SELECT 'Open PR Lines'::TEXT, COUNT(*)
    FROM pr_items pi
    JOIN purchase_requisitions pr ON pr.id = pi.pr_id
   WHERE pi.item_id = p_item_id
     AND pi.deleted_at IS NULL
     AND pr.status IN ('draft', 'submitted')
  UNION ALL
  SELECT 'Active Work Orders'::TEXT, COUNT(*)
    FROM work_orders wo
   WHERE wo.item_id = p_item_id
     AND wo.status IN ('open', 'in_progress');
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if a supplier is referenced by open RFQs or open POs
CREATE OR REPLACE FUNCTION check_supplier_dependencies(p_supplier_id UUID)
RETURNS TABLE(dependency_type TEXT, ref_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 'Open RFQs'::TEXT, COUNT(*)
    FROM rfq_suppliers rs
    JOIN rfqs r ON r.id = rs.rfq_id
   WHERE rs.supplier_id = p_supplier_id
     AND r.status IN ('draft', 'sent')
  UNION ALL
  SELECT 'Open Purchase Orders'::TEXT, COUNT(*)
    FROM purchase_orders po
   WHERE po.supplier_id = p_supplier_id
     AND po.status IN ('open', 'partial');
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if a customer is referenced by open Sales Orders
CREATE OR REPLACE FUNCTION check_customer_dependencies(p_customer_id UUID)
RETURNS TABLE(dependency_type TEXT, ref_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 'Open Sales Orders'::TEXT, COUNT(*)
    FROM sales_orders so
   WHERE so.customer_id = p_customer_id
     AND so.status IN ('open', 'in_progress');
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if a BOM is used in active Work Orders
CREATE OR REPLACE FUNCTION check_bom_dependencies(p_bom_id UUID)
RETURNS TABLE(dependency_type TEXT, ref_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 'Active Work Orders'::TEXT, COUNT(*)
    FROM work_orders wo
   WHERE wo.bom_id = p_bom_id
     AND wo.status IN ('open', 'in_progress');
END;
$$ LANGUAGE plpgsql STABLE;
