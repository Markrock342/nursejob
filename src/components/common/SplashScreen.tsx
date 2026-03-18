// ============================================
// NURSEGO SPLASH SCREEN — Animated 3-second splash
// ============================================
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// ─── Pulse Ring ──────────────────────────────
function PulseRing({ delay, size }: { delay: number; size: number }) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.5, duration: 1400, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.8, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

// ─── Main Splash ─────────────────────────────
export default function SplashScreen() {
  // Animations
  const logoScale    = useRef(new Animated.Value(0.5)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const titleSlide   = useRef(new Animated.Value(30)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const tagSlide     = useRef(new Animated.Value(20)).current;
  const tagOpacity   = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Step 1 — Logo pop in (0ms)
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 70,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Step 2 — Title slide up (300ms)
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(titleSlide, { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 300);

    // Step 3 — Tagline (600ms)
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(tagSlide, { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.timing(tagOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 600);

    // Step 4 — Badge (900ms)
    setTimeout(() => {
      Animated.timing(badgeOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 900);

    // Step 5 — Progress bar (fills over 2.5s)
    setTimeout(() => {
      Animated.timing(progressWidth, {
        toValue: width - 80,
        duration: 2500,
        useNativeDriver: false, // width animation can't use native driver
      }).start();
    }, 100);
  }, []);

  return (
    <View style={styles.container}>
      {/* Decorative background circles */}
      <View style={[styles.bgCircle, styles.bgCircle1]} />
      <View style={[styles.bgCircle, styles.bgCircle2]} />
      <View style={[styles.bgCircle, styles.bgCircle3]} />

      {/* Center content */}
      <View style={styles.center}>
        {/* Pulse rings */}
        <PulseRing delay={0}   size={160} />
        <PulseRing delay={500} size={200} />

        {/* Logo circle */}
        <Animated.View
          style={[
            styles.logoCircle,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <Ionicons name="medical" size={56} color="#FDE047" />
        </Animated.View>

        {/* App name */}
        <Animated.Text
          style={[
            styles.title,
            { opacity: titleOpacity, transform: [{ translateY: titleSlide }] },
          ]}
        >
          NurseGo
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text
          style={[
            styles.tagline,
            { opacity: tagOpacity, transform: [{ translateY: tagSlide }] },
          ]}
        >
          หางานพยาบาล ง่ายกว่าเดิม
        </Animated.Text>

        {/* Badge */}
        <Animated.View style={[styles.badge, { opacity: badgeOpacity }]}>
          <Ionicons name="shield-checkmark" size={12} color="#0EA5E9" />
          <Text style={styles.badgeText}>งานพยาบาลใกล้บ้านคุณ</Text>
        </Animated.View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
        </View>
        <Text style={styles.footerText}>กำลังเตรียมแอป...</Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0284C7', // deeper sky blue
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Decorative BG circles
  bgCircle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  bgCircle1: { width: 400, height: 400, top: -120, left: -100 },
  bgCircle2: { width: 300, height: 300, bottom: -60, right: -80 },
  bgCircle3: { width: 180, height: 180, top: '40%', right: -60 },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pulse ring
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  // Logo circle
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
    marginBottom: 24,
  },

  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 8,
  },

  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '400',
    marginBottom: 16,
    letterSpacing: 0.3,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 60,
    left: 40,
    right: 40,
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 3,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
});
