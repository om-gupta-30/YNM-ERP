# YNM ERP

A comprehensive Enterprise Resource Planning (ERP) system built for manufacturing operations, covering the complete workflow from procurement to production to invoicing.

## Overview

YNM ERP is a full-stack web application designed for manufacturing companies to manage their complete operational workflow. It provides role-based access control, real-time inventory tracking, production management, and financial oversight across multiple factory locations.

## Key Features

### Core Modules

- **Master Data Management**: Items, Suppliers, Customers, and Bill of Materials (BOM)
- **Procurement**: Purchase Requisitions, RFQs, Quote Comparison, and Purchase Orders
- **Inventory Management**: Gate Entry, GRN (Goods Receipt Notes), Stock Tracking, and Ledger
- **Production**: Work Orders, Material Issue, Production Punching, and BOM-based Manufacturing
- **Sales & Distribution**: Sales Orders, Dispatch Management, and Invoice Generation
- **Administration**: User Management, Approvals Workflow, Audit Logs, and Executive Dashboard

### Role-Based Access Control

The system supports 8 distinct user roles with granular permissions:

| Role | Responsibilities |
|------|------------------|
| **Admin** | Full system access, approvals, audit logs, executive dashboard |
| **Planning** | Create PRs, manage work orders, view BOMs and items |
| **Purchase** | Manage suppliers, RFQs, POs, and view stock levels |
| **Sales** | Manage customers and sales orders |
| **Accounts** | Handle dispatches and invoice generation |
| **Security** | Create gate entries for incoming shipments |
| **Stores** | Manage GRNs, issue materials, process dispatches, track stock |
| **Production** | Manage BOMs, punch production output, view work orders |

### Business Process Flow

```
1. Purchase Requisition (Planning) → 
2. RFQ & Quote Comparison (Purchase) → 
3. Purchase Order (Purchase → Admin Approval) → 
4. Gate Entry (Security) → 
5. GRN (Stores → Quality Check) → 
6. Work Order (Planning) → 
7. Material Issue & Production (Stores & Production) → 
8. Sales Order (Sales) → 
9. Dispatch (Stores) → 
10. Invoice (Accounts)
```

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (React 19)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Docker + Google Cloud Build

## Prerequisites

- Node.js 20 or higher
- npm or yarn
- Supabase account and project
- Docker (optional, for containerized deployment)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "ynm erp"
```

### 2. Install Dependencies

```bash
npm install
# or
make install
```

### 3. Environment Setup

Create a `.env.local` file from the example:

```bash
make setup
# or
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 4. Database Setup

Apply migrations and seed data:

```bash
make db-migrate
make db-seed
```

### 5. Run Development Server

```bash
npm run dev
# or
make dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Test Accounts

The seeded database includes the following test accounts:

| Username | Password | Role |
|----------|----------|------|
| Admin | Admin@123 | admin |
| Planning | Planning@123 | planning |
| Purchase | Purchase@123 | purchase |
| Sales | Sales@123 | sales |
| Accounts | Accounts@123 | accounts |
| Security | Security@123 | security |
| Stores | Stores@123 | stores |
| Production | Production@123 | production |

See [QA_TEST_GUIDE.md](./QA_TEST_GUIDE.md) for comprehensive testing scenarios.

## Project Structure

```
ynm erp/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── (app)/               # Authenticated app routes
│   │   │   ├── admin/           # Admin, audit log
│   │   │   ├── approvals/       # Approval workflows
│   │   │   ├── dashboard/       # Dashboards (role-specific)
│   │   │   ├── dispatch/        # Dispatch & invoices
│   │   │   ├── inventory/       # GRN, gate entry, stock, ledger
│   │   │   ├── masters/         # Items, suppliers, customers, BOM
│   │   │   ├── production/      # Work orders, material issue, punches
│   │   │   ├── purchase/        # PR, RFQ, PO
│   │   │   └── sales/           # Sales orders
│   │   ├── (auth)/              # Login & authentication
│   │   └── api/                 # API routes
│   ├── components/              # React components
│   │   ├── ui/                  # Reusable UI components
│   │   ├── layout/              # Layout components (sidebar, header)
│   │   ├── bom/                 # BOM-specific components
│   │   ├── charts/              # Data visualization
│   │   └── [module]/            # Module-specific components
│   ├── contexts/                # React contexts (Auth)
│   ├── lib/                     # Business logic & utilities
│   │   ├── dbServices/          # Database service layer
│   │   ├── services/            # Business logic services
│   │   ├── mockData/            # Seed data
│   │   ├── hooks/               # Custom React hooks
│   │   ├── types.ts             # TypeScript type definitions
│   │   ├── rbac.ts              # Role-based access control
│   │   ├── navigation.ts        # Navigation configuration
│   │   └── supabaseClient.ts    # Supabase client setup
│   └── app/globals.css          # Global styles
├── supabase/
│   ├── migrations/              # Database migrations
│   └── seed.sql                 # Seed data script
├── public/                      # Static assets
├── Dockerfile                   # Docker container config
├── Makefile                     # Development commands
├── QA_TEST_GUIDE.md            # Comprehensive test scenarios
└── package.json                # Dependencies & scripts
```

## Available Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking

# Using Makefile
make dev             # Start dev server
make build           # Production build
make check           # Run typecheck + lint
make db-migrate      # Apply database migrations
make db-seed         # Seed database
make docker-build    # Build Docker image
make docker-run      # Run Docker container
make help            # Show all available commands
```

