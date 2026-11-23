import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Main: undefined;
  /** `fly` : ouverte depuis une carte du catalogue, la photo fait la transition. */
  Product: { id: string; fly?: boolean };
  Checkout: undefined;
  /** Professionnels : finalisation d'une demande, sans paiement. */
  Request: undefined;
  Success: { orderId?: string; requestId?: string };
  Credits: undefined;
};

export type Nav = NativeStackNavigationProp<RootStackParamList>;
