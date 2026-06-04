import { Clock, CheckCircle2, X } from 'lucide-react';
import type { AppointmentRecord } from '@/types/dashboard';
import { APPT_STATUS_COLORS } from './constants';

interface AppointmentRowProps {
  appt: AppointmentRecord;
  compact?: boolean;
  onStatus: (id: string, status: AppointmentRecord['status']) => void;
}

export function AppointmentRow({ appt, compact, onStatus }: AppointmentRowProps) {
  const colors = APPT_STATUS_COLORS[appt.status];
  const start = new Date(appt.startTime);
  const initials = `${appt.patient?.firstName?.[0] || ''}${appt.patient?.lastName?.[0] || ''}` || '?';
  const patientName = `${appt.patient?.firstName || ''} ${appt.patient?.lastName || ''}`.trim() || 'Patient';

  return (
    <div className="p-3 rounded-xl border border-border/40 bg-card/65 flex items-center justify-between gap-3 hover:shadow transition-shadow">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-xs text-foreground truncate">{appt.title}</p>
          <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {start.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            <span className="opacity-60">·</span>
            {patientName}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full"
          style={{ background: colors.bg, color: colors.text }}
        >
          {appt.status.replace('_', ' ')}
        </span>
        {!compact && appt.status === 'SCHEDULED' && (
          <>
            <button
              onClick={() => onStatus(appt.id, 'COMPLETED')}
              title="Mark completed"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#1A9966] hover:bg-[#1A9966]/10 cursor-pointer transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onStatus(appt.id, 'CANCELLED')}
              title="Cancel"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#D41717] hover:bg-[#D41717]/10 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
