import React, { useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

interface OnboardPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function OnboardPatientModal({ isOpen, onClose, onSuccess }: OnboardPatientModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleOnboardSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/users/onboard-patient', {
        method: 'POST',
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          dateOfBirth: new Date(dob).toISOString(),
          gender,
          notes: note.trim() || undefined,
        }),
      });
      toast.success(`Successfully registered profile for ${firstName} ${lastName}.`);
      setFirstName('');
      setLastName('');
      setEmail('');
      setDob('');
      setGender('');
      setNote('');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to register patient profile.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative glass-card w-full max-w-md rounded-2xl p-6 border-border/40 shadow-xl overflow-hidden bg-card/95 animate-scale-in"
        style={{
          borderColor: 'color-mix(in srgb, var(--border) 40%, transparent)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
        }}
      >
        <h3 className="text-base font-bold text-foreground mb-1">Onboard New Patient</h3>
        <p className="text-xs text-muted-foreground mb-4">Register an authenticated profile under your clinical portal organization.</p>

        <form onSubmit={handleOnboardSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">First Name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Last Name</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane.smith@example.com"
              className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Date of Birth</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full text-xs rounded-xl px-3.5 py-2.5 pr-8 outline-none border border-border/60 bg-card text-foreground"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Biological Gender</label>
              <select
                required
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full text-xs rounded-xl px-3.5 py-2.5 outline-none border border-border/60 bg-card text-foreground cursor-pointer"
              >
                <option value="" disabled>Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Intake Comments / Notes</label>
            <textarea
              rows={2.5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="E.g., History of high cholesterol, lipid metrics checkup panel, YC project notes."
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
              style={{ background: '#8a7a6a' }}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Onboard Patient
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
