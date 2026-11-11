export interface GameInfo {
  key: string;
  name: string;
  category: 'Slots' | 'Instantáneos' | 'Mesa';
  color: string;
  path?: string; // sin ruta = próximamente
}

export const GAMES: GameInfo[] = [
  { key: 'tesoro', name: 'Tesoro Maya', category: 'Slots', color: '#FFD166', path: '/juego/tesoro-maya' },
  { key: 'cohete', name: 'Cohete', category: 'Instantáneos', color: '#9DB8FF', path: '/juego/cohete' },
  { key: 'fruta', name: 'Fruta Loca', category: 'Slots', color: '#F59AB0' },
  { key: 'cafe', name: 'Café de Altura', category: 'Slots', color: '#E8C39E' },
  { key: 'volcan', name: 'Volcán de Oro', category: 'Slots', color: '#FFB38A' },
  { key: 'carnaval', name: 'Carnaval', category: 'Slots', color: '#C9B6FF' },
  { key: 'minas', name: 'Minas', category: 'Instantáneos', color: '#7AD3C0' },
  { key: 'plinko', name: 'Plinko', category: 'Instantáneos', color: '#FFE08A' },
  { key: 'ruleta', name: 'Ruleta', category: 'Mesa', color: '#FF9C8A' },
  { key: 'blackjack', name: 'Blackjack 21', category: 'Mesa', color: '#B8E0A0' },
];

export const GAME_NAMES: Record<string, string> = { 'tesoro-maya': 'Tesoro Maya', cohete: 'Cohete' };
