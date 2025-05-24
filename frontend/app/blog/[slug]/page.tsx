"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, FileText, Share2, Download } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import ReactMarkdown from 'react-markdown'
import { useEffect, useState } from 'react'
import apiEndpoints, { Paper } from '@/lib/api'
import axios from 'axios'

export default function BlogPage({ params }: { params: { slug: string } }) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfAnalysis, setPdfAnalysis] = useState<any>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);

  useEffect(() => {
    const fetchPaper = async () => {
      try {
        setLoading(true);
        const response = await apiEndpoints.getPaperBySlug(params.slug);
        setPaper(response.data);
        
        // If paper already has PDF analysis, load it
        if (response.data.has_pdf_analysis && response.data.pdf_analysis) {
          setPdfAnalysis(response.data.pdf_analysis);
        }
        
        setError(null);
      } catch (e: any) {
        console.error('Error fetching paper:', e);
        setError(e.message || 'Failed to load paper. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPaper();
  }, [params.slug]);

  const handleAnalyzePDF = async () => {
    if (!paper) return;
    
    try {
      setAnalyzeLoading(true);
      
      // Call the new PDF analysis endpoint
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
        
        // Update paper object with PDF analysis
        setPaper({
          ...paper,
          has_pdf_analysis: true,
          pdf_analysis: response.data.pdf_analysis
        });
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-2xl font-bold">Paper not found</h1>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Link href="/" className="mt-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="bg-background/50">
            {paper.category_name}
          </Badge>
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="mr-1 h-4 w-4" />
            {new Date(paper.published_date).toLocaleDateString('en-US', {
              year: 'numeric', 
              month: 'long', 
              day: 'numeric'
            })}
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-4">{paper.title}</h1>

        <div className="prose max-w-none">
          {/* Authors section */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Authors</h2>
            <p>{paper.authors}</p>
          </div>

          {/* Summary section */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Summary</h2>
            <ReactMarkdown>{paper.summary_sections}</ReactMarkdown>
          </div>
          
          {/* PDF Analysis section */}
          <div className="mt-8 mb-6">
          
            
            {pdfAnalysis && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Analyzed on {new Date(pdfAnalysis.analysis_date).toLocaleDateString()} • 
                  {pdfAnalysis.num_pages} pages
                </p>
                <div className="bg-muted p-4 rounded-md mt-2 border border-border">
                  <ReactMarkdown>{pdfAnalysis.summary}</ReactMarkdown>
                </div>
              </div>
            )}
            
            
          </div>

          {/* Display link to original paper */}
          <div className="mt-8 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Original Paper</h2>
            <div className="flex flex-col gap-2">
              <a 
                href={paper.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary hover:text-primary/80 flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                View on arXiv
              </a>
              <a 
                href={`https://arxiv.org/pdf/${paper.arxiv_id}.pdf`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary hover:text-primary/80 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </a>
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
