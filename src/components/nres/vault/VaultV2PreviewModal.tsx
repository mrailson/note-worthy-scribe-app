import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const VAULT_HTML = `<div class="vault">
  <div class="nav-bar">
    <div class="nav-tab active" data-view="folders">Folders</div>
    <div class="nav-tab" data-view="recent">Latest edits</div>
    <div class="nav-tab" data-view="added">New uploads</div>
    <div class="nav-tab" data-view="mine">My documents</div>
    <div class="nav-tab" data-view="favourites">Favourites</div>
    <div class="nav-tab" data-view="all">All documents</div>
  </div>
  <div class="view-panel active" id="v-folders">
    <div class="toolbar"><input class="search-box" placeholder="Search files and folders..." /></div>
    <div class="folder-tree">
      <div class="folder-row"><span class="caret">▸</span> <span style="font-size:16px">📁</span> Archive and Reference</div>
      <div class="folder-row"><span class="caret">▸</span> <span style="font-size:16px">📁</span> Estates and Facilities</div>
      <div class="folder-row"><span class="caret">▸</span> <span style="font-size:16px">📁</span> Finance</div>
      <div class="folder-row"><span class="caret">▾</span> <span style="font-size:16px">📂</span> Governance</div>
      <div class="folder-row sub"><span class="caret">▸</span> <span style="font-size:16px">📁</span> Clinical Governance</div>
      <div class="folder-row sub"><span class="caret">▸</span> <span style="font-size:16px">📁</span> Contracts and Agreements</div>
      <div class="folder-row sub"><span class="caret">▸</span> <span style="font-size:16px">📁</span> DPIA / DSA NRES and SNO</div>
      <div class="folder-row sub"><span class="caret">▾</span> <span style="font-size:16px">📂</span> NRES Programme Board Meetings</div>
      <div class="folder-row sub2"><span class="caret">▸</span> <span style="font-size:16px">📁</span> Board Decisions Log</div>
      <div class="folder-row sub2"><span class="caret">▸</span> <span style="font-size:16px">📁</span> February 2026</div>
    </div>
  </div>
  <div class="view-panel" id="v-recent">
    <div class="toolbar"><input class="search-box" placeholder="Filter..." /><span class="filter-chip on">All types</span><span class="filter-chip">.docx</span><span class="filter-chip">.pdf</span><span class="filter-chip">.xlsx</span></div>
    <div class="section-label">Today</div>
    <table class="doc-table"><thead><tr><th style="width:45%">Document</th><th>Type</th><th>Edited by</th><th>When</th><th style="width:28px"></th></tr></thead><tbody>
      <tr><td><div class="doc-name">NRES Locum Services Agreement v1.2</div><div class="doc-path">Governance / Contracts and Agreements</div></td><td><span class="badge badge-docx">.docx</span></td><td><span class="user-avatar">MR</span>Malcolm R.</td><td class="time-ago">2 hrs ago</td><td><span class="star on">★</span></td></tr>
      <tr><td><div class="doc-name">Employee Handbook Issue 2 — March 2026</div><div class="doc-path">HR / Policies</div></td><td><span class="badge badge-docx">.docx</span></td><td><span class="user-avatar">MR</span>Malcolm R.</td><td class="time-ago">4 hrs ago</td><td><span class="star">☆</span></td></tr>
    </tbody></table>
    <div class="section-label">This week</div>
    <table class="doc-table"><thead><tr><th style="width:45%">Document</th><th>Type</th><th>Edited by</th><th>When</th><th style="width:28px"></th></tr></thead><tbody>
      <tr><td><div class="doc-name">NRES Programme Board Minutes — March 2026</div><div class="doc-path">Governance / NRES Programme Board Meetings</div></td><td><span class="badge badge-docx">.docx</span></td><td><span class="user-avatar">AP</span>Amanda P.</td><td class="time-ago">21 Mar</td><td><span class="star">☆</span></td></tr>
      <tr><td><div class="doc-name">DPIA v1.1 — NRES Neighbourhood</div><div class="doc-path">Governance / DPIA / DSA NRES and SNO</div></td><td><span class="badge badge-pdf">.pdf</span></td><td><span class="user-avatar">MR</span>Malcolm R.</td><td class="time-ago">20 Mar</td><td><span class="star on">★</span></td></tr>
      <tr><td><div class="doc-name">SDA Slot Type Reporting — Week 12</div><div class="doc-path">IT & Reporting / SDA Reports</div></td><td><span class="badge badge-xlsx">.xlsx</span></td><td><span class="user-avatar">MC</span>Michael C.</td><td class="time-ago">19 Mar</td><td><span class="star">☆</span></td></tr>
    </tbody></table>
    <div class="section-label">Earlier this month</div>
    <table class="doc-table"><thead><tr><th style="width:45%">Document</th><th>Type</th><th>Edited by</th><th>When</th><th style="width:28px"></th></tr></thead><tbody>
      <tr><td><div class="doc-name">Clinical Pharmacist Induction Programme</div><div class="doc-path">HR / Inductions</div></td><td><span class="badge badge-docx">.docx</span></td><td><span class="user-avatar">MR</span>Malcolm R.</td><td class="time-ago">14 Mar</td><td><span class="star">☆</span></td></tr>
      <tr><td><div class="doc-name">Notewell Governance Pack v1.5</div><div class="doc-path">IT & Reporting / Notewell</div></td><td><span class="badge badge-pdf">.pdf</span></td><td><span class="user-avatar">MR</span>Malcolm R.</td><td class="time-ago">10 Mar</td><td><span class="star on">★</span></td></tr>
    </tbody></table>
  </div>
  <div class="view-panel" id="v-added">
    <div class="toolbar"><input class="search-box" placeholder="Filter..." /><span class="filter-chip on">All types</span><span class="filter-chip">.docx</span><span class="filter-chip">.pdf</span><span class="filter-chip">.xlsx</span></div>
    <table class="doc-table"><thead><tr><th style="width:45%">Document</th><th>Type</th><th>Uploaded by</th><th>When</th><th style="width:28px"></th></tr></thead><tbody>
      <tr><td><div class="doc-name">NRES Locum Services Agreement v1.2</div><div class="doc-path">Governance / Contracts and Agreements</div></td><td><span class="badge badge-docx">.docx</span></td><td><span class="user-avatar">MR</span>Malcolm R.</td><td class="time-ago">24 Mar</td><td><span class="star on">★</span></td></tr>
      <tr><td><div class="doc-name">Employee Handbook Issue 2 — March 2026</div><div class="doc-path">HR / Policies</div></td><td><span class="badge badge-docx">.docx</span></td><td><span class="user-avatar">MR</span>Malcolm R.</td><td class="time-ago">22 Mar</td><td><span class="star">☆</span></td></tr>
      <tr><td><div class="doc-name">SDA Slot Type Reporting — Week 12</div><div class="doc-path">IT & Reporting / SDA Reports</div></td><td><span class="badge badge-xlsx">.xlsx</span></td><td><span class="user-avatar">MC</span>Michael C.</td><td class="time-ago">19 Mar</td><td><span class="star">☆</span></td></tr>
      <tr><td><div class="doc-name">Clinical Pharmacist Induction Programme</div><div class="doc-path">HR / Inductions</div></td><td><span class="badge badge-docx">.docx</span></td><td><span class="user-avatar">MR</span>Malcolm R.</td><td class="time-ago">14 Mar</td><td><span class="star">☆</span></td></tr>
    </tbody></table>
  </div>
  <div class="view-panel" id="v-mine">
    <div class="toolbar"><input class="search-box" placeholder="Search my documents..." /></div>
    <table class="doc-table"><thead><tr><th style="width:50%">Document</th><th>Type</th><th>Uploaded</th><th>Last edited</th><th style="width:28px"></th></tr></thead><tbody>
      <tr><td><div class="doc-name">NRES Locum Services Agreement v1.2</div><div class="doc-path">Governance / Contracts and Agreements</div></td><td><span class="badge badge-docx">.docx</span></td><td class="time-ago">24 Mar</td><td class="time-ago">2 hrs ago</td><td><span class="star on">★</span></td></tr>
      <tr><td><div class="doc-name">Employee Handbook Issue 2 — March 2026</div><div class="doc-path">HR / Policies</div></td><td><span class="badge badge-docx">.docx</span></td><td class="time-ago">22 Mar</td><td class="time-ago">4 hrs ago</td><td><span class="star">☆</span></td></tr>
      <tr><td><div class="doc-name">DPIA v1.1 — NRES Neighbourhood</div><div class="doc-path">Governance / DPIA / DSA NRES and SNO</div></td><td><span class="badge badge-pdf">.pdf</span></td><td class="time-ago">10 Mar</td><td class="time-ago">20 Mar</td><td><span class="star on">★</span></td></tr>
      <tr><td><div class="doc-name">Notewell Governance Pack v1.5</div><div class="doc-path">IT & Reporting / Notewell</div></td><td><span class="badge badge-pdf">.pdf</span></td><td class="time-ago">4 Mar</td><td class="time-ago">18 Mar</td><td><span class="star on">★</span></td></tr>
    </tbody></table>
  </div>
  <div class="view-panel" id="v-favourites">
    <div class="toolbar"><input class="search-box" placeholder="Search favourites..." /></div>
    <table class="doc-table"><thead><tr><th style="width:50%">Document</th><th>Type</th><th>Location</th><th>Last edited</th><th style="width:28px"></th></tr></thead><tbody>
      <tr><td><div class="doc-name">NRES Locum Services Agreement v1.2</div></td><td><span class="badge badge-docx">.docx</span></td><td class="time-ago">Contracts and Agreements</td><td class="time-ago">2 hrs ago</td><td><span class="star on">★</span></td></tr>
      <tr><td><div class="doc-name">DPIA v1.1 — NRES Neighbourhood</div></td><td><span class="badge badge-pdf">.pdf</span></td><td class="time-ago">DPIA / DSA NRES and SNO</td><td class="time-ago">20 Mar</td><td><span class="star on">★</span></td></tr>
      <tr><td><div class="doc-name">Notewell Governance Pack v1.5</div></td><td><span class="badge badge-pdf">.pdf</span></td><td class="time-ago">IT & Reporting / Notewell</td><td class="time-ago">18 Mar</td><td><span class="star on">★</span></td></tr>
    </tbody></table>
  </div>
  <div class="view-panel" id="v-all">
    <div class="toolbar"><input class="search-box" placeholder="Search all documents..." /><span class="filter-chip on">All types</span><span class="filter-chip">.docx</span><span class="filter-chip">.pdf</span><span class="filter-chip">.xlsx</span></div>
    <table class="doc-table"><thead><tr><th style="width:40%">Document</th><th>Type</th><th>Location</th><th>Edited by</th><th>Last edited</th><th style="width:28px"></th></tr></thead><tbody>
      <tr><td><div class="doc-name">NRES Locum Services Agreement v1.2</div></td><td><span class="badge badge-docx">.docx</span></td><td class="time-ago" style="font-size:11px">Contracts and Agreements</td><td><span class="user-avatar">MR</span></td><td class="time-ago">2 hrs ago</td><td><span class="star on">★</span></td></tr>
      <tr><td><div class="doc-name">Employee Handbook Issue 2</div></td><td><span class="badge badge-docx">.docx</span></td><td class="time-ago" style="font-size:11px">HR / Policies</td><td><span class="user-avatar">MR</span></td><td class="time-ago">4 hrs ago</td><td><span class="star">☆</span></td></tr>
      <tr><td><div class="doc-name">Programme Board Minutes — Mar 2026</div></td><td><span class="badge badge-docx">.docx</span></td><td class="time-ago" style="font-size:11px">NRES Programme Board</td><td><span class="user-avatar">AP</span></td><td class="time-ago">21 Mar</td><td><span class="star">☆</span></td></tr>
      <tr><td><div class="doc-name">DPIA v1.1 — NRES Neighbourhood</div></td><td><span class="badge badge-pdf">.pdf</span></td><td class="time-ago" style="font-size:11px">DPIA / DSA NRES and SNO</td><td><span class="user-avatar">MR</span></td><td class="time-ago">20 Mar</td><td><span class="star on">★</span></td></tr>
      <tr><td><div class="doc-name">SDA Slot Type Reporting — Week 12</div></td><td><span class="badge badge-xlsx">.xlsx</span></td><td class="time-ago" style="font-size:11px">IT & Reporting / SDA Reports</td><td><span class="user-avatar">MC</span></td><td class="time-ago">19 Mar</td><td><span class="star">☆</span></td></tr>
      <tr><td><div class="doc-name">Notewell Governance Pack v1.5</div></td><td><span class="badge badge-pdf">.pdf</span></td><td class="time-ago" style="font-size:11px">IT & Reporting / Notewell</td><td><span class="user-avatar">MR</span></td><td class="time-ago">18 Mar</td><td><span class="star on">★</span></td></tr>
    </tbody></table>
  </div>
</div>`;

