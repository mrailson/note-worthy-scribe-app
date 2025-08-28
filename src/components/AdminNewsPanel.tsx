import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Clock, 
  Eye, 
  EyeOff, 
  Star,
  Search,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminNewsModal } from './AdminNewsModal';
import { AdminNewsArticle } from '@/types/news';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const AdminNewsPanel: React.FC = () => {
  const [articles, setArticles] = useState<AdminNewsArticle[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<AdminNewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'unpublished' | 'scheduled' | 'expired'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<AdminNewsArticle | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; article: AdminNewsArticle | null }>({
    isOpen: false,
    article: null
  });

  useEffect(() => {
    loadArticles();
  }, []);

  useEffect(() => {
    filterArticles();
  }, [articles, searchTerm, statusFilter]);

  const loadArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .eq('is_custom', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error('Error loading articles:', error);
      toast.error('Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  const filterArticles = () => {
    let filtered = articles;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    const now = new Date();
    if (statusFilter !== 'all') {
      filtered = filtered.filter(article => {
        const startDate = new Date(article.start_date);
        const endDate = article.end_date ? new Date(article.end_date) : null;
        
        switch (statusFilter) {
          case 'published':
            return article.is_published && startDate <= now && (!endDate || endDate >= now);
          case 'unpublished':
            return !article.is_published;
          case 'scheduled':
            return article.is_published && startDate > now;
          case 'expired':
            return article.is_published && endDate && endDate < now;
          default:
            return true;
        }
      });
    }

    setFilteredArticles(filtered);
  };

  const getArticleStatus = (article: AdminNewsArticle) => {
    const now = new Date();
    const startDate = new Date(article.start_date);
    const endDate = article.end_date ? new Date(article.end_date) : null;

    if (!article.is_published) {
      return { status: 'unpublished', color: 'bg-gray-500' };
    }
    
    if (startDate > now) {
      return { status: 'scheduled', color: 'bg-blue-500' };
    }
    
    if (endDate && endDate < now) {
      return { status: 'expired', color: 'bg-red-500' };
    }
    
    return { status: 'published', color: 'bg-green-500' };
  };

  const togglePublishStatus = async (article: AdminNewsArticle) => {
    try {
      const { error } = await supabase
        .from('news_articles')
        .update({ is_published: !article.is_published })
        .eq('id', article.id);

      if (error) throw error;
      
      toast.success(`Article ${!article.is_published ? 'published' : 'unpublished'} successfully`);
      loadArticles();
    } catch (error) {
      console.error('Error updating article:', error);
      toast.error('Failed to update article');
    }
  };

  const toggleHeadlineStatus = async (article: AdminNewsArticle) => {
    try {
      const { error } = await supabase
        .from('news_articles')
        .update({ is_headline: !article.is_headline })
        .eq('id', article.id);

      if (error) throw error;
      
      toast.success(`Article ${!article.is_headline ? 'marked as headline' : 'removed from headlines'}`);
      loadArticles();
    } catch (error) {
      console.error('Error updating article:', error);
      toast.error('Failed to update article');
    }
  };

  const handleEdit = (article: AdminNewsArticle) => {
    setEditingArticle(article);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteDialog.article) return;

    try {
      const { error } = await supabase
        .from('news_articles')
        .delete()
        .eq('id', deleteDialog.article.id);

      if (error) throw error;
      
      toast.success('Article deleted successfully');
      loadArticles();
      setDeleteDialog({ isOpen: false, article: null });
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('Failed to delete article');
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingArticle(null);
  };

  const handleModalSave = () => {
    loadArticles();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading articles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">News Management</h2>
          <p className="text-muted-foreground">Create and manage custom news articles</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Article
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Articles</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="unpublished">Unpublished</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Articles Grid */}
      <div className="grid gap-4">
        {filteredArticles.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">No articles found</p>
            </CardContent>
          </Card>
        ) : (
          filteredArticles.map((article) => {
            const articleStatus = getArticleStatus(article);
            return (
              <Card key={article.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`${articleStatus.color} text-white`}>
                          {articleStatus.status}
                        </Badge>
                        {article.is_headline && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                            <Star className="h-3 w-3 mr-1" />
                            Headline
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">{article.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {article.summary}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={article.is_published}
                        onCheckedChange={() => togglePublishStatus(article)}
                        title="Toggle publish status"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleHeadlineStatus(article)}
                        title="Toggle headline status"
                      >
                        <Star className={`h-4 w-4 ${article.is_headline ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(article)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteDialog({ isOpen: true, article })}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Start: {format(new Date(article.start_date), 'MMM dd, yyyy HH:mm')}
                    </div>
                    {article.end_date && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        End: {format(new Date(article.end_date), 'MMM dd, yyyy HH:mm')}
                      </div>
                    )}
                  </div>
                  {article.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {article.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal */}
      <AdminNewsModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        article={editingArticle}
        onSave={handleModalSave}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => 
        setDeleteDialog({ isOpen: open, article: deleteDialog.article })
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.article?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};