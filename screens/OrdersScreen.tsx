import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '../components/Tap';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EmptyState } from '../components/EmptyState';
import { PAGE_SCROLL } from '../components/PageSwipe';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { TabHeader } from '../components/TabHeader';
import { TrackCard } from '../components/TrackCard';
import { TEST_TOOLS } from '../lib/config';
import { euro, formatDate, requestLineText } from '../lib/format';
import type { Nav } from '../lib/navigation';
import { Order, ProRequest, orderView, requestView, useStore } from '../lib/store';
import { C, F, PAD } from '../lib/theme';
import { useToast } from '../lib/toast';
import { useFrame } from '../lib/useFrame';

const plural = (n: number) => `${n} produit${n > 1 ? 's' : ''}`;

export function OrdersScreen() {
  const nav = useNavigation<Nav>();
  const { isPro, orders, requests, byId, baseById, reorder, setTab, advanceOrder, advanceRequest } =
    useStore();
  const toast = useToast();
  const { bottom } = useFrame();

  // Professionnels : seules les demandes prises en charge par l'équipe sont des commandes.
  const taken = requests.filter((r) => r.takenAt !== null);
  const count = isPro ? taken.length : orders.length;

  // Une ligne « mangue:avion » ouvre la fiche du produit « mangue ».
  const open = (id: string) => {
    const productId = id.split(':')[0];
    if (byId[productId]) nav.navigate('Product', { id: productId });
  };

  const again = (lines: Order['lines']) => {
    reorder(lines);
    toast(isPro ? 'Produits ajoutés à votre demande en cours' : 'Produits ajoutés à votre panier', {
      action: { label: 'Voir', onPress: () => setTab('cart') },
    });
  };

  const footer = (
    <>
      {TEST_TOOLS && count > 0 && (
        <Text style={styles.testNote}>
          Mode test : le logiciel de notre équipe n’est pas encore connecté. Le bouton « simuler
          l’étape suivante » joue son rôle pour parcourir le suivi.
          {isPro ? '' : ' Paiement simulé : rien n’est prélevé.'}
        </Text>
      )}
      <Pressable
        onPress={() => nav.navigate('Credits')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.credits, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="information-circle-outline" size={17} color={C.textDim} />
        <Text style={styles.creditsText}>Crédits photo et licences</Text>
      </Pressable>
    </>
  );

  const shared = {
    style: PAGE_SCROLL,
    showsVerticalScrollIndicator: false,
    contentContainerStyle: { paddingBottom: TAB_BAR_SPACE + bottom + 16, flexGrow: 1 },
    ListFooterComponent: footer,
  };

  if (isPro) {
    return (
      <FlatList<ProRequest>
        {...shared}
        data={taken}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={
          <TabHeader
            title="Mes"
            accent="commandes"
            subtitle={count > 0 ? 'Demandes prises en charge par notre équipe' : undefined}
          />
        }
        renderItem={({ item }) => (
          <TrackCard
            title={`Commande ${item.number}`}
            date={formatDate(item.createdAt)}
            view={requestView(item)}
            messageLabel="Suivi"
            info={[
              {
                icon: 'pricetag-outline',
                text: `Prix ${item.incoterm}${item.destination ? ` · destination : ${item.destination}` : ''}`,
              },
            ]}
            lines={item.lines.map((l) =>
              requestLineText(l, baseById[l.id.split(':')[0]]?.name ?? l.id),
            )}
            lineIds={item.lines.map((l) => l.id)}
            totalOver={`Estimation ${item.incoterm}${item.unpriced ? ` · hors ${item.unpriced} ligne${item.unpriced > 1 ? 's' : ''} sans prix` : ''}\nPaiement hors application`}
            total={euro(item.subtotal)}
            action={{ label: 'Renouveler', icon: 'refresh', onPress: () => again(item.lines) }}
            onOpenProduct={open}
            onTest={() => advanceRequest(item.id)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Aucune commande en cours"
            body="Une demande passe ici dès que notre équipe l’a confirmée avec vous. En attendant, elle reste dans « Demandes »."
            cta="Voir mes demandes"
            onPress={() => setTab('requests')}
            image={require('../assets/produce/mangue.webp')}
            tint="#A8801C"
          />
        }
      />
    );
  }

  return (
    <FlatList<Order>
      {...shared}
      data={orders}
      keyExtractor={(o) => o.id}
      ListHeaderComponent={
        <TabHeader
          title="Mes"
          accent="commandes"
          subtitle={count > 0 ? 'Validation par notre équipe, puis suivi' : undefined}
        />
      }
      renderItem={({ item }) => (
        <TrackCard
          title={`Commande ${item.number}`}
          date={formatDate(item.createdAt)}
          view={orderView(item)}
          messageLabel="Dernier message"
          info={[
            item.transport
              ? { icon: 'airplane-outline', text: `Transport inclus · ${item.address}` }
              : {
                  icon: 'cube-outline',
                  text: 'Sans transport · enlèvement organisé par vos soins',
                },
          ]}
          lineIds={item.lines.map((l) => l.id)}
          totalOver={`${plural(item.lines.length)} · paiement simulé${item.payment ? `\n${item.payment}` : ''}`}
          total={euro(item.total)}
          action={{ label: 'Recommander', icon: 'refresh', onPress: () => again(item.lines) }}
          onOpenProduct={open}
          onTest={() => advanceOrder(item.id)}
        />
      )}
      ListEmptyComponent={
        <EmptyState
          title="Aucune commande pour l’instant"
          body="Votre première commande et son suivi, de la validation à la livraison, apparaîtront ici."
          cta="Faire mon marché"
          onPress={() => setTab('home')}
          image={require('../assets/produce/citron.webp')}
          tint="#A8901C"
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  testNote: {
    marginTop: 6,
    paddingHorizontal: PAD + 4,
    color: C.textFaint,
    fontFamily: F.medium,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
  },
  credits: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 48,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  creditsText: {
    color: C.textDim,
    fontFamily: F.semi,
    fontSize: 13.5,
    textDecorationLine: 'underline',
  },
});
