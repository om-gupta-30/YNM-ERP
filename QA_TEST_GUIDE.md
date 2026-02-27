# YNM ERP – QA Test Guide

## Test Accounts

| Username | Password | Role | What to test |
|---|---|---|---|
| Admin | Admin@123 | admin | Approvals, audit log, executive dashboard, view everything |
| Planning | Planning@123 | planning | Create PRs, create work orders, view items/BOMs |
| Purchase | Purchase@123 | purchase | Items, suppliers, RFQs, POs, stock levels |
| Sales | Sales@123 | sales | Customers, sales orders |
| Accounts | Accounts@123 | accounts | Dispatches, invoices |
| Security | Security@123 | security | Gate entries |
| Stores | Stores@123 | stores | GRNs, material issue, dispatch, stock |
| Production | Production@123 | production | BOMs, production punches |

---

## 1. Login & Dashboard

### 1.1 Login
1. Open the app URL in your browser
2. Enter **Username**: `Admin` and **Password**: `Admin@123`
3. Click **Login**
4. Verify you land on the **Dashboard** page
5. Verify the sidebar shows all menu items (admin sees everything)

### 1.2 Logout & Re-login
1. Click the user avatar / logout button in the top header
2. Verify you are redirected to the login page
3. Log in as `Planning` / `Planning@123`
4. Verify the sidebar only shows: Items, BOM, Purchase Requisition, Work Orders, Production

### 1.3 Role-based sidebar visibility
Log in as each user and verify they ONLY see their permitted menu items:

| Role | Should see |
|---|---|
| Admin | Everything + Approvals + Executive View + Audit Log |
| Planning | Items, BOM, Purchase Requisition, Work Orders, Production |
| Purchase | Items, Suppliers, RFQ & Quotes, Purchase Orders, Stock & Ledger |
| Sales | Customers, Sales Orders |
| Accounts | Dispatch, Invoices |
| Security | Gate Entry |
| Stores | GRN, Work Orders, Production, Dispatch, Stock & Ledger |
| Production | BOM, Work Orders, Production |

---

## 2. Master Data (Setup)

### 2.1 Items (Login as: `Purchase`)
1. Click **Items** in the sidebar
2. Verify **26 items** are listed (15 raw materials, 3 semi-finished, 5 finished goods, 3 trading)
3. Verify the table shows: Code, Name, Type, Category, UOM, HSN Code, Reorder Level, Active status
4. Click **+ New Item** → fill in all fields → Save → verify it appears in the list
5. Click any existing item → Edit → change the name → Save → verify the update
6. Toggle an item's Active status → verify it changes

### 2.2 Suppliers (Login as: `Purchase`)
1. Click **Suppliers** in the sidebar
2. Verify **6 suppliers** are listed (Tata Steel, National Hardware, Asian Paints, Hyd Rubber, Pioneer, Sri Lakshmi)
3. Click **+ New Supplier** → fill all fields including GSTIN → Save
4. Edit an existing supplier → change phone number → Save → verify
5. Toggle active/inactive → verify

### 2.3 Customers (Login as: `Sales`)
1. Click **Customers** in the sidebar
2. Verify **5 customers** are listed (Tata Projects, L&T, Reliance, Adani, Hero)
3. Add a new customer with billing and shipping addresses → Save
4. Edit existing customer → verify both billing and shipping address fields
5. Toggle active/inactive → verify

### 2.4 Bill of Materials (Login as: `Production`)
1. Click **Bill of Materials** in the sidebar
2. Verify **3 active BOMs**: Safety Helmet (7 components), Safety Harness (6 components), Fire Extinguisher (7 components)
3. Click on the Helmet BOM → verify component list shows: Steel Plate, Helmet Shell, Foam Pad, Visor Lens, Rubber Gasket, Bolt M10, Paint Yellow
4. Verify quantities and scrap percentages are shown
5. Click **Create New BOM** → select a finished good → add components → Save
6. Try marking an existing BOM as obsolete → verify status changes

---

## 3. Purchase Flow

### 3.1 Purchase Requisitions (Login as: `Planning`)

**View existing PRs:**
1. Click **Purchase Requisition** in the sidebar
2. Verify **6 PRs** exist with statuses: 1 Draft, 1 Submitted, 2 Approved, 1 Rejected, 1 Closed
3. Click on PR-2026-001 (Draft) → verify 3 items listed (Steel Plate, Foam Pad, Visor Lens)

**Create a new PR:**
1. Click **+ New PR**
2. Enter department/remarks
3. Add 2-3 items with quantities
4. Click **Save as Draft** → verify it appears in the list as Draft
5. Open the draft PR → click **Submit** → verify status changes to Submitted

