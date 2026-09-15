import os
import random
import string
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

load_dotenv(override=True)

from db import users_col, products_col, orders_col, otps_col, get_db_status, IS_USING_MONGODB
from mail_service import send_order_placed_email, send_otp_email

app = Flask(__name__, static_folder="static")
CORS(app)

PORT = int(os.getenv("PORT", 5000))
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "bakery_secret_key_2026")

def generate_unique_order_id():
    """Generates a stylish unique Order ID like BKR-2026-X8K9"""
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    timestamp_part = datetime.now().strftime("%y%m%d")
    return f"BKR-{timestamp_part}-{random_part}"


# ----------------------------------------------------
# Static Frontend Serving
# ----------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(app.static_folder, path)


# ----------------------------------------------------
# System & DB Status
# ----------------------------------------------------
@app.route("/api/status", methods=["GET"])
def system_status():
    return jsonify({
        "success": True,
        "db": get_db_status(),
        "admin_email": os.getenv("ADMIN_EMAIL", "reddirohitabc@gmail.com"),
        "gmail_configured": bool(os.getenv("GMAIL_USER") and os.getenv("GMAIL_APP_PASS"))
    })


# ----------------------------------------------------
# Auth Helper & Routes (User collection in MongoDB)
# ----------------------------------------------------
def is_admin_request(req):
    """Verifies that the requester is a registered admin in the database."""
    user_id = req.headers.get("X-User-Id") or req.args.get("admin_id")
    if not user_id:
        return False
    user = users_col.find_one({"_id": user_id})
    if not user:
        return False
    return bool(user.get("is_admin") is True or user.get("role") == "admin")


# ----------------------------------------------------
# Authentication Endpoints (OTP & Mandatory Email)
# ----------------------------------------------------
@app.route("/api/auth/send-otp", methods=["POST"])
def send_otp():
    data = request.get_json() or {}
    name = (data.get("name") or "Valued Customer").strip()
    email = (data.get("email") or "").strip().lower()

    if not email or "@" not in email:
        return jsonify({"success": False, "message": "A valid Email address is mandatory to receive your OTP verification code."}), 400

    # Check if this email is already registered
    existing_user = users_col.find_one({"email": email})
    if existing_user:
        return jsonify({"success": False, "message": "An account with this email address is already registered. Please sign in."}), 409

    # Generate secure 6-digit numeric OTP
    otp_code = f"{random.randint(100000, 999999)}"
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(minutes=10)

    # Clean previous OTPs for this email and save new one
    otps_col.delete_one({"email": email})
    otps_col.insert_one({
        "email": email,
        "otp": otp_code,
        "type": "register",
        "created_at": now_utc.isoformat(),
        "expires_at": expires_at
    })

    # Clear log in terminal so owner can see it immediately in live logs
    print(f"\n=======================================================", flush=True)
    print(f"🔥 [ARTISAN BAKERY LIVE OTP DISPATCH]", flush=True)
    print(f"   Recipient Email : {email}", flush=True)
    print(f"   6-Digit OTP Code: {otp_code}", flush=True)
    print(f"   Valid For       : 10 minutes", flush=True)
    print(f"=======================================================\n", flush=True)

    # Send live email via Gmail SMTP
    mail_result = send_otp_email(to_email=email, otp_code=otp_code, user_name=name)

    return jsonify({
        "success": True,
        "message": f"A 6-digit verification code has been sent to {email}.",
        "email": email,
        "mail_status": mail_result.get("status")
    }), 200


