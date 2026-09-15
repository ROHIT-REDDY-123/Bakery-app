# Database & Environment Setup Guide: The Artisan Drop Bakery E-Commerce

This document explains **every single detail required for your MongoDB database, environment configuration, and collection schemas**.

---

## 1. Quick Answer: Do I have to create collections inside the database?

> [!IMPORTANT]
> **NO, you do NOT have to manually create collections or the database in MongoDB.**
>
> MongoDB operates on **dynamic schema generation**:
> - The database (`bakery_ecommerce`) and its collections (`users`, `products`, `orders`) **are created automatically** the moment the first document is written.
> - As soon as you add your `MONGODB_URI` to `.env` and run the included seeder script (`python seed_data.py`), MongoDB creates all collections and indexes immediately.

---

## 2. What Details Are Needed for the Database?

To connect the application to your MongoDB instance (local or MongoDB Atlas Cloud), you only need **one single connection string**:

### `MONGODB_URI`
Paste this into your `.env` file:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/bakery_ecommerce?retryWrites=true&w=majority
```

### How to Get Your Free MongoDB Atlas Connection String (Step-by-Step):
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in (or create a free account).
2. Create a free **M0 Shared Cluster** (select your nearest cloud region, e.g., Mumbai / AWS).
3. **Database Access** (Left Sidebar):
   - Click **Add New Database User**.
   - Set **Authentication Method**: Password.
   - Choose a Username (e.g., `bakery_admin`) and secure Password (e.g., `BakeSecure2026!`).
   - Role: **Read and write to any database**.
4. **Network Access** (Left Sidebar):
   - Click **Add IP Address**.
   - Select **Allow Access From Anywhere** (`0.0.0.0/0`) so your development server can connect.
5. **Get Connection String**:
   - Go to **Databases** -> Click the **Connect** button on your cluster.
   - Choose **Drivers** (Python 3.12).
   - Copy the connection string.
   - Replace `<password>` with your database user's password.
   - Replace `test` with `bakery_ecommerce`.

---

## 3. Full `.env` File Reference

Open the `.env` file in the project root (`c:\Users\reddi\New folder\.env`) and configure:

```env
# ===================================================================
# 1. SERVER CONFIGURATION
# ===================================================================
PORT=5000
SECRET_KEY=bakery_artisan_secret_key_2026_drop01

# ===================================================================
# 2. MONGODB DATABASE CONFIGURATION
# ===================================================================
# Replace with your MongoDB Atlas or local MongoDB URI:
MONGODB_URI=mongodb+srv://bakery_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/bakery_ecommerce?retryWrites=true&w=majority

# ===================================================================
# 3. ADMIN & EMAIL NOTIFICATIONS (GMAIL SMTP)
# ===================================================================
# Email address where the owner receives new order notifications:
ADMIN_EMAIL=owner@yourbakery.com

# Gmail account used to automatically dispatch order alert emails:
GMAIL_USER=yourbakeryalerts@gmail.com