## Docker Deployment

### Build Image

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=your-url \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  -t ynm-erp .
```

### Run Container

```bash
docker run --rm -p 8080:8080 \
  --env-file .env.local \
  ynm-erp
```

Or use the Makefile:

```bash
make docker-build
make docker-run
```

## Key Features in Detail

### Inventory Management

- Real-time stock tracking with inward/outward transaction logging
- Item categorization (Raw Material, Semi-Finished, Finished Goods, Trading)
- Reorder level monitoring
- Multi-location support (YNM-HYD, YNM-PUNE, YNM-CHENNAI)
- Complete stock ledger with transaction history

### Bill of Materials (BOM)

- Multi-level BOM support
- Scrap percentage calculation
- Component-wise material requirements
- BOM versioning and obsolescence tracking
- Automatic material calculation for work orders

### Production Management

- Work order planning based on BOMs
- Material issue tracking
- Production punch recording (good + scrap quantities)
- Real-time production progress monitoring
- Material consumption validation

### Purchase Management

- Purchase requisition workflow
- RFQ with multi-supplier quote comparison
- Automated PO generation from RFQ
- Supplier performance tracking
- Approval workflows for PRs and POs

### Quality Control

- Gate entry verification
- GRN with accept/reject capabilities
- Quality inspection at goods receipt
- Partial acceptance support
- Stock impact only after approval

### Audit & Compliance

- Comprehensive audit log for all transactions
- User activity tracking
- Change history for all master data
- Role-based access control (RBAC)
- Soft delete with data integrity checks

## Database Schema

The application uses Supabase (PostgreSQL) with the following key tables:

- `users` - User accounts and roles
- `items` - Item master data
- `suppliers` - Supplier master data
- `customers` - Customer master data
- `bom_master` / `bom_components` - Bill of materials
- `purchase_requisitions` / `pr_items` - Purchase requisitions
- `rfq` / `rfq_suppliers` / `supplier_quotes` - RFQ management
- `purchase_orders` / `po_items` - Purchase orders
- `gate_entries` - Goods arrival tracking
- `grn` / `grn_items` - Goods receipt notes
- `work_orders` / `production_punches` / `material_issues` - Production
- `sales_orders` / `so_items` - Sales orders
- `dispatches` / `dispatch_items` / `invoices` - Distribution
- `stock_ledger` - Inventory transactions
- `audit_logs` - System audit trail

## Security Features

- Row-level security (RLS) policies in Supabase
- Role-based access control (RBAC)
- Secure authentication with Supabase Auth
- API route protection
- Soft delete with data integrity checks
- Audit logging for compliance

## CI/CD

The project includes:

- GitHub Actions workflow (`.github/workflows/ci.yml`)
- Google Cloud Build configuration (`cloudbuild.yaml`)
- Docker-based deployment
- Automated linting and type checking

## Testing

Comprehensive QA test guide available in [QA_TEST_GUIDE.md](./QA_TEST_GUIDE.md), covering:

- Login and role-based access
- Master data management
- Complete procurement flow
- Production workflows
- Sales and dispatch
- Edge cases and negative tests
- End-to-end integration tests

## Seed Data

The database includes realistic seed data:

- 26 items (raw materials, semi-finished, finished goods, trading)
- 6 suppliers and 5 customers
- 3 complete BOMs with component lists
- 6 PRs, 4 RFQs, 7 POs (covering all statuses)
- 5 gate entries and 5 GRNs
- 40+ stock ledger entries
- 6 work orders with production data
- 6 sales orders, 4 dispatches, 1 invoice
- 18+ audit log entries

## Contributing

1. Follow the existing code structure and naming conventions
2. Run `npm run typecheck` and `npm run lint` before committing
3. Write meaningful commit messages
4. Test thoroughly using the QA guide
5. Update documentation for new features

## License

Proprietary - All rights reserved

## Support

For issues, questions, or feature requests, please contact the development team.

---

Built with ❤️ for YNM Manufacturing
