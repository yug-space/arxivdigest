import os
import argparse
import datetime
import asyncio
from typing import Dict, List, Any, Set
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import re # For slugify
from bson import ObjectId
import time

from arxiv import ArxivFetcher
from llm import LLMSummarizer
from database import paper_details_collection

app = FastAPI()
api_key = os.getenv("OPENAI_API_KEY")

# Global variable to track if generation is in progress for specific categories
generation_in_progress: Dict[str, bool] = {}

# Add CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def slugify(text: str) -> str:
    """Convert text into a URL-friendly slug."""
    text = text.lower()
    text = re.sub(r'\s+', '-', text)
    text = re.sub(r'[^a-z0-9\-]', '', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')

def serialize_mongo_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Helper function to serialize MongoDB document."""
    if doc is None:
        return None
        
    serialized = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            serialized[key] = str(value)
        elif isinstance(value, datetime.datetime):
            serialized[key] = value.isoformat()
        else:
            serialized[key] = value
    return serialized

async def process_category(
    category: str,
    papers: List[Any],
    arxiv_fetcher: ArxivFetcher,
    llm_summarizer: LLMSummarizer,
    current_date: str,
    max_papers_per_category: int
) -> List[Dict[str, Any]]:
    """Process a single category's papers in parallel."""
    try:
        category_name = arxiv_fetcher.get_category_name(category)
        category_s = slugify(category_name)
        
        if not papers:
            print(f"No papers found for {category} - {category_name}.")
            return []
            
        print(f"\nProcessing papers from {category} ({category_name})...")
        
        # Get list of previously processed paper IDs
        existing_paper_ids = set()
        cursor = paper_details_collection.find({}, {"arxiv_id": 1})
        for doc in cursor:
            if doc.get("arxiv_id"):
                existing_paper_ids.add(doc["arxiv_id"])
        
        # Filter out previously processed papers
        new_papers = [
            paper for paper in papers 
            if hasattr(paper, 'entry_id') and paper.entry_id not in existing_paper_ids
        ]
        
        if not new_papers:
            print(f"  No new unprocessed papers found for {category}.")
            return []
            
        print(f"  Found {len(new_papers)} new papers, selecting the most interesting ones...")
        
        # Score and select papers
        selected_papers = await llm_summarizer.score_papers_by_title(new_papers, top_k=max_papers_per_category)
        processed_papers = []

        # Process each paper concurrently and save immediately
        async def process_and_save_paper(paper):
            try:
                start_time = time.time()
                paper_summary = await llm_summarizer.detailed_paper_summary(paper)
                
                if not paper_summary or not paper_summary.get('title'):
                    print("  Skipping an empty or untitled paper summary.")
                    return None

                paper_slug = slugify(paper_summary['title'])
                paper_detail_doc = {
                    "title": paper_summary['title'],
                    "slug": paper_slug,
                    "authors": paper_summary.get('authors'),
                    "category_code": category,
                    "category_name": category_name,
                    "category_slug": category_s,
                    "arxiv_id": paper_summary.get('arxiv_id'),
                    "published_date": paper_summary.get('published_date'),
                    "url": paper_summary['url'],
                    "pdf_path": paper_summary.get('pdf_path'),
                    "pdf_status": paper_summary.get('pdf_status'),
                    "has_pdf_analysis": paper_summary.get('has_pdf_analysis'),
                    "summary_sections": paper_summary.get('detailed_summary'),
                    "generation_date": datetime.datetime.utcnow(),
                    "processed_date": current_date,
                    "processing_time": paper_summary.get('processing_time')
                }
                
                if paper_detail_doc.get("arxiv_id"):
                    # Save to MongoDB immediately after processing
                    await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: paper_details_collection.update_one(
                            {"arxiv_id": paper_detail_doc["arxiv_id"]},
                            {"$set": paper_detail_doc},
                            upsert=True
                        )
                    )
                    elapsed = time.time() - start_time
                    print(f"  ✓ Processed and saved paper: \"{paper_summary['title'][:50]}...\" in {elapsed:.2f} seconds")
                    return paper_detail_doc
                else:
                    print(f"  ! Skipping paper due to missing arxiv_id: {paper_summary['title']}")
                    return None
                    
            except Exception as e:
                print(f"  ✗ Error processing paper: {str(e)}")
                return None

        # Process all selected papers concurrently
        processing_tasks = [process_and_save_paper(paper) for paper in selected_papers]
        processed_results = await asyncio.gather(*processing_tasks)
        
        # Filter out None results from errors
        processed_papers = [paper for paper in processed_results if paper is not None]
        
        return processed_papers
            
    except Exception as e:
        print(f"  ✗ Error processing category {category}: {str(e)}")
        return []
    finally:
        # Clear the generation in progress flag for this category
        generation_in_progress[category] = False

