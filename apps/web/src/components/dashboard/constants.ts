import { Droplet, Heart, Brain } from 'lucide-react';
import type { AppointmentRecord, TaskRecord } from '@/types/dashboard';

export const STATUS_COLORS = {
  NORMAL: {
    text: '#1A9966', // Teal-green
    bg: 'rgba(26, 153, 102, 0.1)',
    border: 'rgba(26, 153, 102, 0.2)',
  },
  LOW: {
    text: '#C97D0A', // Amber
    bg: 'rgba(201, 125, 10, 0.1)',
    border: 'rgba(201, 125, 10, 0.2)',
  },
  HIGH: {
    text: '#F04E14', // Orange-red
    bg: 'rgba(240, 78, 20, 0.1)',
    border: 'rgba(240, 78, 20, 0.2)',
  },
  CRITICAL: {
    text: '#D41717', // Deep red
    bg: 'rgba(212, 23, 23, 0.1)',
    border: 'rgba(212, 23, 23, 0.2)',
  },
} as const;

export const CATEGORY_ICONS: Record<string, any> = {
  Metabolic: Droplet,
  'Lipid Panel': Heart,
  CBC: Droplet,
  Thyroid: Brain,
};

// Task priority → accent color
export const PRIORITY_COLORS: Record<TaskRecord['priority'], string> = {
  HIGH: '#F04E14',
  MEDIUM: '#C97D0A',
  LOW: '#1A9966',
};

// Appointment status → badge palette
export const APPT_STATUS_COLORS: Record<AppointmentRecord['status'], { text: string; bg: string }> = {
  SCHEDULED: { text: 'var(--primary-text)', bg: 'var(--primary-glow)' },
  COMPLETED: { text: '#1A9966', bg: 'rgba(26, 153, 102, 0.12)' },
  CANCELLED: { text: '#D41717', bg: 'rgba(212, 23, 23, 0.12)' },
  NO_SHOW: { text: '#C97D0A', bg: 'rgba(201, 125, 10, 0.12)' },
};
