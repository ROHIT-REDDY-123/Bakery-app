import os
import json
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("BakeryDB")

MONGODB_URI = os.getenv("MONGODB_URI", "").strip()

# Storage mode indicator
IS_USING_MONGODB = False
db = None
users_col = None
products_col = None
orders_col = None
otps_col = None

# Fallback in-memory / JSON store
FALLBACK_FILE = os.path.join(os.path.dirname(__file__), "local_store.json")

class FallbackCollection:
    def __init__(self, name, parent_store):
        self.name = name
        self.parent_store = parent_store

    def _get_items(self):
        return self.parent_store.data.get(self.name, [])

    def _save(self):
        self.parent_store.save()

    def _item_matches(self, item, query):
        if not query:
            return True
        for k, v in query.items():
            if k == "$or":
                or_match = False
                for cond in v:
                    if all(item.get(ck) == cv for ck, cv in cond.items()):
                        or_match = True
                        break
                if not or_match:
                    return False
            elif item.get(k) != v:
                return False
        return True

    def find(self, query=None, projection=None):
        items = self._get_items()
        if not query:
            return [dict(i) for i in items]
        return [dict(item) for item in items if self._item_matches(item, query)]

    def find_one(self, query=None):
        matches = self.find(query)
        return matches[0] if matches else None

    def insert_one(self, document):
        if "_id" not in document:
            document["_id"] = f"{self.name}_{int(datetime.now().timestamp() * 1000)}"
        self._get_items().append(document)
        self._save()
        class Result:
            inserted_id = document["_id"]
        return Result()

    def update_one(self, query, update):
        items = self._get_items()
        for idx, item in enumerate(items):
            if self._item_matches(item, query):
                if "$set" in update:
                    for sk, sv in update["$set"].items():
                        item[sk] = sv
                if "$inc" in update:
                    for ik, iv in update["$inc"].items():
                        item[ik] = item.get(ik, 0) + iv
                if "$push" in update:
                    for pk, pv in update["$push"].items():
                        if pk not in item:
                            item[pk] = []
                        item[pk].append(pv)
                items[idx] = item
                self._save()
                class UpdateResult:
                    matched_count = 1
                    modified_count = 1
                return UpdateResult()
        class FailResult:
            matched_count = 0
            modified_count = 0
        return FailResult()

    def delete_one(self, query):
        items = self._get_items()
        for idx, item in enumerate(items):
            if all(item.get(k) == v for k, v in query.items()):
                items.pop(idx)
                self._save()
                return True
        return False

    def count_documents(self, query=None):
        return len(self.find(query))


class FallbackStore:
    def __init__(self):
        self.data = {"users": [], "products": [], "orders": [], "otps": []}
        self.load()

    def load(self):
        if os.path.exists(FALLBACK_FILE):
            try:
                with open(FALLBACK_FILE, "r", encoding="utf-8") as f:
                    self.data = json.load(f)
                    if "otps" not in self.data:
                        self.data["otps"] = []
            except Exception as e:
                logger.error(f"Failed to read local store: {e}")

    def save(self):
        try:
            with open(FALLBACK_FILE, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to write local store: {e}")


def init_db():
    global IS_USING_MONGODB, db, users_col, products_col, orders_col, otps_col
    
    current_uri = os.getenv("MONGODB_URI", "").strip()
    if current_uri:
        from pymongo import MongoClient
        client = None
        # Attempt 1: Standard connection
        try:
            client = MongoClient(current_uri, serverSelectionTimeoutMS=6000)
            client.admin.command('ping')
        except Exception as e1:
            logger.warning(f"Standard MongoDB SSL failed ({e1}). Retrying with tlsAllowInvalidCertificates=True...")
            try:
                # Attempt 2: Resilient TLS mode (handles cloud Linux OpenSSL differences)
                client = MongoClient(current_uri, serverSelectionTimeoutMS=8000, tlsAllowInvalidCertificates=True)
                client.admin.command('ping')
            except Exception as e2:
                logger.warning(f"Could not connect to MongoDB URI ({e2}). Falling back to local storage.")
                client = None

        if client is not None:
            try:
                db = client.get_database("bakery_ecommerce")
                users_col = db["users"]
                products_col = db["products"]
                orders_col = db["orders"]
                otps_col = db["otps"]
                try:
                    otps_col.create_index("expires_at", expireAfterSeconds=0)
                except Exception:
                    pass
                IS_USING_MONGODB = True
                logger.info(">>> Successfully connected to MongoDB Atlas! <<<")
                return
            except Exception as e:
                logger.warning(f"Error accessing database: {e}")
    
    logger.info(">>> Using resilient Local Persistent Store (waiting for MONGODB_URI in .env) <<<")
    store = FallbackStore()
    users_col = FallbackCollection("users", store)
    products_col = FallbackCollection("products", store)
    orders_col = FallbackCollection("orders", store)
    otps_col = FallbackCollection("otps", store)
    IS_USING_MONGODB = False

init_db()

def get_db_status():
    return {
        "is_mongodb": IS_USING_MONGODB,
        "mode": "MongoDB Cloud/Local" if IS_USING_MONGODB else "Local Store (Ready for MONGODB_URI in .env)",
        "users_count": users_col.count_documents({}),
        "products_count": products_col.count_documents({}),
        "orders_count": orders_col.count_documents({})
    }