async def run_arxiv_summarizer_async(
    current_date: str,
    categories_to_process: Set[str],
    api_key: str = None,
    max_papers_per_category: int = 1,
) -> List[Dict[str, Any]]:
    """Async version of run_arxiv_summarizer that processes categories in parallel."""
    try:
        # Initialize components
        arxiv_fetcher = ArxivFetcher()
        llm_summarizer = LLMSummarizer(api_key=api_key)
        
        # Create a semaphore to limit concurrent processing
        semaphore = asyncio.Semaphore(3)  # Limit to 3 concurrent categories
        
        async def process_category_with_semaphore(category: str, papers: List[Any]) -> List[Dict[str, Any]]:
            async with semaphore:
                try:
                    generation_in_progress[category] = True
                    return await process_category(
                        category=category,
                        papers=papers,
                        arxiv_fetcher=arxiv_fetcher,
                        llm_summarizer=llm_summarizer,
                        current_date=current_date,
                        max_papers_per_category=max_papers_per_category
                    )
                except Exception as e:
                    print(f"Error processing category {category}: {str(e)}")
                    return []
                finally:
                    generation_in_progress[category] = False
        
        # Fetch papers only for categories that need processing
        category_papers = {}
        for category in categories_to_process:
            try:
                papers = arxiv_fetcher.fetch_papers_by_category(category, max_papers_per_category * 3)
                if papers:
                    category_papers[category] = papers
            except Exception as e:
                print(f"Error fetching papers for category {category}: {str(e)}")
                generation_in_progress[category] = False
        
        if not category_papers:
            return []
        
        # Process categories in parallel with resource limits
        tasks = [
            process_category_with_semaphore(category, papers)
            for category, papers in category_papers.items()
        ]
        
        # Wait for all tasks to complete and flatten the results
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions and flatten the results
        all_papers = []
        for result in results:
            if isinstance(result, list):
                all_papers.extend(result)
            else:
                print(f"Error in category processing: {str(result)}")
        
        return all_papers
        
    except Exception as e:
        print(f"Error in run_arxiv_summarizer_async: {str(e)}")
        # Clean up all generation flags
        for category in categories_to_process:
            generation_in_progress[category] = False
        return []

