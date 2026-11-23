import { TEAM_ENDPOINT } from './config';
import type { Account, ProRequest } from './store';

/**
 * Transmission des demandes professionnelles au logiciel interne de l'équipe.
 *
 * Ce logiciel n'existe pas encore : `TEAM_ENDPOINT` vaut `null` et `transmit` répond
 * « not_connected » sans rien envoyer. Le format ci-dessous est prêt ; il suffira de renseigner
 * l'adresse dans `lib/config.ts` pour que les demandes en attente partent (elles sont
 * retentées à chaque ouverture du compte).
 */
export const PAYLOAD_VERSION = 2;

export function buildRequestPayload(request: ProRequest, account: Account | undefined) {
  return {
    version: PAYLOAD_VERSION,
    type: 'demande_professionnelle',
    reference: request.number,
    createdAt: new Date(request.createdAt).toISOString(),
    incoterm: request.incoterm,
    currency: 'EUR',
    lines: request.lines.map((l) => ({
      productId: l.id.split(':')[0],
      product: l.name ?? l.id,
      // Mode de transport de l'offre : 'avion', 'bateau', ou null (offre sans mode).
      mode: l.mode ?? null,
      // Quantité dans l'unité commandée : kilos, ou conteneurs.
      quantity: l.qty,
      unit: l.unit ?? 'kg',
      // Équivalent en kilos, ou null si le poids du conteneur n'est pas défini.
      quantityKg: l.kg ?? (l.unit === 'conteneur' ? null : l.qty),
      // Prix d'une unité commandée, ou null si aucun prix n'était configuré.
      unitPrice: l.priced === false ? null : l.price,
      total: l.priced === false ? null : Math.round(l.qty * l.price * 100) / 100,
    })),
    // Somme des lignes chiffrées uniquement.
    estimatedTotal: request.subtotal,
    unpricedLines: request.unpriced ?? 0,
    customer: {
      accountId: account?.id ?? null,
      activity: account?.activity ?? null,
      company: request.company,
      contact: request.contactName,
      phone: request.phone,
      email: request.email,
      whatsapp: request.whatsapp,
    },
    destination: request.destination,
    note: request.note,
  };
}

export type TransmitResult = 'sent' | 'not_connected' | 'failed';

export async function transmit(payload: unknown): Promise<TransmitResult> {
  if (!TEAM_ENDPOINT) return 'not_connected';
  try {
    const response = await fetch(TEAM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
