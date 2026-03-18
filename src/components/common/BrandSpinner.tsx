import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS } from '../../theme';

interface BrandSpinnerProps {
  size?: number;
  color?: string;
  label?: string;
  style?: ViewStyle;
}

export default function BrandSpinner({
  size = 56,
  color = '#FDE047',
  label,
  style,
}: BrandSpinnerProps) {
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.12,
            duration: 550,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 550,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse, rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.starWrap,
          {
            width: size,
            height: size,
            transform: [{ rotate: spin }, { scale: pulse }],
          },
        ]}
      >
        <Text
          style={[
            styles.star,
            {
              color,
              fontSize: size,
              lineHeight: size,
              textShadowColor: 'rgba(253, 224, 71, 0.35)',
            },
          ]}
        >
          *
        </Text>
      </Animated.View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  starWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
  },
  label: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});