@app.route("/api/auth/verify-otp-register", methods=["POST"])
def verify_otp_register():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = ''.join(filter(str.isdigit, str(data.get("phone", ""))))
    password = data.get("password", "")
    otp_entered = str(data.get("otp", "")).strip()

    if not email or "@" not in email:
        return jsonify({"success": False, "message": "Email address is mandatory."}), 400

    if not name:
        return jsonify({"success": False, "message": "Full Name is required."}), 400

    if not password or len(password) < 4:
        return jsonify({"success": False, "message": "Password must be at least 4 characters."}), 400

    if not otp_entered or len(otp_entered) != 6:
        return jsonify({"success": False, "message": "Please enter the 6-digit OTP sent to your email."}), 400

    # Look up pending OTP record
    otp_record = otps_col.find_one({"email": email})
    if not otp_record:
        return jsonify({"success": False, "message": "No active verification code found for this email. Please click Resend OTP."}), 400

    # Validate expiration
    expires_at = otp_record.get("expires_at")
    current_utc = datetime.now(timezone.utc)
    if isinstance(expires_at, str):
        try:
            expires_at = datetime.fromisoformat(expires_at)
        except Exception:
            expires_at = current_utc

    # Make tz-aware if naive for safe comparison
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at and expires_at < current_utc:
        otps_col.delete_one({"email": email})
        return jsonify({"success": False, "message": "Verification code has expired. Please click Resend OTP to get a new code."}), 400

    # Check OTP match
    stored_otp = str(otp_record.get("otp", "")).strip()
    if stored_otp != otp_entered:
        return jsonify({"success": False, "message": "Incorrect verification code. Please check your email and enter the matching 6 digits."}), 400

    # Check again if user exists
    if users_col.find_one({"email": email}):
        otps_col.delete_one({"email": email})
        return jsonify({"success": False, "message": "An account with this email already exists. Please sign in."}), 409

    # Delete consumed OTP
    otps_col.delete_one({"email": email})

    # Create new verified user
    user_id = f"user_{int(datetime.now().timestamp() * 1000)}"
    user_doc = {
        "_id": user_id,
        "name": name,
        "phone": phone,
        "email": email,
        "password": generate_password_hash(password),
        "role": "user",
        "is_admin": False,
        "addresses": [],
        "orders": [],
        "created_at": datetime.now().isoformat()
    }
    users_col.insert_one(user_doc)

    print(f"🎉 [NEW USER VERIFIED] Account created in MongoDB for {name} ({email})!", flush=True)

    user_safe = {
        "_id": user_id,
        "name": name,
        "phone": phone,
        "email": email,
        "role": "user",
        "is_admin": False,
        "addresses": [],
        "orders": []
    }
    return jsonify({
        "success": True,
        "message": f"Welcome, {name}! Your email is verified and your account is ready.",
        "user": user_safe
    }), 201


@app.route("/api/auth/register", methods=["POST"])
def register():
    """Legacy endpoint: redirects to OTP registration to ensure verification cannot be bypassed."""
    return jsonify({
        "success": False,
        "message": "Email OTP verification is required to register. Please use the verification flow."
    }), 400


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    # Email is strictly mandatory as requested
    email = (data.get("email") or data.get("identifier") or "").strip().lower()
    password = data.get("password", "")

    if not email or "@" not in email:
        return jsonify({"success": False, "message": "Registered Email is mandatory to sign in."}), 400

    if not password:
        return jsonify({"success": False, "message": "Password is required."}), 400

    user = users_col.find_one({"email": email})
    if not user or not check_password_hash(user.get("password", ""), password):
        return jsonify({"success": False, "message": "Invalid email or password. Please verify and try again."}), 401

    is_admin = bool(user.get("is_admin") is True or user.get("role") == "admin")

    user_safe = {
        "_id": str(user.get("_id")),
        "name": user.get("name"),
        "phone": user.get("phone", ""),
        "email": user.get("email", ""),
        "role": "admin" if is_admin else "user",
        "is_admin": is_admin,
        "addresses": user.get("addresses", []),
        "orders": user.get("orders", [])
    }
    return jsonify({
        "success": True,
        "message": f"Welcome back, {user.get('name')}!",
        "user": user_safe,
        "is_admin": is_admin
    })


@app.route("/api/auth/user/<user_id>", methods=["GET"])
def get_user_profile(user_id):
    user = users_col.find_one({"_id": user_id})
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404
    
    # Fetch user's orders as list
    user_orders = list(orders_col.find({"userId": user_id}))
    for o in user_orders:
        o["_id"] = str(o["_id"])

    is_admin = bool(user.get("is_admin") is True or user.get("role") == "admin")

    user_safe = {
        "_id": str(user.get("_id")),
        "name": user.get("name"),
        "email": user.get("email"),
        "phone": user.get("phone", ""),
        "role": "admin" if is_admin else "user",
        "is_admin": is_admin,
        "addresses": user.get("addresses", []),
        "orders": user_orders
    }
    return jsonify({"success": True, "user": user_safe})


# ----------------------------------------------------
# Products Routes
# ----------------------------------------------------
@app.route("/api/products", methods=["GET"])
def list_products():
    category = request.args.get("category")
    query = {}
    if category and category.lower() != "all":
        query["category"] = category

    products = list(products_col.find(query))
    # Format _id to string
    for p in products:
        p["_id"] = str(p["_id"])
    return jsonify({"success": True, "products": products})


