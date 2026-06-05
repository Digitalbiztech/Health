import { useEffect, useRef, useCallback } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_STORAGE_KEY = 'patient-dashboard-tour-completed';

const tourSteps: DriveStep[] = [
  {
    element: '#tour-profile-card',
    popover: {
      title: '👋 Welcome to Your Dashboard',
      description:
        'This is your personal health hub. Here you can see your profile information and quickly access all your health data.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#tour-upload-btn',
    popover: {
      title: '📄 Upload Lab Reports',
      description:
        'Click here to upload your blood work PDF. Our AI will automatically extract and analyze all your biomarkers.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#tour-stats-section',
    popover: {
      title: '📊 Your Health Stats at a Glance',
      description:
        'Get a quick overview of your total reports, analyzed results, processing status, and how many of your markers are within normal range.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#tour-health-snapshot',
    popover: {
      title: '💚 Health Snapshot',
      description:
        'This card gives you a quick summary — balanced markers, flagged markers, and AI-generated recommendations from your latest lab report.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '#tour-ai-summary',
    popover: {
      title: '✨ AI-Powered Insights',
      description:
        'Our AI engine analyzes your lab results and provides personalized summary points to help you understand your health better.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '#tour-report-history',
    popover: {
      title: '📋 Lab Report History',
      description:
        'All your uploaded lab reports are listed here. You can track their processing status, view the original PDF, or review the AI-analyzed results.',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '#tour-report-review-btn',
    popover: {
      title: '🔬 Review Analyzed Report',
      description:
        'Once a report is analyzed, click "Review" to dive into the full biomarker dashboard with visual ranges, trend charts, and detailed insights.',
      side: 'left',
      align: 'center',
    },
  },
];

export function usePatientTour() {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  const startTour = useCallback(() => {
    // Filter steps to only include those whose elements exist in the DOM
    const availableSteps = tourSteps.filter((step) => {
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
      doneBtnText: 'Got it! ✓',
      onDestroyed: () => {
        localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      },
    });

    driverRef.current = driverInstance;
    driverInstance.drive();
  }, []);

  // Auto-start on first visit (only once)
  useEffect(() => {
    const hasCompletedTour = localStorage.getItem(TOUR_STORAGE_KEY);
    if (hasCompletedTour) return;

    // Small delay to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      startTour();
    }, 800);

    return () => {
      clearTimeout(timer);
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, [startTour]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    startTour();
  }, [startTour]);

  return { startTour: resetTour };
}
