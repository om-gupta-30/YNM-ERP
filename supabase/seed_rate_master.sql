-- ============================================================================
-- Supplier-Item Price Master – Dummy Seed Data
-- Multiple suppliers per item so L1/L2/L3 ranking works nicely
-- Run in Supabase SQL Editor
-- ============================================================================

DO $$
DECLARE
  -- Suppliers
  s_tata      UUID; -- SUP-001 Tata Steel
  s_national  UUID; -- SUP-002 National Hardware
  s_asian     UUID; -- SUP-003 Asian Paints
  s_hyd       UUID; -- SUP-004 Hyderabad Rubber
  s_pioneer   UUID; -- SUP-005 Pioneer Plastics
  s_sri       UUID; -- SUP-006 Sri Lakshmi Traders

  -- Items (Raw Materials)
  i_steel     UUID; -- RM-001 MS Steel Plate
  i_rod       UUID; -- RM-002 MS Round Rod
  i_weld      UUID; -- RM-003 Welding Wire
  i_paint_r   UUID; -- RM-004 Paint Red
  i_paint_y   UUID; -- RM-005 Paint Yellow
  i_gasket    UUID; -- RM-006 Rubber Gasket
  i_strap     UUID; -- RM-007 Nylon Strap
  i_bolt      UUID; -- RM-008 Hex Bolt M10
  i_nut       UUID; -- RM-009 Hex Nut M10
  i_spring    UUID; -- RM-010 Compression Spring
  i_bearing   UUID; -- RM-011 Ball Bearing
  i_pipe      UUID; -- RM-012 PVC Pipe
  i_foam      UUID; -- RM-013 EVA Foam Padding
  i_visor     UUID; -- RM-014 Polycarbonate Visor
  i_powder    UUID; -- RM-015 ABC Dry Powder

