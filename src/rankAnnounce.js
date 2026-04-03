/**
 * Annonce dans un salon quand un membre monte de palier (après /rank).
 */

const { EmbedBuilder } = require('discord.js');
const { resolvePanelRankState } = require('./panelRankResolver');
const { getEffectiveRankState } = require('./rankResolver');
const { RANKS } = require('./rankConfig');
const { getMemberRankNotifyState, setMemberRankNotifyKey } = require('./storage/guildRankConfig');

/**
 * @param {{
 *   guild: import('discord.js').Guild,
 *   guildId: string,
 *   member: import('discord.js').GuildMember,
 *   guildConfig: object,
 *   data: { vocalHours?: number, messageCount?: number },
 * }} p
 */
async function maybeAnnounceRankUp({ guild, guildId, member, guildConfig, data }) {
  const channelId = guildConfig.rankAnnounceChannelId;
  if (!channelId || !guild || !member?.user) return;

  const vocalHours = Math.max(0, Number(data.vocalHours) || 0);
  const messageCount = Math.max(0, Math.floor(Number(data.messageCount) || 0));
  const panelRanks = guildConfig.panelRanks || [];
  const usePanel = panelRanks.length > 0;

  const uid = member.user.id;
  let idx;
  let tierName;

  if (usePanel) {
    const state = resolvePanelRankState(guild, vocalHours, messageCount, panelRanks, member);
    idx = state.currentIdx;
    tierName = state.mergedCurrent?.name ?? 'Palier';
  } else {
    const s = getEffectiveRankState(member, vocalHours, guildConfig);
    idx = RANKS.findIndex((r) => r.id === s.current.id);
    tierName = s.mergedCurrent?.name ?? s.current?.name ?? 'Palier';
  }

  if (idx < 0) return;

  const key = usePanel ? 'p' : 'l';
  const prevSnap = await getMemberRankNotifyState(guildId, uid);
  const prev = prevSnap[key];

  if (prev === undefined || prev === null) {
    await setMemberRankNotifyKey(guildId, uid, key, idx);
    return;
  }

  if (idx > prev) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle('Montée de palier')
        .setDescription(
          `**${member.displayName}** a atteint le palier **${tierName}** sur le serveur.`,
        )
        .setTimestamp();
      await channel.send({
        content: `${member}`,
        embeds: [embed],
      });
    }
  }

  await setMemberRankNotifyKey(guildId, uid, key, idx);
}

module.exports = { maybeAnnounceRankUp };
