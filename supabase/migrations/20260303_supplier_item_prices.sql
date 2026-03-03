-- Supplier-Item Price Master (Rate Card)
-- Stores negotiated / standard rates per supplier-item pair for automatic
-- L1/L2/L3 ranking and RFQ quote auto-population.

CREATE TABLE IF NOT EXISTS supplier_item_prices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  unit_price    NUMERIC(14, 4) NOT NULL CHECK (unit_price >= 0),
  tax_percent   NUMERIC(5, 2) NOT NULL DEFAULT 18 CHECK (tax_percent >= 0 AND tax_percent <= 100),
  lead_time_days INTEGER NOT NULL DEFAULT 7 CHECK (lead_time_days >= 0),
  min_order_qty NUMERIC(14, 4) NOT NULL DEFAULT 1 CHECK (min_order_qty > 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE,
  effective_to   DATE,
  remarks       TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, item_id)
);

CREATE INDEX idx_sip_supplier ON supplier_item_prices (supplier_id);
CREATE INDEX idx_sip_item     ON supplier_item_prices (item_id);
CREATE INDEX idx_sip_active   ON supplier_item_prices (is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE supplier_item_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read supplier_item_prices"
  ON supplier_item_prices FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert supplier_item_prices"
  ON supplier_item_prices FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update supplier_item_prices"
  ON supplier_item_prices FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete supplier_item_prices"
  ON supplier_item_prices FOR DELETE
  TO authenticated USING (true);
