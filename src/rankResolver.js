/**
 * Palier effectif = max(palier selon heures vocales, palier selon rôles configurés sur le serveur).
 */

const { RANKS, getRankState } = require('./rankConfig');

/**
 * @param {import('discord.js').GuildMember | null} member
 * @param {number} vocalHours
 * @param {{ roles?: Record<string, string>, tierOverrides?: Record<string, { name?: string, requis?: string[] }> }} guildConfig
 */
function mergeTier(base, override) {
  const requis = [...base.requis];
  if (!override) return { ...base, requis };
  return {
    ...base,
    name: override.name != null && override.name !== '' ? override.name : base.name,
    requis:
      Array.isArray(override.requis) && override.requis.length > 0 ? [...override.requis] : requis,
  };
}

function tierIndexFromId(tierId) {
  const i = RANKS.findIndex((r) => r.id === tierId);
  return i >= 0 ? i : 0;
}

function getRoleBasedMaxIndex(member, guildConfig) {
  if (!member?.roles?.cache) return -1;
  const roles = guildConfig?.roles || {};
  let max = -1;
  for (let i = 0; i < RANKS.length; i++) {
    const roleId = roles[RANKS[i].id];
    if (roleId && member.roles.cache.has(roleId)) max = i;
  }
  return max;
}

/**
 * @returns {{
 *   current: import('./rankConfig').RankTier,
 *   next: import('./rankConfig').RankTier | null,
 *   percent: number,
 *   isMax: boolean,
 *   mergedCurrent: import('./rankConfig').RankTier & { requis: string[] },
 *   mergedNext: (import('./rankConfig').RankTier & { requis: string[] }) | null
 * }}
 */
function getEffectiveRankState(member, vocalHours, guildConfig) {
  const gc = guildConfig || { roles: {}, tierOverrides: {} };
  const h = Math.max(0, Number(vocalHours) || 0);
  const hoursState = getRankState(h);
  const hoursIdx = tierIndexFromId(hoursState.current.id);
  const roleIdx = getRoleBasedMaxIndex(member, gc);
  const idx = Math.max(hoursIdx, roleIdx);
  const current = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;

  let percent = 100;
  if (next) {
    const span = next.minVocalHours - current.minVocalHours;
    const prog = h - current.minVocalHours;
    percent = span > 0 ? Math.min(100, Math.max(0, (prog / span) * 100)) : 0;
  }

  const ov = gc.tierOverrides || {};
  const mergedCurrent = mergeTier(current, ov[current.id]);
  const mergedNext = next ? mergeTier(next, ov[next.id]) : null;

  return {
    current,
    next,
    percent,
    isMax: !next,
    mergedCurrent,
    mergedNext,
  };
}

module.exports = {
  getEffectiveRankState,
  mergeTier,
};
