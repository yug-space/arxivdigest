# backend/database.py
from pymongo import MongoClient
import datetime
import os

# Load environment variables

# MongoDB Configuration
MONGO_URI = os.getenv("MONGODB_URI")

if not MONGO_URI:
    raise ValueError("MONGODB_URI environment variable is not set")

try:
    # Initialize MongoDB client with proper settings
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
    
except Exception as e:
    print(f"Error connecting to MongoDB: {str(e)}")
    raise

# You can add helper functions here if needed, for example:
# def get_summary_by_date(date_str: str):
#     return summaries_collection.find_one({"date": date_str})

# def store_summary(date_str: str, summary_content: str):
#     return summaries_collection.insert_one({
#         "date": date_str,
#         "summary_content": summary_content,
#         "created_at": datetime.datetime.utcnow()
#     }) 