@app.route("/api/products/<product_id>", methods=["GET"])
def get_product(product_id):
    prod = products_col.find_one({"_id": product_id})
    if not prod:
        return jsonify({"success": False, "message": "Product not found"}), 404
    prod["_id"] = str(prod["_id"])
    return jsonify({"success": True, "product": prod})


# ----------------------------------------------------
# Orders Routes (Strict mandatory address + unique Order ID)
# ----------------------------------------------------
@app.route("/api/orders", methods=["POST"])
def create_order():
    data = request.get_json() or {}
    items = data.get("items", [])
    shipping_address = data.get("shippingAddress", {})
    user_id = data.get("userId", None)

    if not items or len(items) == 0:
        return jsonify({"success": False, "message": "Your Hot Bag is empty! Add bakery items first."}), 400

    # Strict validation: Mandatory delivery address fields
    mandatory_fields = {
        "fullName": "Full Name",
        "phone": "Phone Number",
        "street": "Street Address",
        "city": "City",
        "pincode": "Postal Code / Pincode"
    }

    missing_fields = []
    for key, label in mandatory_fields.items():
        val = str(shipping_address.get(key, "")).strip()
        if not val:
            missing_fields.append(label)

    if missing_fields:
        return jsonify({
            "success": False,
            "message": f"Mandatory delivery address missing: {', '.join(missing_fields)}. Please complete all fields to proceed with checkout.",
            "missing_fields": missing_fields
        }), 400

    # Validate phone length (at least 7-10 digits)
    phone_clean = ''.join(filter(str.isdigit, str(shipping_address.get("phone", ""))))
    if len(phone_clean) < 7:
        return jsonify({"success": False, "message": "Please enter a valid phone number (at least 7 digits)."}), 400

    # Verify inventory and stock availability
    total_amount = 0.0
    verified_items = []
    
    for item in items:
        prod_id = item.get("productId") or item.get("_id")
        qty = int(item.get("quantity", 1))
        
        prod = products_col.find_one({"_id": prod_id})
        if not prod:
            return jsonify({"success": False, "message": f"Item '{item.get('name')}' is no longer available."}), 404
        
        current_stock = int(prod.get("stock", 0))
        if current_stock < qty:
            return jsonify({
                "success": False,
                "message": f"Insufficient stock for '{prod.get('name')}'. Only {current_stock} remaining in oven batch."
            }), 400

        subtotal = round(float(prod.get("price", 0.0)) * qty, 2)
        total_amount += subtotal
        verified_items.append({
            "productId": str(prod["_id"]),
            "name": prod.get("name"),
            "price": float(prod.get("price", 0.0)),
            "quantity": qty,
            "subtotal": subtotal,
            "image": prod.get("image", "")
        })

    total_amount = round(total_amount, 2)
    unique_order_id = generate_unique_order_id()

    # Decrement stock in MongoDB / Store
    for item in verified_items:
        prod_id = item["productId"]
        qty = item["quantity"]
        products_col.update_one(
            {"_id": prod_id},
            {"$inc": {"stock": -qty}}
        )
        # Check if stock hit 0
        updated_prod = products_col.find_one({"_id": prod_id})
        if updated_prod and updated_prod.get("stock", 0) <= 0:
            products_col.update_one({"_id": prod_id}, {"$set": {"is_available": False, "stock": 0}})

    # Create Order Document
    order_doc = {
        "_id": unique_order_id,
        "order_id": unique_order_id,
        "userId": user_id,
        "items": verified_items,
        "total_amount": total_amount,
        "shipping_address": {
            "fullName": shipping_address.get("fullName", "").strip(),
            "phone": shipping_address.get("phone", "").strip(),
            "street": shipping_address.get("street", "").strip(),
            "city": shipping_address.get("city", "").strip(),
            "pincode": shipping_address.get("pincode", "").strip(),
            "landmark": shipping_address.get("landmark", "").strip()
        },
        "payment_method": "Pay on Delivery / Fresh Bake Confirm",
        "status": "In Progress",
        "created_at": datetime.now().isoformat()
    }
    orders_col.insert_one(order_doc)

    # Link order to user if authenticated
    if user_id:
        users_col.update_one(
            {"_id": user_id},
            {
                "$push": {"orders": unique_order_id},
                "$set": {"last_address": order_doc["shipping_address"]}
            }
        )

    # Send automated Gmail notification to admin
    email_result = send_order_placed_email(order_doc)

    return jsonify({
        "success": True,
        "message": "Bakery order successfully confirmed!",
        "order_id": unique_order_id,
        "total_amount": total_amount,
        "order": order_doc,
        "email_notification": email_result
    }), 201


