import { useEffect, useState } from 'preact/hooks';
import { getExportStats, subscribeExportStats } from '../lib/exportStats';

export function useExportStats() {
  const [stats, setStats] = useState(getExportStats);
  useEffect(() => subscribeExportStats(() => setStats(getExportStats())), []);
  return stats;
}

export function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
