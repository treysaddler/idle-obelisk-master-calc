// Game sprites from the Idle Obelisk Miner wiki (public/icons) and Tabler UI icons ("tabler:name").
import { UI_ICONS } from './uiIcons';

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
  if (file.startsWith('tabler:')) {
    const body = UI_ICONS[file.slice(7)];
    if (!body) return null;
    return <svg class="icon icon-ui" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: body }} />;
  }
  return <img class="icon" src={`icons/${file}`} width={size} height={size} alt="" loading="lazy" decoding="async" />;
}
