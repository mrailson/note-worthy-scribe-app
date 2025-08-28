export interface NewsArticle {
  id?: string;
  title: string;
  summary: string;
  content: string;
  url?: string;
  source: string;
  image_url?: string;
  tags: string[];
  is_published?: boolean;
  is_headline?: boolean;
  start_date?: string;
  end_date?: string;
  is_custom?: boolean;
  created_at?: string;
  created_by?: string;
  published_at?: string;
  relevance_score?: number;
}

export interface AdminNewsArticle extends NewsArticle {
  is_published: boolean;
  is_headline: boolean;
  start_date: string;
  is_custom: boolean;
}