const VAULT_CSS = `
  .vault { max-width: 100%; background: hsl(var(--background)); border-radius: 12px; padding: 0 20px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: hsl(var(--foreground)); }
  .nav-bar { display: flex; align-items: center; gap: 0; border-bottom: 0.5px solid hsl(var(--border)); overflow-x: auto; }
  .nav-tab { padding: 12px 14px; font-size: 13px; color: hsl(var(--muted-foreground)); cursor: pointer; white-space: nowrap; border-bottom: 2px solid transparent; transition: all .15s; font-weight: 400; }
  .nav-tab:hover { color: hsl(var(--foreground)); background: hsl(var(--muted)); }
  .nav-tab.active { color: #E6A817; border-bottom-color: #E6A817; font-weight: 500; }
  .view-panel { display: none; }
  .view-panel.active { display: block; }
  .toolbar { display: flex; align-items: center; padding: 12px 0; gap: 8px; flex-wrap: wrap; }
  .search-box { flex: 1; max-width: 280px; padding: 6px 10px; border: 0.5px solid hsl(var(--border)); border-radius: 8px; font-size: 13px; background: hsl(var(--background)); color: hsl(var(--foreground)); }
  .filter-chip { padding: 4px 10px; font-size: 12px; border: 0.5px solid hsl(var(--border)); border-radius: 20px; color: hsl(var(--muted-foreground)); cursor: pointer; background: hsl(var(--background)); white-space: nowrap; }
  .filter-chip:hover, .filter-chip.on { background: hsl(var(--primary) / 0.1); color: hsl(var(--primary)); border-color: hsl(var(--primary) / 0.3); }
  .doc-table { width: 100%; border-collapse: collapse; }
  .doc-table th { font-size: 11px; font-weight: 500; color: hsl(var(--muted-foreground)); text-align: left; padding: 6px 8px; border-bottom: 0.5px solid hsl(var(--border)); text-transform: uppercase; letter-spacing: 0.5px; }
  .doc-table td { font-size: 13px; padding: 10px 8px; border-bottom: 0.5px solid hsl(var(--border)); color: hsl(var(--foreground)); vertical-align: middle; }
  .doc-table tr:hover td { background: hsl(var(--muted) / 0.5); }
  .doc-name { font-weight: 500; font-size: 13px; }
  .doc-path { font-size: 11px; color: hsl(var(--muted-foreground)); margin-top: 2px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
  .badge-docx { background: hsl(210 80% 95%); color: hsl(210 70% 30%); }
  .badge-pdf { background: hsl(0 70% 95%); color: hsl(0 60% 30%); }
  .badge-xlsx { background: hsl(90 50% 92%); color: hsl(90 60% 22%); }
  .star { cursor: pointer; font-size: 14px; color: hsl(var(--muted-foreground)); }
  .star.on { color: #E6A817; }
  .time-ago { color: hsl(var(--muted-foreground)); font-size: 12px; white-space: nowrap; }
  .folder-tree { padding: 8px 0; }
  .folder-row { display: flex; align-items: center; gap: 6px; padding: 6px 8px; cursor: pointer; border-radius: 4px; font-size: 13px; color: hsl(var(--foreground)); }
  .folder-row:hover { background: hsl(var(--muted) / 0.5); }
  .folder-row .caret { width: 16px; color: hsl(var(--muted-foreground)); font-size: 10px; text-align: center; }
  .sub { padding-left: 22px; }
  .sub2 { padding-left: 44px; }
  .section-label { font-size: 11px; font-weight: 500; color: hsl(var(--muted-foreground)); text-transform: uppercase; letter-spacing: 0.5px; padding: 16px 8px 6px; }
  .user-avatar { width: 22px; height: 22px; border-radius: 50%; background: hsl(var(--primary) / 0.1); display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 500; color: hsl(var(--primary)); vertical-align: middle; margin-right: 4px; }
`;