@app.route("/api/orders/<order_id>", methods=["GET"])
def get_order_details(order_id):
    order = orders_col.find_one({"order_id": order_id}) or orders_col.find_one({"_id": order_id})
    if not order:
        return jsonify({"success": False, "message": "Order not found"}), 404
    return jsonify({"success": True, "order": order})


@app.route("/api/user/<user_id>/orders", methods=["GET"])
def get_user_orders(user_id):
    user = users_col.find_one({"_id": user_id})
    query_conditions = [{"userId": user_id}]
    if user:
        if user.get("phone"):
            query_conditions.append({"shipping_address.phone": user.get("phone")})
        if user.get("email"):
            query_conditions.append({"shipping_address.email": user.get("email")})
            
    orders = list(orders_col.find({"$or": query_conditions}))
    for ord in orders:
        ord["_id"] = str(ord["_id"])
    orders_sorted = sorted(orders, key=lambda x: x.get("created_at", ""), reverse=True)
    return jsonify({"success": True, "orders": orders_sorted})


@app.route("/api/user/<user_id>/make-admin", methods=["POST"])
def make_user_admin(user_id):
    users_col.update_one({"_id": user_id}, {"$set": {"is_admin": True, "role": "admin"}})
    updated = users_col.find_one({"_id": user_id})
    if updated:
        updated["_id"] = str(updated["_id"])
        updated.pop("password", None)
        return jsonify({"success": True, "message": "Account upgraded to Store Admin!", "user": updated})
    return jsonify({"success": False, "message": "User not found"}), 404


# ----------------------------------------------------
# Admin Routes (Stock editing from UI + Inventory & Orders)
# ----------------------------------------------------
@app.route("/api/admin/products", methods=["GET"])
def admin_get_products():
    if not is_admin_request(request):
        return jsonify({"success": False, "message": "Access Denied: Administrator privileges required."}), 403

    products = list(products_col.find({}))
    for p in products:
        p["_id"] = str(p["_id"])
    return jsonify({"success": True, "products": products})


@app.route("/api/admin/products/<product_id>/stock", methods=["PUT"])
def admin_update_stock(product_id):
    """
    Direct in-place stock update endpoint called from the Admin UI.
    Accepts: {"stock": new_stock_number}
    """
    if not is_admin_request(request):
        return jsonify({"success": False, "message": "Access Denied: Administrator privileges required."}), 403

    data = request.get_json() or {}
    new_stock = data.get("stock")

    if new_stock is None:
        return jsonify({"success": False, "message": "New stock value is required."}), 400

    try:
        new_stock = int(new_stock)
        if new_stock < 0:
            return jsonify({"success": False, "message": "Stock cannot be negative."}), 400
    except ValueError:
        return jsonify({"success": False, "message": "Stock must be a valid integer."}), 400

    is_avail = new_stock > 0
    res = products_col.update_one(
        {"_id": product_id},
        {"$set": {"stock": new_stock, "is_available": is_avail}}
    )

    if res.matched_count == 0:
        return jsonify({"success": False, "message": "Product not found."}), 404

    updated = products_col.find_one({"_id": product_id})
    updated["_id"] = str(updated["_id"])

    return jsonify({
        "success": True,
        "message": f"Stock updated to {new_stock} units.",
        "product": updated
    })


@app.route("/api/admin/products", methods=["POST"])
def admin_add_product():
    if not is_admin_request(request):
        return jsonify({"success": False, "message": "Access Denied: Administrator privileges required."}), 403

    data = request.get_json() or {}
    name = data.get("name", "").strip()
    category = data.get("category", "Sourdough & Breads").strip()
    price = float(data.get("price", 0.0))
    stock = int(data.get("stock", 0))
    description = data.get("description", "").strip()
    image = data.get("image", "").strip()
    badge = data.get("badge", "JUST BAKED").strip()

    if not name or price <= 0:
        return jsonify({"success": False, "message": "Product name and positive price are required."}), 400

    prod_id = f"prod_{int(datetime.now().timestamp() * 1000)}"
    new_prod = {
        "_id": prod_id,
        "name": name,
        "category": category,
        "price": price,
        "stock": stock,
        "description": description,
        "image": image,
        "badge": badge,
        "is_available": stock > 0,
        "created_at": datetime.now().isoformat()
    }
    products_col.insert_one(new_prod)
    return jsonify({"success": True, "message": "New bakery product added!", "product": new_prod}), 201


