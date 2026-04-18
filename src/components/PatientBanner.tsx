import { DemoPatient } from '@/data/demoPatients';
import {
  Phone,
  MapPin,
  User,
  Calendar,
  Briefcase,
  Heart,
} from 'lucide-react';

interface PatientBannerProps {
  patient: DemoPatient;
  compact?: boolean;
}

const TONE_STYLES: Record<
  DemoPatient['clinicalFlags'][number]['tone'],
  { container: string; dot: string }
> = {
  red: {
    container: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-600',
  },
  amber: {
    container: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-600',
  },
  blue: {
    container: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-600',
  },
  grey: {
    container: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-500',
  },
};

export const PatientBanner = ({ patient, compact = false }: PatientBannerProps) => {
  const avatarSize = compact ? 44 : 56;
  const avatarFontSize = compact ? 15 : 18;
  const middlePadY = compact ? 'py-1.5' : 'py-3';
  const topPadY = compact ? 'py-3' : 'py-4';

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm mb-4 bg-white">
      {/* Top section — identity strip */}
      <div
        className={`px-5 ${topPadY} flex items-start justify-between gap-4`}
        style={{
          background:
            'linear-gradient(90deg, #F0F6FB 0%, #FAFCFE 100%)',
        }}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Avatar */}
          <div
            className="flex items-center justify-center rounded-full text-white font-bold shrink-0 ring-2 ring-white/60 shadow-inner"
            style={{
              width: avatarSize,
              height: avatarSize,
              backgroundColor: patient.avatarColor,
              fontSize: avatarFontSize,
            }}
          >
            {patient.initials}
          </div>

          {/* Name + demographics */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-lg font-bold text-slate-900 truncate">
                {patient.salutation} {patient.fullName}
              </span>
              <span className="text-base font-normal text-slate-600">
                ({patient.preferredName})
              </span>
            </div>
            <div
              className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 mt-0.5 ${
                compact ? 'whitespace-nowrap overflow-hidden' : ''
              }`}
            >
              <span>{patient.gender}</span>
              <span className="text-slate-300">·</span>
              <span>{patient.age} yrs</span>
              <span className="text-slate-300">·</span>
              <span>DOB {patient.dob}</span>
              <span className="text-slate-300">·</span>
              <span className="tabular-nums">NHS {patient.nhsNumber}</span>
            </div>
          </div>
        </div>

        {/* Clinical flags */}
        <div className="flex flex-wrap justify-end gap-1.5 max-w-[50%]">
          {patient.clinicalFlags.map((flag, idx) => {
            const tone = TONE_STYLES[flag.tone];
            return (
              <span
                key={idx}
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tone.container}`}
              >
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${tone.dot}`}
                />
                {flag.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Middle section — contact & clinical admin */}
      <div
        className={`px-5 ${middlePadY} bg-white border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-700`}
      >
        <div className="flex items-start">
          <MapPin className="h-3.5 w-3.5 text-slate-500 mr-2 mt-0.5 shrink-0" />
          <span>{patient.address}</span>
        </div>
        <div className="flex items-start">
          <User className="h-3.5 w-3.5 text-slate-500 mr-2 mt-0.5 shrink-0" />
          <span>
            GP: {patient.registeredGp} · {patient.practice} ({patient.odsCode})
          </span>
        </div>
        <div className="flex items-start">
          <Phone className="h-3.5 w-3.5 text-slate-500 mr-2 mt-0.5 shrink-0" />
          <span>{patient.phone}</span>
        </div>
        <div className="flex items-start">
          <Heart className="h-3.5 w-3.5 text-slate-500 mr-2 mt-0.5 shrink-0" />
          <span>
            NOK: {patient.nextOfKin.name} ({patient.nextOfKin.relationship}) ·{' '}
            {patient.nextOfKin.phone}
            {patient.nextOfKin.lpa ? ` · LPA ${patient.nextOfKin.lpa}` : ''}
          </span>
        </div>
      </div>

      {/* Bottom — visit context strip */}
      <div className="bg-slate-900 text-white px-5 py-2.5 flex flex-wrap items-center gap-3 text-xs uppercase tracking-wider">
        <span className="font-semibold text-white/70">VISIT</span>
        <span className="w-px h-4 bg-white/20" />
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {patient.visit.date}
        </span>
        <span className="w-px h-4 bg-white/20" />
        <span className="inline-flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5" />
          {patient.visit.type}
        </span>
        <span className="w-px h-4 bg-white/20" />
        <span className="inline-flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          {patient.visit.worker}, {patient.visit.workerRole}
        </span>

        <span className="ml-auto inline-flex items-center gap-2">
          <span className="relative inline-flex">
            <span className="absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="text-amber-400 font-bold tracking-widest">
            DEMO PATIENT
          </span>
        </span>
      </div>
    </div>
  );
};

export default PatientBanner;
