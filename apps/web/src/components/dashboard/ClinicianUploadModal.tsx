import React, { useState, useRef } from 'react';
import { Upload, X, Search, Loader2, CheckCircle2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { PatientRecord } from '@/types/dashboard';

interface ClinicianUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: PatientRecord[];
  onUpload: (file: File, compareSlot: 'A' | 'B' | null, targetPatientId?: string) => Promise<void>;
  onOnboardClick: () => void;
}

export function ClinicianUploadModal({
  isOpen,
  onClose,
  patients,
  onUpload,
  onOnboardClick,
}: ClinicianUploadModalProps) {
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const filteredPatients = patients.filter((p) => {
    const query = searchTerm.toLowerCase();
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
    return fullName.includes(query) || (p.email || '').toLowerCase().includes(query);
  });

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type !== 'application/pdf') {
        toast.error('Only PDF documents are supported for clinical processing.');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error('File size exceeds the 20MB maximum safety threshold.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast.error('Only PDF documents are supported for clinical processing.');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error('File size exceeds the 20MB maximum safety threshold.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      toast.error('Please select a patient profile for this report.');
      return;
    }
    if (!selectedFile) {
      toast.error('Please choose a laboratory PDF report.');
      return;
    }

    setUploading(true);
    try {
      await onUpload(selectedFile, null, selectedPatientId);
      onClose();
    } catch (err: any) {
      // Errors handled by parent component toast/viewState
    } finally {
      setUploading(false);
    }
  };

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
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-foreground">Upload Patient Lab Report</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1 rounded-lg hover:bg-border/20 bg-transparent border-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Select an onboarded patient and upload their diagnostic report for AI biomarker processing.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Selector */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Select Patient Profile
            </label>
            
            <div
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full text-xs rounded-xl px-3.5 py-2.5 border border-border/60 bg-card text-foreground cursor-pointer flex justify-between items-center hover:border-[var(--primary)]/60 transition-colors"
            >
              <span className={selectedPatient ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                {selectedPatient
                  ? `${selectedPatient.firstName} ${selectedPatient.lastName} (${selectedPatient.email || 'No Email'})`
                  : 'Search or select patient...'}
              </span>
              <span className="text-[10px] text-muted-foreground">▼</span>
            </div>

            {dropdownOpen && (
              <div className="absolute z-10 mt-1.5 w-full bg-card border border-border/70 rounded-xl shadow-lg max-h-[220px] overflow-hidden flex flex-col animate-fade-in">
                {/* Search field */}
                <div className="relative p-2 border-b border-border/40 shrink-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search name or email..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-border/60 bg-card/50 text-foreground outline-none focus:border-[var(--primary)] transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Patient list */}
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                  {filteredPatients.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">No matching patients found.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          onOnboardClick();
                        }}
                        className="mt-2 text-xs font-semibold text-[var(--primary-text)] hover:underline flex items-center gap-1 mx-auto bg-transparent border-0 cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" />
                        Onboard new patient
                      </button>
                    </div>
                  ) : (
                    filteredPatients.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedPatientId(p.id);
                          setDropdownOpen(false);
                        }}
                        className={`p-3 text-xs cursor-pointer transition-colors border-b border-border/10 last:border-0 flex justify-between items-center ${
                          selectedPatientId === p.id
                            ? 'bg-[var(--primary)]/15 text-foreground font-semibold'
                            : 'hover:bg-border/20 text-foreground'
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{p.firstName} {p.lastName}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{p.email || 'No Email'}</p>
                        </div>
                        {p.dateOfBirth && (
                          <span className="text-[9px] text-muted-foreground bg-border/20 px-1.5 py-0.5 rounded">
                            {new Date(p.dateOfBirth).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* PDF Upload Area */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Diagnostic Lab Report (PDF)
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf"
              className="hidden"
            />

            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 scale-[1.01]'
                  : selectedFile
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-border/60 hover:border-[var(--primary)]/60 hover:bg-border/10'
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="flex flex-col items-center gap-1.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  <p className="text-xs font-semibold text-foreground truncate max-w-[280px]">
                    {selectedFile.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {((selectedFile.size || 0) / (1024 * 1024)).toFixed(2)} MB · Click to replace
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Drag and drop your clinical PDF report here
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      or browse your local system files (PDF only, max 20MB)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-border hover:bg-border/20 text-muted-foreground transition-all cursor-pointer text-center bg-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !selectedPatientId || !selectedFile}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
              style={{ background: 'var(--primary-text)' }}
            >
              {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Upload & Parse Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
