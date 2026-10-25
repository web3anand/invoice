# AV Interior — Invoice & Quotation Desk

Print-ready invoices, quotations, and GST invoices for AV Interior Decoration. Edit letterhead, customer details, line items, and totals, then print or save as PDF. Documents automatically save with local browser storage and cloud database sync.

## Features

- **Invoices, Quotations & GST Invoices** — Independent numbering series, filters, and custom print templates.
- **GST Tax Invoice Extras** — Customer GSTIN, vehicle number, and printed copy tags (`Original for Recipient` / `Duplicate for Transporter`).
- **Flexible Measurements** — Multi-size entry with automatic square feet calculation and rounding.
- **Customer Directory & Letterhead** — Saved customer addresses, editable company profile, bank account details, and signature.
- **Print & PDF Export** — A4 print stylesheets styled to match official business invoice sheets.
- **Offline First** — Fast offline operation with browser storage plus automatic Postgres sync.

## Getting Started

```bash
# Install dependencies
npm install

# Run the local development server
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

## Build

```bash
# Check TypeScript types
npm run typecheck

# Build production bundle
npm run build
```

## Database Configuration

Copy `.env.example` to `.env` if connecting to a remote Postgres database (such as Neon):

```env
DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require
```

If `DATABASE_URL` is not set, the app automatically runs on an embedded PGLite database for local and offline use.
