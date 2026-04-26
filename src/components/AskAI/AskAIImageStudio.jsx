import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ASK_AI_IMAGE_STUDIO_TEMPLATES, assembleAskAIImageStudioPrompt } from './askAIImageStudioTemplates';

const modelLabels = {
  'recraft/v4-svg': 'Recraft v4 SVG',
  'recraft/v4': 'Recraft v4',
  'ideogram/v3': 'Ideogram v3',
  'google/imagen-4-pro': 'Imagen 4 Pro',
  'google/imagen-4-ultra': 'Imagen 4 Ultra',
};

const aspectToLayout = { '3:4': 'portrait', '1:1': 'square', '16:9': 'landscape' };
const modelOptions = Object.keys(modelLabels);
const aspectOptions = ['3:4', '1:1', '16:9'];

function downloadUrl(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.position = 'fixed';
  a.style.left = '-9999px';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function downloadPngFromImage(url, filename) {
  if (url.startsWith('data:image/svg')) {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1200, img.naturalWidth || 1200);
    canvas.height = Math.max(1600, img.naturalHeight || 1600);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG export failed');
    downloadUrl(URL.createObjectURL(blob), filename);
    return;
  }

  const response = await fetch(url);
  const blob = await response.blob();
  downloadUrl(URL.createObjectURL(blob), filename);
}

