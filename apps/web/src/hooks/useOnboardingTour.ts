import { useRef, useCallback } from 'react';
import { driver, type DriveStep } from 'driver.js';
import { useOnboarding } from '@/contexts/OnboardingContext';
import 'driver.js/dist/driver.css';

const TOUR_STORAGE_KEY = 'onboarding-tour-completed';

const patientHomeSteps: DriveStep[] = [
  {
    element: '#tour-upload-btn',
    popover: {
      title: '📄 Step 1 — Upload Report',
      description:
        'Upload your blood test PDF here. The platform extracts and structures your biomarker data in under 2 minutes.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#tour-health-snapshot',
    popover: {
      title: '📊 Step 2 — Health Snapshot',
      description:
        'Monitor your overall health scores (e.g. Cardiovascular, Metabolic, Inflammation) and a quick breakdown of your biomarker statuses.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '#tour-ai-summary',
    popover: {
      title: '✨ Step 3 — AI Key Findings',
      description:
        'Get a patient-friendly summary of the key findings from your blood work. (Note: AI never alters your original lab values).',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '#tour-report-history',
    popover: {
      title: '📋 Step 4 — Report History',
      description:
        'Track all your uploaded lab reports here. You can see their processing status and download the original PDFs.',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '#tour-report-review-btn',
    popover: {
      title: '🔍 Step 5 — Detailed Review',
      description:
        'Click the "Review" button on this sample report card to open the interactive, full-featured Report Dashboard!',
      side: 'left',
      align: 'center',
    },
  },
];

const patientReportSteps: DriveStep[] = [
  {
    element: '#report-tour-banner',
    popover: {
      title: '📋 Step 1 — Sample Report Mode',
      description:
        'You are currently viewing a Sample Report. Click "Upload Now" at any time to upload and analyze your own laboratory PDF.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#report-tour-summary',
    popover: {
      title: '✨ Step 2 — Clinical Summary',
      description:
        'View overall health scores, summary categories (normal, borderline, high), and key clinical findings extracted from the report.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#report-tour-biomarkers',
    popover: {
      title: '📊 Step 3 — Biomarker Breakdown',
      description:
        'Explore your detailed blood values. Expand any row to see standard reference ranges, educational descriptions, and recommendations.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#report-tab-btn-trends',
    popover: {
      title: '📈 Step 4 — Historical Trends',
      description:
        'View chronological trend lines for each biomarker across multiple historical lab results to monitor changes over time.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#report-tab-btn-ai-chat',
    popover: {
      title: '💬 Step 5 — AI Clinical Care',
      description:
        'Chat directly with our HIPAA-compliant AI medical assistant to ask clinical questions, translate medical jargon, or plan care.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#report-tab-btn-compare',
    popover: {
      title: '🔄 Step 6 — Report Comparison',
      description:
        'Compare two lab reports side-by-side. Highlight values that increased, decreased, or remained stable.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#help-drawer-trigger',
    popover: {
      title: '❓ Step 7 — Help & FAQs',
      description:
        'Need assistance or want to restart this tour later? You can access help, reset onboarding, or view FAQs here at any time.',
      side: 'left',
      align: 'end',
    },
  },
];

const staffSteps: DriveStep[] = [
  {
    element: '#clinician-tour-nav',
    popover: {
      title: '🧭 Step 1 — Clinician Navigation',
      description:
        'Quickly toggle between the clinical Overview, Patients Directory, Appointments, and Organization Activity feed.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '#clinician-tour-stats',
    popover: {
      title: '📈 Step 2 — Dashboard Stats',
      description:
        'Monitor registered patients, total lab reports, processing queue, and failed extractions at a glance.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#clinician-tour-patients',
    popover: {
      title: '👥 Step 3 — Patients Directory',
      description:
        'Browse and search your patient directory, view their intake notes, uploaded reports, and clinical insights.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#clinician-tour-onboard',
    popover: {
      title: '➕ Step 4 — Onboard Patient',
      description:
        'Click here to register a new patient by entering their contact details, demographic info, and initial intake notes.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#clinician-tour-upload',
    popover: {
      title: '📝 Step 5 — Upload Lab PDF',
      description:
        'Click here to upload a patient\'s lab PDF for processing.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#clinician-tour-tasks',
    popover: {
      title: '📝 Step 6 — Task Management',
      description:
        'Track and prioritize your daily clinical tasks, set due dates, and tie them to patient files.',
      side: 'left',
      align: 'start',
    },
  },
];

export function useOnboardingTour(role: 'PATIENT_HOME' | 'PATIENT_REPORT' | 'STAFF') {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const { completeTour } = useOnboarding();

  const startTour = useCallback(() => {
    const steps = role === 'STAFF' ? staffSteps :
                  role === 'PATIENT_HOME' ? patientHomeSteps :
                  patientReportSteps;

    // Filter steps to only include those whose elements exist in the DOM (skip filtering for STAFF role so we can transition tabs dynamically)
    const availableSteps = role === 'STAFF' ? steps : steps.filter((step) => {
      if (!step.element) return true;
      return document.querySelector(step.element as string) !== null;
    });

    if (availableSteps.length === 0) return;

    const driverInstance = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: 'rgba(0, 0, 0, 0.65)',
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: 'patient-tour-popover',
      steps: availableSteps,
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: role === 'PATIENT_HOME' ? 'Next Phase →' : 'Finish Tour ✓',
      onNextClick: (_element, _step, { driver: inst }) => {
        const activeIndex = inst.getActiveIndex();
        if (activeIndex === undefined) {
          inst.moveNext();
          return;
        }

        if (role === 'STAFF' && activeIndex === 1) {
          // Stats (Overview) -> Patients tab
          const patTab = document.getElementById('clinician-nav-item-patients');
          if (patTab) {
            (patTab as HTMLButtonElement).click();
          }
          setTimeout(() => {
            inst.moveNext();
          }, 150);
          return;
        }

        if (role === 'PATIENT_REPORT') {
          const currentStep = availableSteps[activeIndex];
          const nextStep = availableSteps[activeIndex + 1];

          if (nextStep) {
            if (nextStep.element === '#report-tab-btn-trends') {
              const tab = document.getElementById('report-tab-btn-trends');
              if (tab) (tab as HTMLButtonElement).click();
            } else if (nextStep.element === '#report-tab-btn-ai-chat') {
              const tab = document.getElementById('report-tab-btn-ai-chat');
              if (tab) (tab as HTMLButtonElement).click();
            } else if (nextStep.element === '#report-tab-btn-compare') {
              const tab = document.getElementById('report-tab-btn-compare');
              if (tab) (tab as HTMLButtonElement).click();
            } else if (currentStep?.element === '#report-tab-btn-compare') {
              // Leaving Compare tab step, switch back to Current Report tab
              const tab = document.getElementById('report-tab-btn-current');
              if (tab) (tab as HTMLButtonElement).click();
            }
          }
        }

        if (role === 'PATIENT_HOME' && inst.isLastStep()) {
          sessionStorage.setItem('active-onboarding-tour', 'PATIENT_REPORT');
          const btn = document.getElementById('tour-report-review-btn');
          if (btn) {
            (btn as HTMLButtonElement).click();
          }
          inst.destroy();
        } else {
          inst.moveNext();
        }
      },
      onPrevClick: (_element, _step, { driver: inst }) => {
        const activeIndex = inst.getActiveIndex();
        if (activeIndex === undefined) {
          inst.movePrevious();
          return;
        }

        if (role === 'STAFF' && activeIndex === 2) {
          // Patients tab -> Overview tab
          const overviewTab = document.getElementById('clinician-nav-item-overview');
          if (overviewTab) {
            (overviewTab as HTMLButtonElement).click();
          }
          setTimeout(() => {
            inst.movePrevious();
          }, 150);
          return;
        }

        if (role === 'PATIENT_REPORT') {
          const currentStep = availableSteps[activeIndex];
          const prevStep = availableSteps[activeIndex - 1];

          if (prevStep) {
            if (prevStep.element === '#report-tab-btn-trends') {
              const tab = document.getElementById('report-tab-btn-trends');
              if (tab) (tab as HTMLButtonElement).click();
            } else if (prevStep.element === '#report-tab-btn-ai-chat') {
              const tab = document.getElementById('report-tab-btn-ai-chat');
              if (tab) (tab as HTMLButtonElement).click();
            } else if (prevStep.element === '#report-tab-btn-compare') {
              const tab = document.getElementById('report-tab-btn-compare');
              if (tab) (tab as HTMLButtonElement).click();
            } else if (currentStep?.element === '#report-tab-btn-trends') {
              // Going back from Trends tab step, switch back to Current Report tab
              const tab = document.getElementById('report-tab-btn-current');
              if (tab) (tab as HTMLButtonElement).click();
            }
          }
        }

        inst.movePrevious();
      },
      onDestroyed: () => {
        if (sessionStorage.getItem('active-onboarding-tour') !== 'PATIENT_REPORT') {
          sessionStorage.removeItem('active-onboarding-tour');
        }
        completeTour();
        localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      },
    });

    driverRef.current = driverInstance;
    driverInstance.drive();
  }, [role, completeTour]);

  return { startTour };
}