@app.get("/api/generate")
async def generate_summaries(background_tasks: BackgroundTasks, category: str = None, max_papers: int = 1):
    """
    Endpoint to generate paper summaries in parallel. Only runs the generation for missing categories.
    For subsequent requests on the same day, it returns cached results from MongoDB.
    """
    try:
        today_date_str = datetime.datetime.now().strftime("%Y-%m-%d")
        arxiv_fetcher = ArxivFetcher()
        
        # If category is specified, only check/generate for that category
        categories_to_check = [category] if category else arxiv_fetcher.categories.keys()
        
        # Check which categories need generation
        categories_to_process = set()
        existing_papers = {}
        generation_status = {}
        
        for cat in categories_to_check:
            # Get current generation status
            is_generating = generation_in_progress.get(cat, False)
            generation_status[cat] = {
                "status": "in_progress" if is_generating else "pending",
                "last_updated": datetime.datetime.now().isoformat()
            }
            
            # Skip if generation is already in progress for this category
            if is_generating:
                continue
                
            # Check if we have papers for this category today
            cat_papers = list(paper_details_collection.find({
                "category_code": cat,
                "processed_date": today_date_str
            }))
            
            if cat_papers:
                existing_papers[cat] = [serialize_mongo_doc(paper) for paper in cat_papers]
                generation_status[cat]["status"] = "completed"
            else:
                categories_to_process.add(cat)
                generation_in_progress[cat] = True
                generation_status[cat]["status"] = "starting"
        
        # Start background processing for categories that need it
        if categories_to_process:
            background_tasks.add_task(
                run_arxiv_summarizer_async,
                current_date=today_date_str,
                categories_to_process=categories_to_process,
                api_key=api_key,
                max_papers_per_category=max_papers
            )
        
        # Prepare response with existing papers and generation status
        response = {
            "existing_papers": existing_papers,
            "generation_status": generation_status,
            "categories_processing": list(categories_to_process),
            "timestamp": datetime.datetime.now().isoformat()
        }
        
        return response
        
    except Exception as e:
        # Clean up generation flags in case of error
        for cat in categories_to_process:
            generation_in_progress[cat] = False
        raise HTTPException(
            status_code=500,
            detail=f"Error generating summaries: {str(e)}"
        )

@app.get("/api/categories")
async def get_categories():
    """Get all available categories."""
    try:
        arxiv_fetcher = ArxivFetcher()
        categories = []
        for code, name in arxiv_fetcher.categories.items():
            # Get paper count for this category
            count = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: paper_details_collection.count_documents({"category_code": code})
            )
            categories.append({
                "code": code,
                "name": name,
                "slug": slugify(name),
                "paper_count": count
            })
        return categories
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching categories: {str(e)}"
        )

@app.get("/api/category/{category_slug}")
async def get_papers_by_category(category_slug: str, date: str = None, page: int = 1, per_page: int = 10):
    """Get papers for a specific category, optionally filtered by date."""
    try:
        query = {"category_slug": category_slug}
        if date:
            query["processed_date"] = date
        
        # Get total count for pagination
        total_count = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: paper_details_collection.count_documents(query)
        )
        
        # Calculate skip for pagination
        skip = (page - 1) * per_page
        
        # Fetch papers with pagination
        papers = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: list(
                paper_details_collection.find(query)
                .sort("published_date", -1)
                .skip(skip)
                .limit(per_page)
            )
        )
        
        # Serialize MongoDB documents
        serialized_papers = [serialize_mongo_doc(paper) for paper in papers]
                
        return {
            "papers": serialized_papers,
            "total": total_count,
            "page": page,
            "per_page": per_page,
            "total_pages": (total_count + per_page - 1) // per_page
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching papers: {str(e)}"
        )

@app.get("/api/blog/{paper_slug}")
async def get_paper_by_slug(paper_slug: str):
    """Get a specific paper by its slug."""
    try:
        paper = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: paper_details_collection.find_one({"slug": paper_slug})
        )
        if paper:
            return serialize_mongo_doc(paper)
        raise HTTPException(status_code=404, detail="Paper not found")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching paper: {str(e)}"
        )

