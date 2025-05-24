"use client"

import { useState, useEffect } from 'react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, Download } from "lucide-react"
import Link from "next/link"
import axios from 'axios'

// Define an interface for the paper data
interface Paper {
  title: string;
  authors: string;
  summary_sections?: string;
  published_date?: string;
  url: string;
  category_code?: string;
  category_name?: string;
  arxiv_id?: string;
  slug?: string;
}

interface PdfAnalysis {
  pdf_path: string;
  num_pages: number;
  summary: string;
  analysis_date: string;
}

export default function ArxivUrlPage({ params }: { params: { id: string } }) {
  const [paper, setPaper] = useState<Paper | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'fetching' | 'processing' | 'complete' | 'error'>('idle')
  const [pdfAnalysis, setPdfAnalysis] = useState<PdfAnalysis | null>(null)
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [arxivId, setArxivId] = useState<string>("")

  // Extract arXiv ID from URL
  const getArxivIdFromParams = (paramId: string): string => {
    try {
      // First decode the URL parameter
      let decodedUrl = decodeURIComponent(paramId)
      
      // If it's a full URL, extract the ID
      if (decodedUrl.includes('arxiv.org/abs/')) {
        decodedUrl = decodedUrl.split('arxiv.org/abs/')[1]
      }
      
      // Remove any version suffix (vX)
      if (decodedUrl.includes('v')) {
        const vIndex = decodedUrl.indexOf('v')
        // Make sure we're dealing with a version number (v1, v2, etc.) and not part of the ID
        if (vIndex > 0 && /v\d+$/.test(decodedUrl)) {
          decodedUrl = decodedUrl.substring(0, vIndex)
        }
      }
      
      return decodedUrl.trim()
    } catch (e) {
      console.error('Error parsing arXiv ID:', e)
      return paramId
    }
  }

  // Function to fetch the paper from our backend
  const fetchPaperFromBackend = async (paperArxivId: string) => {
    try {
      setProcessingStatus('fetching')
      
      // Call our backend to fetch the paper
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_URL || 'http://localhost:8000'}/api/fetch-arxiv-paper`,
        { arxiv_id: paperArxivId },
        { timeout: 60000 } // 60 seconds timeout
      )
      
      return response.data
    } catch (error: any) {
      console.error('Error fetching from backend:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to fetch paper'
      throw new Error(errorMessage)
    }
  }

  const handleAnalyzePDF = async () => {
    if (!paper || !paper.arxiv_id) return;
    
    try {
      setAnalyzeLoading(true);
      
      // Call the backend PDF analysis endpoint
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_URL || 'http://localhost:8000'}/api/pdf-analysis/${paper.arxiv_id}`,
        {},
        {
          timeout: 120000, // 2 minutes
        }
      );
      
      if (response.data && response.data.pdf_analysis) {
        setPdfAnalysis(response.data.pdf_analysis);
      } else {
        throw new Error('PDF analysis response is missing expected data');
      }
    } catch (e: any) {
      console.error('Error analyzing PDF:', e);
      const errorMessage = e.response?.data?.detail || e.message || 'Unknown error occurred';
      alert(`Failed to analyze PDF: ${errorMessage}. Please try again later.`);
    } finally {
      setAnalyzeLoading(false);
    }
  };

  // Parse the arxiv ID once on component mount
  useEffect(() => {
    const id = getArxivIdFromParams(params.id);
    setArxivId(id);
  }, [params.id]);

  // Fetch the paper when arxivId is available
  useEffect(() => {
    const fetchPaper = async () => {
      if (!arxivId) return;
      
      try {
        setLoading(true);
        
        // Fetch paper from our backend
        const paperData = await fetchPaperFromBackend(arxivId);
        setPaper(paperData);
        setProcessingStatus('complete');
      } catch (e: any) {
        console.error('Error processing paper:', e);
        setError(e.message || 'Failed to fetch paper. Please try again later.');
        setProcessingStatus('error');
      } finally {
        setLoading(false);
      }
    };

    fetchPaper();
  }, [arxivId]);
  
  // Automatically analyze PDF when paper is loaded
  useEffect(() => {
    // Start PDF analysis automatically when paper is loaded
    if (paper?.arxiv_id && !pdfAnalysis && !analyzeLoading) {
      handleAnalyzePDF();
    }
  }, [paper]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[50vh] p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-foreground mb-4"></div>
        <p className="text-muted-foreground text-center">
          {processingStatus === 'fetching' ? 'Fetching paper from backend...' :
           processingStatus === 'processing' ? 'Processing paper...' :
           'Loading...'}
        </p>
      </div>
    )
  }

  if (error || !paper) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <h1 className="text-2xl font-bold">Paper Not Found</h1>
        <p className="text-muted-foreground mt-2 text-center">{error}</p>
        <p className="text-sm text-muted-foreground mt-4 max-w-md text-center">
          This could happen if the arXiv ID is invalid or if there was an error fetching the paper.
        </p>
        <Link href="/" className="mt-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to home
        </Link>
      </div>
    )
  }

  // Format the published date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown date';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="bg-background/50">
            {paper.category_name || 'Research Paper'}
          </Badge>
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="mr-1 h-4 w-4" />
            {formatDate(paper.published_date)}
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-4">{paper.title}</h1>

        <div className="prose max-w-none">
          {/* Authors section */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Authors</h2>
            <p>{paper.authors || 'Unknown authors'}</p>
          </div>

          {/* Summary section */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Summary</h2>
            <div className="whitespace-pre-line bg-muted p-4 rounded-md border border-border">
              {paper.summary_sections || 'No summary available'}
            </div>
          </div>
          
          {/* PDF Analysis section */}
          {paper.arxiv_id && (
            <div className="mt-8 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">PDF Analysis</h2>
                {!pdfAnalysis && analyzeLoading && (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-t-2 border-b-2 border-foreground rounded-full"></div>
                    <span>Analyzing PDF (this may take a minute)...</span>
                  </div>
                )}
              </div>
              
              {pdfAnalysis && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Analyzed on {new Date(pdfAnalysis.analysis_date).toLocaleDateString()} • 
                    {pdfAnalysis.num_pages} pages
                  </p>
                  <div className="bg-muted p-4 rounded-md mt-2 border border-border">
                    <div className="whitespace-pre-line">{pdfAnalysis.summary}</div>
                  </div>
                </div>
              )}
              
              {!pdfAnalysis && analyzeLoading && (
                <div className="mt-4 p-4 border border-border rounded-md">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-foreground rounded-full"></div>
                    <p>Downloading and analyzing PDF content...</p>
                    <p className="text-sm text-muted-foreground">This may take 1-2 minutes for large papers</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Display link to original paper */}
          <div className="mt-8 mb-6">
            <h2 className="text-2xl font-semibold mb-2">Original Paper</h2>
            <div className="flex flex-col gap-2">
              <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                View on arXiv
              </a>
              {paper.arxiv_id && (
                <a 
                  href={`https://arxiv.org/pdf/${paper.arxiv_id}.pdf`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary hover:text-primary/80 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </a>
              )}
            </div>
          </div>

          <div className="mt-8 mb-6">
            <p className="mb-4">Go back to <Link href="/" className="text-primary hover:text-primary/80">home</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}

