# Print-on-Demand In-House Management Platform

A multi-tenant backend and administrative console designed to manage independent publishing clients, automate book inventories, and coordinate print-on-demand order fulfillment using the **Stripe API** and **Lulu Print API**.

---

## 🏗️ Architecture Overview

The platform is designed to run as a secure, serverless portal managing client assets and automated checkout events:

```
                  ┌────────────────────────┐
                  │   Aldiverse Console    │ (Admin Dashboard)
                  │   (Next.js / React)    │
                  └───────────┬────────────┘
                              │ Authenticated Team Reads & Writes
                              ▼
                  ┌────────────────────────┐
                  │      Supabase DB       │ (Profiles, Tenants, Books, Orders)
                  │   & Object Storage     │ (Public books bucket for print PDFs)
                  └───────────▲────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │ API Webhooks Sync    │ API Webhooks Sync    │ API Checkout Route
       ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  Stripe API  │       │   Lulu API   │       │ Static Sites │ (Vite Frontend)
│  (Checkouts) │       │ (Print Jobs) │       │ (Client Store)│
└──────────────┘       └──────────────┘       └──────────────┘
```

---

## 🛠️ Technology Stack

* **Frontend & Admin Panel**: Next.js 16 (App Router), React 19, TypeScript, TailwindCSS, Framer Motion, Lucide Icons.
* **Database & Auth**: Supabase (PostgreSQL with Row Level Security, Supabase Auth).
* **Storage**: Supabase Storage (Public bucket named `books` for cover and interior PDF uploads).
* **Payment Processing**: Stripe Checkout (Dynamic billing address collection, tax estimation, session creation).
* **Fulfillment Gateway**: Lulu Developer Print API (Sandbox & Production OAuth authorization, Print-Job routing).
* **Security**: AES-256-GCM cryptographic encryption for storing clients' API credentials.

---

## 📂 Key Directory Structure

```
├── app/
│   ├── api/v1/                   # RESTful Endpoint Routers
│   │   ├── auth/bootstrap/       # Superadmin Initializer
│   │   ├── books/                # Storefront Book Catalog Fetch
│   │   ├── checkout/             # Stripe Session Creator
│   │   ├── clients/              # Client Settings Management
│   │   ├── orders/               # Orders Retrieval & Retries
│   │   ├── users/                # Team Registry Controllers
│   │   └── webhooks/             
│   │       ├── lulu/             # Lulu Print & Shipping Update Hook
│   │       └── stripe/           # Stripe Paid Event Fulfillment Hook
│   ├── console/                  # Authenticated Admin Panel
│   │   ├── [client-slug]/        # Workspace-Specific Pages
│   │   │   ├── books/            # Book Catalog & Upload Forms
│   │   │   ├── orders/           # Client Order Logs & Lulu Sync
│   │   │   └── settings/         # Lulu & Stripe Client Key Config
│   │   ├── clients/              # Client Workspace Directory
│   │   └── users/                # User Registry (Superadmin Only)
│   ├── login/                    # Credentials Login Page
│   └── page.tsx                  # Public Dashboard Landing
├── components/                   # Shared UI Components & Auth Contexts
├── lib/                          # Backend Libraries & Crypto Utilities
│   ├── crypto.ts                 # Credentials Encryption / Decryption
│   ├── lulu.ts                   # Lulu API Client Wrapper
│   └── supabase.ts               # Supabase Service Instance
└── supabase/
    └── migrations/               # PostgreSQL Database Init Scripts
```

---

## 🔒 Security & Encryption

To protect clients' credentials (Stripe keys, Lulu secrets), the database does not store them in plaintext. The system uses **AES-256-GCM** encryption:
* Secrets are encrypted backend-side before inserting into the `tenants` table.
* Decryption happens in memory only when calling Stripe or Lulu API gateways.
* Ensure you configure a 64-character hex encryption key in your environment variables.

---

## ⚙️ Environment Variables Setup

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-host.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Encryption Key (64-character hexadecimal string)
# Generate one using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

---

## 🚀 Local Deployment

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Initialize Database Schema**:
   Apply the migrations located in the `/supabase/migrations` folder using the Supabase CLI, or copy and execute the SQL script inside the Supabase Query Editor.

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to access the console.

4. **Initialize Superadmin Account**:
   Send a request to `/api/v1/auth/bootstrap` (or click the register button on the login screen for first-time setup) to establish your superadmin credentials.

5. **Build for Production**:
   ```bash
   npm run build
   ```

---

## 📡 Webhooks Setup

To synchronize order state updates automatically, you must register the callback URLs in your payment and print portals:

### 1. Stripe Webhooks
Register a webhook in the client's Stripe Developer Dashboard for the `checkout.session.completed` event.
* **Endpoint URL**: `https://your-domain.com/api/v1/webhooks/stripe?tenant=[client-slug]`
* **Signing Secret**: Copy the generated `whsec_...` key and paste it under **Stripe Webhook Signing Secret** in the client settings panel.

### 2. Lulu Webhooks
Register a webhook in the client's Lulu Developer Portal for print job status changes.
* **Endpoint URL**: `https://your-domain.com/api/v1/webhooks/lulu`
* **Note**: No signing secret is required; Lulu will send updates with the matching `print_job_id` corresponding to our recorded orders.
