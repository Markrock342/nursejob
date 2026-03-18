import { useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  recordScreenRender,
  startScreenPerformanceSession,
} from '../services/performanceMetrics';

export function useScreenPerformance(screenName: string): void {
  useFocusEffect(
    useCallback(() => startScreenPerformanceSession(screenName), [screenName])
  );

  useEffect(() => {
    recordScreenRender(screenName);
  });
}