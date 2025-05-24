import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_URL || 'http://localhost:8000/api/',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Paper {
  _id: string;
  title: string;
  slug: string;
  authors: string;
  category_code: string;
  category_name: string;
  category_slug: string;
  arxiv_id: string;
  published_date: string;
  url: string;
  pdf_path?: string;
  pdf_status?: string;
  has_pdf_analysis: boolean;
  summary_sections: string;
  generation_date: string;
  processed_date: string;
  pdf_analysis?: {
    pdf_path: string;
    num_pages: number;
    summary: string;
    analysis_date: string;
  };
}

export interface Category {
  code: string;
  name: string;
  slug: string;
  paper_count: number;
}

export interface PaginatedResponse<T> {
  papers: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface GenerationStatus {
  existing_papers: { [key: string]: Paper[] };
  generation_status: {
    [key: string]: {
      status: 'in_progress' | 'pending' | 'completed';
      last_updated: string;
    };
  };
  categories_processing: string[];
  timestamp: string;
}

// API endpoints
export const apiEndpoints = {
  // Papers
  getAllPapers: (params?: {
    category?: string;
    date?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => api.get<PaginatedResponse<Paper>>('/papers', { params }),

  getPapersByCategory: (categorySlug: string, params?: {
    date?: string;
    page?: number;
    per_page?: number;
  }) => api.get<PaginatedResponse<Paper>>(`/category/${categorySlug}`, { params }),

  getPaperBySlug: (slug: string) => api.get<Paper>(`/blog/${slug}`),
  
  // Categories
  getAllCategories: () => api.get<Category[]>('/categories'),
  
  // Generation
  generateSummaries: (params?: {
    category?: string;
    max_papers?: number;
  }) => api.get<GenerationStatus>('/generate', { params }),

  getGenerationStatus: (params?: {
    category?: string;
  }) => api.get<{
    date: string;
    status: {
      [key: string]: {
        category_name: string;
        status: 'in_progress' | 'completed' | 'not_started';
        papers_generated_today: number;
        total_papers: number;
        last_updated: string;
      };
    };
    timestamp: string;
  }>('/generation-status', { params }),
};

// Error handling interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default apiEndpoints; 