import openai
import os
from typing import List, Dict, Any
from pathlib import Path
import PyPDF2
import tempfile
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor

class LLMSummarizer:
    def __init__(self, api_key: str = None):
        """Initialize the LLM summarizer with OpenAI API key."""
        if api_key:
            self.api_key = api_key
        else:
            self.api_key = os.environ.get("OPENAI_API_KEY")
            if not self.api_key:
                raise ValueError("OpenAI API key not provided and not found in environment variables")
        
        # Use the simpler old-style API to avoid proxy issues
        openai.api_key = self.api_key
        self.model = "gpt-4o-mini"  # Using GPT-4o-mini as specified
        self.executor = ThreadPoolExecutor(max_workers=5)  # For CPU-bound tasks
    
    async def extract_pdf_text(self, paper: Any) -> str:
        """
        Download and extract text from a paper's PDF asynchronously.
        """
        start_time = time.time()
        try:
            # Create a temporary directory for PDF download
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir) / "temp_paper.pdf"
                
                # Download PDF to temporary location - run in thread pool
                await asyncio.get_event_loop().run_in_executor(
                    self.executor,
                    paper.download_pdf,
                    temp_dir,
                    "temp_paper.pdf"
                )
                
                # Extract text from PDF - run in thread pool
                text_content = []
                async def extract_page_text(page):
                    return await asyncio.get_event_loop().run_in_executor(
                        self.executor,
                        lambda: page.extract_text()
                    )

                async with asyncio.Lock():  # Ensure thread-safe PDF reading
                    with open(temp_path, 'rb') as pdf_file:
                        pdf_reader = PyPDF2.PdfReader(pdf_file)
                        max_pages = min(5, len(pdf_reader.pages))
                        
                        # Extract text from pages concurrently
                        tasks = [extract_page_text(pdf_reader.pages[i]) for i in range(max_pages)]
                        text_content = await asyncio.gather(*tasks)
                
                elapsed = time.time() - start_time
                print(f"  ✓ PDF processing completed in {elapsed:.2f} seconds")
                return "\n".join(text_content)
                
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"  ✗ Error extracting PDF text ({elapsed:.2f}s): {str(e)}")
            return ""
    
    async def score_papers_by_title(self, papers: List[Any], top_k: int = 1) -> List[Any]:
        """Score and select the most interesting papers based on their titles."""
        start_time = time.time()
        if not papers:
            return []
            
        # Prepare titles for scoring
        titles_with_ids = [(i, paper.title) for i, paper in enumerate(papers)]
        titles_text = "\n".join([f"{i+1}. {title}" for i, title in enumerate([t for _, t in titles_with_ids])])
        
        prompt = f"""Below are research paper titles. Score each title from 1-10 based on:
- Innovation and novelty (new methods, approaches, or findings)
- Potential impact in the field
- Technical significance
- Clarity and specificity of the contribution

Papers:
{titles_text}

Format your response as:
1. Score: X - One sentence explanation
2. Score: X - One sentence explanation
...

Only output the scores and explanations, nothing else."""
        
        try:
            # Run OpenAI API call in thread pool
            response = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                lambda: openai.ChatCompletion.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a research expert who evaluates paper significance."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=200,
                    temperature=0.3
                )
            )
            
            # Parse scores from response
            scores_text = response.choices[0].message.content.strip().split('\n')
            scores = []
            
            for i, score_text in enumerate(scores_text):
                try:
                    score = int(score_text.split('Score: ')[1].split(' -')[0])
                    scores.append((score, i))
                except:
                    scores.append((5, i))
            
            # Sort by score and get top_k papers
            scores.sort(reverse=True)
            selected_indices = [titles_with_ids[idx][0] for score, idx in scores[:top_k]]
            
            elapsed = time.time() - start_time
            print(f"  ✓ Paper scoring completed in {elapsed:.2f} seconds")
            return [papers[i] for i in selected_indices]
            
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"  ✗ Error scoring papers ({elapsed:.2f}s): {str(e)}")
            return papers[:top_k]
    
    async def detailed_paper_summary(self, paper: Any) -> Dict[str, str]:
        """Create a detailed summary of a research paper using both metadata and PDF content."""
        start_time = time.time()
        
        title = paper.title
        abstract = paper.summary
        authors = paper.authors
        author_names = ', '.join([str(author) for author in authors]) if authors else ''
        published_date = paper.published if hasattr(paper, 'published') else None
        arxiv_id = paper.entry_id if hasattr(paper, 'entry_id') else None
        
        # Extract text from PDF asynchronously
        print(f"  Extracting text from PDF for: {title[:50]}...")
        pdf_text = await self.extract_pdf_text(paper)
        
        # Create a comprehensive prompt
        prompt = f"""
        Title: {title}
        Authors: {author_names}
        Abstract: {abstract}
        
        Additional Content from PDF Introduction:
        {pdf_text[:2000]}  # Using first 2000 chars of PDF text
        
        Please provide a comprehensive analysis of this research paper covering:
        1. Main objective and motivation (from abstract)
        2. Key methodology or approach (from PDF content)
        3. Most significant findings or contributions
        4. Technical details and implementation insights (from PDF)
        5. Potential impact and applications
        
        Format the response as:
        SUMMARY: [200-word detailed summary incorporating PDF content]
        METHODOLOGY: [Key technical approaches found in the paper]
        FINDINGS: [Main results and contributions]
        TECHNICAL_DETAILS: [Important implementation details from the PDF]
        IMPACT: [Potential applications and significance]
        """
        
        try:
            # Run OpenAI API call in thread pool
            response = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                lambda: openai.ChatCompletion.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a research expert who provides detailed paper analysis."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=1000,
                    temperature=0.3
                )
            )
            
            summary_text = response.choices[0].message.content.strip()
            
            # Download PDF for user reference - in thread pool
            pdf_dir = Path("paper_downloads")
            pdf_dir.mkdir(exist_ok=True)
            
            safe_title = "".join(x for x in title if x.isalnum() or x in (' ', '-', '_'))[:50]
            pdf_filename = f"{safe_title}.pdf"
            pdf_path = pdf_dir / pdf_filename
            
            try:
                await asyncio.get_event_loop().run_in_executor(
                    self.executor,
                    paper.download_pdf,
                    str(pdf_dir),
                    pdf_filename
                )
                pdf_status = "Successfully downloaded"
            except Exception as e:
                pdf_status = f"Download failed: {str(e)[:50]}..."
            
            elapsed = time.time() - start_time
            print(f"  ✓ Paper summary completed in {elapsed:.2f} seconds")
            
            return {
                "title": title,
                "authors": author_names,
                "category": paper.primary_category,
                "detailed_summary": summary_text,
                "url": paper.entry_id,
                "arxiv_id": arxiv_id,
                "published_date": published_date,
                "pdf_path": str(pdf_path) if pdf_status == "Successfully downloaded" else None,
                "pdf_status": pdf_status,
                "has_pdf_analysis": bool(pdf_text.strip()),
                "processing_time": elapsed
            }
        
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"  ✗ Error creating detailed summary ({elapsed:.2f}s): {str(e)}")
            return {
                "title": title,
                "authors": author_names,
                "category": paper.primary_category,
                "detailed_summary": f"Summary failed: {str(e)[:50]}...",
                "url": paper.entry_id,
                "arxiv_id": arxiv_id,
                "published_date": published_date,
                "pdf_path": None,
                "pdf_status": "Summary failed",
                "has_pdf_analysis": False,
                "processing_time": elapsed
            }
    
    async def batch_summarize(self, papers: List[Any], max_papers: int = 1) -> List[Dict[str, str]]:
        """Select and create detailed summaries for the best papers."""
        if not papers:
            return []
            
        # First, score and select the most interesting papers
        selected_papers = await self.score_papers_by_title(papers, top_k=max_papers)
        
        # Process papers concurrently and save each one as it completes
        tasks = [self.detailed_paper_summary(paper) for paper in selected_papers]
        summaries = await asyncio.gather(*tasks)
        
        return summaries
    
    async def generate_paper_summary(self, title: str, authors: str, abstract: str, url: str) -> str:
        """Generate a comprehensive summary of a paper based on its metadata."""
        prompt = f"""
        Title: {title}
        Authors: {authors}
        Abstract: {abstract}
        Paper URL: {url}
        
        Please provide a comprehensive analysis of this research paper based on the abstract. Include:
        
        1. Main objective and research question addressed
        2. Key methodology or approach
        3. Most significant findings, results, or contributions
        4. Potential applications and implications
        5. Technical significance and advancements
        
        Format your response as a well-structured essay with markdown formatting, 
        using sections like "Research Objectives", "Methodology", "Key Findings", 
        "Technical Significance", and "Potential Applications".
        """
        
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                lambda: openai.ChatCompletion.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a research expert who synthesizes academic papers into accessible summaries."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=1500,
                    temperature=0.3
                )
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"Error generating paper summary: {str(e)}")
            return f"Error generating summary: {str(e)}"
            
    async def generate_pdf_summary(self, title: str, authors: str, pdf_text: str) -> str:
        """
        Generate a detailed summary of a paper based on its PDF content.
        
        Args:
            title: Paper title
            authors: Paper authors
            pdf_text: Extracted text from the PDF file
        
        Returns:
            A detailed summary of the paper
        """
        start_time = time.time()
        
        # Create a comprehensive prompt using the PDF text
        prompt = f"""
        Title: {title}
        Authors: {authors}
        
        PDF CONTENT:
        {pdf_text[:8000]}  # Using first 8000 chars of PDF text to stay within token limits
        
        Please provide a comprehensive analysis of this research paper based on the PDF content. Include:
        
        1. Main objective and research question addressed
        2. Key methodology or approach (based on the full text, not just abstract)
        3. Most significant findings, results, or contributions
        4. Technical details found in the paper (algorithms, models, datasets, implementation details)
        5. Evaluation methods and metrics
        6. Potential applications and implications
        
        Format your response as a well-structured essay with markdown formatting, using appropriate sections.
        Focus on details that are only available in the full paper text and not in the abstract.
        """
        
        try:
            # Run OpenAI API call in thread pool
            response = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                lambda: openai.ChatCompletion.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a research expert who analyzes academic papers in detail."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=2000,
                    temperature=0.3
                )
            )
            
            summary_text = response.choices[0].message.content.strip()
            
            elapsed = time.time() - start_time
            print(f"  ✓ PDF summary generation completed in {elapsed:.2f} seconds")
            
            return summary_text
            
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"  ✗ Error generating PDF summary ({elapsed:.2f}s): {str(e)}")
            return f"Error generating PDF summary: {str(e)}"