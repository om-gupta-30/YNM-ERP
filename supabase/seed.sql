-- ============================================================================
-- YNM ERP – Comprehensive Seed Data
-- Run in Supabase SQL Editor AFTER creating users (auth + app_users + factory)
-- ============================================================================

DO $$
DECLARE
  -- Factory
  fid UUID;

  -- Users (looked up from app_users)
  uid_admin      UUID;
  uid_planning   UUID;
  uid_purchase   UUID;
  uid_sales      UUID;
  uid_accounts   UUID;
  uid_security   UUID;
  uid_stores     UUID;
  uid_production UUID;

  -- ── Items: Raw Materials ──
  item_steel_plate   UUID := gen_random_uuid();
  item_ms_rod        UUID := gen_random_uuid();
  item_welding_wire  UUID := gen_random_uuid();
  item_paint_red     UUID := gen_random_uuid();
  item_paint_yellow  UUID := gen_random_uuid();
  item_rubber_gasket UUID := gen_random_uuid();
  item_nylon_strap   UUID := gen_random_uuid();
  item_bolt_m10      UUID := gen_random_uuid();
  item_nut_m10       UUID := gen_random_uuid();
  item_spring        UUID := gen_random_uuid();
  item_bearing       UUID := gen_random_uuid();
  item_pvc_pipe      UUID := gen_random_uuid();
  item_foam_pad      UUID := gen_random_uuid();
  item_visor_lens    UUID := gen_random_uuid();
  item_dry_powder    UUID := gen_random_uuid();

  -- ── Items: Semi-Finished ──
  item_helmet_shell  UUID := gen_random_uuid();
  item_harness_frame UUID := gen_random_uuid();
  item_ext_body      UUID := gen_random_uuid();

  -- ── Items: Finished Goods ──
  item_safety_helmet  UUID := gen_random_uuid();
  item_safety_harness UUID := gen_random_uuid();
  item_fire_ext       UUID := gen_random_uuid();
  item_safety_shoe    UUID := gen_random_uuid();
  item_safety_goggle  UUID := gen_random_uuid();

  -- ── Items: Trading ──
  item_first_aid_kit UUID := gen_random_uuid();
  item_safety_cone   UUID := gen_random_uuid();
  item_ear_plug      UUID := gen_random_uuid();

  -- ── Suppliers ──
  sup_tata_steel  UUID := gen_random_uuid();
  sup_national_hw UUID := gen_random_uuid();
  sup_asian_paint UUID := gen_random_uuid();
  sup_hyd_rubber  UUID := gen_random_uuid();
  sup_pioneer     UUID := gen_random_uuid();
  sup_sri_lakshmi UUID := gen_random_uuid();

  -- ── Customers ──
  cust_tata_proj UUID := gen_random_uuid();
  cust_lnt       UUID := gen_random_uuid();
  cust_reliance  UUID := gen_random_uuid();
  cust_adani     UUID := gen_random_uuid();
  cust_hero      UUID := gen_random_uuid();

  -- ── BOMs ──
  bom_helmet  UUID := gen_random_uuid();
  bom_harness UUID := gen_random_uuid();
  bom_fire    UUID := gen_random_uuid();

  -- ── Purchase Requisitions ──
  pr_draft     UUID := gen_random_uuid();
  pr_submitted UUID := gen_random_uuid();
  pr_approved1 UUID := gen_random_uuid();
  pr_approved2 UUID := gen_random_uuid();
  pr_rejected  UUID := gen_random_uuid();
  pr_closed    UUID := gen_random_uuid();

  -- ── RFQs ──
  rfq_draft    UUID := gen_random_uuid();
  rfq_sent     UUID := gen_random_uuid();
  rfq_received UUID := gen_random_uuid();
  rfq_closed   UUID := gen_random_uuid();

  -- ── RFQ Suppliers ──
  rfqs_pending  UUID := gen_random_uuid();
  rfqs_sent1    UUID := gen_random_uuid();
  rfqs_sent2    UUID := gen_random_uuid();
  rfqs_quoted1  UUID := gen_random_uuid();
  rfqs_quoted2  UUID := gen_random_uuid();
  rfqs_declined UUID := gen_random_uuid();
  rfqs_closed1  UUID := gen_random_uuid();
  rfqs_closed2  UUID := gen_random_uuid();

  -- ── Purchase Orders ──
  po_draft     UUID := gen_random_uuid();
  po_open      UUID := gen_random_uuid();
  po_ack       UUID := gen_random_uuid();
  po_partial   UUID := gen_random_uuid();
  po_received  UUID := gen_random_uuid();
  po_closed    UUID := gen_random_uuid();
  po_cancelled UUID := gen_random_uuid();

  -- ── Gate Entries ──
  ge_open1   UUID := gen_random_uuid();
  ge_open2   UUID := gen_random_uuid();
  ge_closed1 UUID := gen_random_uuid();
  ge_closed2 UUID := gen_random_uuid();
  ge_closed3 UUID := gen_random_uuid();

  -- ── GRNs ──
  grn_draft     UUID := gen_random_uuid();
  grn_accepted1 UUID := gen_random_uuid();
  grn_accepted2 UUID := gen_random_uuid();
  grn_partial   UUID := gen_random_uuid();
  grn_rejected  UUID := gen_random_uuid();

  -- ── Work Orders ──
  wo_draft      UUID := gen_random_uuid();
  wo_released   UUID := gen_random_uuid();
  wo_inprog1    UUID := gen_random_uuid();
  wo_inprog2    UUID := gen_random_uuid();
  wo_completed1 UUID := gen_random_uuid();
  wo_completed2 UUID := gen_random_uuid();

  -- ── Sales Orders ──
  so_draft      UUID := gen_random_uuid();
  so_confirmed  UUID := gen_random_uuid();
  so_inprod     UUID := gen_random_uuid();
  so_ready      UUID := gen_random_uuid();
  so_dispatched UUID := gen_random_uuid();
  so_invoiced   UUID := gen_random_uuid();

  -- ── Dispatches ──
  disp_draft      UUID := gen_random_uuid();
  disp_pending    UUID := gen_random_uuid();
  disp_dispatched UUID := gen_random_uuid();
  disp_delivered  UUID := gen_random_uuid();

  -- ── Invoices ──
  inv_issued UUID := gen_random_uuid();

  -- ── SO Items (need fixed IDs for dispatch_items.so_item_id FK) ──
  -- so_ready items (disp_draft)
  soi_ready_harness UUID := gen_random_uuid();
  soi_ready_goggle  UUID := gen_random_uuid();
  soi_ready_cone    UUID := gen_random_uuid();
  -- so_inprod items (disp_pending)
  soi_inprod_helmet UUID := gen_random_uuid();
  soi_inprod_shoe   UUID := gen_random_uuid();
  soi_inprod_fak    UUID := gen_random_uuid();
  -- so_dispatched items (disp_dispatched)
  soi_disp_fire     UUID := gen_random_uuid();
  soi_disp_fak      UUID := gen_random_uuid();
  -- so_invoiced items (disp_delivered)
  soi_inv_helmet    UUID := gen_random_uuid();
  soi_inv_harness   UUID := gen_random_uuid();
  soi_inv_fire      UUID := gen_random_uuid();
  soi_inv_goggle    UUID := gen_random_uuid();