export const VaultV2PreviewModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    
    // Handle tab clicks
    const tab = target.closest('.nav-tab') as HTMLElement;
    if (tab) {
      const container = e.currentTarget;
      const viewId = tab.getAttribute('data-view');
      if (!viewId) return;
      
      container.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const map: Record<string, string> = { folders:'v-folders', recent:'v-recent', added:'v-added', mine:'v-mine', favourites:'v-favourites', all:'v-all' };
      const panel = container.querySelector(`#${map[viewId]}`);
      panel?.classList.add('active');
      return;
    }

    // Handle star clicks
    const star = target.closest('.star') as HTMLElement;
    if (star) {
      star.classList.toggle('on');
      star.textContent = star.classList.contains('on') ? '★' : '☆';
      return;
    }

    // Handle filter chip clicks
    const chip = target.closest('.filter-chip') as HTMLElement;
    if (chip) {
      chip.parentElement?.querySelectorAll('.filter-chip').forEach(x => x.classList.remove('on'));
      chip.classList.add('on');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950">
          <Sparkles className="h-3.5 w-3.5" />
          Preview V2
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            Mid April
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
          <DialogTitle className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-base font-semibold">Document Vault — Version 2 Preview</div>
              <div className="text-xs font-normal text-muted-foreground mt-0.5">
                Coming mid April 2026 — interactive preview of the new vault experience
              </div>
            </div>
            <Badge className="ml-auto bg-amber-500 hover:bg-amber-600 text-white text-xs">
              Coming Soon
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-4">
          <style>{VAULT_CSS}</style>
          <div 
            onClick={handleContainerClick}
            dangerouslySetInnerHTML={{ __html: VAULT_HTML }} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
