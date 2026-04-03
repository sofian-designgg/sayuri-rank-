/**
 * Modèle palier panel : rôle permissions + rôle esthétique (rétrocompat : ancien champ roleId).
 */

/**
 * @param {Record<string, unknown>} r
 * @returns {{ permRoleId: string, aestheticRoleId: string, minMessages: number, minVocalHours: number }}
 */
function normalizePanelRankEntry(r) {
  const perm = String(r.permRoleId ?? r.roleId ?? '')
    .trim()
    .replace(/^\uFEFF/, '');
  const aes = String(r.aestheticRoleId ?? r.roleId ?? perm ?? '')
    .trim()
    .replace(/^\uFEFF/, '');
  return {
    permRoleId: perm,
    aestheticRoleId: aes || perm,
    minMessages: Math.max(0, Math.floor(Number(r.minMessages) || 0)),
    minVocalHours: Math.max(0, Number(r.minVocalHours) || 0),
  };
}

/**
 * @param {unknown[]} arr
 */
function normalizePanelRanksArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => normalizePanelRankEntry(typeof x === 'object' && x ? x : {}));
}

/** Clé stable d’un palier (upsert / suppression) = rôle permissions */
function tierPermKey(rank) {
  return normalizePanelRankEntry(rank).permRoleId;
}

/**
 * @param {import('discord.js').Guild | null} guild
 * @param {string} rid
 */
function roleTag(guild, rid) {
  if (!rid) return '—';
  const role = guild?.roles?.cache?.get(rid);
  return role ? `<@&${rid}>` : `\`${rid}\``;
}

module.exports = {
  normalizePanelRankEntry,
  normalizePanelRanksArray,
  tierPermKey,
  roleTag,
};
