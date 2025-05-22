import arxiv
from typing import List, Dict, Any
from datetime import datetime, timedelta

class ArxivFetcher:
    def __init__(self):
        """Initialize the ArXiv client."""
        self.client = arxiv.Client()
        
        # Define arXiv categories of interest
        self.categories = {
            "cs.LG": "Machine Learning",
            "cs.CL": "Natural Language Processing",
            "cs.CV": "Computer Vision",
            "stat.ML": "Statistical ML",
            "quant-ph": "Quantum Physics",
            "nucl-th": "Nuclear Theory",
            "nucl-ex": "Nuclear Experiment",
            "cond-mat.mtrl-sci": "Materials Science",
            "astro-ph.GA": "Galaxy Astrophysics",
            "q-bio.NC": "Neurons & Cognition",
            "cs.CR": "Crypto & Security"
        }
    
    def fetch_papers_by_category(self, category: str, max_results: int = 5, days_back: int = 7) -> List[Dict[Any, Any]]:
        """
        Fetch recent papers from a specific arXiv category.
        
        Args:
            category: arXiv category code (e.g., 'cs.LG')
            max_results: Maximum number of papers to fetch
            days_back: How many days back to search for papers
            
        Returns:
            List of paper objects
        """
        # Calculate date range for recent papers
        date_cutoff = datetime.now() - timedelta(days=days_back)
        
        # Fetch 5x more papers initially to ensure we have enough new ones after filtering
        initial_max_results = max_results * 5
        
        search = arxiv.Search(
            query=f"cat:{category}",
            max_results=initial_max_results,
            sort_by=arxiv.SortCriterion.SubmittedDate,
            sort_order=arxiv.SortOrder.Descending
        )
        
        try:
            print(f"  Fetching papers for {category}...")
            results = []
            for paper in self.client.results(search):
                # Some papers might not have published date
                if not hasattr(paper, 'published'):
                    continue
                    
                # Check if paper is within our date range
                if paper.published.replace(tzinfo=None) >= date_cutoff:
                    results.append(paper)
                    if len(results) >= initial_max_results:
                        break
                        
            print(f"  Found {len(results)} recent papers in {category}")
            return results
            
        except Exception as e:
            print(f"Error fetching papers for category {category}: {str(e)}")
            return []
    
    def fetch_all_categories(self, max_per_category: int = 3) -> Dict[str, List[Dict[Any, Any]]]:
        """
        Fetch papers from all defined categories.
        
        Args:
            max_per_category: Maximum number of papers per category
            
        Returns:
            Dictionary mapping category codes to lists of papers
        """
        all_papers = {}
        
        print("\nFetching papers from arXiv categories:")
        print("=====================================")
        
        for category, category_name in self.categories.items():
            print(f"\nCategory: {category} - {category_name}")
            papers = self.fetch_papers_by_category(category, max_per_category)
            
            if papers:
                print(f"  Successfully fetched {len(papers)} papers")
            else:
                print("  No papers found or error occurred")
                
            all_papers[category] = papers
            
        print("\nFinished fetching papers from all categories")
        return all_papers
    
    def get_category_name(self, category_code: str) -> str:
        """Get the human-readable name for a category code."""
        return self.categories.get(category_code, "Unknown Category")