**Approve a PR (Login as: `Admin`):**
1. Go to **Approvals** page (or open the submitted PR directly)
2. Find the submitted PR → click **Approve** → verify status changes to Approved
3. Open PR-2026-005 → verify it shows as Rejected

**Edit a draft PR (Login as: `Planning`):**
1. Open a Draft PR → click **Edit**
2. Add/remove items, change quantities
3. Save → verify changes are persisted

### 3.2 RFQ & Quotes (Login as: `Purchase`)

**View existing RFQs:**
1. Click **RFQ & Quotes** in the sidebar
2. Verify **4 RFQs**: Draft, Sent, Received (Quoted), Closed
3. Click on RFQ-2026-003 (Received) → verify 3 suppliers shown (Tata Steel: Quoted, Asian Paints: Quoted, Sri Lakshmi: Declined)

**Create a new RFQ:**
1. Click **Create RFQ**
2. Select an approved PR from the dropdown
3. Select 2-3 suppliers
4. Save → verify it appears as Draft
5. Open the draft RFQ → click **Send to Suppliers** → verify status changes to Sent

**Add supplier quotes:**
1. Open a Sent RFQ (RFQ-2026-002)
2. Click on a supplier → **Add Quote**
3. Enter unit price, tax %, lead time for each item
4. Save → verify the supplier shows as Quoted

**Compare quotes:**
1. Open RFQ-2026-003 (Received — all suppliers have responded)
2. Click **View Comparison**
3. Verify the comparison table shows: item-wise pricing from each supplier, landed cost, best price highlighted
4. Verify the overall best supplier is indicated

### 3.3 Purchase Orders (Login as: `Purchase`)

**View existing POs:**
1. Click **Purchase Orders** in the sidebar
2. Verify **7 POs** with statuses: Draft, Acknowledged (x2), Partially Received, Received, Closed, Cancelled

**Generate PO from RFQ:**
1. Open a received RFQ with complete quotes
2. Select the best supplier → click **Generate PO**
3. Verify a new PO appears in the PO list with status Draft
4. Verify PO items match the PR items with the selected supplier's pricing

**Approve a PO (Login as: `Admin`):**
1. Go to **Approvals** or open a Draft PO
2. Click **Approve** → verify status changes to Acknowledged
3. Try to approve an already acknowledged PO → verify it's a no-op
4. Open a Draft PO → click **Reject** → verify status changes to Cancelled

**View PO details:**
1. Click on PO-2026-003 (Acknowledged) → verify items, quantities, prices, tax, totals

---

## 4. Inventory

### 4.1 Gate Entry (Login as: `Security`)

**View existing gate entries:**
1. Click **Gate Entry** in the sidebar
2. Verify **5 gate entries**: 2 Open, 3 Closed

**Create a new gate entry:**
1. Click **+ New Gate Entry**
2. Select an acknowledged PO from the dropdown (only acknowledged/partially received POs should appear)
3. Enter vehicle number and challan/invoice number
4. Save → verify it appears as Open
5. Try creating a gate entry for a Draft PO → verify it is blocked

### 4.2 GRN — Goods Receipt Note (Login as: `Stores`)

**View existing GRNs:**
1. Click **GRN** in the sidebar
2. Verify **5 GRNs**: 1 Draft, 2 Accepted, 1 Partially Accepted, 1 Rejected

**Create a GRN:**
1. Click **+ New GRN**
2. Select an open gate entry from the dropdown
3. Verify PO items are auto-populated with ordered quantities
4. Save → verify it appears as Draft

**Approve a GRN:**
1. Open the Draft GRN (GRN-2026-001)
2. Enter received qty, accepted qty for each item (try accepting all) → click **Approve**
3. Verify status changes to Accepted
4. Go to **Stock & Ledger** → verify inward stock entries were created for the accepted items

**Partially accept a GRN:**
1. Create a new GRN → accept some items, reject others
2. Verify status shows Partially Accepted

**Reject a GRN:**
1. Open a Draft GRN → click **Reject**
2. Verify status changes to Rejected
3. Verify NO stock entries were created

### 4.3 Stock Levels (Login as: `Stores`)
1. Click **Stock & Ledger** in the sidebar
2. Go to **Current Stock** tab/page
3. Verify items with various stock levels:
   - **HIGH**: Steel Plate (~2930 KG), MS Rod (1500 KG), Bolts (~3040), Nuts (~4150)
   - **MEDIUM**: Rubber Gaskets (~1030), Springs (~260), Paint, PVC Pipe
   - **LOW/Critical**: Bearings (40, reorder=100), Visor Lens (negative!), Foam Pad (80)
4. Verify finished goods stock: Helmets, Harness, Fire Ext, Shoes, Goggles
5. Verify trading items: First Aid Kit, Safety Cone, Ear Plug

