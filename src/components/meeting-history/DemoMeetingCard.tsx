import { useState } from 'react';
import { format } from 'date-fns';
import {
  Sparkles,
  Pencil,
  Phone,
  Stethoscope,
  Heart,
  Calendar,
  Briefcase,
  User,
  FileText,
  HeartPulse,
  FileDown,
  MoreHorizontal,
  Users,
  FileOutput,
  Trash2,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { DemoPatient } from '@/data/demoPatients';

/* ─────────────────────────────────────────────
   Demo-only meeting card.
   Used exclusively for meetings in the
   "Demonstrations" folder. Calmer palette,
   8-row hierarchy, optimised for frailty/
   elderly-care demo presentations.
   ───────────────────────────────────────────── */

interface DemoMeetingCardProps {
  meeting: any;
  patient: DemoPatient;
  folderName?: string;
  onViewNotes: () => void;
  onAgeingWell: () => void;
  onDownloadWord: () => void;
  onManageAttendees: () => void;
  onDelete: () => void;
  onEditTitle: () => void;
}

const TONE_PILL: Record<DemoPatient['clinicalFlags'][number]['tone'], string> = {
  red: 'bg-[#FCECE8] text-[#C5442E] border-[#F0CFC8]',
  amber: 'bg-[#FDF2E8] text-[#C05621] border-[#F2D9C4]',
  blue: 'bg-[#E6F0F0] text-[#1F5E5E] border-[#CDE0E0]',
  grey: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const DemoMeetingCard = ({
  meeting,
  patient,
  folderName,
  onViewNotes,
  onAgeingWell,
  onDownloadWord,
  onManageAttendees,
  onDelete,
  onEditTitle,
}: DemoMeetingCardProps) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const wordCount = meeting.word_count || 0;
  const wordCountDisplay =
    wordCount >= 1000 ? `${(wordCount / 1000).toFixed(1)}K words` : `${wordCount} words`;

  const startTime = meeting.start_time ? new Date(meeting.start_time) : null;
  const createdAt = meeting.created_at ? new Date(meeting.created_at) : null;

  const flagsToShow = patient.clinicalFlags.slice(0, 2);
  const extraFlagsCount = Math.max(0, patient.clinicalFlags.length - flagsToShow.length);

  return (
    <div
      className="rounded-lg overflow-hidden shadow-sm mb-4"
      style={{
        background: '#FEFCF7',
        border: '1px solid #E8E2D4',
      }}
    >
      {/* ROW 1 — Meeting header */}
      <div
        className="flex items-start gap-4 px-7 py-5"
        style={{ borderBottom: '1px solid #F0EADD' }}
      >
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
          style={{ background: '#E6F0F0', color: '#1F5E5E' }}
        >
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="font-medium text-[1.0625rem] leading-tight truncate"
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              color: '#1A2332',
              letterSpacing: '-0.01em',
            }}
          >
            {meeting.title}
          </h3>
          <div
            className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[12.5px]"
            style={{ color: '#6B7688', fontVariantNumeric: 'tabular-nums' }}
          >
            {startTime && <span>{format(startTime, 'd MMM yyyy')}</span>}
            <span className="w-[3px] h-[3px] rounded-full" style={{ background: '#8B94A5' }} />
            {startTime && <span>{format(startTime, 'HH:mm')}</span>}
            <span className="w-[3px] h-[3px] rounded-full" style={{ background: '#8B94A5' }} />
            <span>{wordCountDisplay}</span>
            {folderName && (
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                style={{ background: '#E6F0F0', color: '#1F5E5E' }}
              >
                {folderName}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onEditTitle}
          className="shrink-0 p-1.5 rounded-md transition-colors hover:bg-slate-100"
          aria-label="Edit meeting"
          style={{ color: '#8B94A5' }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ROW 2 — Patient context */}
      <div
        className="px-7 py-6 flex items-start gap-5"
        style={{
          borderBottom: '1px solid #F0EADD',
          background: 'linear-gradient(180deg, #FEFCF7 0%, #FAF6EA 100%)',
        }}
      >
        {/* Avatar */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-white"
          style={{
            background: 'linear-gradient(135deg, #2C7A7B 0%, #1F5E5E 100%)',
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: '1.5rem',
            fontWeight: 500,
            boxShadow: '0 4px 12px -2px rgba(31, 94, 94, 0.35)',
          }}
        >
          {patient.initials}
        </div>

        {/* Name + demographics */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline flex-wrap gap-x-2">
            <span
              className="text-[1.25rem] font-medium"
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                color: '#1A2332',
                letterSpacing: '-0.01em',
              }}
            >
              {patient.salutation} {patient.fullName}
            </span>
            <span className="italic text-[14.5px]" style={{ color: '#8B94A5' }}>
              "{patient.preferredName}"
            </span>
          </div>
          <div
            className="flex items-center flex-wrap gap-x-2 mt-1 text-[13px]"
            style={{ color: '#6B7688', fontVariantNumeric: 'tabular-nums' }}
          >
            <span>{patient.gender}</span>
            <span style={{ color: '#D4CFC0' }}>·</span>
            <span>{patient.age} yrs</span>
            <span style={{ color: '#D4CFC0' }}>·</span>
            <span>DOB {patient.dob}</span>
            <span style={{ color: '#D4CFC0' }}>·</span>
            <span style={{ color: '#3A4556', fontWeight: 500 }}>
              NHS {patient.nhsNumber}
            </span>
          </div>
        </div>

        {/* Flags column */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {flagsToShow.map((flag, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11.5px] font-medium border ${TONE_PILL[flag.tone]}`}
            >
              {flag.label}
            </span>
          ))}
          {extraFlagsCount > 0 && (
            <button
              type="button"
              className="text-[11px] mt-0.5 hover:underline"
              style={{ color: '#8B94A5' }}
            >
              + {extraFlagsCount} more
            </button>
          )}
        </div>
      </div>

      {/* ROW 3 — Contact strip */}
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-5 px-7 py-3.5"
        style={{ background: '#FEFCF7', borderBottom: '1px solid #F0EADD' }}
      >
        <ContactCell
          icon={<Phone className="h-3.5 w-3.5" style={{ color: '#94A3B8' }} />}
          label="HOME"
          value={patient.phone}
        />
        <ContactCell
          icon={<Stethoscope className="h-3.5 w-3.5" style={{ color: '#94A3B8' }} />}
          label="GP"
          value={`${patient.registeredGp} · ${patient.practice}`}
        />
        <ContactCell
          icon={<Heart className="h-3.5 w-3.5" style={{ color: '#94A3B8' }} />}
          label="NOK"
          value={`${patient.nextOfKin.name} (${patient.nextOfKin.relationship}) · ${patient.nextOfKin.phone}`}
        />
      </div>

      {/* ROW 4 — Visit strip */}
      <div
        className="flex items-center flex-wrap gap-3 px-7 py-3"
        style={{ background: '#FAF6EA', borderBottom: '1px solid #F0EADD' }}
      >
        <span
          className="text-[11px] font-semibold uppercase"
          style={{ color: '#1F5E5E', letterSpacing: '0.08em' }}
        >
          Visit
        </span>
        <VDivider />
        <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: '#3A4556' }}>
          <Calendar className="h-3 w-3" style={{ color: '#8B94A5' }} />
          {patient.visit.date}
        </span>
        <VDivider />
        <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: '#3A4556' }}>
          <Briefcase className="h-3 w-3" style={{ color: '#8B94A5' }} />
          {patient.visit.type}
        </span>
        <VDivider />
        <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: '#3A4556' }}>
          <User className="h-3 w-3" style={{ color: '#8B94A5' }} />
          with {patient.visit.worker}, {patient.visit.workerRole}
        </span>

        <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ border: '1px solid #C05621', background: 'transparent' }}
        >
          <span className="relative inline-flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping"
              style={{ background: '#C05621' }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ background: '#C05621' }}
            />
          </span>
          <span
            className="text-[10.5px] font-semibold uppercase"
            style={{ color: '#C05621', letterSpacing: '0.1em' }}
          >
            Demo Patient
          </span>
        </span>
      </div>

      {/* ROW 5 — Actions */}
      <div className="flex items-center gap-2.5 px-7 py-4">
        <button
          onClick={onViewNotes}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-[13px] font-medium text-white transition-colors"
          style={{ background: '#1E3A5F' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#16304F')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#1E3A5F')}
        >
          <FileText className="h-4 w-4" />
          View Notes
        </button>

        <button
          onClick={onAgeingWell}
          className="relative inline-flex items-center gap-2 h-9 px-5 rounded-md text-[13px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md"
          style={{
            background: 'linear-gradient(135deg, #2C7A7B 0%, #1F5E5E 100%)',
          }}
        >
          <HeartPulse className="h-4 w-4" />
          Ageing Well
          <ChevronRight className="h-3.5 w-3.5 opacity-80" />
          <span
            className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-white"
            style={{ background: '#C05621', fontSize: '9px', fontWeight: 700 }}
            aria-hidden
          >
            ★
          </span>
        </button>

        <button
          onClick={onDownloadWord}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-[13px] font-medium transition-colors"
          style={{
            background: 'transparent',
            border: '1px solid #E2E8F0',
            color: '#3A4556',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <FileDown className="h-4 w-4" />
          Word
        </button>

        <div className="flex-1" />

        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              className="w-[38px] h-[38px] inline-flex items-center justify-center rounded-md transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid #E2E8F0',
                color: '#6B7688',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              aria-label="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-[180px] p-1 rounded-md shadow-md border-slate-200 bg-white"
          >
            <MenuItem
              icon={<Users className="h-4 w-4" />}
              label="Manage Attendees"
              onClick={() => {
                setMenuOpen(false);
                onManageAttendees();
              }}
            />
            <MenuItem
              icon={<FileOutput className="h-4 w-4" />}
              label="Export as PDF"
              onClick={() => {
                setMenuOpen(false);
                toast.info('PDF export coming soon');
              }}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 py-2 px-3 text-sm rounded-sm hover:bg-red-50 text-red-600 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete meeting
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="mx-4 max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{meeting.title}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PopoverContent>
        </Popover>
      </div>

      {/* ROW 7 — Overview content */}
      {meeting.overview && (
        <div className="px-7 py-5" style={{ borderTop: '1px solid #F0EADD' }}>
          <p
            className="text-[14.5px] leading-relaxed"
            style={{ color: '#3A4556' }}
          >
            {meeting.overview}
          </p>
        </div>
      )}

      {/* ROW 8 — Footer */}
      <div
        className="flex items-center justify-between px-7 py-3"
        style={{
          background: '#FCFAF3',
          borderTop: '1px solid #F0EADD',
          color: '#6B7688',
        }}
      >
        <span className="inline-flex items-center gap-1.5 text-[12px]">
          {meeting.summary_exists ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#2F855A' }} />
              <span style={{ color: '#2F855A', fontWeight: 500 }}>Summary available</span>
            </>
          ) : (
            <span style={{ color: '#8B94A5' }}>Summary pending</span>
          )}
        </span>
        {createdAt && (
          <span className="text-[12px]">
            Created {format(createdAt, 'd MMM yyyy')}
          </span>
        )}
      </div>
    </div>
  );
};

/* ── helpers ── */

const VDivider = () => (
  <span
    className="inline-block w-px"
    style={{ height: '14px', background: '#E2E8F0' }}
  />
);

const ContactCell = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-2 min-w-0">
    <span className="mt-0.5 shrink-0">{icon}</span>
    <div className="min-w-0">
      <div
        className="text-[10.5px] font-semibold uppercase"
        style={{ color: '#94A3B8', letterSpacing: '0.08em' }}
      >
        {label}
      </div>
      <div
        className="text-[12.5px] truncate"
        style={{ color: '#3A4556', fontWeight: 500 }}
        title={value}
      >
        {value}
      </div>
    </div>
  </div>
);

const MenuItem = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-2 py-2 px-3 text-sm rounded-sm hover:bg-slate-50 transition-colors"
    style={{ color: '#3A4556' }}
  >
    {icon}
    {label}
  </button>
);

export default DemoMeetingCard;
