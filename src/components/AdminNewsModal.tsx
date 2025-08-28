import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminNewsArticle } from '@/types/news';

interface NewsArticleForm {
  id?: string;
  title: string;
  summary: string;
  content: string;
  url?: string;
  source: string;
  image_url?: string;
  tags: string[];
  is_published: boolean;
  is_headline: boolean;
  start_date: Date;
  end_date?: Date;
  is_custom: boolean;
}

interface AdminNewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  article?: AdminNewsArticle | null;
  onSave: () => void;
}

export const AdminNewsModal: React.FC<AdminNewsModalProps> = ({
  isOpen,
  onClose,
  article,
  onSave
}) => {
  const [formData, setFormData] = useState<NewsArticleForm>({
    title: '',
    summary: '',
    content: '',
    url: '',
    source: 'Admin',
    image_url: '',
    tags: [],
    is_published: false,
    is_headline: false,
    start_date: new Date(),
    end_date: undefined,
    is_custom: true
  });
  
  const [newTag, setNewTag] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [runIndefinitely, setRunIndefinitely] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (article) {
      setFormData({
        ...article,
        start_date: new Date(article.start_date),
        end_date: article.end_date ? new Date(article.end_date) : undefined
      });
      
      const startDate = new Date(article.start_date);
      setStartTime(format(startDate, 'HH:mm'));
      
      if (article.end_date) {
        const endDate = new Date(article.end_date);
        setEndTime(format(endDate, 'HH:mm'));
        setRunIndefinitely(false);
      } else {
        setRunIndefinitely(true);
      }
    } else {
      // Reset form for new article
      setFormData({
        title: '',
        summary: '',
        content: '',
        url: '',
        source: 'Admin',
        image_url: '',
        tags: [],
        is_published: false,
        is_headline: false,
        start_date: new Date(),
        end_date: undefined,
        is_custom: true
      });
      setStartTime('09:00');
      setEndTime('17:00');
      setRunIndefinitely(true);
    }
  }, [article, isOpen]);

  const handleInputChange = (field: keyof NewsArticleForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      handleInputChange('tags', [...formData.tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const handleStartDateChange = (date: Date | undefined) => {
    if (date) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours, minutes);
      handleInputChange('start_date', newDate);
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    if (date && !runIndefinitely) {
      const [hours, minutes] = endTime.split(':').map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours, minutes);
      handleInputChange('end_date', newDate);
    }
  };

  const handleTimeChange = (timeType: 'start' | 'end', time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    
    if (timeType === 'start') {
      setStartTime(time);
      const newDate = new Date(formData.start_date);
      newDate.setHours(hours, minutes);
      handleInputChange('start_date', newDate);
    } else {
      setEndTime(time);
      if (!runIndefinitely && formData.end_date) {
        const newDate = new Date(formData.end_date);
        newDate.setHours(hours, minutes);
        handleInputChange('end_date', newDate);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const articleData = {
        ...formData,
        end_date: runIndefinitely ? null : formData.end_date?.toISOString(),
        start_date: formData.start_date.toISOString(),
        created_by: (await supabase.auth.getUser()).data.user?.id,
        published_at: formData.is_published ? new Date().toISOString() : null
      };

      if (article?.id) {
        // Update existing article
        const { error } = await supabase
          .from('news_articles')
          .update(articleData)
          .eq('id', article.id);

        if (error) throw error;
        toast.success('News article updated successfully');
      } else {
        // Create new article
        const { error } = await supabase
          .from('news_articles')
          .insert(articleData);

        if (error) throw error;
        toast.success('News article created successfully');
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving article:', error);
      toast.error('Failed to save article');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {article ? 'Edit News Article' : 'Create News Article'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter article title"
                  required
                />
              </div>

              <div>
                <Label htmlFor="summary">Summary *</Label>
                <Textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => handleInputChange('summary', e.target.value)}
                  placeholder="Brief summary of the article"
                  rows={3}
                  required
                />
              </div>

              <div>
                <Label htmlFor="content">Content *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  placeholder="Full article content"
                  rows={8}
                  required
                />
              </div>

              <div>
                <Label htmlFor="url">External URL (optional)</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url || ''}
                  onChange={(e) => handleInputChange('url', e.target.value)}
                  placeholder="https://example.com/article"
                />
              </div>

              <div>
                <Label htmlFor="image_url">Image URL (optional)</Label>
                <Input
                  id="image_url"
                  type="url"
                  value={formData.image_url || ''}
                  onChange={(e) => handleInputChange('image_url', e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <Label>Tags</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={addTag}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
                    >
                      <span>{tag}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTag(tag)}
                        className="h-4 w-4 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="published"
                  checked={formData.is_published}
                  onCheckedChange={(checked) => handleInputChange('is_published', checked)}
                />
                <Label htmlFor="published">Publish immediately</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="headline"
                  checked={formData.is_headline}
                  onCheckedChange={(checked) => handleInputChange('is_headline', checked)}
                />
                <Label htmlFor="headline">Headline news (show at top)</Label>
              </div>

              <div>
                <Label>Start Date & Time</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal flex-1",
                          !formData.start_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.start_date ? format(formData.start_date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.start_date}
                        onSelect={handleStartDateChange}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => handleTimeChange('start', e.target.value)}
                      className="w-24"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="indefinite"
                  checked={runIndefinitely}
                  onCheckedChange={setRunIndefinitely}
                />
                <Label htmlFor="indefinite">Run indefinitely</Label>
              </div>

              {!runIndefinitely && (
                <div>
                  <Label>End Date & Time</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal flex-1",
                            !formData.end_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.end_date ? format(formData.end_date, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.end_date}
                          onSelect={handleEndDateChange}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => handleTimeChange('end', e.target.value)}
                        className="w-24"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (article ? 'Update Article' : 'Create Article')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};