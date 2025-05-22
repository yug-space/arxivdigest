"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, Share2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import ReactMarkdown from 'react-markdown'
import { useEffect, useState } from 'react'
import apiEndpoints, { Paper } from '@/lib/api'

export default function BlogPage({ params }: { params: { slug: string } }) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaper = async () => {
      try {
        setLoading(true);
        const response = await apiEndpoints.getPaperBySlug(params.slug);
        setPaper(response.data);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
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

        <div className="prose prose-invert max-w-none">
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

          {/* Display link to original paper */}
          <div className="mt-8 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Original Paper</h2>
            <p className="mb-4">
              <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                View on arXiv
              </a>
            </p>
          </div>

          <div className="mt-8 mb-6">
            <p className="mb-4">Go back to <Link href="/" className="text-blue-400 hover:text-blue-300">home</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}
