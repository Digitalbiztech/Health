import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface OnboardingContextType {
  hasSeenWelcome: boolean;
  tourCompleted: boolean;
  sampleReportViewed: boolean;
  showWelcomeModal: boolean;
  setShowWelcomeModal: (show: boolean) => void;
  dismissWelcome: () => void;
  completeTour: () => void;
  markSampleViewed: () => void;
  resetOnboarding: () => void;
}

const WELCOME_KEY = 'onboarding-welcome-seen';
const TOUR_KEY = 'onboarding-tour-completed';
const SAMPLE_KEY = 'onboarding-sample-viewed';

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean>(false);
  const [tourCompleted, setTourCompleted] = useState<boolean>(false);
  const [sampleReportViewed, setSampleReportViewed] = useState<boolean>(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(false);

  useEffect(() => {
    const welcome = localStorage.getItem(WELCOME_KEY) === 'true';
    const tour = localStorage.getItem(TOUR_KEY) === 'true';
    const sample = localStorage.getItem(SAMPLE_KEY) === 'true';

    setHasSeenWelcome(welcome);
    setTourCompleted(tour);
    setSampleReportViewed(sample);

    // If welcome has not been seen, show modal
    if (!welcome) {
      setShowWelcomeModal(true);
    }
  }, []);

  const dismissWelcome = () => {
    localStorage.setItem(WELCOME_KEY, 'true');
    setHasSeenWelcome(true);
    setShowWelcomeModal(false);
  };

  const completeTour = () => {
    localStorage.setItem(TOUR_KEY, 'true');
    setTourCompleted(true);
  };

  const markSampleViewed = () => {
    localStorage.setItem(SAMPLE_KEY, 'true');
    setSampleReportViewed(true);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(WELCOME_KEY);
    localStorage.removeItem(TOUR_KEY);
    localStorage.removeItem(SAMPLE_KEY);
    setHasSeenWelcome(false);
    setTourCompleted(false);
    setSampleReportViewed(false);
    setShowWelcomeModal(true);
  };

  return (
    <OnboardingContext.Provider
      value={{
        hasSeenWelcome,
        tourCompleted,
        sampleReportViewed,
        showWelcomeModal,
        setShowWelcomeModal,
        dismissWelcome,
        completeTour,
        markSampleViewed,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
