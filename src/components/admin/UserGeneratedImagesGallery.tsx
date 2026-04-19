import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Download, Images, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UserImageRow {
  id: string;
  image_url: string;
  prompt: string | null;
  title: string | null;
  category: string | null;
  source: string | null;
  created_at: string;
  user_id: string;
}

export function UserGeneratedImagesGallery() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UserImageRow[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open || rows.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('admin_list_user_generated_images' as any);
      if (!cancelled) {
        if (error) {
          console.error('Failed to load user_generated_images', error);
        } else {
          setRows(((data as any) || []) as UserImageRow[]);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, rows.length]);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.title?.toLowerCase().includes(q) ||
      r.prompt?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q) ||
      r.source?.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Images className="h-4 w-4" />
            View all generated image thumbnails
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            User Generated Images
          </DialogTitle>
          <DialogDescription>
            Showing up to 1,000 most recent images across all users (admin view).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 pb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title, prompt, category, source…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {loading ? 'Loading…' : `${filtered.length} of ${rows.length}`}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading thumbnails…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">No images found.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((img) => {
                const handleDownload = async (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    const res = await fetch(img.image_url, { mode: 'cors' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const blob = await res.blob();
                    const ext =
                      (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg').split(';')[0];
                    const safeName =
                      (img.title || img.prompt || `image-${img.id}`)
                        .toLowerCase()
                        .replace(/[^a-z0-9-_]+/g, '-')
                        .replace(/^-+|-+$/g, '')
                        .slice(0, 60) || `image-${img.id}`;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${safeName}.${ext}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (err: any) {
                    // CORS or other failure → fall back to opening in a new tab
                    console.error('Download failed', err);
                    toast.error('Direct download blocked — opening in a new tab instead');
                    window.open(img.image_url, '_blank', 'noopener,noreferrer');
                  }
                };

                return (
                  <div
                    key={img.id}
                    className="group relative rounded-lg overflow-hidden border bg-card hover:shadow-md transition-shadow"
                    title={img.prompt || img.title || ''}
                  >
                    <a
                      href={img.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <div className="aspect-square bg-muted overflow-hidden">
                        <img
                          src={img.image_url}
                          alt={img.title || img.prompt || 'Generated image'}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.opacity = '0.2';
                          }}
                        />
                      </div>
                      <div className="p-2 text-xs space-y-0.5">
                        <div className="font-medium line-clamp-1">
                          {img.title || img.prompt || 'Untitled'}
                        </div>
                        <div className="text-muted-foreground flex items-center justify-between gap-1">
                          <span className="line-clamp-1">
                            {img.category || img.source || '—'}
                          </span>
                          <span className="whitespace-nowrap">
                            {format(new Date(img.created_at), 'dd/MM/yy HH:mm')}
                          </span>
                        </div>
                      </div>
                    </a>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      onClick={handleDownload}
                      className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shadow"
                      title="Download full image"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
