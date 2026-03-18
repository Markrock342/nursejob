import { useEffect, useState } from 'react';
import { subscribeOnboardingSurveyAdminSettings } from '../services/onboardingSurveyService';

export function useOnboardingSurveyEnabled() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeOnboardingSurveyAdminSettings((settings) => {
      setEnabled(settings.surveyEnabled !== false);
    });
    return unsubscribe;
  }, []);

  return enabled;
}