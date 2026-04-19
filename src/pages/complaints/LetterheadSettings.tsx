import { useEffect, useMemo, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, FileText, Trash2, RotateCcw, Loader2, AlertCircle, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Practice {
  id: string;
  name: string;
}

interface Letterhead {
  id: string;
  practice_id: string;
  original_filename: string;
  original_mime_type?: string | null;
  storage_path: string;
  rendered_png_path: string | null;
  height_cm: number;
  top_margin_cm: number;
  alignment: 'left' | 'centre' | 'right';
  include_all_pages: boolean;
  uploaded_by: string;
  uploaded_at: string;
  active: boolean;
  uploader_name?: string;
  signed_url?: string;
}

type LetterPreviewType = 'acknowledgement' | 'upheld' | 'not_upheld';

const PREVIEW_BODIES: Record<LetterPreviewType, { title: string; body: string[] }> = {
  acknowledgement: {
    title: 'Acknowledgement letter',
    body: [
      'Dear Mrs Sample Patient,',
      '',
      'Thank you for taking the time to contact us regarding your recent experience. I am writing to acknowledge formally receipt of your complaint dated [date].',
      '',
      'In line with NHS complaints regulations, we will respond fully to the matters you have raised within the agreed timeframe. If we require any clarification we will contact you directly.',
      '',
      'Yours sincerely,',
      '',
      '[Practice Manager]',
    ],
  },
  upheld: {
    title: 'Outcome — upheld',
    body: [
      'Dear Mrs Sample Patient,',
      '',
      'Following our investigation into the concerns you raised, I am writing to confirm that your complaint has been upheld. We accept that the standard of care fell below what you should have been able to expect.',
      '',
      'A summary of our findings and the actions we have taken to put matters right is set out below.',
      '',
      'Yours sincerely,',
      '',
      '[Practice Manager]',
    ],
  },
  not_upheld: {
    title: 'Outcome — not upheld',
    body: [
      'Dear Mrs Sample Patient,',
      '',
      'Following a thorough investigation into the concerns you raised, I am writing to inform you that your complaint has not been upheld. The reasons for this conclusion are explained in detail below.',
      '',
      'You may take this matter further by contacting the Parliamentary and Health Service Ombudsman.',
      '',
      'Yours sincerely,',
      '',
      '[Practice Manager]',
    ],
  },
};

export default function LetterheadSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [authorising, setAuthorising] = useState(true);
  const [authorised, setAuthorised] = useState(false);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [selectedPracticeId, setSelectedPracticeId] = useState<string>('');
  const [active, setActive] = useState<Letterhead | null>(null);
  const [history, setHistory] = useState<Letterhead[]>([]);
  const [loadingPractice, setLoadingPractice] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewType, setPreviewType] = useState<LetterPreviewType>('acknowledgement');
  const [zoom, setZoom] = useState<number>(0.75);

  const [heightCm, setHeightCm] = useState<number>(6);
  const [topMarginCm, setTopMarginCm] = useState<number>(1);
  const [alignment, setAlignment] = useState<'left' | 'centre' | 'right'>('centre');
  const [includeAllPages, setIncludeAllPages] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!user) {
        navigate('/auth', { replace: true });
        return;
      }
      try {
        const { data: roleRecords } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        const allowed = (roleRecords || []).some((r: any) =>
          ['system_admin', 'practice_manager', 'complaints_manager'].includes(r.role),
        );
        if (!allowed) {
          toast.error('You do not have permission to manage letterheads.');
          navigate('/complaints', { replace: true });
          return;
        }
        setAuthorised(true);
      } catch (e) {
        console.error(e);
        navigate('/complaints', { replace: true });
      } finally {
        setAuthorising(false);
      }
    };
    check();
  }, [user, navigate]);

  useEffect(() => {
    if (!authorised || !user) return;
    const load = async () => {
      try {
        const { data: ids, error } = await supabase.rpc('get_user_practice_ids', {
          p_user_id: user.id,
        });
        if (error) throw error;
        if (!ids || ids.length === 0) {
          toast.info('No practices linked to your account.');
          return;
        }
        const { data: practiceRows, error: pErr } = await supabase
          .from('gp_practices')
          .select('id, name')
          .in('id', ids as string[])
          .order('name');
        if (pErr) throw pErr;
        setPractices(practiceRows || []);
        if (practiceRows && practiceRows.length > 0) {
          setSelectedPracticeId(practiceRows[0].id);
        }
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'Failed to load practices');
      }
    };
    load();
  }, [authorised, user]);

  const loadLetterheads = useCallback(async (practiceId: string) => {
    if (!practiceId) return;
    setLoadingPractice(true);
    try {
      const { data: rows, error } = await supabase
        .from('practice_letterheads')
        .select('*')
        .eq('practice_id', practiceId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;

      const list = (rows || []) as Letterhead[];

      const uploaderIds = Array.from(new Set(list.map((l) => l.uploaded_by)));
      const [{ data: profiles }, signedAll] = await Promise.all([
        uploaderIds.length
          ? supabase.from('profiles').select('id, full_name, email').in('id', uploaderIds)
          : Promise.resolve({ data: [] as any[] }),
        Promise.all(
          list.map((l) =>
            supabase.storage
              .from('practice-letterheads')
              .createSignedUrl(l.storage_path, 3600),
          ),
        ),
      ]);

      const enriched: Letterhead[] = list.map((l, i) => ({
        ...l,
        uploader_name:
          (profiles || []).find((p: any) => p.id === l.uploaded_by)?.full_name ||
          (profiles || []).find((p: any) => p.id === l.uploaded_by)?.email ||
          'Unknown',
        signed_url: signedAll[i].data?.signedUrl,
      }));

      const activeRow = enriched.find((l) => l.active) || null;
      setActive(activeRow);
      setHistory(enriched.filter((l) => !l.active));

      if (activeRow) {
        setHeightCm(Number(activeRow.height_cm));
        setTopMarginCm(Number(activeRow.top_margin_cm));
        setAlignment(activeRow.alignment);
        setIncludeAllPages(activeRow.include_all_pages);
      } else {
        setHeightCm(6);
        setTopMarginCm(1);
        setAlignment('centre');
        setIncludeAllPages(false);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to load letterheads');
    } finally {
      setLoadingPractice(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPracticeId) loadLetterheads(selectedPracticeId);
  }, [selectedPracticeId, loadLetterheads]);

  const onDrop = useCallback(
    async (accepted: File[], rejected: any[]) => {
      if (rejected.length > 0) {
        toast.error(`File rejected: ${rejected[0].errors[0]?.message || 'invalid file'}`);
        return;
      }
      const file = accepted[0];
      if (!file || !selectedPracticeId) return;

      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('practice_id', selectedPracticeId);
        fd.append('height_cm', String(heightCm));
        fd.append('top_margin_cm', String(topMarginCm));
        fd.append('alignment', alignment);
        fd.append('include_all_pages', String(includeAllPages));

        const { data, error } = await supabase.functions.invoke('render-practice-letterhead', {
          body: fd,
        });
        if (error) {
          const details = await error.context?.json?.().catch?.(() => null);
          throw new Error(details?.error || error.message || 'Upload failed');
        }
        if ((data as any)?.error) throw new Error((data as any).error);

        toast.success('Letterhead uploaded and rendered.');
        await loadLetterheads(selectedPracticeId);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [selectedPracticeId, heightCm, topMarginCm, alignment, includeAllPages, loadLetterheads],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    noClick: true,
    disabled: uploading || !selectedPracticeId,
  });

  const persistSettings = async () => {
    if (!active) return;
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('practice_letterheads')
        .update({
          height_cm: heightCm,
          top_margin_cm: topMarginCm,
          alignment,
          include_all_pages: includeAllPages,
        })
        .eq('id', active.id);
      if (error) throw error;
      toast.success('Settings saved');
      await loadLetterheads(selectedPracticeId);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSavingSettings(false);
    }
  };

  const removeActive = async () => {
    if (!active) return;
    if (!confirm('Remove the active letterhead? Letters will revert to the Notewell default.')) return;
    try {
      const { error } = await supabase
        .from('practice_letterheads')
        .update({ active: false })
        .eq('id', active.id);
      if (error) throw error;
      toast.success('Letterhead removed');
      await loadLetterheads(selectedPracticeId);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove');
    }
  };

  const restore = async (lh: Letterhead) => {
    try {
      const { error } = await supabase.from('practice_letterheads').insert({
        practice_id: lh.practice_id,
        original_filename: lh.original_filename,
        storage_path: lh.storage_path,
        rendered_png_path: lh.rendered_png_path,
        height_cm: lh.height_cm,
        top_margin_cm: lh.top_margin_cm,
        alignment: lh.alignment,
        include_all_pages: lh.include_all_pages,
        uploaded_by: user!.id,
        active: true,
      });
      if (error) throw error;
      toast.success('Letterhead restored');
      await loadLetterheads(selectedPracticeId);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to restore');
    }
  };

  const A4_WIDTH_CM = 21.0;
  const A4_HEIGHT_CM = 29.7;
  const previewScale = zoom;
  const cmToPx = useMemo(() => 37.795 * previewScale, [previewScale]);
  const pageWidthPx = A4_WIDTH_CM * cmToPx;
  const pageHeightPx = A4_HEIGHT_CM * cmToPx;
  const headerHeightPx = heightCm * cmToPx;
  const topMarginPx = topMarginCm * cmToPx;

  if (authorising) {
    return (
      <div className="container max-w-6xl py-10">
        <Skeleton className="h-8 w-72 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/complaints')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to complaints
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Practice letterhead</h1>
        <p className="text-muted-foreground mt-1">
          Upload your headed paper. It will be applied automatically to every complaint letter
          generated for patients at this practice.
        </p>
      </div>

      {practices.length > 1 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <Label htmlFor="practice-select" className="mb-2 block">
              Editing letterhead for
            </Label>
            <Select value={selectedPracticeId} onValueChange={setSelectedPracticeId}>
              <SelectTrigger id="practice-select" className="max-w-md">
                <SelectValue placeholder="Select a practice" />
              </SelectTrigger>
              <SelectContent>
                {practices.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" /> Upload letterhead
              </CardTitle>
              <CardDescription>
                A4 page, 300 DPI. We'll use the top 5–7&nbsp;cm as your letterhead band.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                } ${uploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}
                onClick={() => !uploading && open()}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Rendering letterhead…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm">
                      {isDragActive ? 'Drop the file' : 'Drag & drop, or click to choose'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Upload a single-page PDF or DOCX only, up to 5&nbsp;MB.
                    </p>
                  </div>
                )}
              </div>

              {active && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{active.original_filename}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {format(new Date(active.uploaded_at), 'd MMM yyyy HH:mm')} by{' '}
                        {active.uploader_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary">Active</Badge>
                    <Button variant="outline" size="sm" onClick={() => open()}>Replace</Button>
                    <Button variant="ghost" size="sm" onClick={removeActive}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {!active && !loadingPractice && (
                <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                  <span>
                    No letterhead set. Letters will use the Notewell default until you upload one.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Layout controls</CardTitle>
              <CardDescription>Changes preview live on the right.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Letterhead height</Label>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {heightCm.toFixed(1)} cm
                  </span>
                </div>
                <Slider
                  min={3}
                  max={9}
                  step={0.1}
                  value={[heightCm]}
                  onValueChange={(v) => setHeightCm(v[0])}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Top margin of body text</Label>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {topMarginCm.toFixed(1)} cm
                  </span>
                </div>
                <Slider
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={[topMarginCm]}
                  onValueChange={(v) => setTopMarginCm(v[0])}
                />
              </div>

              <div>
                <Label className="mb-2 block">Alignment</Label>
                <ToggleGroup
                  type="single"
                  value={alignment}
                  onValueChange={(v) => v && setAlignment(v as any)}
                >
                  <ToggleGroupItem value="left">Left</ToggleGroupItem>
                  <ToggleGroupItem value="centre">Centre</ToggleGroupItem>
                  <ToggleGroupItem value="right">Right</ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Include letterhead on every page</Label>
                  <p className="text-xs text-muted-foreground">Default: page 1 only</p>
                </div>
                <Switch
                  checked={includeAllPages}
                  onCheckedChange={setIncludeAllPages}
                />
              </div>

              {active && (
                <Button onClick={persistSettings} disabled={savingSettings} className="w-full">
                  {savingSettings ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save layout settings
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setHistoryOpen((o) => !o)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Version history ({history.length})
                </CardTitle>
                {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {historyOpen && (
              <CardContent className="space-y-2">
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No previous versions.</p>
                ) : (
                  history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center gap-3 rounded-md border p-2"
                    >
                      <div className="h-12 w-16 bg-muted rounded overflow-hidden flex-shrink-0">
                        {h.signed_url && (
                          <img
                            src={h.signed_url}
                            alt={h.original_filename}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{h.original_filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(h.uploaded_at), 'd MMM yyyy HH:mm')} • {h.uploader_name}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => restore(h)}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            )}
          </Card>
        </div>

        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Preview</CardTitle>
                <div className="flex items-center gap-2">
                  <ToggleGroup
                    type="single"
                    size="sm"
                    value={String(zoom)}
                    onValueChange={(v) => v && setZoom(Number(v))}
                  >
                    <ToggleGroupItem value="0.5">50%</ToggleGroupItem>
                    <ToggleGroupItem value="0.75">75%</ToggleGroupItem>
                    <ToggleGroupItem value="1">100%</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
              <ToggleGroup
                type="single"
                size="sm"
                value={previewType}
                onValueChange={(v) => v && setPreviewType(v as LetterPreviewType)}
                className="mt-2 justify-start flex-wrap"
              >
                <ToggleGroupItem value="acknowledgement">Acknowledgement</ToggleGroupItem>
                <ToggleGroupItem value="upheld">Outcome — upheld</ToggleGroupItem>
                <ToggleGroupItem value="not_upheld">Outcome — not upheld</ToggleGroupItem>
              </ToggleGroup>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-md p-4 overflow-auto max-h-[78vh] flex justify-center">
                <div
                  className="bg-card text-card-foreground shadow-lg relative"
                  style={{
                    width: `${pageWidthPx}px`,
                    height: `${pageHeightPx}px`,
                  }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 border-b border-dashed border-muted-foreground/30 overflow-hidden"
                    style={{ height: `${headerHeightPx}px` }}
                  >
                    {active?.signed_url ? (
                      <img
                        src={active.signed_url}
                        alt="Letterhead"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          objectPosition:
                            alignment === 'left'
                              ? 'left top'
                              : alignment === 'right'
                                ? 'right top'
                                : 'center top',
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        [ Notewell default header ]
                      </div>
                    )}
                  </div>

                  <div
                    className="absolute left-0 right-0"
                    style={{
                      top: `${headerHeightPx + topMarginPx}px`,
                      paddingLeft: `${2 * cmToPx}px`,
                      paddingRight: `${2 * cmToPx}px`,
                      fontSize: `${0.32 * cmToPx}px`,
                      lineHeight: 1.5,
                    }}
                  >
                    <div className="text-right mb-4">
                      {format(new Date(), 'd MMMM yyyy')}
                    </div>
                    <div className="mb-4">
                      Mrs Sample Patient
                      <br />1 Example Street
                      <br />Northampton NN1 1AA
                    </div>
                    <div className="font-semibold mb-3">{PREVIEW_BODIES[previewType].title}</div>
                    {PREVIEW_BODIES[previewType].body.map((line, i) => (
                      <p key={i} className="mb-2 last:mb-0">
                        {line || '\u00a0'}
                      </p>
                    ))}
                  </div>

                  <div
                    className="absolute bottom-0 left-0 right-0 text-center text-muted-foreground"
                    style={{
                      paddingBottom: `${1 * cmToPx}px`,
                      fontSize: `${0.25 * cmToPx}px`,
                    }}
                  >
                    Ref: COMP-2026-0042
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
