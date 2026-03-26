import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Shield, ShieldCheck, Lock, CheckCircle2, Clock, FileText, Eye, PenLine, CircleCheckBig } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────
export interface CertificateSignatory {
  id: string;
  name: string;
  email: string;
  role: string | null;
  organisation: string | null;
  organisation_type: string | null;
  signatory_title: string | null;
  signed_name: string | null;
  signed_role: string | null;
  signed_organisation: string | null;
  signed_at: string | null;
  signed_ip: string | null;
  signed_user_agent: string | null;
  signature_font: string | null;
  status: string;
  viewed_at: string | null;
}

export interface CertificateDocument {
  id: string;
  title: string;
  original_filename: string;
  file_hash: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  category: string | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor_name: string | null;
  actor_email: string | null;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: any;
  signatory_id: string | null;
}

interface Props {
  document: CertificateDocument;
  signatories: CertificateSignatory[];
  auditLog: AuditEntry[];
  certificateId: string;
  pageCount?: number;
}

// ─── Signature fonts available ─────────────────────────────────────────
const SIGNATURE_FONTS = [
  'Dancing Script',
  'Caveat',
  'Great Vibes',
  'Sacramento',
  'Satisfy',
];

// Build Google Fonts URL for all signature fonts
const GOOGLE_FONTS_URL = `https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500&family=Dancing+Script:wght@600&family=Caveat:wght@600&family=Great+Vibes&family=Sacramento&family=Satisfy&display=swap`;

// ─── QR Code component ────────────────────────────────────────────────
function QRCodeCanvas({ url, size = 100 }: { url: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: size,
        margin: 1,
        color: { dark: '#1a2744', light: '#ffffff' },
      });
    }
  }, [url, size]);

  return <canvas ref={canvasRef} />;
}

