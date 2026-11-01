// Game sprites from the Idle Obelisk Miner wiki, stored in public/icons.

export const CATEGORY_ICONS: Record<string, string> = {
  'Costs & Gains': 'item-chest.png',
  Decisions: 'auto-bomber.png',
  Gems: 'gem.png',
  Odds: 'relic-chest.png',
  Progression: 'obelisk-base-icon.png',
  'Wiki Calculators': 'skill-point.png',
  Simulators: 'arch-icon.png',
};

export function Icon({ file, size = 32 }: { file?: string; size?: number }) {
  if (!file) return null;
  return <img class="icon" src={`icons/${file}`} width={size} height={size} alt="" loading="lazy" decoding="async" />;
}
