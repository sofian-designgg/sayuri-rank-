/**
 * Paliers Sayuri : modifie ce tableau pour définir tes rangs et leurs prérequis.
 * `minVocalHours` = heures vocales cumulées nécessaires pour **atteindre** ce palier (le 1er est toujours 0).
 * Image optionnelle : assets/ranks/<id>.png
 */

/** @typedef {{ id: string, name: string, minVocalHours: number, requis: string[] }} RankTier */

/** @type {RankTier[]} */
const RANKS = [
  {
    id: 'shiro',
    name: 'Shiro',
    minVocalHours: 0,
    requis: ['Être sur le serveur'],
  },
  {
    id: 'sakura',
    name: 'Sakura',
    minVocalHours: 24,
    requis: ['24 h en vocal cumulées', 'Compte Discord vérifié'],
  },
  {
    id: 'momiji',
    name: 'Momiji',
    minVocalHours: 72,
    requis: ['72 h en vocal', '7 jours d’ancienneté sur le serveur'],
  },
  {
    id: 'yozakura',
    name: 'Yozakura',
    minVocalHours: 150,
    requis: ['150 h en vocal', 'Top 80 % activité du mois'],
  },
  {
    id: 'sayuri',
    name: 'Sayuri',
    minVocalHours: 300,
    requis: ['300 h en vocal', 'Validation équipe'],
  },
];

/**
 * @param {number} vocalHours
 * @returns {{ current: RankTier, next: RankTier | null, percent: number, isMax: boolean }}
 */
function getRankState(vocalHours) {
  const h = Math.max(0, Number(vocalHours) || 0);
  let idx = 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (h >= RANKS[i].minVocalHours) {
      idx = i;
      break;
    }
  }
  const current = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  let percent = 100;
  if (next) {
    const span = next.minVocalHours - current.minVocalHours;
    const prog = h - current.minVocalHours;
    percent = span > 0 ? Math.min(100, Math.max(0, (prog / span) * 100)) : 0;
  }
  return { current, next, percent, isMax: !next };
}

/** Affichage type 167h50m */
function formatVocalHours(vocalHours) {
  const totalMin = Math.round(Math.max(0, Number(vocalHours) || 0) * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${hh}h${String(mm).padStart(2, '0')}m`;
}

module.exports = {
  RANKS,
  getRankState,
  formatVocalHours,
};
