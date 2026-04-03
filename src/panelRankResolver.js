/**
 * Paliers /panelrank : tri par difficulté, palier actuel = dernier seuil atteint (messages ET vocal).
 */

/**
 * @param {{ roleId: string, minMessages: number, minVocalHours: number }[]} ranks
 */
function sortPanelRanks(ranks) {
  return [...ranks].sort((a, b) => {
    const da = a.minVocalHours * 1e12 + a.minMessages;
    const db = b.minVocalHours * 1e12 + b.minMessages;
    return da - db;
  });
}

/**
 * @param {import('discord.js').Guild | null} guild
 * @param {number} vocalHours
 * @param {number} messageCount
 * @param {{ roleId: string, minMessages: number, minVocalHours: number }[]} panelRanks
 * @param {import('discord.js').GuildMember | null} [member] — palier le plus haut parmi les rôles panel possédés
 */
function resolvePanelRankState(guild, vocalHours, messageCount, panelRanks, member = null) {
  const ranks = sortPanelRanks(panelRanks);
  const voc = Math.max(0, Number(vocalHours) || 0);
  const msg = Math.max(0, Math.floor(Number(messageCount) || 0));

  let statsIdx = -1;
  for (let i = 0; i < ranks.length; i++) {
    if (msg >= ranks[i].minMessages && voc >= ranks[i].minVocalHours) statsIdx = i;
  }

  let roleIdx = -1;
  if (member?.roles?.cache) {
    for (let i = 0; i < ranks.length; i++) {
      const rid = String(ranks[i].roleId);
      if (member.roles.cache.has(rid)) roleIdx = Math.max(roleIdx, i);
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
      next.minVocalHours <= 0 ? 1 : Math.min(1, voc / next.minVocalHours);
    percent = Math.min(100, Math.max(0, ((pMsg + pVoc) / 2) * 100));
  }

  const currentDisplay = current
    ? {
        id: current.roleId,
        name: roleName(current.roleId),
        minVocalHours: current.minVocalHours,
        minMessages: current.minMessages,
        requis: [
          `≥ ${current.minMessages.toLocaleString('fr-FR')} messages`,
          `≥ ${current.minVocalHours} h vocales`,
        ],
      }
    : {
        id: 'none',
        name: 'Aucun palier',
        minVocalHours: 0,
        minMessages: 0,
        requis: ['Configure les paliers avec /panelrank'],
      };

  const nextDisplay = next
    ? {
        id: next.roleId,
        name: roleName(next.roleId),
        minVocalHours: next.minVocalHours,
        minMessages: next.minMessages,
        requis: [
          `≥ ${next.minMessages.toLocaleString('fr-FR')} messages`,
          `≥ ${next.minVocalHours} h vocales`,
        ],
      }
    : null;

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
};
