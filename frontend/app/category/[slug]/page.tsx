"use client"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Calendar } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from 'react'
import apiEndpoints, { Paper, Category } from '@/lib/api'
import { Button } from "@/components/ui/button"

// Helper function to extract summary from paper
function extractSummary(summary: string): string {
  if (!summary) return "No summary available";
  return summary.length > 200 ? `${summary.slice(0, 200)}...` : summary;
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchCategoryData = async () => {
      try {
        setLoading(true);
        const response = await apiEndpoints.getPapersByCategory(params.slug, {
          page,
          per_page: 10
        });
        
        setPapers(response.data.papers);
        setTotalPages(response.data.total_pages);
        
        // Get category info from the first paper
        if (response.data.papers.length > 0) {
          const firstPaper = response.data.papers[0];
          setCategory({
            code: firstPaper.category_code,
            name: firstPaper.category_name,
            slug: firstPaper.category_slug,
            paper_count: response.data.total
          });
        }
        
        setError(null);
      } catch (e: any) {
        console.error('Error fetching category data:', e);
        setError(e.message || 'Failed to load category data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryData();
  }, [params.slug, page]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (error || (!category && papers.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-2xl font-bold">No papers found for this category</h1>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Link href="/" className="mt-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to categories
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="relative h-48 w-full overflow-hidden rounded-xl">
        <div className="absolute bottom-0 left-0 p-6">
          <Link href="/" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to categories
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {category?.name || params.slug}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Latest research papers in {category?.name || params.slug}
          </p>
          <Badge variant="secondary" className="mt-2">
            {category?.paper_count || 0} papers
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {papers.map((paper) => (
          <Link href={`/blog/${paper.slug}`} key={paper._id}>
            <Card className="h-full overflow-hidden backdrop-blur-sm   transition-all hover:shadow-md hover:shadow-primary/5 hover:border-muted/60">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-background/50">
                    {paper.category_name}
                  </Badge>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="mr-1 h-3 w-3" />
                    {new Date(paper.published_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>
                <h3 className="font-semibold mb-2">{paper.title}</h3>
                
                <div className="mt-2 text-xs text-muted-foreground">
                  By {paper.authors}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
