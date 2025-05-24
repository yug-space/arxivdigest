"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Users } from "lucide-react"
import Link from "next/link"
import { Button } from "./ui/button"
import apiEndpoints, { Category } from '@/lib/api'

export function CategoryList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [generationStatus, setGenerationStatus] = useState<string>("");

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const [categoriesResponse, generationResponse] = await Promise.all([
          apiEndpoints.getAllCategories(),
          apiEndpoints.getGenerationStatus()
        ]);
        
        setCategories(categoriesResponse.data);
        
        // Check if any category is being generated
        const generatingCategories = Object.entries(generationResponse.data.status)
          .filter(([_, status]) => status.status === 'in_progress')
          .map(([code, status]) => status.category_name);
          
        if (generatingCategories.length > 0) {
          setGenerationStatus(`Generating summaries for: ${generatingCategories.join(', ')}`);
        }
        
        setError(null);
      } catch (e: any) {
        console.error("Failed to fetch categories:", e);
        setError(e.message || "Failed to load categories. Please try again later.");
        setCategories(fallbackCategories);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
    
    // Poll generation status every 30 seconds
    const pollInterval = setInterval(fetchCategories, 30000);
    return () => clearInterval(pollInterval);
  }, []);

  const filteredCategories = categories.filter(
    (category) =>
      category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (error && categories.length === 0) {
    return (
      <div className="text-center py-4 text-destructive">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {generationStatus && (
        <div className="text-center py-2 text-foreground bg-muted rounded-md border border-border">
          {generationStatus}
        </div>
      )}
      
      <div className="relative outline outline-none rounded-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search categories..."
          className="pl-10 bg-background/50 outline-none"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCategories.map((category) => (
          <Link href={`/category/${category.slug}`} key={category.code}>
            <Card className="h-full overflow-hidden backdrop-blur-sm  transition-all hover:shadow-md hover:shadow-primary/5 hover:border-muted/60">
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xl">
                    {getCategoryIcon(category.name)}
                  </div>
                </div>
                <h3 className="mb-1 font-semibold">{category.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Latest papers in {category.name}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Button variant="outline" className="bg-background/50">
                    View Papers
                  </Button>
                  <Badge variant="secondary">{category.paper_count} papers</Badge>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

// Helper function to get an icon based on the category name
function getCategoryIcon(categoryName: string): string {
  const iconMap: {[key: string]: string} = {
    "Machine Learning": "🧠",
    "Natural Language Processing": "💬",
    "Computer Vision": "👁️",
    "Statistical ML": "📊",
    "Quantum Physics": "⚛️",
    "Nuclear Theory": "☢️",
    "Materials Science": "🔋",
    "Galaxy Astrophysics": "🌌",
    "Neurons & Cognition": "🧠",
    "Crypto & Security": "🔒"
  };
  
  // Try to find a direct match
  if (iconMap[categoryName]) {
    return iconMap[categoryName];
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(iconMap)) {
    if (categoryName.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // Default icon
  return "📚";
}

// Fallback categories in case the API fails
const fallbackCategories: Category[] = [
  {
    code: "cs.LG",
    name: "Machine Learning",
    slug: "machine-learning",
    paper_count: 0
  },
  {
    code: "cs.CL",
    name: "Natural Language Processing",
    slug: "natural-language-processing",
    paper_count: 0
  },
  {
    code: "cs.CV",
    name: "Computer Vision",
    slug: "computer-vision",
    paper_count: 0
  },
  {
    code: "stat.ML",
    name: "Statistical ML",
    slug: "statistical-ml",
    paper_count: 0
  }
];
