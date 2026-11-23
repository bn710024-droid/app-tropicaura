import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ZoomIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import type { Photo } from './data';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from '../components/Tap';
import { C, F, R, shadow } from './theme';
import { DESKTOP_BAR, useFrame } from './useFrame';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Toast = {
  key: number;
  message: string;
  icon: IconName;
  tint: string;
  /** Photo du produit concerné : on voit tout de suite de quoi parle le message. */
  image?: Photo;
  action?: { label: string; onPress: () => void };
};
type ShowOptions = {
  icon?: IconName;
  tint?: string;
  image?: Photo;
  action?: Toast['action'];
};

const Ctx = createContext<(message: string, options?: ShowOptions) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { top, width, desktop } = useFrame();

  const show = useCallback((message: string, options?: ShowOptions) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({
      key: Date.now(),
      message,
      icon: options?.icon ?? 'checkmark-circle',
      tint: options?.tint ?? C.leaf,
      image: options?.image,
      action: options?.action,
    });
    // Un message avec un bouton reste plus longtemps : on a le temps de le toucher.
    timer.current = setTimeout(() => setToast(null), options?.action ? 4600 : 2400);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Écran étroit : le bouton passe sous le message plutôt que de l'écraser.
  const stacked = !!toast?.action && width < 360;

  return (
    <Ctx.Provider value={show}>
      {children}
      <View style={[styles.host, { top: desktop ? DESKTOP_BAR + 18 : top + 58 }]}>
        {toast && (
          <Animated.View
            key={toast.key}
            entering={FadeInUp.springify().damping(17).stiffness(220)}
            exiting={FadeOutUp.duration(180)}
            style={[styles.toast, stacked && styles.toastStacked, shadow(12, 30, 0.55)]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <View style={styles.main}>
              {toast.image ? (
                <View style={styles.thumb}>
                  <Image
                    source={toast.image}
                    style={styles.thumbImage}
                    contentFit="contain"
                    accessible={false}
                  />
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={11} color={C.onLeaf} />
                  </View>
                </View>
              ) : (
                <Ionicons name={toast.icon} size={20} color={toast.tint} />
              )}
              <Text style={styles.message} numberOfLines={3}>
                {toast.message}
              </Text>
            </View>
            {toast.action && (
              <Animated.View
                entering={ZoomIn.delay(160).springify().damping(12).stiffness(240)}
                style={stacked && { alignSelf: 'flex-end' }}
              >
                <Pressable
                  onPress={() => {
                    toast.action?.onPress();
                    setToast(null);
                  }}
                  hitSlop={8}
                  scaleTo={0.92}
                  accessibilityRole="button"
                  accessibilityLabel={toast.action.label}
                  style={styles.action}
                >
                  <Text style={styles.actionText} numberOfLines={1}>
                    {toast.action.label}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={C.onLeaf} />
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
        )}
      </View>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 14,
    right: 14,
    alignItems: 'center',
    pointerEvents: 'box-none',
    zIndex: 50,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '100%',
    backgroundColor: '#20261A',
    borderWidth: 1,
    borderColor: C.lineStrong,
    borderRadius: 24,
    paddingLeft: 10,
    paddingRight: 10,
    paddingVertical: 9,
  },
  toastStacked: { flexDirection: 'column', alignItems: 'stretch', paddingRight: 12 },
  main: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 4 },
  thumb: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -4 },
  thumbImage: { width: 38, height: 38 },
  check: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
    borderWidth: 2,
    borderColor: '#20261A',
  },
  message: {
    flexShrink: 1,
    color: C.text,
    fontFamily: F.semi,
    fontSize: 14,
    lineHeight: 19,
    paddingRight: 4,
  },
  action: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: R.pill,
    backgroundColor: C.leaf,
  },
  actionText: { color: C.onLeaf, fontFamily: F.heavy, fontSize: 13.5 },
});
