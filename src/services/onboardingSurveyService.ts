import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const APP_CONFIG_COLLECTION = 'app_config';
const ONBOARDING_SURVEY_DOC = 'onboarding_survey';
const ONBOARDING_SURVEY_REF = doc(db, APP_CONFIG_COLLECTION, ONBOARDING_SURVEY_DOC);

export interface OnboardingSurveyAdminSettings {
  surveyEnabled: boolean;
  updatedAt?: Date | null;
  updatedBy?: string | null;
}

function parseSettings(data: any): OnboardingSurveyAdminSettings {
  return {
    surveyEnabled: data?.surveyEnabled !== false,
    updatedAt: typeof data?.updatedAt?.toDate === 'function' ? data.updatedAt.toDate() : null,
    updatedBy: data?.updatedBy || null,
  };
}

export async function getOnboardingSurveyAdminSettings(): Promise<OnboardingSurveyAdminSettings> {
  try {
    const snapshot = await getDoc(ONBOARDING_SURVEY_REF);
    if (!snapshot.exists()) {
      return { surveyEnabled: true };
    }
    return parseSettings(snapshot.data());
  } catch (error) {
    console.warn('[onboardingSurveyService] unable to load settings, falling back to enabled');
    return { surveyEnabled: true };
  }
}

export function subscribeOnboardingSurveyAdminSettings(
  callback: (settings: OnboardingSurveyAdminSettings) => void
): () => void {
  return onSnapshot(
    ONBOARDING_SURVEY_REF,
    (snapshot) => {
      callback(snapshot.exists() ? parseSettings(snapshot.data()) : { surveyEnabled: true });
    },
    () => callback({ surveyEnabled: true })
  );
}

export async function updateOnboardingSurveyEnabled(
  updatedBy: string,
  surveyEnabled: boolean,
): Promise<void> {
  await setDoc(
    ONBOARDING_SURVEY_REF,
    {
      surveyEnabled,
      updatedBy,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}