// ─── Main Component ───────────────────────────────────────────────────
export function SignatureCertificate({ document: doc, signatories, auditLog, certificateId, pageCount }: Props) {
  const [activeTab, setActiveTab] = useState<'certificate' | 'audit'>('certificate');

  const approvedCount = signatories.filter(s => s.status === 'approved').length;
  const allSigned = approvedCount === signatories.length && signatories.length > 0;
  const verificationUrl = `https://gpnotewell.co.uk/verify/${certificateId}`;

  // Compute timeline events from audit log
  const timelineEvents = useMemo(() => {
    const eventConfig: Record<string, { emoji: string; label: string }> = {
      created: { emoji: '📄', label: 'Document created' },
      sent: { emoji: '📨', label: 'Sent for signing' },
      viewed: { emoji: '👁', label: 'Document viewed' },
      approved: { emoji: '✍️', label: 'Document signed' },
      declined: { emoji: '❌', label: 'Document declined' },
      revoked: { emoji: '🚫', label: 'Approval revoked' },
      closed: { emoji: '📁', label: 'Document closed' },
      reminder_sent: { emoji: '🔔', label: 'Reminder sent' },
      signed_document_generated: { emoji: '✅', label: 'Certificate of Completion issued' },
    };

    return auditLog.map(entry => {
      const cfg = eventConfig[entry.action] || { emoji: '📌', label: entry.action.replace(/_/g, ' ') };
      return { ...entry, ...cfg };
    });
  }, [auditLog]);

  return (
    <>
      {/* Load Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={GOOGLE_FONTS_URL} rel="stylesheet" />

      <div className="cert-root" style={{ fontFamily: "'DM Sans', sans-serif", maxWidth: 720, margin: '0 auto' }}>
        {/* ── Header ────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #1a2744 0%, #2a3d62 60%, #1a2744 100%)',
          borderRadius: '12px 12px 0 0',
          padding: '20px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Gold gradient overlay */}
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%',
            background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.08))',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: '#ffffff', fontWeight: 400 }}>
                Notewell
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600, color: '#c9a84c',
                border: '1.5px solid #c9a84c', borderRadius: 4, padding: '2px 7px',
                letterSpacing: '0.06em', lineHeight: 1,
              }}>
                VERIFIED
              </span>
            </div>
            <div style={{
              fontFamily: "'DM Serif Display', serif", fontSize: 17, color: '#c9a84c',
              marginTop: 4, letterSpacing: '0.02em',
            }}>
              ELECTRONIC SIGNATURE CERTIFICATE
            </div>
          </div>

          {allSigned && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(22,163,74,0.15)', borderRadius: 8, padding: '6px 14px',
              position: 'relative', zIndex: 1,
            }}>
              <ShieldCheck size={18} color="#16a34a" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a', letterSpacing: '0.03em' }}>
                COMPLETE
              </span>
            </div>
          )}
        </div>

        {/* ── Tab Bar ───────────────────────────────────────────── */}
        <div style={{
          display: 'flex', background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
        }}>
          {(['certificate', 'audit'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '12px 0', border: 'none', background: 'transparent',
                cursor: 'pointer', position: 'relative',
                fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontFamily: "'DM Sans', sans-serif",
                color: activeTab === tab ? '#1a2744' : '#94a3b8',
                transition: 'color 0.2s',
              }}
            >
              {tab === 'certificate' ? 'Certificate' : 'Audit Trail'}
              {activeTab === tab && (
                <div style={{
                  position: 'absolute', bottom: 0, left: '20%', right: '20%',
                  height: 3, background: '#c9a84c', borderRadius: '3px 3px 0 0',
                }} />
              )}
            </button>
          ))}
        </div>

        {/* ── Content Area ──────────────────────────────────────── */}
        <div style={{
          background: '#ffffff', borderRadius: '0 0 12px 12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          padding: '28px 32px',
        }}>
          {activeTab === 'certificate' ? (
            <CertificateTab
              doc={doc}
              signatories={signatories}
              certificateId={certificateId}
              pageCount={pageCount}
              allSigned={allSigned}
              approvedCount={approvedCount}
              verificationUrl={verificationUrl}
            />
          ) : (
            <AuditTrailTab
              events={timelineEvents}
              signatories={signatories}
              doc={doc}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Certificate Tab ──────────────────────────────────────────────────
function CertificateTab({
  doc, signatories, certificateId, pageCount, allSigned, approvedCount, verificationUrl,
}: {
  doc: CertificateDocument;
  signatories: CertificateSignatory[];
  certificateId: string;
  pageCount?: number;
  allSigned: boolean;
  approvedCount: number;
  verificationUrl: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Document Details */}
      <section>
        <SectionLabel>DOCUMENT DETAILS</SectionLabel>
        <div style={{
          background: '#f8f9fb', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
            <DetailRow label="Document" value={doc.original_filename} />
            <DetailRow label="Reference" value={certificateId} mono />
            {pageCount != null && <DetailRow label="Pages" value={String(pageCount)} />}
            <div>
              <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Status
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                  background: allSigned ? '#16a34a' : '#f59e0b',
                }} />
                <span style={{
                  fontSize: 13, fontWeight: 500,
                  color: allSigned ? '#16a34a' : '#92400e',
                }}>
                  {allSigned
                    ? 'All parties signed'
                    : `Awaiting ${signatories.length - approvedCount} signature${signatories.length - approvedCount !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
          </div>

          {/* Hash */}
          <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 14, paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Lock size={13} color="#94a3b8" />
              <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                SHA-256 Document Hash
              </span>
            </div>
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6,
              padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, color: '#475569', wordBreak: 'break-all', lineHeight: 1.5,
            }}>
              {doc.file_hash}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Signatories */}
      <section>
        <SectionLabel>SIGNATORIES ({approvedCount} OF {signatories.length})</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {signatories.map(sig => (
            <SignatoryCard key={sig.id} signatory={sig} />
          ))}
        </div>
      </section>

      {/* 3. Verification */}
      <section>
        <SectionLabel>VERIFICATION</SectionLabel>
        <div style={{
          background: '#f8f9fb', border: '1px solid #e2e8f0', borderRadius: 8,
          padding: '20px 24px', display: 'flex', gap: 24, alignItems: 'center',
        }}>
          <div style={{ flexShrink: 0 }}>
            <QRCodeCanvas url={verificationUrl} size={96} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: 0, marginBottom: 10 }}>
              Scan the QR code or visit the URL below to independently verify the authenticity
              and integrity of this signed document.
            </p>
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6,
              padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, color: '#1a2744', wordBreak: 'break-all',
            }}>
              {verificationUrl}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Legal Footer */}
      <footer style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
        <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7, margin: 0, marginBottom: 8 }}>
          <strong style={{ color: '#475569' }}>Legal Basis:</strong> This electronic signature certificate
          is issued in accordance with the Electronic Communications Act 2000 and UK eIDAS regulations.
          Electronic signatures applied via this service are legally binding for the purposes of
          document approval and authorisation.
        </p>
        <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7, margin: 0, marginBottom: 12 }}>
          <strong style={{ color: '#475569' }}>Integrity:</strong> The SHA-256 hash above was computed
          at the time of signing. Any modification to the original document after signing will produce
          a different hash value, indicating the document has been altered.
        </p>
        <p style={{
          fontSize: 10, color: '#94a3b8', textAlign: 'center', margin: 0,
          borderTop: '1px solid #e2e8f0', paddingTop: 12,
        }}>
          Notewell · Powered by PCN Services Ltd · MHRA Class I Registered Medical Device
        </p>
      </footer>
    </div>
  );
}

// ─── Audit Trail Tab ──────────────────────────────────────────────────
function AuditTrailTab({
  events, signatories, doc,
}: {
  events: Array<AuditEntry & { emoji: string; label: string }>;
  signatories: CertificateSignatory[];
  doc: CertificateDocument;
}) {
  const allSigned = signatories.length > 0 && signatories.every(s => s.status === 'approved');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionLabel>EVENT TIMELINE</SectionLabel>

      {/* Timeline */}
      <div style={{ position: 'relative', paddingLeft: 44 }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute', left: 16, top: 16, bottom: 16,
          width: 2, background: '#e2e8f0',
        }} />

        {events.map((event, i) => {
          const isCompletion = event.action === 'signed_document_generated';
          return (
            <div key={event.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 16,
              marginBottom: i < events.length - 1 ? 20 : 0,
              position: 'relative',
            }}>
              {/* Circle */}
              <div style={{
                position: 'absolute', left: -44 + 1, top: 0,
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, lineHeight: 1,
                background: isCompletion ? '#f0fdf4' : '#ffffff',
                border: `2px solid ${isCompletion ? '#16a34a' : '#e2e8f0'}`,
                zIndex: 1,
              }}>
                {event.emoji}
              </div>

              <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                <div style={{
                  fontSize: 13, fontWeight: isCompletion ? 600 : 500,
                  color: isCompletion ? '#16a34a' : '#1a2744',
                }}>
                  {event.label}
                </div>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '4px 16px',
                  marginTop: 4, fontSize: 12, color: '#94a3b8',
                }}>
                  {event.actor_name && (
                    <span>{event.actor_name}</span>
                  )}
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                    {format(new Date(event.created_at), "dd MMM yyyy 'at' HH:mm:ss 'UTC'")}
                  </span>
                  {event.ip_address && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                      IP: {event.ip_address}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Audit Summary */}
      <div style={{
        background: '#f8f9fb', border: '1px solid #e2e8f0', borderRadius: 8,
        padding: '16px 20px',
      }}>
        <SectionLabel>AUDIT SUMMARY</SectionLabel>
        <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.7, margin: 0 }}>
          This document was sent to {signatories.length} signator{signatories.length !== 1 ? 'ies' : 'y'}.
          {allSigned && doc.completed_at && (
            <> All parties completed signing on{' '}
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {format(new Date(doc.completed_at), "dd MMM yyyy 'at' HH:mm 'UTC'")}
              </span>.
            </>
          )}
          {' '}All events were captured with timestamps{events.some(e => e.ip_address) ? ' and IP addresses' : ''}.
        </p>
      </div>
    </div>
  );
}

// ─── Shared Sub-Components ────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: '#94a3b8',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <div style={{
        fontSize: 13, fontWeight: 500, color: '#1a2744', marginTop: 2,
        fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
      }}>
        {value}
      </div>
    </div>
  );
}

function SignatoryCard({ signatory: sig }: { signatory: CertificateSignatory }) {
  const isSigned = sig.status === 'approved';
  const displayName = sig.signed_name || sig.name;
  const displayRole = sig.signed_role || sig.role || '';
  const displayOrg = sig.signed_organisation || sig.organisation || '';
  const font = sig.signature_font || 'Dancing Script';

  return (
    <div style={{
      background: isSigned ? '#f0fdf4' : '#ffffff',
      border: `1px solid ${isSigned ? '#bbf7d0' : '#e2e8f0'}`,
      borderRadius: 8, padding: '18px 22px', position: 'relative',
    }}>
      {/* Status badge */}
      <div style={{
        position: 'absolute', top: 14, right: 16,
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 11, fontWeight: 600, letterSpacing: '0.03em',
        color: isSigned ? '#16a34a' : '#92400e',
        background: isSigned ? 'rgba(22,163,74,0.1)' : 'rgba(245,158,11,0.12)',
        borderRadius: 20, padding: '3px 10px',
      }}>
        {isSigned ? '✓ SIGNED' : '⏳ PENDING'}
      </div>

      {/* Handwritten signature */}
      <div style={{
        fontFamily: `'${font}', cursive`,
        fontSize: 28, color: '#1a2744',
        marginBottom: 12, lineHeight: 1.2,
      }}>
        {displayName}
      </div>

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', marginBottom: 8 }}>
        <DetailRow label="Name" value={`${sig.signatory_title ? sig.signatory_title + ' ' : ''}${displayName}`} />
        <DetailRow label="Role" value={displayRole || '—'} />
        <DetailRow label="Email" value={sig.email} mono />
        <DetailRow label="Organisation" value={displayOrg || '—'} />
      </div>

      {/* Document Role - full width */}
      {displayRole && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Document Role
          </span>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2744', marginTop: 2 }}>
            {displayRole}
          </div>
        </div>
      )}

      {/* Signing details */}
      {isSigned && sig.signed_at && (
        <div style={{
          borderTop: '1px dashed #d1d5db', paddingTop: 10, marginTop: 6,
          display: 'flex', flexWrap: 'wrap', gap: '4px 20px',
          fontSize: 12, color: '#475569',
        }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
            {format(new Date(sig.signed_at), "dd MMM yyyy 'at' HH:mm:ss 'UTC'")}
          </span>
          {sig.signed_ip && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#94a3b8' }}>
              IP: {sig.signed_ip}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