### 4.4 Stock Ledger (Login as: `Stores`)
1. Go to **Stock Ledger** page
2. Verify transaction entries of all types: GRN (inward), Production Issue (outward), Production Receipt (inward), Dispatch (outward)
3. Filter by item → verify only that item's transactions show
4. Filter by transaction type (Inward/Outward) → verify correct filtering

---

## 5. Production

### 5.1 Work Orders (Login as: `Planning`)

**View existing work orders:**
1. Click **Work Orders** in the sidebar
2. Verify **6 work orders**: Draft, Released, In Progress (x2), Completed (x2)
3. Click on WO-2026-003 (In Progress, Helmet) → verify planned qty=200, produced qty=115

**Create a new work order:**
1. Click **+ New Work Order**
2. Select a finished good (e.g. Safety Helmet) → verify BOM is auto-selected
3. Enter planned quantity → Save
4. Verify it appears with status Released

### 5.2 Issue Materials (Login as: `Stores`)
1. Click **Production** in the sidebar → go to **Issue Materials**
2. Select an in-progress or released work order
3. Verify required materials are shown (from BOM × planned qty + scrap %)
4. Enter issue quantities for each material
5. Click **Issue** → verify stock is deducted (check Stock Ledger)
6. Try issuing more than available stock → verify error message

### 5.3 Punch Production (Login as: `Production`)
1. Go to **Production** → **Punch Output**
2. Select an in-progress work order (WO-2026-003)
3. Verify existing punches shown: 60+55=115 produced so far
4. Enter produced qty and scrap/rejected qty → click **Punch**
5. Verify the work order's produced qty updates
6. Verify an inward stock ledger entry is created for the finished good
7. Try punching more than materials support → verify error

### 5.4 Complete a Work Order (Login as: `Planning` or `Production`)
1. Open a work order where produced qty >= planned qty
2. Click **Complete** → verify status changes to Completed
3. Try completing a work order where produced < planned → verify it's blocked

---

## 6. Sales & Dispatch

### 6.1 Sales Orders (Login as: `Sales`)

**View existing sales orders:**
1. Click **Sales Orders** in the sidebar
2. Verify **6 SOs**: Draft, Confirmed, In Production, Ready, Dispatched, Invoiced
3. Click on SO-2026-002 (Confirmed, Tata Projects) → verify 3 items: Helmet 200, Harness 50, Fire Ext 25

**Create a new sales order:**
1. Click **+ New Sales Order**
2. Select a customer
3. Add items with quantities and unit prices
4. Save → verify it appears as Confirmed with correct total amount
5. Verify duplicate items are blocked

### 6.2 Dispatch (Login as: `Stores`)

**View existing dispatches:**
1. Click **Dispatch** in the sidebar
2. Verify **4 dispatches**: Draft (x2), Dispatched, Delivered

**Create a dispatch:**
1. Click **+ New Dispatch**
2. Select a sales order (only non-completed SOs should appear)
3. Verify dispatch items are auto-populated from SO line items
4. Save → verify it appears as Draft

**Process dispatch:**
1. Open a Draft dispatch
2. Verify item quantities and adjust if needed
3. Click **Dispatch** → verify status changes to Dispatched
4. Go to **Stock Ledger** → verify outward entries were created for dispatched items
5. Try dispatching more than available stock → verify error

### 6.3 Invoices (Login as: `Accounts`)

**View existing invoices:**
1. Click **Invoices** in the sidebar
2. Verify **1 invoice**: INV-2025-001 (for Tata Projects, total ~₹3,94,710)

**Generate an invoice:**
1. Open a dispatched delivery
2. Click **Generate Invoice**
3. Verify: subtotal is calculated from SO prices × dispatched qty, tax = 18% GST, total = subtotal + tax
4. Verify the dispatch status changes to Delivered
5. Verify the sales order status changes to Invoiced
6. Try generating a duplicate invoice for the same dispatch → verify it returns the existing one

---

## 7. Approvals (Login as: `Admin`)

1. Click **Approvals** in the sidebar
2. Verify pending items are listed (submitted PRs, draft POs)
3. **Approve a PR** → verify status change and audit log entry
4. **Reject a PR** → verify status change
5. **Approve a PO** → verify it moves to Acknowledged status
6. **Reject a PO** → verify it moves to Cancelled status

---

## 8. Admin & Audit

### 8.1 User Management (Login as: `Admin`)
1. Click **Admin** in the sidebar
2. Verify all 8 users are listed with their roles
3. Try toggling a user's active status
4. Try creating a new user with a role

### 8.2 Audit Log (Login as: `Admin`)
1. Click **Audit Log** in the sidebar
2. Verify **18+ audit entries** covering: LOGIN, CREATE, APPROVE, REJECT, STATUS_CHANGE, UPDATE
3. Verify entries span across modules: Auth, Items, BOM, PR, RFQ, PO, Gate Entry, GRN, Work Order, Sales Order, Dispatch, Invoice, Admin
4. Filter by module → verify correct filtering
5. Verify each entry shows: user, action, module, timestamp, details

