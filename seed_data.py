from db import products_col, users_col, IS_USING_MONGODB
from werkzeug.security import generate_password_hash
from datetime import datetime

DEFAULT_PRODUCTS = [
    {
        "_id": "prod_1",
        "name": "Wild Sourdough Boule",
        "category": "Sourdough & Breads",
        "price": 280.0,
        "stock": 15,
        "description": "24-hour slow cold fermentation with crisp blistered crust and soft airy crumb.",
        "image": "",
        "badge": "FRESH BAKE",
        "is_available": True,
        "created_at": datetime.now().isoformat()
    },
    {
        "_id": "prod_2",
        "name": "Golden Butter Croissant",
        "category": "Viennoiserie",
        "price": 160.0,
        "stock": 25,
        "description": "Flaky French pastry laminated with 100% pure butter, honeycomb interior.",
        "image": "",
        "badge": "POPULAR",
        "is_available": True,
        "created_at": datetime.now().isoformat()
    },
    {
        "_id": "prod_3",
        "name": "Dark Chocolate Pain Au Chocolat",
        "category": "Viennoiserie",
        "price": 190.0,
        "stock": 18,
        "description": "Double batons of 70% dark Belgian chocolate folded in flaky pastry.",
        "image": "",
        "badge": "CHEF SPECIAL",
        "is_available": True,
        "created_at": datetime.now().isoformat()
    },
    {
        "_id": "prod_4",
        "name": "Cinnamon Brioche Roll",
        "category": "Viennoiserie",
        "price": 150.0,
        "stock": 12,
        "description": "Fluffy egg brioche swirled with Ceylon cinnamon and cream cheese glaze.",
        "image": "",
        "badge": "FRESH BAKE",
        "is_available": True,
        "created_at": datetime.now().isoformat()
    },
    {
        "_id": "prod_5",
        "name": "Caramelized Onion & Cheese Focaccia",
        "category": "Savory & Specials",
        "price": 240.0,
        "stock": 10,
        "description": "Extra virgin olive oil dough topped with sweet onions and herb sea salt.",
        "image": "",
        "badge": "HOT BAKE",
        "is_available": True,
        "created_at": datetime.now().isoformat()
    },
    {
        "_id": "prod_6",
        "name": "Midnight Chocolate Fudge Cake",
        "category": "Artisan Cakes",
        "price": 220.0,
        "stock": 10,
        "description": "Rich dark chocolate sponge layered with smooth chocolate ganache frosting.",
        "image": "",
        "badge": "BEST SELLER",
        "is_available": True,
        "created_at": datetime.now().isoformat()
    },
    {
        "_id": "prod_7",
        "name": "Pistachio Raspberry Tart",
        "category": "Artisan Cakes",
        "price": 260.0,
        "stock": 14,
        "description": "Crisp almond tart shell filled with roasted pistachio cream and berries.",
        "image": "",
        "badge": "CHEF SPECIAL",
        "is_available": True,
        "created_at": datetime.now().isoformat()
    },
    {
        "_id": "prod_8",
        "name": "Matcha White Chocolate Cookie",
        "category": "Savory & Specials",
        "price": 120.0,
        "stock": 30,
        "description": "Ceremonial green tea cookie loaded with creamy Belgian white chocolate.",
        "image": "",
        "badge": "POPULAR",
        "is_available": True,
        "created_at": datetime.now().isoformat()
    }
]

def seed_database():
    print(">>> Seeding Bakery Database...")
    
    # Check if products already exist
    existing_count = products_col.count_documents({})
    if existing_count == 0:
        for p in DEFAULT_PRODUCTS:
            products_col.insert_one(dict(p))
        print(f"[OK] Successfully seeded {len(DEFAULT_PRODUCTS)} bakery products!")
    else:
        print(f"[INFO] Products already present ({existing_count} items found). Skipping product seed.")

    # Create default admin user if not exists
    admin_user = users_col.find_one({"$or": [{"email": "admin@bakery.com"}, {"phone": "9999999999"}]})
    if not admin_user:
        users_col.insert_one({
            "_id": "user_admin",
            "name": "Store Admin",
            "email": "admin@bakery.com",
            "phone": "9999999999",
            "password": generate_password_hash("admin123"),
            "role": "admin",
            "is_admin": True,
            "addresses": [],
            "orders": [],
            "created_at": datetime.now().isoformat()
        })
        print("[OK] Created default Admin account: 9999999999 / admin@bakery.com (is_admin: True)")
    else:
        # Ensure is_admin is True
        users_col.update_one({"_id": admin_user["_id"]}, {"$set": {"is_admin": True, "role": "admin", "phone": "9999999999"}})
        print("[INFO] Admin account already exists (updated with is_admin: True).")

    # Create a demo customer if not exists
    demo_user = users_col.find_one({"$or": [{"email": "customer@bakery.com"}, {"phone": "9876543210"}]})
    if not demo_user:
        users_col.insert_one({
            "_id": "user_demo",
            "name": "Sarah Jenkins",
            "email": "customer@bakery.com",
            "phone": "9876543210",
            "password": generate_password_hash("password123"),
            "role": "user",
            "is_admin": False,
            "addresses": [{
                "fullName": "Sarah Jenkins",
                "phone": "9876543210",
                "street": "42 Artisan Bakery Lane, Apt 3B",
                "city": "Bengaluru",
                "pincode": "560001"
            }],
            "orders": [],
            "created_at": datetime.now().isoformat()
        })
        print("[OK] Created demo Customer account: 9876543210 / customer@bakery.com (is_admin: False)")
    else:
        users_col.update_one({"_id": demo_user["_id"]}, {"$set": {"is_admin": False, "role": "user"}})
        print("[INFO] Customer account already exists (is_admin: False).")

if __name__ == "__main__":
    seed_database()
