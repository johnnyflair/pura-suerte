/** Configuración del negocio. Todo lo que se ajusta seguido vive aquí. */

export const BRAND = process.env.BRAND_NAME ?? 'Pura Suerte';

export const WELCOME_COINS = 100_000;

export const DAILY_WHEEL = {
  cooldownHours: 20,
  segments: [
    { coins: 1_000, weight: 30 },
    { coins: 2_000, weight: 28 },
    { coins: 5_000, weight: 22 },
    { coins: 10_000, weight: 12 },
    { coins: 25_000, weight: 6 },
    { coins: 50_000, weight: 2 },
  ],
};

export const GIFT = { coins: 2_000, everyHours: 4 };

export const AD_REWARD = { coins: 1_000, perDay: 3, minWatchSeconds: 30 };

export interface Pack {
  id: string;
  coins: number;
  priceCents: number;
  tag?: string;
  freeSpins?: number;
  welcome?: boolean;
}

// Precios de referencia (USD). Ajustar antes de lanzar.
export const PACKS: Pack[] = [
  { id: 'welcome', coins: 250_000, priceCents: 299, freeSpins: 20, welcome: true, tag: 'Oferta de bienvenida' },
  { id: 'p50k', coins: 50_000, priceCents: 199 },
  { id: 'p120k', coins: 120_000, priceCents: 499, tag: '+20% extra' },
  { id: 'p300k', coins: 300_000, priceCents: 999, tag: 'Más popular' },
  { id: 'p700k', coins: 700_000, priceCents: 1999, tag: '+40% extra' },
  { id: 'p1500k', coins: 1_500_000, priceCents: 4999, tag: 'Mejor valor' },
];

/**
 * demo: acredita la compra sin cobrar (solo pruebas internas).
 * off: la tienda muestra los paquetes pero no vende.
 * La integración con Stripe es el siguiente paso.
 */
export const PAYMENTS_MODE = (process.env.PAYMENTS_MODE ?? 'off') as 'demo' | 'off';

export const MIN_AGE = 18;
