import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import type { PatientRecord } from '@/types/dashboard';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: PatientRecord[];
  onSuccess: () => void;
}

export function AppointmentModal({ isOpen, onClose, patients, onSuccess }: AppointmentModalProps) {
  const [patientId, setPatientId] = useState('');
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleApptSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          title: title.trim(),
          startTime: new Date(start).toISOString(),
          notes: notes.trim() || undefined,
        }),
      });
      toast.success('Appointment scheduled successfully.');
      setPatientId('');
      setTitle('');
      setStart('');
      setNotes('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule appointment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative glass-card w-full max-w-md rounded-2xl p-6 border-border/40 shadow-xl overflow-hidden bg-card/95 animate-scale-in"
        style={{ boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)' }}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-foreground">Schedule Appointment</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Book a clinical visit for a patient in your organization.</p>

        <form onSubmit={handleApptSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Patient</label>
            <select
              required
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground cursor-pointer"
            >
              <option value="" disabled>Select a patient</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Lipid panel follow-up"
              className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Date &amp; Time</label>
            <input
              type="datetime-local"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context for the visit."
              className="w-full text-xs rounded-xl px-3.5 py-2 outline-none border border-border/60 bg-card text-foreground resize-none"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-border hover:bg-border/20 text-muted-foreground transition-all cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
              style={{ background: 'var(--primary-text)' }}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