BEGIN
  -- ════════════════════════════════════════════════════════════════════════
  -- Look up existing factory + user IDs
  -- ════════════════════════════════════════════════════════════════════════
  SELECT id INTO fid FROM factories WHERE code = 'YNM-HYD' LIMIT 1;
  IF fid IS NULL THEN RAISE EXCEPTION 'Factory YNM-HYD not found. Create users first.'; END IF;

  SELECT id INTO uid_admin      FROM app_users WHERE role = 'admin'      LIMIT 1;
  SELECT id INTO uid_planning   FROM app_users WHERE role = 'planning'   LIMIT 1;
  SELECT id INTO uid_purchase   FROM app_users WHERE role = 'purchase'   LIMIT 1;
  SELECT id INTO uid_sales      FROM app_users WHERE role = 'sales'      LIMIT 1;
  SELECT id INTO uid_accounts   FROM app_users WHERE role = 'accounts'   LIMIT 1;
  SELECT id INTO uid_security   FROM app_users WHERE role = 'security'   LIMIT 1;
  SELECT id INTO uid_stores     FROM app_users WHERE role = 'stores'     LIMIT 1;
  SELECT id INTO uid_production FROM app_users WHERE role = 'production' LIMIT 1;

  -- ════════════════════════════════════════════════════════════════════════
  -- ITEMS  (15 raw + 3 semi-finished + 5 finished + 3 trading = 26)
  -- ════════════════════════════════════════════════════════════════════════

  -- Raw Materials
  INSERT INTO items (id, code, name, item_type, category, uom, hsn_code, reorder_level, is_active) VALUES
    (item_steel_plate,   'RM-001', 'MS Steel Plate 3mm',         'raw_material', 'Metals',      'KG',  '7208', 500,  true),
    (item_ms_rod,        'RM-002', 'MS Round Rod 12mm',          'raw_material', 'Metals',      'KG',  '7214', 300,  true),
    (item_welding_wire,  'RM-003', 'Welding Wire 1.2mm',         'raw_material', 'Consumables', 'KG',  '8311', 50,   true),
    (item_paint_red,     'RM-004', 'Industrial Epoxy Paint Red',  'raw_material', 'Chemicals',   'KG',  '3208', 100,  true),
    (item_paint_yellow,  'RM-005', 'Industrial Epoxy Paint Yellow','raw_material','Chemicals',   'KG',  '3208', 100,  true),
    (item_rubber_gasket, 'RM-006', 'Rubber Gasket 50mm',         'raw_material', 'Rubber',      'NOS', '4016', 200,  true),
    (item_nylon_strap,   'RM-007', 'Nylon Webbing Strap 45mm',   'raw_material', 'Textiles',    'MTR', '5607', 500,  true),
    (item_bolt_m10,      'RM-008', 'Hex Bolt M10x40 SS',         'raw_material', 'Hardware',    'NOS', '7318', 1000, true),
    (item_nut_m10,       'RM-009', 'Hex Nut M10 SS',             'raw_material', 'Hardware',    'NOS', '7318', 1000, true),
    (item_spring,        'RM-010', 'Compression Spring 25mm',    'raw_material', 'Hardware',    'NOS', '7320', 300,  true),
    (item_bearing,       'RM-011', 'Ball Bearing 6205',          'raw_material', 'Bearings',    'NOS', '8482', 100,  true),
    (item_pvc_pipe,      'RM-012', 'PVC Pipe 25mm',              'raw_material', 'Plastics',    'MTR', '3917', 200,  true),
    (item_foam_pad,      'RM-013', 'EVA Foam Padding 10mm',      'raw_material', 'Plastics',    'NOS', '3921', 300,  true),
    (item_visor_lens,    'RM-014', 'Polycarbonate Visor Lens',   'raw_material', 'Plastics',    'NOS', '9004', 200,  true),
    (item_dry_powder,    'RM-015', 'ABC Dry Chemical Powder',    'raw_material', 'Chemicals',   'KG',  '3813', 150,  true);

  -- Semi-Finished
  INSERT INTO items (id, code, name, item_type, category, uom, hsn_code, reorder_level, is_active) VALUES
    (item_helmet_shell,  'SF-001', 'Helmet Shell Assembly',    'semi_finished', 'Assemblies', 'NOS', '6506', 50, true),
    (item_harness_frame, 'SF-002', 'Harness Frame Assembly',   'semi_finished', 'Assemblies', 'NOS', '7326', 40, true),
    (item_ext_body,      'SF-003', 'Extinguisher Body Welded', 'semi_finished', 'Assemblies', 'NOS', '7311', 30, true);

  -- Finished Goods
  INSERT INTO items (id, code, name, item_type, category, uom, hsn_code, reorder_level, is_active) VALUES
    (item_safety_helmet,  'FG-001', 'YNM Industrial Safety Helmet',    'finished_good', 'Head Protection', 'NOS', '6506', 100, true),
    (item_safety_harness, 'FG-002', 'YNM Full Body Safety Harness',    'finished_good', 'Fall Protection', 'NOS', '6307', 50,  true),
    (item_fire_ext,       'FG-003', 'YNM Fire Extinguisher 5kg ABC',   'finished_good', 'Fire Safety',     'NOS', '8424', 30,  true),
    (item_safety_shoe,    'FG-004', 'YNM Safety Shoe Steel Toe',       'finished_good', 'Foot Protection', 'NOS', '6403', 80,  true),
    (item_safety_goggle,  'FG-005', 'YNM Safety Goggle Anti-Fog',      'finished_good', 'Eye Protection',  'NOS', '9004', 120, true);

  -- Trading
  INSERT INTO items (id, code, name, item_type, category, uom, hsn_code, reorder_level, is_active) VALUES
    (item_first_aid_kit, 'TR-001', 'First Aid Kit Industrial 50-person', 'consumable', 'Medical',        'NOS', '3006', 50,  true),
    (item_safety_cone,   'TR-002', 'Traffic Safety Cone 750mm',          'consumable', 'Traffic Safety',  'NOS', '3926', 100, true),
    (item_ear_plug,      'TR-003', 'Foam Ear Plug (pair)',               'consumable', 'Hearing Safety',  'NOS', '9021', 500, true);

  -- ════════════════════════════════════════════════════════════════════════
  -- SUPPLIERS  (6)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO suppliers (id, code, name, gstin, contact_person, phone, email, address, payment_terms, is_active) VALUES
    (sup_tata_steel,  'SUP-001', 'Tata Steel Distributors',   '36AABCT1234F1ZP', 'Rajesh Kumar',  '9876543210', 'rajesh@tatasteel.com',    '42, Industrial Area, Jamshedpur, Jharkhand 831001',            'Net 30', true),
    (sup_national_hw, 'SUP-002', 'National Hardware Supplies', '36AANCS5678G1ZQ', 'Vikram Singh',  '9876543211', 'vikram@nationalhw.com',   '15, Bolt Market, Ludhiana, Punjab 141001',                     'Net 45', true),
    (sup_asian_paint, 'SUP-003', 'Asian Paints Industrial',    '27AABCA4321H1ZR', 'Priya Sharma',  '9876543212', 'priya@asianpaints.com',   '6A, Andheri East, Mumbai, Maharashtra 400069',                 'Net 30', true),
    (sup_hyd_rubber,  'SUP-004', 'Hyderabad Rubber Works',     '36AABHR8765I1ZS', 'Mohammad Ali',  '9876543213', 'ali@hydrubber.com',       '78, Balanagar Industrial Area, Hyderabad, Telangana 500037',   'Net 15', true),
    (sup_pioneer,     'SUP-005', 'Pioneer Plastics & Polymers','36AABPP2468J1ZT', 'Amit Patel',    '9876543214', 'amit@pioneerplastics.com','904, Patancheru Industrial Area, Hyderabad 502319',            'Net 30', true),
    (sup_sri_lakshmi, 'SUP-006', 'Sri Lakshmi Traders',        '36AABSL1357K1ZU', 'Suresh Reddy',  '9876543215', 'suresh@sltraders.com',    '23, Nacharam Industrial Area, Hyderabad, Telangana 500076',    'Net 15', true);

  -- ════════════════════════════════════════════════════════════════════════
  -- CUSTOMERS  (5)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO customers (id, code, name, gstin, address, contact_person, phone, email, payment_terms, is_active) VALUES
    (cust_tata_proj, 'CUST-001', 'Tata Projects Limited',   '36AABCT9876L1ZV', '{"billing":"Tata Projects, Saifabad, Hyderabad 500004","shipping":"Site Office, TSIIC Adibatla, RR Dist 501510"}',             'Ramesh Iyer',  '9988776601', 'procurement@tataprojects.com', 'Net 60', true),
    (cust_lnt,       'CUST-002', 'Larsen & Toubro Ltd',     '27AABCL5432M1ZW', '{"billing":"L&T House, Ballard Estate, Mumbai 400001","shipping":"L&T Construction, Gachibowli, Hyderabad 500032"}',          'Sunil Mehta',  '9988776602', 'safety@lnt.com',               'Net 45', true),
    (cust_reliance,  'CUST-003', 'Reliance Industries Ltd',  '27AABCR2109N1ZX', '{"billing":"Maker Chambers IV, Nariman Point, Mumbai 400021","shipping":"Reliance Refinery, Jamnagar, Gujarat 361140"}',      'Deepak Joshi', '9988776603', 'hse@ril.com',                  'Net 30', true),
    (cust_adani,     'CUST-004', 'Adani Enterprises Ltd',    '24AABCA6543O1ZY', '{"billing":"Adani House, Nr Mithakhali Circle, Ahmedabad 380009","shipping":"Mundra Port, Kutch, Gujarat 370421"}',           'Kiran Shah',   '9988776604', 'safety@adani.com',             'Net 45', true),
    (cust_hero,      'CUST-005', 'Hero MotoCorp Ltd',        '06AABCH3210P1ZZ', '{"billing":"34, Community Centre, Basant Lok, New Delhi 110057","shipping":"Hero Plant, Dharuhera, Haryana 123106"}',         'Naveen Gupta', '9988776605', 'ehs@heromotocorp.com',         'Net 30', true);

  -- ════════════════════════════════════════════════════════════════════════
  -- BOMs  (3 active BOMs for finished goods)
  -- ════════════════════════════════════════════════════════════════════════

  -- Safety Helmet BOM
  INSERT INTO bom_master (id, finished_item_id, description, version, status, created_by) VALUES
    (bom_helmet, item_safety_helmet, 'Standard Industrial Safety Helmet – v1', 1, 'active', uid_planning);
  INSERT INTO bom_items (id, bom_id, component_item_id, quantity, uom, scrap_percent) VALUES
    (gen_random_uuid(), bom_helmet, item_steel_plate,   0.35, 'KG',  5),
    (gen_random_uuid(), bom_helmet, item_helmet_shell,  1,    'NOS', 2),
    (gen_random_uuid(), bom_helmet, item_foam_pad,      1,    'NOS', 3),
    (gen_random_uuid(), bom_helmet, item_visor_lens,    1,    'NOS', 2),
    (gen_random_uuid(), bom_helmet, item_rubber_gasket, 2,    'NOS', 3),
    (gen_random_uuid(), bom_helmet, item_bolt_m10,      4,    'NOS', 5),
    (gen_random_uuid(), bom_helmet, item_paint_yellow,  0.08, 'KG',  10);

  -- Safety Harness BOM
  INSERT INTO bom_master (id, finished_item_id, description, version, status, created_by) VALUES
    (bom_harness, item_safety_harness, 'Full Body Safety Harness – v1', 1, 'active', uid_planning);
  INSERT INTO bom_items (id, bom_id, component_item_id, quantity, uom, scrap_percent) VALUES
    (gen_random_uuid(), bom_harness, item_nylon_strap,   6,    'MTR', 4),
    (gen_random_uuid(), bom_harness, item_harness_frame, 1,    'NOS', 2),
    (gen_random_uuid(), bom_harness, item_bolt_m10,      8,    'NOS', 5),
    (gen_random_uuid(), bom_harness, item_nut_m10,       8,    'NOS', 5),
    (gen_random_uuid(), bom_harness, item_spring,        4,    'NOS', 3),
    (gen_random_uuid(), bom_harness, item_rubber_gasket, 4,    'NOS', 3);

  -- Fire Extinguisher BOM
  INSERT INTO bom_master (id, finished_item_id, description, version, status, created_by) VALUES
    (bom_fire, item_fire_ext, 'ABC Fire Extinguisher 5kg – v1', 1, 'active', uid_planning);
  INSERT INTO bom_items (id, bom_id, component_item_id, quantity, uom, scrap_percent) VALUES
    (gen_random_uuid(), bom_fire, item_steel_plate,   2.5,  'KG',  4),
    (gen_random_uuid(), bom_fire, item_ext_body,      1,    'NOS', 2),
    (gen_random_uuid(), bom_fire, item_pvc_pipe,      0.5,  'MTR', 5),
    (gen_random_uuid(), bom_fire, item_rubber_gasket, 3,    'NOS', 2),
    (gen_random_uuid(), bom_fire, item_dry_powder,    5.5,  'KG',  3),
    (gen_random_uuid(), bom_fire, item_paint_red,     0.25, 'KG',  10),
    (gen_random_uuid(), bom_fire, item_bearing,       1,    'NOS', 2);

  -- ════════════════════════════════════════════════════════════════════════
  -- PURCHASE REQUISITIONS  (6 – every status)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO purchase_requisitions (id, pr_number, factory_id, raised_by, remarks, status, created_at) VALUES
    (pr_draft,     'PR-2026-001', fid, uid_planning,   'Raw material for Q1 helmet production',      'draft',     '2026-01-05 09:00:00+05:30'),
    (pr_submitted, 'PR-2026-002', fid, uid_planning,   'Urgent: welding consumables running low',    'submitted', '2026-01-10 10:30:00+05:30'),
    (pr_approved1, 'PR-2026-003', fid, uid_planning,   'Hardware items for helmet & harness lines',  'approved',  '2026-01-12 11:00:00+05:30'),
    (pr_approved2, 'PR-2026-004', fid, uid_production, 'Steel + chemicals for fire ext batch',       'approved',  '2026-01-15 09:30:00+05:30'),
    (pr_rejected,  'PR-2026-005', fid, uid_stores,     'Duplicate – already covered in PR-003',      'rejected',  '2026-01-18 14:00:00+05:30'),
    (pr_closed,    'PR-2025-006', fid, uid_planning,   'Rubber gaskets for Q4-2025 production run',  'closed',    '2025-12-01 08:00:00+05:30');

  UPDATE purchase_requisitions SET approved_by = uid_admin, approved_at = '2026-01-14 10:00:00+05:30' WHERE id = pr_approved1;
  UPDATE purchase_requisitions SET approved_by = uid_admin, approved_at = '2026-01-17 09:00:00+05:30' WHERE id = pr_approved2;
  UPDATE purchase_requisitions SET approved_by = uid_admin, approved_at = '2026-01-19 15:00:00+05:30' WHERE id = pr_rejected;
  UPDATE purchase_requisitions SET approved_by = uid_admin, approved_at = '2025-12-02 10:00:00+05:30' WHERE id = pr_closed;

  -- PR Items
  INSERT INTO pr_items (id, pr_id, item_id, quantity, uom, remarks) VALUES
    (gen_random_uuid(), pr_draft,     item_steel_plate,   1000, 'KG',  'For helmet shell pressing'),
    (gen_random_uuid(), pr_draft,     item_foam_pad,       500, 'NOS', 'Inner padding'),
    (gen_random_uuid(), pr_draft,     item_visor_lens,     500, 'NOS', 'Helmet visors'),
    (gen_random_uuid(), pr_submitted, item_welding_wire,   100, 'KG',  'Urgent – current stock < 60 kg'),
    (gen_random_uuid(), pr_submitted, item_bearing,        200, 'NOS', 'For fire ext valve assembly'),
    (gen_random_uuid(), pr_approved1, item_bolt_m10,      5000, 'NOS', 'M10 bolts for helmets + harness'),
    (gen_random_uuid(), pr_approved1, item_nut_m10,       5000, 'NOS', 'M10 nuts'),
    (gen_random_uuid(), pr_approved1, item_spring,        1000, 'NOS', 'Compression springs for harness'),
    (gen_random_uuid(), pr_approved2, item_steel_plate,   2000, 'KG',  'Fire ext body cylinders'),
    (gen_random_uuid(), pr_approved2, item_dry_powder,     500, 'KG',  'ABC powder fill'),
    (gen_random_uuid(), pr_approved2, item_pvc_pipe,       300, 'MTR', 'Nozzle hose pipes'),
    (gen_random_uuid(), pr_rejected,  item_bolt_m10,      5000, 'NOS', 'Duplicate of PR-003'),
    (gen_random_uuid(), pr_closed,    item_rubber_gasket, 3000, 'NOS', 'Completed – PO raised & received');

  -- ════════════════════════════════════════════════════════════════════════
  -- RFQs  (4 – every status)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO rfqs (id, rfq_number, pr_id, factory_id, created_by, status, created_at) VALUES
    (rfq_draft,    'RFQ-2026-001', pr_submitted, fid, uid_purchase, 'draft',    '2026-01-11 10:00:00+05:30'),
    (rfq_sent,     'RFQ-2026-002', pr_approved1, fid, uid_purchase, 'sent',     '2026-01-13 11:00:00+05:30'),
    (rfq_received, 'RFQ-2026-003', pr_approved2, fid, uid_purchase, 'received', '2026-01-16 09:00:00+05:30'),
    (rfq_closed,   'RFQ-2025-004', pr_closed,    fid, uid_purchase, 'closed',   '2025-12-05 10:00:00+05:30');

  -- RFQ Suppliers (mix of pending / sent / quoted / declined)
  INSERT INTO rfq_suppliers (id, rfq_id, supplier_id, status, sent_at, responded_at) VALUES
    (rfqs_pending,  rfq_draft,    sup_asian_paint, 'pending', NULL,                              NULL),
    (rfqs_sent1,    rfq_sent,     sup_national_hw, 'sent',    '2026-01-13 12:00:00+05:30',      NULL),
    (rfqs_sent2,    rfq_sent,     sup_pioneer,     'sent',    '2026-01-13 12:00:00+05:30',      NULL),
    (rfqs_quoted1,  rfq_received, sup_tata_steel,  'quoted',  '2026-01-16 10:00:00+05:30',      '2026-01-18 14:00:00+05:30'),
    (rfqs_quoted2,  rfq_received, sup_asian_paint, 'quoted',  '2026-01-16 10:00:00+05:30',      '2026-01-19 11:00:00+05:30'),
    (rfqs_declined, rfq_received, sup_sri_lakshmi, 'declined','2026-01-16 10:00:00+05:30',      '2026-01-17 09:00:00+05:30'),
    (rfqs_closed1,  rfq_closed,   sup_hyd_rubber,  'quoted',  '2025-12-05 11:00:00+05:30',      '2025-12-07 10:00:00+05:30'),
    (rfqs_closed2,  rfq_closed,   sup_national_hw, 'quoted',  '2025-12-05 11:00:00+05:30',      '2025-12-08 09:00:00+05:30');

  -- Supplier Quotes
  INSERT INTO supplier_quotes (id, rfq_supplier_id, item_id, quantity, uom, unit_price, tax_percent, lead_time_days) VALUES
    (gen_random_uuid(), rfqs_quoted1, item_steel_plate, 2000, 'KG',  85.00, 18, 7),
    (gen_random_uuid(), rfqs_quoted1, item_dry_powder,   500, 'KG',  62.00, 18, 5),
    (gen_random_uuid(), rfqs_quoted1, item_pvc_pipe,     300, 'MTR', 42.00, 18, 5),
    (gen_random_uuid(), rfqs_quoted2, item_steel_plate, 2000, 'KG',  92.00, 18, 10),
    (gen_random_uuid(), rfqs_quoted2, item_dry_powder,   500, 'KG',  58.00, 18, 8),
    (gen_random_uuid(), rfqs_quoted2, item_pvc_pipe,     300, 'MTR', 38.50, 18, 7),
    (gen_random_uuid(), rfqs_closed1, item_rubber_gasket,3000,'NOS', 12.50, 18, 3),
    (gen_random_uuid(), rfqs_closed2, item_rubber_gasket,3000,'NOS', 14.00, 18, 5);

  -- ════════════════════════════════════════════════════════════════════════
  -- PURCHASE ORDERS  (7 – every status)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO purchase_orders (id, po_number, supplier_id, factory_id, rfq_id, created_by, status, po_date, created_at) VALUES
    (po_draft,     'PO-2026-001', sup_asian_paint, fid, rfq_draft,    uid_purchase, 'draft',              '2026-02-01', '2026-02-01 09:00:00+05:30'),
    (po_open,      'PO-2026-002', sup_national_hw, fid, rfq_sent,     uid_purchase, 'acknowledged',       '2026-01-20', '2026-01-20 10:00:00+05:30'),
    (po_ack,       'PO-2026-003', sup_tata_steel,  fid, rfq_received, uid_purchase, 'acknowledged',       '2026-01-22', '2026-01-22 09:00:00+05:30'),
    (po_partial,   'PO-2025-004', sup_hyd_rubber,  fid, rfq_closed,   uid_purchase, 'partially_received', '2025-12-10', '2025-12-10 10:00:00+05:30'),
    (po_received,  'PO-2025-005', sup_national_hw, fid, rfq_closed,   uid_purchase, 'received',           '2025-12-12', '2025-12-12 11:00:00+05:30'),
    (po_closed,    'PO-2025-006', sup_pioneer,     fid, NULL,          uid_purchase, 'closed',             '2025-11-01', '2025-11-01 09:00:00+05:30'),
    (po_cancelled, 'PO-2025-007', sup_sri_lakshmi, fid, NULL,          uid_purchase, 'cancelled',          '2025-11-15', '2025-11-15 14:00:00+05:30');

  UPDATE purchase_orders SET approved_by = uid_admin, approved_at = '2026-01-21 10:00:00+05:30' WHERE id = po_open;
  UPDATE purchase_orders SET approved_by = uid_admin, approved_at = '2026-01-23 10:00:00+05:30' WHERE id = po_ack;
  UPDATE purchase_orders SET approved_by = uid_admin, approved_at = '2025-12-11 09:00:00+05:30' WHERE id = po_partial;
  UPDATE purchase_orders SET approved_by = uid_admin, approved_at = '2025-12-13 10:00:00+05:30' WHERE id = po_received;
  UPDATE purchase_orders SET approved_by = uid_admin, approved_at = '2025-11-02 09:00:00+05:30' WHERE id = po_closed;

  -- PO Items
  INSERT INTO po_items (id, po_id, item_id, quantity, uom, unit_price, tax_percent, total_amount) VALUES
    (gen_random_uuid(), po_draft, item_welding_wire, 100, 'KG',  180.00, 18, 21240.00),
    (gen_random_uuid(), po_draft, item_paint_red,     50, 'KG',  250.00, 18, 14750.00),
    (gen_random_uuid(), po_open,  item_bolt_m10,    5000, 'NOS',   8.50, 18, 50150.00),
    (gen_random_uuid(), po_open,  item_nut_m10,     5000, 'NOS',   5.20, 18, 30680.00),
    (gen_random_uuid(), po_open,  item_spring,      1000, 'NOS',  22.00, 18, 25960.00),
    (gen_random_uuid(), po_ack,   item_steel_plate, 2000, 'KG',   85.00, 18, 200600.00),
    (gen_random_uuid(), po_ack,   item_dry_powder,   500, 'KG',   62.00, 18, 36580.00),
    (gen_random_uuid(), po_ack,   item_pvc_pipe,     300, 'MTR',  42.00, 18, 14868.00),
    (gen_random_uuid(), po_partial, item_rubber_gasket, 3000, 'NOS', 12.50, 18, 44250.00),
    (gen_random_uuid(), po_received, item_bolt_m10,    2000, 'NOS',  8.00, 18, 18880.00),
    (gen_random_uuid(), po_received, item_nut_m10,     2000, 'NOS',  5.00, 18, 11800.00),
    (gen_random_uuid(), po_closed,   item_bearing,      150, 'NOS', 320.00, 18, 56640.00),
    (gen_random_uuid(), po_closed,   item_foam_pad,     500, 'NOS',  45.00, 18, 26550.00),
    (gen_random_uuid(), po_cancelled, item_pvc_pipe,    500, 'MTR',  45.00, 18, 26550.00);

  -- ════════════════════════════════════════════════════════════════════════
  -- GATE ENTRIES  (5 – open & closed)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO gate_entries (id, ge_number, factory_id, po_id, supplier_id, vehicle_number, challan_number, status, entry_date, created_by, created_at) VALUES
    (ge_open1,   'GE-2026-001', fid, po_ack,      sup_tata_steel,  'TS09UA1234', 'CH-2026-0045', 'open',   '2026-02-10', uid_security, '2026-02-10 09:30:00+05:30'),
    (ge_open2,   'GE-2026-002', fid, po_open,     sup_national_hw, 'AP16TC5678', 'CH-2026-0052', 'open',   '2026-02-12', uid_security, '2026-02-12 10:00:00+05:30'),
    (ge_closed1, 'GE-2025-003', fid, po_partial,  sup_hyd_rubber,  'TS07UB9012', 'CH-2025-0198', 'closed', '2025-12-18', uid_security, '2025-12-18 08:45:00+05:30'),
    (ge_closed2, 'GE-2025-004', fid, po_received, sup_national_hw, 'AP21TD3456', 'CH-2025-0210', 'closed', '2025-12-22', uid_security, '2025-12-22 09:15:00+05:30'),
    (ge_closed3, 'GE-2025-005', fid, po_closed,   sup_pioneer,     'DL01TE7890', 'CH-2025-0165', 'closed', '2025-11-10', uid_security, '2025-11-10 10:00:00+05:30');

  -- ════════════════════════════════════════════════════════════════════════
  -- GRNs  (5 – every status)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO grns (id, grn_number, gate_entry_id, po_id, factory_id, status, grn_date, created_by, created_at) VALUES
    (grn_draft,     'GRN-2026-001', ge_open1,   po_ack,      fid, 'draft',              '2026-02-10', uid_stores, '2026-02-10 10:00:00+05:30'),
    (grn_accepted1, 'GRN-2025-002', ge_closed1, po_partial,  fid, 'accepted',            '2025-12-18', uid_stores, '2025-12-18 11:00:00+05:30'),
    (grn_accepted2, 'GRN-2025-003', ge_closed2, po_received, fid, 'accepted',            '2025-12-22', uid_stores, '2025-12-22 11:30:00+05:30'),
    (grn_partial,   'GRN-2026-004', ge_open2,   po_open,     fid, 'partially_accepted',  '2026-02-12', uid_stores, '2026-02-12 11:00:00+05:30'),
    (grn_rejected,  'GRN-2025-005', ge_closed3, po_closed,   fid, 'rejected',            '2025-11-10', uid_stores, '2025-11-10 12:00:00+05:30');

  -- GRN Items
  INSERT INTO grn_items (id, grn_id, item_id, ordered_qty, received_qty, accepted_qty, rejected_qty, uom) VALUES
    (gen_random_uuid(), grn_draft,     item_steel_plate, 2000, 2000,    0,    0, 'KG'),
    (gen_random_uuid(), grn_draft,     item_dry_powder,   500,  500,    0,    0, 'KG'),
    (gen_random_uuid(), grn_draft,     item_pvc_pipe,     300,  280,    0,    0, 'MTR'),
    (gen_random_uuid(), grn_accepted1, item_rubber_gasket,3000, 1800, 1750,  50, 'NOS'),
    (gen_random_uuid(), grn_accepted2, item_bolt_m10,    2000, 2000, 1980,  20, 'NOS'),
    (gen_random_uuid(), grn_accepted2, item_nut_m10,     2000, 2000, 1990,  10, 'NOS'),
    (gen_random_uuid(), grn_partial,   item_bolt_m10,    5000, 3000, 2500, 500, 'NOS'),
    (gen_random_uuid(), grn_partial,   item_nut_m10,     5000, 3000, 2800, 200, 'NOS'),
    (gen_random_uuid(), grn_partial,   item_spring,      1000,  600,  580,  20, 'NOS'),
    (gen_random_uuid(), grn_rejected,  item_bearing,      150,  150,    0, 150, 'NOS');

  -- ════════════════════════════════════════════════════════════════════════
  -- STOCK LEDGER  (comprehensive – HIGH / MEDIUM / LOW stock levels)
  -- ════════════════════════════════════════════════════════════════════════

  -- ── Raw material inward (GRN receipts) ──
  INSERT INTO stock_ledger (id, factory_id, item_id, transaction_type, transaction_date, quantity, uom, balance, reference_type, reference_id) VALUES
    -- HIGH stock
    (gen_random_uuid(), fid, item_steel_plate,   'grn', '2025-10-15', 3000, 'KG',  3000, 'grn', grn_accepted2),
    (gen_random_uuid(), fid, item_ms_rod,        'grn', '2025-10-20', 1500, 'KG',  1500, 'grn', grn_accepted2),
    (gen_random_uuid(), fid, item_bolt_m10,      'grn', '2025-12-22', 1980, 'NOS', 1980, 'grn', grn_accepted2),
    (gen_random_uuid(), fid, item_bolt_m10,      'grn', '2026-02-12', 2500, 'NOS', 4480, 'grn', grn_partial),
    (gen_random_uuid(), fid, item_nut_m10,       'grn', '2025-12-22', 1990, 'NOS', 1990, 'grn', grn_accepted2),
    (gen_random_uuid(), fid, item_nut_m10,       'grn', '2026-02-12', 2800, 'NOS', 4790, 'grn', grn_partial),
    (gen_random_uuid(), fid, item_nylon_strap,   'grn', '2025-11-15', 2000, 'MTR', 2000, 'grn', grn_accepted2),
    -- MEDIUM stock (near reorder)
    (gen_random_uuid(), fid, item_rubber_gasket, 'grn', '2025-12-18', 1750, 'NOS', 1750, 'grn', grn_accepted1),
    (gen_random_uuid(), fid, item_welding_wire,  'grn', '2025-11-01',   60, 'KG',    60, 'grn', grn_accepted2),
    (gen_random_uuid(), fid, item_paint_red,     'grn', '2025-11-05',  120, 'KG',   120, 'grn', grn_accepted2),
    (gen_random_uuid(), fid, item_paint_yellow,  'grn', '2025-11-05',  130, 'KG',   130, 'grn', grn_accepted2),
    (gen_random_uuid(), fid, item_pvc_pipe,      'grn', '2025-11-10',  250, 'MTR',  250, 'grn', grn_accepted2),
    (gen_random_uuid(), fid, item_spring,        'grn', '2026-02-12',  580, 'NOS',  580, 'grn', grn_partial),
    (gen_random_uuid(), fid, item_dry_powder,    'grn', '2025-11-20',  180, 'KG',   180, 'grn', grn_accepted2),
    -- LOW stock (below reorder – will trigger warnings)
    (gen_random_uuid(), fid, item_bearing,       'grn', '2025-09-15',   40, 'NOS',   40, 'grn', grn_accepted2),
    (gen_random_uuid(), fid, item_foam_pad,      'grn', '2025-11-12',  280, 'NOS',  280, 'grn', grn_accepted2),
    (gen_random_uuid(), fid, item_visor_lens,    'grn', '2025-11-12',  180, 'NOS',  180, 'grn', grn_accepted2),
    -- Semi-finished inward (from earlier internal production)
    (gen_random_uuid(), fid, item_helmet_shell,  'production_receipt', '2025-11-25', 300, 'NOS', 300, 'work_order', wo_completed1),
    (gen_random_uuid(), fid, item_harness_frame, 'production_receipt', '2025-11-25', 120, 'NOS', 120, 'work_order', wo_completed1),
    (gen_random_uuid(), fid, item_ext_body,      'production_receipt', '2025-11-28',  80, 'NOS',  80, 'work_order', wo_completed2);

  -- ── Finished goods inward (production receipts from completed WOs) ──
  INSERT INTO stock_ledger (id, factory_id, item_id, transaction_type, transaction_date, quantity, uom, balance, reference_type, reference_id) VALUES
    (gen_random_uuid(), fid, item_safety_helmet,  'production_receipt', '2025-12-18', 200, 'NOS', 200, 'work_order', wo_completed1),
    (gen_random_uuid(), fid, item_safety_harness, 'production_receipt', '2025-12-22',  80, 'NOS',  80, 'work_order', wo_completed1),
    (gen_random_uuid(), fid, item_fire_ext,       'production_receipt', '2025-12-28',  45, 'NOS',  45, 'work_order', wo_completed2),
    (gen_random_uuid(), fid, item_safety_shoe,    'production_receipt', '2026-01-05', 150, 'NOS', 150, 'work_order', wo_completed1),
    (gen_random_uuid(), fid, item_safety_goggle,  'production_receipt', '2026-01-10', 300, 'NOS', 300, 'work_order', wo_completed1);

  -- ── Trading items inward ──
  INSERT INTO stock_ledger (id, factory_id, item_id, transaction_type, transaction_date, quantity, uom, balance, reference_type, reference_id) VALUES
    (gen_random_uuid(), fid, item_first_aid_kit, 'grn', '2025-11-20', 60,  'NOS', 60,  'grn', grn_accepted2),
    (gen_random_uuid(), fid, item_safety_cone,   'grn', '2025-11-25', 150, 'NOS', 150, 'grn', grn_accepted2),
    (gen_random_uuid(), fid, item_ear_plug,      'grn', '2025-11-25', 800, 'NOS', 800, 'grn', grn_accepted2);

  -- ── Dispatch outward (for delivered SO) ──
  INSERT INTO stock_ledger (id, factory_id, item_id, transaction_type, transaction_date, quantity, uom, balance, reference_type, reference_id) VALUES
    (gen_random_uuid(), fid, item_safety_helmet,  'dispatch', '2025-12-28', -120, 'NOS',  80, 'dispatch', disp_delivered),
    (gen_random_uuid(), fid, item_safety_harness, 'dispatch', '2025-12-28',  -60, 'NOS',  20, 'dispatch', disp_delivered),
    (gen_random_uuid(), fid, item_fire_ext,       'dispatch', '2025-12-28',  -20, 'NOS',  25, 'dispatch', disp_delivered),
    (gen_random_uuid(), fid, item_safety_goggle,  'dispatch', '2025-12-28',  -50, 'NOS', 250, 'dispatch', disp_delivered);

  -- ── Dispatch outward (for dispatched SO) ──
  INSERT INTO stock_ledger (id, factory_id, item_id, transaction_type, transaction_date, quantity, uom, balance, reference_type, reference_id) VALUES
    (gen_random_uuid(), fid, item_fire_ext,      'dispatch', '2026-01-25', -25, 'NOS',   0, 'dispatch', disp_dispatched),
    (gen_random_uuid(), fid, item_first_aid_kit, 'dispatch', '2026-01-25', -20, 'NOS',  40, 'dispatch', disp_dispatched);

  -- ── Production issue outward (for in-progress WOs) ──
  INSERT INTO stock_ledger (id, factory_id, item_id, transaction_type, transaction_date, quantity, uom, balance, reference_type, reference_id) VALUES
    (gen_random_uuid(), fid, item_steel_plate,   'production_issue', '2026-01-26', -70,  'KG',  2930, 'work_order', wo_inprog1),
    (gen_random_uuid(), fid, item_helmet_shell,  'production_issue', '2026-01-26', -200, 'NOS',  100, 'work_order', wo_inprog1),
    (gen_random_uuid(), fid, item_foam_pad,      'production_issue', '2026-01-26', -200, 'NOS',   80, 'work_order', wo_inprog1),
    (gen_random_uuid(), fid, item_visor_lens,    'production_issue', '2026-01-26', -200, 'NOS',  -20, 'work_order', wo_inprog1),
    (gen_random_uuid(), fid, item_rubber_gasket, 'production_issue', '2026-01-26', -400, 'NOS', 1350, 'work_order', wo_inprog1),
    (gen_random_uuid(), fid, item_bolt_m10,      'production_issue', '2026-01-26', -800, 'NOS', 3680, 'work_order', wo_inprog1),
    (gen_random_uuid(), fid, item_paint_yellow,  'production_issue', '2026-01-26',  -16, 'KG',   114, 'work_order', wo_inprog1),
    (gen_random_uuid(), fid, item_nylon_strap,   'production_issue', '2026-01-29', -480, 'MTR', 1520, 'work_order', wo_inprog2),
    (gen_random_uuid(), fid, item_harness_frame, 'production_issue', '2026-01-29',  -80, 'NOS',   40, 'work_order', wo_inprog2),
    (gen_random_uuid(), fid, item_bolt_m10,      'production_issue', '2026-01-29', -640, 'NOS', 3040, 'work_order', wo_inprog2),
    (gen_random_uuid(), fid, item_nut_m10,       'production_issue', '2026-01-29', -640, 'NOS', 4150, 'work_order', wo_inprog2),
    (gen_random_uuid(), fid, item_spring,        'production_issue', '2026-01-29', -320, 'NOS',  260, 'work_order', wo_inprog2),
    (gen_random_uuid(), fid, item_rubber_gasket, 'production_issue', '2026-01-29', -320, 'NOS', 1030, 'work_order', wo_inprog2);

  -- ── Production receipt inward (partial output from in-progress WOs) ──
  INSERT INTO stock_ledger (id, factory_id, item_id, transaction_type, transaction_date, quantity, uom, balance, reference_type, reference_id) VALUES
    (gen_random_uuid(), fid, item_safety_helmet,  'production_receipt', '2026-02-08', 115, 'NOS', 195, 'work_order', wo_inprog1),
    (gen_random_uuid(), fid, item_safety_harness, 'production_receipt', '2026-02-05',  34, 'NOS',  54, 'work_order', wo_inprog2);

  -- ════════════════════════════════════════════════════════════════════════
  -- WORK ORDERS  (6 – every status)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO work_orders (id, wo_number, factory_id, item_id, bom_id, planned_qty, uom, status, created_by, created_at) VALUES
    (wo_draft,      'WO-2026-001', fid, item_safety_helmet,  bom_helmet,  100, 'NOS', 'draft',       uid_planning, '2026-02-15 09:00:00+05:30'),
    (wo_released,   'WO-2026-002', fid, item_fire_ext,       bom_fire,     50, 'NOS', 'released',    uid_planning, '2026-02-10 10:00:00+05:30'),
    (wo_inprog1,    'WO-2026-003', fid, item_safety_helmet,  bom_helmet,  200, 'NOS', 'in_progress', uid_planning, '2026-01-25 09:00:00+05:30'),
    (wo_inprog2,    'WO-2026-004', fid, item_safety_harness, bom_harness,  80, 'NOS', 'in_progress', uid_planning, '2026-01-28 10:00:00+05:30'),
    (wo_completed1, 'WO-2025-005', fid, item_safety_helmet,  bom_helmet,  200, 'NOS', 'completed',   uid_planning, '2025-12-01 09:00:00+05:30'),
    (wo_completed2, 'WO-2025-006', fid, item_fire_ext,       bom_fire,     45, 'NOS', 'completed',   uid_planning, '2025-12-10 10:00:00+05:30');

  UPDATE work_orders SET actual_start = '2026-01-26 08:00:00+05:30'                                                        WHERE id = wo_inprog1;
  UPDATE work_orders SET actual_start = '2026-01-29 08:00:00+05:30'                                                        WHERE id = wo_inprog2;
  UPDATE work_orders SET actual_start = '2025-12-02 08:00:00+05:30', actual_end = '2025-12-18 17:00:00+05:30', produced_qty = 200 WHERE id = wo_completed1;
  UPDATE work_orders SET actual_start = '2025-12-11 08:00:00+05:30', actual_end = '2025-12-26 17:00:00+05:30', produced_qty = 45  WHERE id = wo_completed2;
  UPDATE work_orders SET produced_qty = 115 WHERE id = wo_inprog1;
  UPDATE work_orders SET produced_qty = 34  WHERE id = wo_inprog2;

  -- ════════════════════════════════════════════════════════════════════════
  -- PRODUCTION ISSUES  (materials issued for in-progress WOs)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO production_issues (id, work_order_id, item_id, issued_qty, uom, issued_by, issued_at) VALUES
    (gen_random_uuid(), wo_inprog1, item_steel_plate,   70,  'KG',  uid_stores, '2026-01-26 09:00:00+05:30'),
    (gen_random_uuid(), wo_inprog1, item_helmet_shell,  200, 'NOS', uid_stores, '2026-01-26 09:00:00+05:30'),
    (gen_random_uuid(), wo_inprog1, item_foam_pad,      200, 'NOS', uid_stores, '2026-01-26 09:00:00+05:30'),
    (gen_random_uuid(), wo_inprog1, item_visor_lens,    200, 'NOS', uid_stores, '2026-01-26 09:00:00+05:30'),
    (gen_random_uuid(), wo_inprog1, item_rubber_gasket, 400, 'NOS', uid_stores, '2026-01-26 09:00:00+05:30'),
    (gen_random_uuid(), wo_inprog1, item_bolt_m10,      800, 'NOS', uid_stores, '2026-01-26 09:30:00+05:30'),
    (gen_random_uuid(), wo_inprog1, item_paint_yellow,   16, 'KG',  uid_stores, '2026-01-26 09:30:00+05:30'),
    (gen_random_uuid(), wo_inprog2, item_nylon_strap,   480, 'MTR', uid_stores, '2026-01-29 09:00:00+05:30'),
    (gen_random_uuid(), wo_inprog2, item_harness_frame,  80, 'NOS', uid_stores, '2026-01-29 09:00:00+05:30'),
    (gen_random_uuid(), wo_inprog2, item_bolt_m10,      640, 'NOS', uid_stores, '2026-01-29 09:00:00+05:30'),
    (gen_random_uuid(), wo_inprog2, item_nut_m10,       640, 'NOS', uid_stores, '2026-01-29 09:00:00+05:30'),
    (gen_random_uuid(), wo_inprog2, item_spring,        320, 'NOS', uid_stores, '2026-01-29 09:00:00+05:30'),
    (gen_random_uuid(), wo_inprog2, item_rubber_gasket, 320, 'NOS', uid_stores, '2026-01-29 09:30:00+05:30');

  -- ════════════════════════════════════════════════════════════════════════
  -- PRODUCTION PUNCHES  (output recorded for in-progress + completed WOs)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO production_punches (id, work_order_id, produced_qty, rejected_qty, uom, punched_by, punched_at) VALUES
    (gen_random_uuid(), wo_inprog1,    60, 3, 'NOS', uid_production, '2026-02-01 17:00:00+05:30'),
    (gen_random_uuid(), wo_inprog1,    55, 2, 'NOS', uid_production, '2026-02-08 17:00:00+05:30'),
    (gen_random_uuid(), wo_inprog2,    34, 1, 'NOS', uid_production, '2026-02-05 17:00:00+05:30'),
    (gen_random_uuid(), wo_completed1, 100, 4, 'NOS', uid_production, '2025-12-10 17:00:00+05:30'),
    (gen_random_uuid(), wo_completed1, 100, 2, 'NOS', uid_production, '2025-12-18 17:00:00+05:30'),
    (gen_random_uuid(), wo_completed2,  25, 1, 'NOS', uid_production, '2025-12-20 17:00:00+05:30'),
    (gen_random_uuid(), wo_completed2,  20, 0, 'NOS', uid_production, '2025-12-26 17:00:00+05:30');

  -- ════════════════════════════════════════════════════════════════════════
  -- SALES ORDERS  (6 – every key status)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO sales_orders (id, so_number, customer_id, factory_id, status, order_date, total_amount, created_by, created_at) VALUES
    (so_draft,      'SO-2026-001', cust_hero,      fid, 'draft',         '2026-02-20', 0,          uid_sales, '2026-02-20 10:00:00+05:30'),
    (so_confirmed,  'SO-2026-002', cust_tata_proj, fid, 'confirmed',     '2026-02-15', 375000.00,  uid_sales, '2026-02-15 11:00:00+05:30'),
    (so_inprod,     'SO-2026-003', cust_reliance,  fid, 'in_production', '2026-02-01', 520000.00,  uid_sales, '2026-02-01 09:00:00+05:30'),
    (so_ready,      'SO-2026-004', cust_lnt,       fid, 'ready',         '2026-01-20', 287500.00,  uid_sales, '2026-01-20 10:00:00+05:30'),
    (so_dispatched, 'SO-2026-005', cust_adani,     fid, 'dispatched',    '2026-01-10', 192000.00,  uid_sales, '2026-01-10 09:00:00+05:30'),
    (so_invoiced,   'SO-2025-006', cust_tata_proj, fid, 'invoiced',      '2025-12-15', 445000.00,  uid_sales, '2025-12-15 10:00:00+05:30');

  -- SO Items
  INSERT INTO so_items (id, so_id, item_id, quantity, uom, unit_price, total_amount) VALUES
    (gen_random_uuid(),    so_draft,      item_safety_helmet,  50,  'NOS', 850.00,  42500.00),
    (gen_random_uuid(),    so_draft,      item_safety_goggle, 100,  'NOS', 450.00,  45000.00),
    (gen_random_uuid(),    so_confirmed,  item_safety_helmet, 200,  'NOS', 850.00, 170000.00),
    (gen_random_uuid(),    so_confirmed,  item_safety_harness, 50,  'NOS',2200.00, 110000.00),
    (gen_random_uuid(),    so_confirmed,  item_fire_ext,       25,  'NOS',3800.00,  95000.00),
    (soi_inprod_helmet,    so_inprod,     item_safety_helmet, 300,  'NOS', 850.00, 255000.00),
    (soi_inprod_shoe,      so_inprod,     item_safety_shoe,   100,  'NOS',1650.00, 165000.00),
    (soi_inprod_fak,       so_inprod,     item_first_aid_kit,  50,  'NOS',2000.00, 100000.00),
    (soi_ready_harness,    so_ready,      item_safety_harness, 75,  'NOS',2200.00, 165000.00),
    (soi_ready_goggle,     so_ready,      item_safety_goggle, 250,  'NOS', 450.00, 112500.00),
    (soi_ready_cone,       so_ready,      item_safety_cone,    50,  'NOS', 200.00,  10000.00),
    (soi_disp_fire,        so_dispatched, item_fire_ext,       40,  'NOS',3800.00, 152000.00),
    (soi_disp_fak,         so_dispatched, item_first_aid_kit,  20,  'NOS',2000.00,  40000.00),
    (soi_inv_helmet,       so_invoiced,   item_safety_helmet, 120,  'NOS', 850.00, 102000.00),
    (soi_inv_harness,      so_invoiced,   item_safety_harness, 60,  'NOS',2200.00, 132000.00),
    (soi_inv_fire,         so_invoiced,   item_fire_ext,       20,  'NOS',3800.00,  76000.00),
    (soi_inv_goggle,       so_invoiced,   item_safety_goggle,  50,  'NOS', 490.00,  24500.00);

  -- ════════════════════════════════════════════════════════════════════════
  -- DISPATCHES  (4 – every status)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO dispatches (id, dispatch_number, so_id, factory_id, status, dispatch_date, created_by, created_at) VALUES
    (disp_draft,      'DSP-2026-001', so_ready,      fid, 'draft',      '2026-02-22', uid_stores, '2026-02-22 09:00:00+05:30'),
    (disp_pending,    'DSP-2026-002', so_inprod,     fid, 'draft',      '2026-02-18', uid_stores, '2026-02-18 10:00:00+05:30'),
    (disp_dispatched, 'DSP-2026-003', so_dispatched, fid, 'dispatched', '2026-01-25', uid_stores, '2026-01-25 08:00:00+05:30'),
    (disp_delivered,  'DSP-2025-004', so_invoiced,   fid, 'delivered',  '2025-12-28', uid_stores, '2025-12-28 09:00:00+05:30');

  -- Dispatch Items
  INSERT INTO dispatch_items (id, dispatch_id, so_item_id, item_id, dispatched_qty, uom) VALUES
    (gen_random_uuid(), disp_draft,      soi_ready_harness, item_safety_harness, 75,  'NOS'),
    (gen_random_uuid(), disp_draft,      soi_ready_goggle,  item_safety_goggle, 250,  'NOS'),
    (gen_random_uuid(), disp_draft,      soi_ready_cone,    item_safety_cone,    50,  'NOS'),
    (gen_random_uuid(), disp_pending,    soi_inprod_helmet, item_safety_helmet, 100,  'NOS'),
    (gen_random_uuid(), disp_pending,    soi_inprod_shoe,   item_safety_shoe,    40,  'NOS'),
    (gen_random_uuid(), disp_dispatched, soi_disp_fire,     item_fire_ext,       25,  'NOS'),
    (gen_random_uuid(), disp_dispatched, soi_disp_fak,      item_first_aid_kit,  20,  'NOS'),
    (gen_random_uuid(), disp_delivered,  soi_inv_helmet,    item_safety_helmet, 120,  'NOS'),
    (gen_random_uuid(), disp_delivered,  soi_inv_harness,   item_safety_harness, 60,  'NOS'),
    (gen_random_uuid(), disp_delivered,  soi_inv_fire,      item_fire_ext,       20,  'NOS'),
    (gen_random_uuid(), disp_delivered,  soi_inv_goggle,    item_safety_goggle,  50,  'NOS');

  -- ════════════════════════════════════════════════════════════════════════
  -- INVOICES  (1 issued – for the delivered dispatch)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO invoices (id, invoice_number, dispatch_id, customer_id, factory_id, status, invoice_date, subtotal, tax_amount, total_amount, created_by, created_at) VALUES
    (inv_issued, 'INV-2025-001', disp_delivered, cust_tata_proj, fid, 'issued', '2025-12-29', 334500.00, 60210.00, 394710.00, uid_accounts, '2025-12-29 10:00:00+05:30');

  -- ════════════════════════════════════════════════════════════════════════
  -- AUDIT LOGS  (sample trail across modules)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO audit_logs (id, user_id, user_name, action, module, entity_id, entity_type, details, factory_id, created_at) VALUES
    (gen_random_uuid(), uid_admin,      'Admin User',      'LOGIN',         'Auth',               NULL,              NULL,                    '{"ip":"192.168.1.10"}',                                          fid, '2026-02-25 08:30:00+05:30'),
    (gen_random_uuid(), uid_planning,   'Planning User',   'CREATE',        'Items',              item_safety_helmet::text, 'item',            '{"code":"FG-001","name":"YNM Industrial Safety Helmet"}',         fid, '2025-10-01 09:00:00+05:30'),
    (gen_random_uuid(), uid_planning,   'Planning User',   'CREATE',        'BOM',                bom_helmet::text,  'bom_master',            '{"finished_good":"FG-001","version":1}',                          fid, '2025-10-05 10:00:00+05:30'),
    (gen_random_uuid(), uid_planning,   'Planning User',   'CREATE',        'Purchase Requisition',pr_approved1::text,'purchase_requisition',  '{"pr_number":"PR-2026-003","items":3}',                           fid, '2026-01-12 11:00:00+05:30'),
    (gen_random_uuid(), uid_admin,      'Admin User',      'APPROVE',       'Purchase Requisition',pr_approved1::text,'purchase_requisition',  '{"pr_number":"PR-2026-003","status":"approved"}',                 fid, '2026-01-14 10:00:00+05:30'),
    (gen_random_uuid(), uid_admin,      'Admin User',      'REJECT',        'Purchase Requisition',pr_rejected::text, 'purchase_requisition',  '{"pr_number":"PR-2026-005","reason":"Duplicate of PR-003"}',      fid, '2026-01-19 15:00:00+05:30'),
    (gen_random_uuid(), uid_purchase,   'Purchase User',   'CREATE',        'RFQ',                rfq_received::text,'rfq',                    '{"rfq_number":"RFQ-2026-003","suppliers":3}',                     fid, '2026-01-16 09:00:00+05:30'),
    (gen_random_uuid(), uid_purchase,   'Purchase User',   'CREATE',        'Purchase Order',     po_ack::text,      'purchase_order',         '{"po_number":"PO-2026-003","supplier":"Tata Steel"}',             fid, '2026-01-22 09:00:00+05:30'),
    (gen_random_uuid(), uid_admin,      'Admin User',      'APPROVE',       'Purchase Order',     po_ack::text,      'purchase_order',         '{"po_number":"PO-2026-003","status":"acknowledged"}',             fid, '2026-01-23 10:00:00+05:30'),
    (gen_random_uuid(), uid_security,   'Security User',   'CREATE',        'Gate Entry',         ge_open1::text,    'gate_entry',             '{"ge_number":"GE-2026-001","vehicle":"TS09UA1234"}',              fid, '2026-02-10 09:30:00+05:30'),
    (gen_random_uuid(), uid_stores,     'Stores User',     'CREATE',        'GRN',                grn_accepted2::text,'grn',                   '{"grn_number":"GRN-2025-003","status":"accepted"}',               fid, '2025-12-22 11:30:00+05:30'),
    (gen_random_uuid(), uid_stores,     'Stores User',     'STATUS_CHANGE', 'GRN',                grn_rejected::text,'grn',                    '{"grn_number":"GRN-2025-005","status":"rejected","reason":"Quality failure"}', fid, '2025-11-10 12:00:00+05:30'),
    (gen_random_uuid(), uid_planning,   'Planning User',   'CREATE',        'Work Order',         wo_inprog1::text,  'work_order',             '{"wo_number":"WO-2026-003","item":"FG-001","qty":200}',           fid, '2026-01-25 09:00:00+05:30'),
    (gen_random_uuid(), uid_production, 'Production User', 'STATUS_CHANGE', 'Work Order',         wo_completed1::text,'work_order',            '{"wo_number":"WO-2025-005","status":"completed","produced":200}', fid, '2025-12-18 17:00:00+05:30'),
    (gen_random_uuid(), uid_sales,      'Sales User',      'CREATE',        'Sales Order',        so_confirmed::text,'sales_order',             '{"so_number":"SO-2026-002","customer":"Tata Projects"}',          fid, '2026-02-15 11:00:00+05:30'),
    (gen_random_uuid(), uid_stores,     'Stores User',     'CREATE',        'Dispatch',           disp_delivered::text,'dispatch',              '{"dispatch_number":"DSP-2025-004","so":"SO-2025-006"}',           fid, '2025-12-28 09:00:00+05:30'),
    (gen_random_uuid(), uid_accounts,   'Accounts User',   'CREATE',        'Invoice',            inv_issued::text,  'invoice',                '{"invoice_number":"INV-2025-001","total":394710.00}',             fid, '2025-12-29 10:00:00+05:30'),
    (gen_random_uuid(), uid_admin,      'Admin User',      'UPDATE',        'Admin',              uid_security::text,'app_user',                '{"action":"activated user","user":"Security User"}',              fid, '2025-10-01 08:00:00+05:30');

  RAISE NOTICE '✅ Seed data inserted successfully!';
END $$;
