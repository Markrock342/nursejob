import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';

interface UseTabRefreshOptions {
  scrollToTop?: () => void;
  beforeRefreshMs?: number;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useTabRefresh(
  onRefresh: () => void | Promise<void>,
  options?: UseTabRefreshOptions,
) {
  const navigation = useNavigation<any>();
  const onRefreshRef = useRef(onRefresh);
  const scrollToTopRef = useRef(options?.scrollToTop);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    scrollToTopRef.current = options?.scrollToTop;
  }, [options?.scrollToTop]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      void (async () => {
        scrollToTopRef.current?.();
        await wait(options?.beforeRefreshMs ?? 120);
        await onRefreshRef.current();
      })();
    });

    return unsubscribe;
  }, [navigation, options?.beforeRefreshMs]);
}