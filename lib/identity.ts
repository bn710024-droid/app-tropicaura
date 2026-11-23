/** Identifiants de connexion : une adresse e-mail ou un numéro de téléphone. */

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

export const isPhone = (s: string) =>
  /^[+\d\s().-]+$/.test(s.trim()) && s.replace(/\D/g, '').length >= 8;

export const normEmail = (s: string) => s.trim().toLowerCase();

/** Chiffres seuls, sans « + » ni « 00 » initial : +221 77… et 00221 77… désignent le même numéro. */
export const phoneDigits = (s: string) => s.replace(/\D/g, '').replace(/^00/, '');

/** Mise en forme légère pour l'affichage : on garde ce que la personne a saisi, sans espaces en trop. */
export const tidyPhone = (s: string) => s.trim().replace(/\s+/g, ' ');

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
