/**
 * Données affichées en bas de la carte /rank (stats réelles + écart au palier suivant).
 */

const { getRankState } = require('./rankConfig');
const { resolvePanelRankState } = require('./panelRankResolver');
const { normalizePanelRankEntry } = require('./panelRankUtils');

/**
 * @param {unknown} raw
 * @returns {{ messages: number, vocalMinutes: number }}
 */
function normalizeMemberStatEntry(raw) {
  if (!raw || typeof raw !== 'object') return { messages: 0, vocalMinutes: 0 };
  return {
    messages: Math.max(0, Math.floor(Number(raw.messages) || 0)),
    vocalMinutes: Math.max(0, Number(raw.vocalMinutes) || 0),
  };
}

/**
 * Rang d’activité parmi les membres enregistrés (messages + min vocal).
 * @param {Record<string, unknown>} memberStats
 * @param {string} userId
 */
function activityRankAmongTracked(memberStats, userId) {
  const uid = String(userId ?? '').trim();
  const self = normalizeMemberStatEntry(memberStats[uid]);
  const selfScore = self.messages + self.vocalMinutes;
  let higher = 0;
  for (const [id, raw] of Object.entries(memberStats || {})) {
    if (id === uid) continue;
    const o = normalizeMemberStatEntry(raw);
    if (o.messages + o.vocalMinutes > selfScore) higher += 1;
  }
  return higher + 1;
}

/**
 * @param {object} next — entrée palier brute
 * @param {number} messageCount
 * @param {number} vocalMinutes
 */
function formatPanelNextGap(next, messageCount, vocalMinutes) {
  const n = normalizePanelRankEntry(next);
  const needM = Math.max(0, n.minMessages - messageCount);
  const needV = Math.max(0, n.minVocalMinutes - vocalMinutes);
  if (needM <= 0 && needV <= 0) return 'Prérequis atteints';
  const parts = [];
  if (needM > 0) parts.push(`${needM.toLocaleString('fr-FR')} msgs`);
  if (needV > 0) parts.push(`${Math.ceil(needV)} min vocal`);
  return `Manque · ${parts.join(' · ')}`;
}

/**
 * @param {object} guildConfig — résultat getGuildConfig
 * @param {import('discord.js').GuildMember | null} member
 */
function buildRankCardData(guildConfig, member) {
  const uid = member?.user?.id ?? '';
  const stats = normalizeMemberStatEntry(guildConfig.memberStats?.[uid]);
  const vocalHours = stats.vocalMinutes / 60;
  const messageCount = stats.messages;

  const panelRanks = guildConfig.panelRanks || [];
  const usePanel = panelRanks.length > 0;

  let timeLeft = '—';
  if (usePanel) {
    const state = resolvePanelRankState(
      member?.guild ?? null,
      vocalHours,
      messageCount,
      panelRanks,
      member,
    );
    if (state.isMax) timeLeft = 'Palier max';
    else if (state.next) timeLeft = formatPanelNextGap(state.next, messageCount, stats.vocalMinutes);
  } else {
    const rs = getRankState(vocalHours);
    if (rs.isMax) timeLeft = 'Palier max';
    else if (rs.next) {
      const needH = Math.max(0, rs.next.minVocalHours - vocalHours);
      timeLeft = needH <= 0 ? 'Prérequis atteints' : `~${needH.toFixed(1)} h vocal jusqu’au palier suivant`;
    }
  }

  const rankN = activityRankAmongTracked(guildConfig.memberStats || {}, uid);
  const rankPos = uid ? `#${rankN}` : '—';

  const voiceStatus = member?.voice?.channelId ? 'EN VOCAL' : 'INACTIF';

  return {
    vocalHours,
    messageCount,
    timeLeft,
    rankPos,
    voiceStatus,
    boostStatus: 'BOOST DÉSACTIVÉ',
  };
}

module.exports = {
  buildRankCardData,
  normalizeMemberStatEntry,
  activityRankAmongTracked,
};