BEGIN
  -- Look up supplier IDs
  SELECT id INTO s_tata     FROM suppliers WHERE code = 'SUP-001';
  SELECT id INTO s_national FROM suppliers WHERE code = 'SUP-002';
  SELECT id INTO s_asian    FROM suppliers WHERE code = 'SUP-003';
  SELECT id INTO s_hyd      FROM suppliers WHERE code = 'SUP-004';
  SELECT id INTO s_pioneer  FROM suppliers WHERE code = 'SUP-005';
  SELECT id INTO s_sri      FROM suppliers WHERE code = 'SUP-006';

  -- Look up item IDs
  SELECT id INTO i_steel   FROM items WHERE code = 'RM-001';
  SELECT id INTO i_rod     FROM items WHERE code = 'RM-002';
  SELECT id INTO i_weld    FROM items WHERE code = 'RM-003';
  SELECT id INTO i_paint_r FROM items WHERE code = 'RM-004';
  SELECT id INTO i_paint_y FROM items WHERE code = 'RM-005';
  SELECT id INTO i_gasket  FROM items WHERE code = 'RM-006';
  SELECT id INTO i_strap   FROM items WHERE code = 'RM-007';
  SELECT id INTO i_bolt    FROM items WHERE code = 'RM-008';
  SELECT id INTO i_nut     FROM items WHERE code = 'RM-009';
  SELECT id INTO i_spring  FROM items WHERE code = 'RM-010';
  SELECT id INTO i_bearing FROM items WHERE code = 'RM-011';
  SELECT id INTO i_pipe    FROM items WHERE code = 'RM-012';
  SELECT id INTO i_foam    FROM items WHERE code = 'RM-013';
  SELECT id INTO i_visor   FROM items WHERE code = 'RM-014';
  SELECT id INTO i_powder  FROM items WHERE code = 'RM-015';

  -- ════════════════════════════════════════════════════════════════════════
  -- MS Steel Plate 3mm (KG) — 4 suppliers compete
  -- L1: Tata Steel ₹82, L2: Sri Lakshmi ₹88, L3: National ₹92, L4: Pioneer ₹98
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_tata,     i_steel, 82.00,  18, 5,  500, 'Direct mill rate, bulk discount above 2000kg'),
    (s_sri,      i_steel, 88.00,  18, 7,  200, 'Ex-stock Hyderabad warehouse'),
    (s_national, i_steel, 92.00,  18, 8,  100, 'Small lot friendly'),
    (s_pioneer,  i_steel, 98.00,  18, 10, 100, 'Backup supplier');

  -- ════════════════════════════════════════════════════════════════════════
  -- MS Round Rod 12mm (KG) — 3 suppliers
  -- L1: Tata ₹75, L2: National ₹82, L3: Sri Lakshmi ₹86
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_tata,     i_rod, 75.00, 18, 5,  300, 'Mill direct'),
    (s_national, i_rod, 82.00, 18, 6,  100, 'Ready stock'),
    (s_sri,      i_rod, 86.00, 18, 4,  50,  'Quick delivery, small lots OK');

  -- ════════════════════════════════════════════════════════════════════════
  -- Welding Wire 1.2mm (KG) — 3 suppliers
  -- L1: National ₹165, L2: Tata ₹178, L3: Sri Lakshmi ₹185
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_national, i_weld, 165.00, 18, 3, 25, 'AWS certified, ex-stock'),
    (s_tata,     i_weld, 178.00, 18, 7, 50, 'ESAB brand, imported'),
    (s_sri,      i_weld, 185.00, 18, 2, 10, 'Urgent orders OK');

  -- ════════════════════════════════════════════════════════════════════════
  -- Industrial Epoxy Paint Red (KG) — 3 suppliers
  -- L1: Asian ₹220, L2: Pioneer ₹248, L3: Sri Lakshmi ₹265
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_asian,   i_paint_r, 220.00, 18, 4,  20, 'Factory direct, industrial grade'),
    (s_pioneer, i_paint_r, 248.00, 18, 6,  10, 'Reseller, small lots OK'),
    (s_sri,     i_paint_r, 265.00, 18, 3,  5,  'Quick supply, premium pricing');

  -- ════════════════════════════════════════════════════════════════════════
  -- Industrial Epoxy Paint Yellow (KG) — 3 suppliers
  -- L1: Asian ₹215, L2: Pioneer ₹240, L3: Sri Lakshmi ₹258
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_asian,   i_paint_y, 215.00, 18, 4,  20, 'Factory direct'),
    (s_pioneer, i_paint_y, 240.00, 18, 6,  10, 'Reseller'),
    (s_sri,     i_paint_y, 258.00, 18, 3,  5,  'Spot supply');

  -- ════════════════════════════════════════════════════════════════════════
  -- Rubber Gasket 50mm (NOS) — 4 suppliers
  -- L1: Hyd Rubber ₹11.50, L2: Pioneer ₹13.80, L3: Sri Lakshmi ₹14.50, L4: National ₹16.00
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_hyd,      i_gasket, 11.50, 18, 3,   100, 'Own manufacturing, best price'),
    (s_pioneer,  i_gasket, 13.80, 18, 5,   50,  'Moulded rubber, good quality'),
    (s_sri,      i_gasket, 14.50, 18, 4,   25,  'Trader, flexible MOQ'),
    (s_national, i_gasket, 16.00, 18, 7,   200, 'Hardware pack, higher MOQ');

  -- ════════════════════════════════════════════════════════════════════════
  -- Nylon Webbing Strap 45mm (MTR) — 3 suppliers
  -- L1: Pioneer ₹28.00, L2: Hyd Rubber ₹32.50, L3: Sri Lakshmi ₹35.00
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_pioneer, i_strap, 28.00, 12, 7,  200, 'Industrial grade nylon, bulk rolls'),
    (s_hyd,     i_strap, 32.50, 12, 5,  100, 'Cut-to-length available'),
    (s_sri,     i_strap, 35.00, 12, 3,  50,  'Small quantity friendly');

  -- ════════════════════════════════════════════════════════════════════════
  -- Hex Bolt M10x40 SS (NOS) — 4 suppliers
  -- L1: National ₹7.80, L2: Sri Lakshmi ₹8.50, L3: Tata ₹9.20, L4: Pioneer ₹10.00
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_national, i_bolt, 7.80,  18, 3,  500,  'Ludhiana factory, bulk rate'),
    (s_sri,      i_bolt, 8.50,  18, 2,  100,  'Local stock, fast delivery'),
    (s_tata,     i_bolt, 9.20,  18, 5,  1000, 'Premium SS304 grade'),
    (s_pioneer,  i_bolt, 10.00, 18, 4,  200,  'Standard grade');

  -- ════════════════════════════════════════════════════════════════════════
  -- Hex Nut M10 SS (NOS) — 4 suppliers
  -- L1: National ₹4.50, L2: Sri Lakshmi ₹5.20, L3: Tata ₹5.80, L4: Pioneer ₹6.50
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_national, i_nut, 4.50, 18, 3,  500,  'Factory rate'),
    (s_sri,      i_nut, 5.20, 18, 2,  100,  'Local supply'),
    (s_tata,     i_nut, 5.80, 18, 5,  1000, 'Premium grade'),
    (s_pioneer,  i_nut, 6.50, 18, 4,  200,  'Standard');

  -- ════════════════════════════════════════════════════════════════════════
  -- Compression Spring 25mm (NOS) — 3 suppliers
  -- L1: National ₹18.50, L2: Pioneer ₹22.00, L3: Sri Lakshmi ₹24.00
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_national, i_spring, 18.50, 18, 5, 200, 'Tempered steel, consistent quality'),
    (s_pioneer,  i_spring, 22.00, 18, 7, 100, 'Standard spec'),
    (s_sri,      i_spring, 24.00, 18, 3, 50,  'Quick turnaround');

  -- ════════════════════════════════════════════════════════════════════════
  -- Ball Bearing 6205 (NOS) — 3 suppliers
  -- L1: Pioneer ₹285, L2: National ₹310, L3: Sri Lakshmi ₹340
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_pioneer,  i_bearing, 285.00, 18, 5,  50,  'SKF equivalent, good quality'),
    (s_national, i_bearing, 310.00, 18, 7,  25,  'NTN brand imported'),
    (s_sri,      i_bearing, 340.00, 18, 3,  10,  'FAG bearings, premium');

  -- ════════════════════════════════════════════════════════════════════════
  -- PVC Pipe 25mm (MTR) — 3 suppliers
  -- L1: Pioneer ₹36.00, L2: Hyd Rubber ₹40.00, L3: Sri Lakshmi ₹44.00
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_pioneer, i_pipe, 36.00, 18, 4,  100, 'Own extrusion line, cheapest'),
    (s_hyd,     i_pipe, 40.00, 18, 5,  50,  'Standard quality'),
    (s_sri,     i_pipe, 44.00, 18, 3,  25,  'Small lot available');

  -- ════════════════════════════════════════════════════════════════════════
  -- EVA Foam Padding 10mm (NOS) — 3 suppliers
  -- L1: Pioneer ₹38.00, L2: Hyd Rubber ₹42.00, L3: Sri Lakshmi ₹48.00
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_pioneer, i_foam, 38.00, 18, 5,  100, 'Die-cut pads, consistent thickness'),
    (s_hyd,     i_foam, 42.00, 18, 4,  50,  'Custom shapes available'),
    (s_sri,     i_foam, 48.00, 18, 2,  20,  'Spot delivery');

  -- ════════════════════════════════════════════════════════════════════════
  -- Polycarbonate Visor Lens (NOS) — 3 suppliers
  -- L1: Pioneer ₹125, L2: Asian ₹142, L3: Sri Lakshmi ₹158
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_pioneer, i_visor, 125.00, 18, 7,  100, 'Injection moulded, anti-scratch'),
    (s_asian,   i_visor, 142.00, 18, 10, 50,  'Premium anti-fog coating'),
    (s_sri,     i_visor, 158.00, 18, 4,  25,  'Ready stock, quick dispatch');

  -- ════════════════════════════════════════════════════════════════════════
  -- ABC Dry Chemical Powder (KG) — 3 suppliers
  -- L1: Asian ₹55, L2: Tata ₹62, L3: Sri Lakshmi ₹68
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO supplier_item_prices (supplier_id, item_id, unit_price, tax_percent, lead_time_days, min_order_qty, remarks) VALUES
    (s_asian, i_powder, 55.00, 18, 5,  100, 'ISI certified, factory direct'),
    (s_tata,  i_powder, 62.00, 18, 7,  200, 'Premium grade, high purity'),
    (s_sri,   i_powder, 68.00, 18, 3,  25,  'Small quantity OK');

  RAISE NOTICE '✅ Rate Master seed data inserted — 50 supplier-item rates across 15 items and 6 suppliers!';
END $$;
