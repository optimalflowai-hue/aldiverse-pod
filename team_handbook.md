# 📖 Aldiverse Platform: Team Handbook (Non-Technical Guide)

Welcome to the **Aldiverse Print-on-Demand (POD)** Management Console! This guide is designed for publishing managers and operational team members. It outlines how to perform common tasks, configure client accounts, upload books, and monitor order fulfillment.

---

## 🧭 Table of Contents
1. [Portal Access & User Management](#-1-portal-access--user-management)
2. [Adding a New Client Workspace](#-2-adding-a-new-client-workspace)
3. [Connecting Payment Gateways (Stripe)](#-3-connecting-payment-gateways-stripe)
4. [Connecting Print Fulfillment (Lulu)](#-4-connecting-print-fulfillment-lulu)
5. [Publishing books & Uploading Files](#-5-publishing-books--uploading-files)
6. [Monitoring & Troubleshooting Orders](#-6-monitoring--troubleshooting-orders)

---

## 👤 1. Portal Access & User Management

The admin portal has two roles:
* **Superadmin**: Full control (adding clients, deleting data, and managing team member logins).
* **Member**: Standard read/write access (can manage client settings, upload books, and track orders; cannot view or edit user logins).

### Registering a Team Member (Superadmin Only)
1. In the sidebar, go to **User Management**.
2. Click **Add New Member** at the top right.
3. Enter a **Username** (e.g. `jane`).
   > [!NOTE]
   > You only need to type a simple username. The portal automatically appends `@aldiverse.com` in the database.
4. Enter an initial password and select a role (`member` or `superadmin`).
5. Click **Add Member**.

### Sharing Login Credentials
When a user is created or updated:
1. Click the **Share** (`Share2` icon) button next to their name.
2. An overlay opens showing a preview message containing their credentials and the login link.
3. Click **Copy Credentials** to copy the formatted credentials to your clipboard.
4. Share this copied message securely with your team member.

---

## 🏢 2. Adding a New Client Workspace

Before a client (like Dr. Patti Mills) can sell books, you must create their dedicated workspace:
1. Go to the dashboard **Overview** page.
2. Click **Add New Client**.
3. Type the **Client Name** (e.g., `Test Client`).
4. The system will auto-generate a **Client Workspace Slug** (e.g., `test-client`).
5. Click **Create Client Workspace**.
   > [!WARNING]
   > The **Workspace Slug** is used in API URLs (e.g., `/test-client`). To prevent breaking active checkouts, **workspace slugs cannot be renamed** once created.

---

## 💳 3. Connecting Payment Gateways (Stripe)

Each client collects payment through their own Stripe merchant account. To link it:
1. Navigate to your client's workspace (e.g. click **Enter Workspace** on the Clients Directory page).
2. Click **API Settings** in the sidebar.
3. Open your client's **Stripe Developer Dashboard** in another browser tab.
4. Go to **Developers > API Keys** in Stripe:
   * Copy the **Secret Key** (`sk_test_...` or `sk_live_...`).
   * In the Aldiverse settings, paste this into **Stripe Secret Key**.
5. Go to **Developers > Webhooks** in Stripe:
   * Click **Add Endpoint**.
   * In Aldiverse, copy the **Webhook Endpoint URL** from the bottom card (e.g., `https://your-domain.com/api/v1/webhooks/stripe?tenant=client-slug`).
   * Paste this URL into the Stripe endpoint configuration.
   * Under **Select Events**, choose `checkout.session.completed`. Click **Add endpoint**.
   * Reveal the **Signing Secret** (`whsec_...`) for the new webhook.
   * In Aldiverse, paste this code into **Stripe Webhook Signing Secret**.
6. Click **Save API Configuration**.

---

## 🖨️ 4. Connecting Print Fulfillment (Lulu)

Lulu prints and ships the physical books. To link the client's Lulu account:
1. Open the **Lulu Developer Portal** at [developers.lulu.com](https://developers.lulu.com/) and register/log in.
2. Go to the **My Apps** tab and click **Create New App**:
   * **App Name**: `Aldiverse Fulfillment - [Client Name]`
   * **Description**: `Automated print fulfillment`
3. Once the App is created, click on it to see the credentials:
   * Copy the **Client Key**. Paste it into **Lulu Client Key** in Aldiverse settings.
   * Copy the **Client Secret**. Paste it into **Lulu Client Secret** in Aldiverse settings.
4. Select the **Lulu Environment**:
   * **Sandbox**: Use this for initial setup and testing. Print jobs are created as mock orders (no money charged, no physical printing).
   * **Production**: Use this once you are ready to process real, paid orders for physical shipment.
5. Click **Save API Configuration**.

> [!IMPORTANT]
> **Linked Credit Card/Balance**: For production orders to print, the client must add a credit card or preload their balance inside the Lulu developer portal account. If there is no balance, print jobs are created as `UNPAID` and will not enter print queues until paid.

---

## 📚 5. Publishing Books & Uploading Files

To add a new book to the storefront catalog:
1. In the client workspace, click **Book Catalog**.
2. Click **Add New Book** at the top right.
3. Enter the **Book Title**, **Retail Price** (in USD), and a short summary **Description**.
4. Choose the **Book Format Preset**:
   * Standard presets (e.g., *US Trade 6"x9" - B&W Standard, Cream Paper*) automatically assign the correct dotted SKU code.
   * If the book uses a special binding, paper, or sizing, select **Custom / Manual SKU Entry**.
5. **How to find custom Lulu SKU/Package IDs**:
   * If you chose **Custom**, the **Lulu SKU / Package ID** input field unlocks.
   * Click **🌐 Pricing Calculator** to open Lulu's web pricing tool. Enter your book parameters to see the printed SKU.
   * Or click **📊 Excel Spec Sheet** to download the master Excel file listing every valid combination of size, ink, and binding.
   * Follow the dotted code convention: `Trim.Ink.Quality.Binding.Paper.Finish` (e.g. `0600X0900.BW.STD.PB.060UC444.MXX`).
6. **Upload Print PDFs**:
   * Drag & drop or click to upload the **Interior PDF Manuscript** (must be standard black & white or color pages).
   * Drag & drop or click to upload the **Cover PDF Wrap** (must include the front cover, spine width, and back cover as a single spread).
   * *Note:* Uploading starts only when you submit the form. Keep your browser open until the button status displays "Book published successfully".

---

## 🛒 6. Monitoring & Troubleshooting Orders

Every purchase placed on the client's storefront automatically spawns an entry in the **Orders Pipeline**.

### Tracking Order Statuses
* **paid**: Stripe has successfully collected payment, and the database has recorded the customer address.
* **submitted_to_lulu**: The order has been forwarded to Lulu's print queue. The **Lulu Job ID** will be visible on the right.
* **printing**: Lulu's printing partner has approved the files and is physically printing the pages.
* **shipped**: The carrier has picked up the package. A **Tracking Number** link will appear in the dashboard.
* **cancelled**: The print job was cancelled by Lulu (due to file dimension errors) or manually deleted.

### Handling "Unsent" Errors
If a print job fails to submit (e.g. if the client's Lulu developer portal was down, or the PDFs had missing files):
1. The status will show a pulsing red **Unsent** warning badge.
2. Click the **Retry Lulu** button on the right side of the order row.
3. The platform will re-authenticate with Lulu and attempt to re-submit the order. If it succeeds, the order status changes to **submitted_to_lulu** immediately.
