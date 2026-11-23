import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_300Light_Italic } from '@expo-google-fonts/fraunces/300Light_Italic';
import { Fraunces_900Black_Italic } from '@expo-google-fonts/fraunces/900Black_Italic';
import { BigShoulders_700Bold } from '@expo-google-fonts/big-shoulders/700Bold';
import { BigShoulders_900Black } from '@expo-google-fonts/big-shoulders/900Black';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import {
  DarkTheme,
  NavigationContainer,
  StackActions,
  Theme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DesktopBar } from './components/DesktopBar';
import type { RootStackParamList } from './lib/navigation';
import { StoreProvider, TabId, useStore } from './lib/store';
import { DESKTOP_MIN, useFrame } from './lib/useFrame';
import { FlightProvider } from './lib/flight';
import { C, CLIP, MAX_WIDTH } from './lib/theme';
import { ToastProvider } from './lib/toast';
import { AuthScreen } from './screens/AuthScreen';
import { CheckoutScreen } from './screens/CheckoutScreen';
import { CreditsScreen } from './screens/CreditsScreen';
import { MainScreen } from './screens/MainScreen';
import { ProductScreen } from './screens/ProductScreen';
import { RequestScreen } from './screens/RequestScreen';
import { SuccessScreen } from './screens/SuccessScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigation = createNavigationContainerRef<RootStackParamList>();

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: C.bg,
    card: C.bg,
    text: C.text,
    primary: C.leaf,
    border: 'transparent',
  },
};

/** Sans compte ouvert, l'application s'arrête à l'inscription ; ensuite, elle s'ouvre en entier. */
function Root() {
  const { hydrated, account, setTab } = useStore();
  const { desktop } = useFrame();
  if (!hydrated) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  // Ordinateur : la barre du haut reste en place ; choisir une destination referme la page
  // ouverte par-dessus (fiche produit, commande…) et affiche l'onglet demandé.
  const go = (tab: TabId) => {
    setTab(tab);
    if (navigation.isReady() && navigation.canGoBack())
      navigation.dispatch(StackActions.popToTop());
  };

  if (!account) {
    return (
      <>
        {desktop && <DesktopBar />}
        <AuthScreen />
      </>
    );
  }
  return (
    <>
      {desktop && <DesktopBar onNavigate={go} />}
      <View style={{ flex: 1 }}>{stack(account.id)}</View>
    </>
  );
}

function stack(accountId: string) {
  return (
    <NavigationContainer
      key={accountId}
      ref={navigation}
      theme={theme}
      documentTitle={{ formatter: () => 'Primeur — fruits & légumes du Sénégal et d’Afrique' }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Main" component={MainScreen} />
        <Stack.Screen
          name="Product"
          component={ProductScreen}
          // Ouverte depuis une carte, la fiche apparaît en fondu : sa photo arrive de la carte.
          options={({ route }) => ({ animation: route.params.fly ? 'fade' : 'slide_from_right' })}
        />
        <Stack.Screen
          name="Checkout"
          component={CheckoutScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Request"
          component={RequestScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Success"
          component={SuccessScreen}
          options={{ animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen name="Credits" component={CreditsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  // Polices d'icônes préchargées : indispensable pour leur affichage sur le web.
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    Fraunces_600SemiBold,
    Fraunces_300Light_Italic,
    Fraunces_900Black_Italic,
    BigShoulders_700Bold,
    BigShoulders_900Black,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // Écran plus large que la colonne de l'application (tablette, ordinateur) : les bords de la
  // colonne se fondent dans le fond, sans bande ni coupure.
  const { width: windowWidth } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && windowWidth >= DESKTOP_MIN;
  const wide = !desktop && windowWidth > MAX_WIDTH;

  if (!fontsLoaded) {
    return <View style={styles.outer} />;
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <View style={styles.outer}>
          <View style={[styles.frame, desktop && styles.frameDesktop]}>
            <StoreProvider>
              <ToastProvider>
                <FlightProvider>
                  <Root />
                </FlightProvider>
              </ToastProvider>
            </StoreProvider>
            {wide && (
              <>
                <LinearGradient
                  colors={[C.bg, 'rgba(11,14,9,0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.edge, { left: 0 }]}
                />
                <LinearGradient
                  colors={['rgba(11,14,9,0)', C.bg]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.edge, { right: 0 }]}
                />
              </>
            )}
          </View>
        </View>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  outer: { flex: 1, backgroundColor: C.bg, alignItems: 'center', ...CLIP },
  // Ordinateur : l'application occupe toute la fenêtre, sous sa barre de navigation.
  frameDesktop: { maxWidth: undefined },
  edge: { position: 'absolute', top: 0, bottom: 0, width: 18, zIndex: 60, pointerEvents: 'none' },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_WIDTH,
    backgroundColor: C.bg,
    ...CLIP,
  },
});
