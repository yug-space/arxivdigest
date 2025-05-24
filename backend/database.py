# backend/database.py
from pymongo import MongoClient
import datetime
import os

# Load environment variables

# MongoDB Configuration
MONGO_URI = os.getenv("MONGO_URI")

# Create mock MongoDB collections for fallback when real MongoDB is not available
class MockCollection:
    """A simple in-memory mock of MongoDB collection for fallback."""
    def __init__(self, name):
        self.name = name
        self.data = {}
        
    def find_one(self, query):
        """Simple implementation of find_one."""
        if not query:
            return None
        
        # Handle _id query
        if "_id" in query and query["_id"] in self.data:
            return self.data[query["_id"]]
            
        # Handle other field queries (very simplified)
        for doc_id, doc in self.data.items():
            match = True
            for key, value in query.items():
                if key not in doc or doc[key] != value:
                    match = False
                    break
            if match:
                return doc
        return None
        
    def find(self, query=None, **kwargs):
        """Simple implementation of find."""
        results = []
        if not query:
            results = list(self.data.values())
        else:
            for doc in self.data.values():
                match = True
                for key, value in query.items():
                    if isinstance(value, dict) and "$or" in key:
                        # Handle $or operator (simplified)
                        or_conditions = value
                        or_match = False
                        for condition in or_conditions:
                            for or_key, or_val in condition.items():
                                if or_key in doc and doc[or_key] == or_val:
                                    or_match = True
                                    break
                            if or_match:
                                break
                        if not or_match:
                            match = False
                            break
                    elif key not in doc or doc[key] != value:
                        match = False
                        break
                if match:
                    results.append(doc)
                    
        # Handle sorting, skip, limit
        if "sort" in kwargs:
            field, direction = kwargs["sort"]
            results.sort(key=lambda x: x.get(field, ""), reverse=(direction == -1))
        
        if "skip" in kwargs:
            results = results[kwargs["skip"]:]
            
        if "limit" in kwargs and kwargs["limit"] > 0:
            results = results[:kwargs["limit"]]
            
        # Return a list-like object
        return results
        
    def count_documents(self, query=None):
        """Simple implementation of count_documents."""
        if query is None:
            return len(self.data)
        
        count = 0
        for doc in self.data.values():
            match = True
            for key, value in query.items():
                if key not in doc or doc[key] != value:
                    match = False
                    break
            if match:
                count += 1
        return count
        
    def insert_one(self, doc):
        """Simple implementation of insert_one."""
        if "_id" not in doc:
            import uuid
            doc["_id"] = str(uuid.uuid4())
        self.data[doc["_id"]] = doc
        return doc
        
    def update_one(self, query, update, upsert=False):
        """Simple implementation of update_one."""
        doc = self.find_one(query)
        if doc:
            if "$set" in update:
                for key, value in update["$set"].items():
                    doc[key] = value
        elif upsert:
            # Create new doc with query + update
            new_doc = {}
            for key, value in query.items():
                new_doc[key] = value
            if "$set" in update:
                for key, value in update["$set"].items():
                    new_doc[key] = value
            self.insert_one(new_doc)
        return None

class MockDatabase:
    """A simple mock of MongoDB database."""
    def __init__(self, name):
        self.name = name
        self.collections = {}
        
    def get_collection(self, name):
        if name not in self.collections:
            self.collections[name] = MockCollection(name)
        return self.collections[name]

try:
    # Initialize MongoDB client with proper settings
    if MONGO_URI:
        client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5000,  # 5 second timeout
            connectTimeoutMS=10000,  # 10 second timeout
            socketTimeoutMS=45000,  # 45 second timeout
            maxPoolSize=50  # Maximum connection pool size
        )
        
        # Test the connection
        client.admin.command('ping')
        print("Successfully connected to MongoDB")
        
        # Initialize database and collection
        db = client.get_database("arxiv_summaries_db")
        paper_details_collection = db.get_collection("paper_details")
        
    else:
        print("MONGODB_URI not set, using in-memory mock storage")
        # Use in-memory mock collections when MongoDB is not available
        mock_db = MockDatabase("arxiv_summaries_db")
        paper_details_collection = mock_db.get_collection("paper_details")
        
except Exception as e:
    print(f"Error connecting to MongoDB: {str(e)}")
    print("Falling back to in-memory mock storage")
    # Use in-memory mock collections when MongoDB connection fails
    mock_db = MockDatabase("arxiv_summaries_db")
    paper_details_collection = mock_db.get_collection("paper_details")

# You can add helper functions here if needed, for example:
# def get_summary_by_date(date_str: str):
#     return summaries_collection.find_one({"date": date_str})

# def store_summary(date_str: str, summary_content: str):
#     return summaries_collection.insert_one({
#         "date": date_str,
#         "summary_content": summary_content,
#         "created_at": datetime.datetime.utcnow()
#     }) 