@app.route("/api/admin/users", methods=["GET"])
def admin_get_users():
    if not is_admin_request(request):
        return jsonify({"success": False, "message": "Access Denied: Administrator privileges required."}), 403

    users = list(users_col.find({}))
    safe_users = []
    for u in users:
        u_id = str(u.get("_id"))
        phone = u.get("phone", "")
        email = u.get("email", "")
        # Query total orders placed by this user in orders collection
        query_conditions = [{"userId": u_id}]
        if phone:
            query_conditions.append({"shipping_address.phone": phone})
        if email:
            query_conditions.append({"shipping_address.email": email})
        order_count = orders_col.count_documents({"$or": query_conditions})

        safe_users.append({
            "_id": u_id,
            "name": u.get("name", "Customer"),
            "email": email,
            "phone": phone,
            "role": u.get("role", "user"),
            "is_admin": bool(u.get("is_admin") is True or u.get("role") == "admin"),
            "created_at": u.get("created_at", ""),
            "orders_count": order_count,
            "last_address": u.get("last_address")
        })
    safe_users_sorted = sorted(safe_users, key=lambda x: x.get("created_at", ""), reverse=True)
    return jsonify({"success": True, "users": safe_users_sorted})


@app.route("/api/admin/users/<user_id>/toggle-admin", methods=["POST"])
def admin_toggle_user_admin(user_id):
    if not is_admin_request(request):
        return jsonify({"success": False, "message": "Access Denied: Administrator privileges required."}), 403

    user = users_col.find_one({"_id": user_id})
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    current_status = bool(user.get("is_admin") is True or user.get("role") == "admin")
    new_status = not current_status
    new_role = "admin" if new_status else "user"

    users_col.update_one({"_id": user_id}, {"$set": {"is_admin": new_status, "role": new_role}})
    return jsonify({
        "success": True,
        "message": f"Updated role to {'Admin' if new_status else 'Customer'}",
        "is_admin": new_status,
        "role": new_role
    })


@app.route("/api/admin/orders", methods=["GET"])
def admin_get_orders():
    if not is_admin_request(request):
        return jsonify({"success": False, "message": "Access Denied: Administrator privileges required."}), 403

    orders = list(orders_col.find({}))
    for ord in orders:
        ord["_id"] = str(ord["_id"])
    orders_sorted = sorted(orders, key=lambda x: x.get("created_at", ""), reverse=True)
    return jsonify({"success": True, "orders": orders_sorted})


@app.route("/api/admin/orders/<order_id>/status", methods=["PUT"])
def admin_update_order_status(order_id):
    if not is_admin_request(request):
        return jsonify({"success": False, "message": "Access Denied: Administrator privileges required."}), 403

    data = request.get_json() or {}
    new_status = data.get("status")
    out_of_stock_items = data.get("out_of_stock_items", []) # List of item names or product IDs
    
    valid_statuses = ["In Progress", "Out of Stock", "Finished", "Confirmed", "In Oven", "Out for Delivery", "Delivered", "Cancelled"]
    if new_status not in valid_statuses:
        return jsonify({"success": False, "message": f"Status must be one of: {valid_statuses}"}), 400

    update_payload = {"status": new_status}
    if out_of_stock_items:
        update_payload["out_of_stock_items"] = out_of_stock_items
        # Automatically mark these items as 0 stock in the bakery inventory
        for item_info in out_of_stock_items:
            p_id = item_info if isinstance(item_info, str) else item_info.get("productId")
            p_name = item_info if isinstance(item_info, str) else item_info.get("name")
            
            match_p = []
            if p_id:
                match_p.append({"_id": p_id})
            if p_name:
                match_p.append({"name": p_name})
            
            if match_p:
                products_col.update_one({"$or": match_p}, {"$set": {"stock": 0, "is_available": False}})

    orders_col.update_one({"$or": [{"order_id": order_id}, {"_id": order_id}]}, {"$set": update_payload})
    updated_order = orders_col.find_one({"$or": [{"order_id": order_id}, {"_id": order_id}]})
    return jsonify({
        "success": True, 
        "message": f"Order status updated to '{new_status}'", 
        "order": updated_order
    })


if __name__ == "__main__":
    print(f"*** Starting Bakery E-Commerce Server on http://127.0.0.1:{PORT} ***")
    app.run(host="0.0.0.0", port=PORT, debug=True)
