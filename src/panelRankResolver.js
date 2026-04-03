/**
 * Paliers /panelrank : tri par difficulté, vocal comparé en **minutes** (stats mock encore en heures → ×60).
 */

const { normalizePanelRankEntry, normalizePanelRanksArray } = require('./panelRankUtils');

/**
 * @param {object[]} ranks
 */
function sortPanelRanks(ranks) {
  const norm = normalizePanelRanksArray(ranks);
  return norm.sort((a, b) => {
    const da = a.minVocalMinutes * 1e12 + a.minMessages;
    const db = b.minVocalMinutes * 1e12 + b.minMessages;
    return da - db;
  });
}

/**
 * @param {import('discord.js').GuildMember | null} member
 * @param {object} rank
 */
function memberHasPanelTierRoles(member, rank) {
  if (!member?.roles?.cache) return false;
  const n = normalizePanelRankEntry(rank);
  const hasP = member.roles.cache.has(n.permRoleId);
  const hasA = member.roles.cache.has(n.aestheticRoleId);
  if (n.permRoleId === n.aestheticRoleId) return hasP;
  return hasP && hasA;
}

function shortName(s, max) {
  const t = String(s || '');
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * @param {import('discord.js').Guild | null} guild
 * @param {number} vocalHours — données membre (décimal)
 * @param {number} messageCount
 * @param {object[]} panelRanks
 * @param {import('discord.js').GuildMember | null} [member]
 */
function resolvePanelRankState(guild, vocalHours, messageCount, panelRanks, member = null) {
  const ranks = sortPanelRanks(panelRanks);
  const vocMin = Math.max(0, Number(vocalHours) || 0) * 60;
  const msg = Math.max(0, Math.floor(Number(messageCount) || 0));

  let statsIdx = -1;
  for (let i = 0; i < ranks.length; i++) {
    if (msg >= ranks[i].minMessages && vocMin >= ranks[i].minVocalMinutes) statsIdx = i;
  }

  let roleIdx = -1;
  if (member?.roles?.cache) {
    for (let i = 0; i < ranks.length; i++) {
      if (memberHasPanelTierRoles(member, ranks[i])) roleIdx = Math.max(roleIdx, i);
    }
  }

  const currentIdx = Math.max(statsIdx, roleIdx);

  const nextIdx = currentIdx + 1;
  const current = currentIdx >= 0 ? ranks[currentIdx] : null;
  const next = nextIdx < ranks.length ? ranks[nextIdx] : null;

  const roleName = (rid) =>
    guild?.roles?.cache?.get(rid)?.name ?? (rid ? 'Rôle inconnu' : '—');

  let percent = 100;
  if (next) {
    const pMsg =
      next.minMessages <= 0 ? 1 : Math.min(1, msg / next.minMessages);
    const pVoc =
      next.minVocalMinutes <= 0 ? 1 : Math.min(1, vocMin / next.minVocalMinutes);
    percent = Math.min(100, Math.max(0, ((pMsg + pVoc) / 2) * 100));
  }

  const displayPairName = (rank) => {
    const n = normalizePanelRankEntry(rank);
    const a = roleName(n.permRoleId);
    const b = roleName(n.aestheticRoleId);
    if (n.permRoleId === n.aestheticRoleId) return a;
    return `${shortName(a, 16)} · ${shortName(b, 16)}`;
  };

  const toDisplay = (rank) => {
    const n = normalizePanelRankEntry(rank);
    return {
      id: n.permRoleId,
      name: displayPairName(rank),
      minMessages: n.minMessages,
      minVocalMinutes: n.minVocalMinutes,
      minVocalHours: n.minVocalMinutes / 60,
      requis: [
        `≥ ${n.minMessages.toLocaleString('fr-FR')} messages`,
        `≥ ${n.minVocalMinutes.toLocaleString('fr-FR')} min en vocal`,
      ],
    };
  };

  const currentDisplay = current
    ? toDisplay(current)
    : {
        id: 'none',
        name: 'Aucun palier',
        minVocalHours: 0,
        minVocalMinutes: 0,
        minMessages: 0,
        requis: ['Configure les paliers avec /panelrank'],
      };

  const nextDisplay = next ? toDisplay(next) : null;

  return {
    ranks,
    currentIdx,
    current,
    next,
    mergedCurrent: currentDisplay,
    mergedNext: nextDisplay,
    percent,
    isMax: !next,
  };
}

module.exports = {
  sortPanelRanks,
  resolvePanelRankState,
  memberHasPanelTierRoles,
};