# 16-character Google App Password (NOT your regular Gmail password)
# Generated at: Google Account -> Security -> 2-Step Verification -> App Passwords
GMAIL_APP_PASS=xxxx xxxx xxxx xxxx
```

*(Note: If `GMAIL_USER` or `GMAIL_APP_PASS` is left blank, the app will run normally and log order email alerts to the console.)*

---

## 4. Collections & Schemas Overview

The application automatically manages three main collections:

### 1. `users` Collection
Stores registered customers and bakery administrators.

| Field | Type | Description | Example |
|---|---|---|---|
| `_id` | String / ObjectId | Unique user identifier | `"user_admin"` or ObjectId |
| `name` | String | Full name of user | `"Store Admin"` or `"Sarah Jenkins"` |
| `phone` | String | Unique phone number (used for login) | `"9999999999"` |
| `email` | String (Optional) | User email address | `"admin@bakery.com"` |
| `password` | String | Securely hashed password (Werkzeug / PBKDF2) | `scrypt:32768:8:1$...` |
| `is_admin` | **Boolean** | **Access control flag** (`True` = Admin, `False` = Customer) | `True` |
| `role` | String | User role identifier | `"admin"` or `"user"` |
| `addresses` | Array of Objects | Saved customer delivery addresses | `[{ fullName, phone, street, city, pincode }]` |
| `orders` | Array of Strings | List of order IDs placed by this user | `["BKR-260915-AVRF"]` |
| `created_at` | String (ISO) | Registration timestamp | `"2026-09-15T18:30:00.000000"` |

---

### 2. `products` Collection
Stores all bakery catalog items and real-time oven batch inventory.

| Field | Type | Description | Example |
|---|---|---|---|
| `_id` | String / ObjectId | Unique product identifier | `"prod_1"` |
| `name` | String | Artisan bake name | `"Golden Butter Croissant"` |
| `category` | String | Bakery category | `"Viennoiserie"`, `"Sourdough & Breads"`, `"Artisan Cakes"`, `"Savory & Specials"` |
| `price` | Number (Float) | Item price in Indian Rupees (**`₹`**) | `160.0` |
| `stock` | Number (Integer) | Current oven inventory count | `25` |
| `description` | String | Detailed artisan bakery description | `"Flaky French pastry laminated with 100% pure butter."` |
| `image` | String | Photo path/URL (kept empty for future upload) | `""` |
| `badge` | String | Visual marketing badge on card | `"FRESH BAKE"`, `"POPULAR"`, `"CHEF SPECIAL"` |
| `is_available` | Boolean | Real-time availability (`True` if stock > 0, `False` if 0) | `True` |
| `created_at` | String (ISO) | Creation timestamp | `"2026-09-15T18:30:00.000000"` |

---

### 3. `orders` Collection
Stores placed customer orders, delivery details, and order lifecycle states.

| Field | Type | Description | Example |
|---|---|---|---|
| `_id` | String | Unique Order Identifier | `"BKR-260915-AVRF"` |
| `order_id` | String | Same as `_id` for quick lookup | `"BKR-260915-AVRF"` |
| `userId` | String / Null | User ID who placed the order (or guest) | `"user_demo"` |
| `items` | Array of Objects | Verified items with quantities and subtotals | `[ { productId, name, price, quantity, subtotal } ]` |
| `total_amount` | Number (Float) | Grand total order value in **`₹`** | `600.0` |
| `shipping_address` | Object | **Strict mandatory delivery address** | `{ fullName, phone, street, city, pincode }` |
| `payment_method` | String | Payment method description | `"Pay on Delivery / Fresh Bake Confirm"` |
| `status` | String | Current 3-state order lifecycle | `"In Progress"`, `"Out of Stock"`, or `"Finished"` |
| `out_of_stock_items` | Array of Strings | Item names marked unavailable by the admin | `["Golden Butter Croissant"]` |
| `created_at` | String (ISO) | Order placement timestamp | `"2026-09-15T18:45:00.000000"` |

---

## 5. How to Seed the Database in 1 Step

Once you have added your `MONGODB_URI` to `.env`, populate initial bakery items and default accounts by running:

```powershell
python seed_data.py
```

### Pre-configured Seed Accounts:
- **Store Admin** (`is_admin: True`):
  - Phone: `9999999999`
  - Email: `admin@bakery.com`
  - Password: `admin123`
  - *Access*: Dedicated Admin Dashboard (`[ Admin ]`, `[ Stock ]`, `[ Account ]`).
- **Demo Customer** (`is_admin: False`):
  - Phone: `9876543210`
  - Email: `customer@bakery.com`
  - Password: `password123`
  - *Access*: Customer Store (`[ Shop ]`, `[ Hot Bag ]`, `[ Account ]`).

---

## 6. How the System Works Without `.env` (Fallback Mode)

If `MONGODB_URI` is left empty in `.env`:
- The app uses the **built-in local persistent store** (`local_store.json`).
- All users, products, stock adjustments, and orders persist seamlessly across server restarts.
- As soon as you add your `MONGODB_URI` to `.env`, the server automatically connects to MongoDB Atlas.
