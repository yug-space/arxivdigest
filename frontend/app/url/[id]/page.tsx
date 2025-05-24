"use client"

import { useState, useEffect } from 'react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, Share2, Download, FileText } from "lucide-react"
import Link from "next/link"
import axios from 'axios'

// Define an interface for the paper data
interface Paper {
  title: string;
  authors: string;
  summary: string;
  published: string;
  url: string;
  category?: string;
  categoryName?: string;
  arxiv_id?: string;
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
    // URL will be in the format "https://arxiv.org/abs/2505.14669v1" or just the ID
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

  // Helper function to extract text from XML
  const extractTextFromXml = (xmlString: string, selector: string): string => {
    // Simple regex-based extractor for XML elements
    // This is a simplistic approach; in production, you'd use a proper XML parser
    const regex = new RegExp(`<${selector}[^>]*>(.*?)<\/${selector}>`, 's')
    const match = xmlString.match(regex)
    return match ? match[1].trim() : ''
  }

  // Function to fetch the paper directly from arXiv API
  const fetchPaperFromArxiv = async (paperArxivId: string) => {
    try {
      setProcessingStatus('fetching')
      
      // Use the arXiv API to fetch the paper
      const response = await axios.get(`https://export.arxiv.org/api/query?id_list=${paperArxivId}`)
      const xmlString = response.data
      
      // Check if we got a valid response
      if (!xmlString.includes('<entry>')) {
        throw new Error('Paper not found')
      }
      
      // Extract the entry section
      const entryMatch = xmlString.match(/<entry>([\s\S]*?)<\/entry>/)
      if (!entryMatch) {
        throw new Error('Paper entry not found in response')
      }
      
      const entryXml = entryMatch[0]
      
      // Extract paper details using our helper function
      const title = extractTextFromXml(entryXml, 'title')
      const summary = extractTextFromXml(entryXml, 'summary')
      const published = extractTextFromXml(entryXml, 'published')
      const url = extractTextFromXml(entryXml, 'id')
      
      // Extract authors - this is more complex
      const authorMatches = entryXml.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)
      const authors = authorMatches 
        ? authorMatches
            .map((author: string) => {
              const nameMatch = author.match(/<name>([\s\S]*?)<\/name>/)
              return nameMatch ? nameMatch[1].trim() : null
            })
            .filter(Boolean)
            .join(', ')
        : 'Unknown'
      
      // Extract category
      let category = ''
      let categoryName = 'Research Paper'
      
      const categoryMatch = entryXml.match(/<category term="([^"]*)"/)
      if (categoryMatch) {
        category = categoryMatch[1]
        // Map category codes to human-readable names (simplified)
        const categoryMap: {[key: string]: string} = {
          'cs.LG': 'Machine Learning',
          'cs.CL': 'Natural Language Processing',
          'cs.CV': 'Computer Vision',
          'stat.ML': 'Statistical ML',
          'quant-ph': 'Quantum Physics',
          'nucl-th': 'Nuclear Theory',
          'nucl-ex': 'Nuclear Experiment',
          'cond-mat.mtrl-sci': 'Materials Science',
          'astro-ph.GA': 'Galaxy Astrophysics',
          'q-bio.NC': 'Neurons & Cognition',
          'cs.CR': 'Crypto & Security'
        }
        categoryName = categoryMap[category] || category
      }
      
      // Create the paper object
      const paperData: Paper = {
        title,
        authors,
        summary,
        published,
        url,
        category,
        categoryName,
        arxiv_id: paperArxivId
      }
      
      return paperData
    } catch (error) {
      console.error('Error fetching from arXiv:', error)
      throw error
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
          // Increase timeout for the PDF analysis request
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
        
        // Fetch paper from arXiv
        const paperData = await fetchPaperFromArxiv(arxivId);
        setPaper(paperData);
        setProcessingStatus('complete');
      } catch (e: any) {
        console.error('Error processing paper:', e);
        setError(e.response?.data?.detail || e.message || 'Failed to fetch paper. Please try again later.');
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900 mb-4"></div>
        <p className="text-muted-foreground text-center">
          {processingStatus === 'fetching' ? 'Fetching paper from arXiv...' :
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

  return (
    <div className="flex flex-col gap-8 p-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="bg-background/50">
            {paper.categoryName}
          </Badge>
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="mr-1 h-4 w-4" />
            {new Date(paper.published).toLocaleDateString('en-US', {
              year: 'numeric', 
              month: 'long', 
              day: 'numeric'
            })}
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-4">{paper.title}</h1>

        <div className="prose prose-invert max-w-none">
          {/* Authors section */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Authors</h2>
            <p>{paper.authors}</p>
          </div>

          {/* Summary section */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Abstract</h2>
            <p className="whitespace-pre-line">{paper.summary}</p>
          </div>
          
          {/* PDF Analysis section */}
          {paper.arxiv_id && (
            <div className="mt-8 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">PDF Analysis</h2>
                {!pdfAnalysis && analyzeLoading && (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-t-2 border-b-2 border-gray-900 rounded-full"></div>
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
                  <div className="bg-gray-800 p-4 rounded-md mt-2">
                    <div className="whitespace-pre-line">{pdfAnalysis.summary}</div>
                  </div>
                </div>
              )}
              
              {!pdfAnalysis && analyzeLoading && (
                <div className="mt-4 p-4 border border-gray-700 rounded-md">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-gray-900 rounded-full"></div>
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
              <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                View on arXiv
              </a>
              {paper.arxiv_id && (
                <a 
                  href={`https://arxiv.org/pdf/${paper.arxiv_id}.pdf`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </a>
              )}
            </div>
          </div>

          <div className="mt-8 mb-6">
            <p className="mb-4">Go back to <Link href="/" className="text-blue-400 hover:text-blue-300">home</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}