### 8.3 Executive Dashboard (Login as: `Admin`)
1. Click **Executive View** in the sidebar
2. Verify high-level KPIs and summaries are displayed
3. Verify data reflects the seeded records

---

## 9. End-to-End Flow Test

This tests the complete procurement-to-invoice cycle from scratch. Use multiple logins as directed.

### Step 1 — Create PR (Login as: `Planning`)
1. Go to Purchase Requisition → New PR
2. Add: Bolt M10 × 10,000 NOS, Nut M10 × 10,000 NOS
3. Save as Draft → Submit

### Step 2 — Approve PR (Login as: `Admin`)
1. Go to Approvals → find the PR → Approve

### Step 3 — Create & Send RFQ (Login as: `Purchase`)
1. Go to RFQ → Create from the approved PR
2. Select suppliers: National Hardware + Pioneer Plastics
3. Save → Send to Suppliers

### Step 4 — Add Quotes (Login as: `Purchase`)
1. Open the sent RFQ
2. Add quote for National Hardware: Bolt ₹8.50, Nut ₹5.20, 18% tax, 7 days
3. Add quote for Pioneer: Bolt ₹9.00, Nut ₹4.80, 18% tax, 10 days
4. View comparison → verify best supplier highlighted

### Step 5 — Generate & Approve PO (Login as: `Purchase` then `Admin`)
1. Select best supplier → Generate PO
2. Login as Admin → Approve the PO

### Step 6 — Gate Entry (Login as: `Security`)
1. Create gate entry for the approved PO
2. Enter vehicle number and challan number

### Step 7 — GRN (Login as: `Stores`)
1. Create GRN from the gate entry
2. Enter received/accepted/rejected quantities
3. Approve the GRN → verify stock updated

### Step 8 — Create Work Order (Login as: `Planning`)
1. Create a work order for Safety Helmet × 50
2. Verify BOM is linked and materials required are calculated

### Step 9 — Issue Materials & Punch (Login as: `Stores` then `Production`)
1. Login as Stores → Issue materials for the work order
2. Login as Production → Punch production output (50 produced, 2 scrap)
3. Complete the work order

### Step 10 — Sales Order (Login as: `Sales`)
1. Create SO for Hero MotoCorp: Safety Helmet × 50 @ ₹850

### Step 11 — Dispatch (Login as: `Stores`)
1. Create dispatch from the SO
2. Process dispatch → verify stock deducted

### Step 12 — Invoice (Login as: `Accounts`)
1. Generate invoice from the dispatched delivery
2. Verify amounts: subtotal = 50 × 850 = ₹42,500, tax = ₹7,650, total = ₹50,150
3. Verify SO status = Invoiced, Dispatch status = Delivered

---

## 10. Edge Cases & Negative Tests

| Test | Expected Result |
|---|---|
| Login with wrong password | "Invalid username or password" error |
| Login with inactive user | "Account deactivated" error |
| Submit a PR that is already submitted | Error: "Only draft PRs can be submitted" |
| Approve a PR that is not submitted | Error: "Only submitted PRs can be approved" |
| Create RFQ from a draft/rejected PR | Error: "Only approved PRs" |
| Create gate entry for a draft PO | Error: "Only acknowledged POs" |
| Create duplicate GRN for same gate entry | Error: "GRN already exists" |
| Issue materials exceeding stock | Error: "Insufficient stock" |
| Punch production without issuing materials | Error: "Issue materials first" |
| Punch more than materials support | Error with max producible units |
| Complete WO with insufficient production | Error: "Produce remaining quantity first" |
| Dispatch more than stock available | Error: "Insufficient stock" |
| Generate duplicate invoice | Returns existing invoice (idempotent) |
| Create duplicate dispatch for same SO | Error: "Pending dispatch already exists" |
| Add duplicate items in a PR/SO | Error: "Duplicate items not allowed" |
| Zero quantity in any form | Validation error |

---

## Seed Data Summary

The database has been pre-loaded with realistic data across all modules:

- **26 items** (raw, semi-finished, finished, trading)
- **6 suppliers**, **5 customers**
- **3 BOMs** with full component lists
- **6 PRs** (every status), **4 RFQs**, **8 supplier quotes**
- **7 POs** (every status), **14 PO line items**
- **5 gate entries**, **5 GRNs** (every status)
- **40+ stock ledger entries** with HIGH/MEDIUM/LOW stock levels
- **6 work orders** (every status), production issues & punches
- **6 sales orders** (every status), **4 dispatches**, **1 invoice**
- **18 audit log entries** across all modules