export default function AskAIImageStudio({ open, onClose }) {
  const [view, setView] = useState('gallery');
  const [template, setTemplate] = useState(null);
  const [values, setValues] = useState({});
  const [additionalRequirements, setAdditionalRequirements] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedOpened, setAdvancedOpened] = useState(false);
  const [modelOverride, setModelOverride] = useState('');
  const [aspectOverride, setAspectOverride] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const finalPrompt = useMemo(() => {
    if (!template) return '';
    return assembleAskAIImageStudioPrompt(template, values, additionalRequirements);
  }, [template, values, additionalRequirements]);

  if (!open) return null;

  const resetToGallery = () => {
    setView('gallery');
    setTemplate(null);
    setValues({});
    setAdditionalRequirements('');
    setShowAdvanced(false);
    setAdvancedOpened(false);
    setModelOverride('');
    setAspectOverride('');
    setResult(null);
  };

  const selectTemplate = (nextTemplate) => {
    setTemplate(nextTemplate);
    setValues(Object.fromEntries(nextTemplate.variables.map(variable => [variable.key, ''])));
    setAdditionalRequirements('');
    setShowAdvanced(false);
    setAdvancedOpened(false);
    setModelOverride('');
    setAspectOverride('');
    setResult(null);
    setView('form');
  };

  const generate = async (regenerationOfId = null) => {
    if (!template) return;
    const missing = template.variables.find(variable => !values[variable.key]?.trim());
    if (missing) {
      toast.error(`Please complete ${missing.label}`);
      return;
    }

    const model = modelOverride || template.model;
    const aspectRatio = aspectOverride || template.aspectRatio;
    setIsGenerating(true);
    setView('result');

    try {
      const { data, error } = await supabase.functions.invoke('ai4gp-image-generation', {
        body: {
          prompt: finalPrompt,
          imageModel: model,
          layoutPreference: aspectToLayout[aspectRatio],
          requestType: template.id.includes('poster') ? 'poster' : template.id.includes('social') ? 'social' : template.id.includes('infographic') ? 'infographic' : 'general',
          purpose: template.id.includes('poster') ? 'poster' : template.id.includes('social') ? 'social' : template.id.includes('infographic') ? 'infographic' : 'general',
          promptPrefix: '',
          negativePrompt: template.negativePrompt,
          isStudioRequest: true,
          routingDecision: {
            model,
            reason: `Ask AI Image Studio template: ${template.id}`,
            autoSelected: !modelOverride,
          },
        },
      });

      if (error) throw error;
      if (!data?.success || !data?.image?.url) throw new Error(data?.error || 'No image was generated');

      const { data: authData } = await supabase.auth.getUser();
      const generationRecord = {
        user_id: authData?.user?.id,
        template_id: template.id,
        model,
        aspect_ratio: aspectRatio,
        prompt_final: finalPrompt,
        additional_requirements: additionalRequirements.trim() || null,
        image_url: data.image.url,
        regeneration_of_id: regenerationOfId,
        advanced_opened: advancedOpened,
      };

      let generationId = null;
      if (generationRecord.user_id) {
        const { data: inserted, error: insertError } = await supabase
          .from('image_generations')
          .insert(generationRecord)
          .select('id')
          .single();
        if (insertError) console.error('Image Studio tracking failed:', insertError);
        generationId = inserted?.id || null;
      }

      setResult({
        id: generationId,
        imageUrl: data.image.url,
        svgUrl: data.image.svgUrl,
        supportsSvgDownload: model === 'recraft/v4-svg' && (data.image.supportsSvgDownload || data.image.url?.startsWith('data:image/svg')),
        model,
        aspectRatio,
        prompt: finalPrompt,
      });
      toast.success('Image generated');
    } catch (error) {
      console.error('Ask AI Image Studio generation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Image generation failed');
      setView('form');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-background/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-6xl flex-col bg-background shadow-2xl md:my-6 md:h-[calc(100%-3rem)] md:rounded-lg md:border">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Image Studio</h2>
            <p className="text-sm text-muted-foreground">Create NHS-ready images from guided templates.</p>
          </div>
          <button className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted" onClick={onClose}>Close</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {view === 'gallery' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ASK_AI_IMAGE_STUDIO_TEMPLATES.map(item => (
                <button key={item.id} className="overflow-hidden rounded-lg border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => selectTemplate(item)}>
                  <img src={item.thumbnail} alt="" className="h-36 w-full bg-muted object-cover" loading="lazy" />
                  <div className="space-y-2 p-4">
                    <h3 className="text-sm font-semibold text-card-foreground">{item.title}</h3>
                    <p className="text-xs leading-5 text-muted-foreground">{item.description}</p>
                    <span className="inline-flex rounded-full bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">{modelLabels[item.model]} · {item.aspectRatio}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {view === 'form' && template && (
            <div className="mx-auto max-w-2xl space-y-5">
              <button className="text-sm font-medium text-primary hover:underline" onClick={() => setView('gallery')}>← Back to templates</button>
              <div>
                <h3 className="text-xl font-semibold text-foreground">{template.title}</h3>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </div>
              <div className="space-y-4">
                {template.variables.map(variable => (
                  <label key={variable.key} className="block space-y-2">
                    <span className="text-sm font-medium text-foreground">{variable.label}</span>
                    <input className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={values[variable.key] || ''} placeholder={variable.placeholder} onChange={event => setValues(prev => ({ ...prev, [variable.key]: event.target.value }))} />
                  </label>
                ))}
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">Additional requirements</span>
                  <textarea className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" value={additionalRequirements} placeholder="Optional — appended to the prompt without changing the model or negative prompt." onChange={event => setAdditionalRequirements(event.target.value)} />
                </label>
                <button className="text-sm font-semibold text-primary hover:underline" onClick={() => { setShowAdvanced(opened => !opened); setAdvancedOpened(true); }}>
                  {showAdvanced ? 'Hide advanced' : 'Show advanced'}
                </button>
                {showAdvanced && (
                  <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-foreground">Model override</span>
                      <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={modelOverride} onChange={event => setModelOverride(event.target.value)}>
                        <option value="">Default: {modelLabels[template.model]}</option>
                        {modelOptions.map(model => <option key={model} value={model}>{modelLabels[model]}</option>)}
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-foreground">Aspect override</span>
                      <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={aspectOverride} onChange={event => setAspectOverride(event.target.value)}>
                        <option value="">Default: {template.aspectRatio}</option>
                        {aspectOptions.map(aspect => <option key={aspect} value={aspect}>{aspect}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                <button className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60" onClick={() => generate()} disabled={isGenerating}>
                  {isGenerating ? 'Generating…' : 'Generate image'}
                </button>
              </div>
            </div>
          )}

          {view === 'result' && template && (
            <div className="mx-auto max-w-4xl space-y-5">
              <button className="text-sm font-medium text-primary hover:underline" onClick={() => setView('form')}>← Edit prompt</button>
              <div className="rounded-lg border bg-card p-4">
                {isGenerating ? (
                  <div className="flex min-h-96 items-center justify-center text-muted-foreground">Generating your image…</div>
                ) : result ? (
                  <div className="space-y-4">
                    <img src={result.imageUrl} alt={`Generated ${template.title}`} className="mx-auto max-h-[58vh] rounded-md border object-contain" />
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90" onClick={() => generate(result.id)}>Regenerate</button>
                      <button className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted" onClick={() => setView('form')}>Edit prompt</button>
                      <button className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted" onClick={() => downloadPngFromImage(result.imageUrl, `${template.id}.png`).catch(() => toast.error('Download failed'))}>Download PNG</button>
                      {result.supportsSvgDownload && <button className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted" onClick={() => downloadUrl(result.svgUrl || result.imageUrl, `${template.id}.svg`)}>Download SVG</button>}
                    </div>
                    <p className="text-xs text-muted-foreground">{modelLabels[result.model] || result.model} · {result.aspectRatio}</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="border-t px-5 py-3">
          <button className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={resetToGallery}>Start over</button>
        </div>
      </div>
    </div>
  );
}
