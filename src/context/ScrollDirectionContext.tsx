import React, { createContext, useContext, useRef, useCallback } from 'react';
import { Animated } from 'react-native';

interface ScrollDirectionContextValue {
  tabBarHidden: Animated.Value;
  headerCollapsed: Animated.Value;
  onScrollForward: () => void;
  onScrollBack: () => void;
}

const ScrollDirectionContext = createContext<ScrollDirectionContextValue | null>(null);

export function ScrollDirectionProvider({ children }: { children: React.ReactNode }) {
  const tabBarHidden = useRef(new Animated.Value(0)).current;
  const headerCollapsed = useRef(new Animated.Value(0)).current;
  const isHiddenRef = useRef(false);

  const onScrollForward = useCallback(() => {
    if (isHiddenRef.current) return;
    isHiddenRef.current = true;
    Animated.parallel([
      Animated.timing(tabBarHidden, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(headerCollapsed, { toValue: 1, duration: 220, useNativeDriver: false }),
    ]).start();
  }, [tabBarHidden, headerCollapsed]);

  const onScrollBack = useCallback(() => {
    if (!isHiddenRef.current) return;
    isHiddenRef.current = false;
    Animated.parallel([
      Animated.timing(tabBarHidden, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(headerCollapsed, { toValue: 0, duration: 220, useNativeDriver: false }),
    ]).start();
  }, [tabBarHidden, headerCollapsed]);

  return (
    <ScrollDirectionContext.Provider
      value={{ tabBarHidden, headerCollapsed, onScrollForward, onScrollBack }}
    >
      {children}
    </ScrollDirectionContext.Provider>
  );
}

export function useScrollDirection() {
  const ctx = useContext(ScrollDirectionContext);
  if (!ctx) throw new Error('useScrollDirection must be inside ScrollDirectionProvider');
  return ctx;
}