@app.get("/api/papers")
async def get_papers(
    category: str = None,
    date: str = None,
    page: int = 1,
    per_page: int = 10,
    sort_by: str = "published_date",
    sort_order: str = "desc"
):
    """
    Fetch papers filtered by category and/or date with pagination and sorting.
    Returns cached results from MongoDB.
    """
    try:
        # Use today's date if not specified
        if not date:
            date = datetime.datetime.now().strftime("%Y-%m-%d")
        
        # Create the query
        query = {"processed_date": date}
        if category:
            # Try to match either category_code or category_slug
            query["$or"] = [
                {"category_code": category},
                {"category_slug": category}
            ]
        
        # Validate sort parameters
        valid_sort_fields = ["published_date", "title", "generation_date"]
        if sort_by not in valid_sort_fields:
            sort_by = "published_date"
        sort_direction = -1 if sort_order.lower() == "desc" else 1
        
        # Calculate skip for pagination
        skip = (page - 1) * per_page
        
        # Get total count for pagination
        total_count = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: paper_details_collection.count_documents(query)
        )
        
        # Fetch papers with pagination and sorting
        papers = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: list(
                paper_details_collection.find(query)
                .sort(sort_by, sort_direction)
                .skip(skip)
                .limit(per_page)
            )
        )
        
        # Serialize MongoDB documents
        serialized_papers = [serialize_mongo_doc(paper) for paper in papers]
        
        return {
            "date": date,
            "category": category,
            "papers": serialized_papers,
            "count": len(papers),
            "total": total_count,
            "page": page,
            "per_page": per_page,
            "total_pages": (total_count + per_page - 1) // per_page,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching papers: {str(e)}"
        )

@app.get("/api/generation-status")
async def get_generation_status(category: str = None):
    """
    Get the current generation status for all categories or a specific category.
    Returns detailed information about the generation process.
    """
    try:
        today_date_str = datetime.datetime.now().strftime("%Y-%m-%d")
        arxiv_fetcher = ArxivFetcher()
        
        # If category is specified, only check that category
        categories_to_check = [category] if category else arxiv_fetcher.categories.keys()
        
        status_info = {}
        for cat in categories_to_check:
            # Check if generation is in progress
            is_generating = generation_in_progress.get(cat, False)
            
            # Check for existing papers today
            existing_count = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: paper_details_collection.count_documents({
                    "category_code": cat,
                    "processed_date": today_date_str
                })
            )
            
            # Get total papers for this category
            total_papers = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: paper_details_collection.count_documents({
                    "category_code": cat
                })
            )
            
            status_info[cat] = {
                "category_name": arxiv_fetcher.get_category_name(cat),
                "status": "in_progress" if is_generating else "completed" if existing_count > 0 else "not_started",
                "papers_generated_today": existing_count,
                "total_papers": total_papers,
                "last_updated": datetime.datetime.now().isoformat()
            }
        
        return {
            "date": today_date_str,
            "status": status_info,
            "timestamp": datetime.datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error checking generation status: {str(e)}"
        )

async def generate_bulk_summaries():
    """Generate 50 summaries for each category."""
    try:
        arxiv_fetcher = ArxivFetcher()
        current_date = datetime.datetime.now().strftime("%Y-%m-%d")
        categories = arxiv_fetcher.categories.keys()
        
        print(f"Starting bulk generation of 50 papers for each category...")
        print(f"Total categories to process: {len(categories)}")
        
        results = await run_arxiv_summarizer_async(
            current_date=current_date,
            categories_to_process=set(categories),
            api_key=api_key,
            max_papers_per_category=50
        )
        
        print(f"\nBulk generation completed!")
        print(f"Total papers generated: {len(results)}")
        for category in categories:
            count = sum(1 for paper in results if paper.get('category_code') == category)
            print(f"- {category}: {count} papers")
            
    except Exception as e:
        print(f"Error in bulk generation: {str(e)}")

def main():
    """Command line interface for the arXiv summarizer."""
    parser = argparse.ArgumentParser(description="Run FastAPI server for arXiv summarizer with daily caching.")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to run the server on.")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the server on.")
    parser.add_argument("--generate-bulk", action="store_true", help="Generate 50 papers for each category before starting server.")
    
    args = parser.parse_args()
    
    if args.generate_bulk:
        print("Starting bulk generation of papers...")
        asyncio.run(generate_bulk_summaries())
        print("Bulk generation completed!")
    
    print(f"Starting FastAPI server on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port)

if __name__ == "__main__":
    main()
