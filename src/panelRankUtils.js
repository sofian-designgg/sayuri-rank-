/**
 * Modèle palier panel : tierId + rôle perm + rôle esthétique + prérequis (vocal en minutes).
 */

/**
 * @param {Record<string, unknown>} r
 * @returns {{ tierId: string, permRoleId: string, aestheticRoleId: string, minMessages: number, minVocalMinutes: number }}
 */
function normalizePanelRankEntry(r) {
  const raw = typeof r === 'object' && r ? r : {};
  const perm = String(raw.permRoleId ?? raw.roleId ?? '')
    .trim()
    .replace(/^\uFEFF/, '');
  const aes = String(raw.aestheticRoleId ?? raw.roleId ?? perm ?? '')
    .trim()
    .replace(/^\uFEFF/, '');
  const minMessages = Math.max(0, Math.floor(Number(raw.minMessages) || 0));
  let minVocalMinutes;
  if (raw.minVocalMinutes != null && raw.minVocalMinutes !== '' && Number.isFinite(Number(raw.minVocalMinutes))) {
    minVocalMinutes = Math.max(0, Math.floor(Number(raw.minVocalMinutes)));
  } else {
    const h = Math.max(0, Number(raw.minVocalHours) || 0);
    minVocalMinutes = Math.max(0, Math.floor(h * 60));
  }
  return {
    tierId: String(raw.tierId || '').trim(),
    permRoleId: perm,
    aestheticRoleId: aes || perm,
    minMessages,
    minVocalMinutes,
  };
}

/**
 * @param {unknown[]} arr
 */
function normalizePanelRanksArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => normalizePanelRankEntry(typeof x === 'object' && x ? x : {}));
}

/** Identifiant stable du palier (Mongo / suppression). Vide si pas encore persisté. */
function getTierId(rank) {
  const t = normalizePanelRankEntry(rank).tierId;
  return t || null;
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
  getTierId,
  roleTag,
};
