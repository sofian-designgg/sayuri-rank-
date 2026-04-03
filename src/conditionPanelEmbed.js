/**
 * Embeds pour /conditionpanel — hiérarchie des paliers (panel).
 */

const { EmbedBuilder } = require('discord.js');
const { sortPanelRanks } = require('./panelRankResolver');
const { normalizePanelRankEntry, roleTag } = require('./panelRankUtils');

const MAX_DESC = 3900;

/**
 * @param {import('discord.js').Guild} guild
 * @param {{ panelRanks: object[] }} guildConfig
 * @returns {EmbedBuilder[]}
 */
function buildConditionPanelEmbeds(guild, guildConfig) {
  const sorted = sortPanelRanks(guildConfig.panelRanks || []);
  if (sorted.length === 0) {
    return [
      new EmbedBuilder()
        .setColor(0xf4b6c2)
        .setTitle('Hiérarchie des paliers')
        .setDescription('Aucun palier configuré. Utilise **/panelrank** d’abord.'),
    ];
  }

  const lines = sorted.map((r, i) => {
    const n = normalizePanelRankEntry(r);
    const p = roleTag(guild, n.permRoleId);
    const a = roleTag(guild, n.aestheticRoleId);
    const pn = guild.roles.cache.get(n.permRoleId)?.name ?? n.permRoleId;
    const an = guild.roles.cache.get(n.aestheticRoleId)?.name ?? n.aestheticRoleId;
    return (
      `**${i + 1}.** **Perm** ${p} (${pn})\n` +
      `  **Esth.** ${a} (${an})\n` +
      `  · Messages minimum : **${n.minMessages.toLocaleString('fr-FR')}**\n` +
      `  · Heures vocal minimum : **${n.minVocalHours}**`
    );
  });

  const header =
    'Chaque ligne = **2 rôles** (permissions + esthétique). Ordre du plus accessible au plus exigeant.\n\n';
  const chunks = [];
  let buf = header;
  for (const line of lines) {
    const add = (buf ? '\n\n' : '') + line;
    if (buf.length + add.length > MAX_DESC) {
      chunks.push(buf);
      buf = line;
    } else {
      buf += add;
    }
  }
  if (buf) chunks.push(buf);

  return chunks.map((desc, i) =>
    new EmbedBuilder()
      .setColor(0xf4b6c2)
      .setTitle(i === 0 ? 'Hiérarchie des paliers & conditions' : `Hiérarchie (suite ${i + 1})`)
      .setDescription(desc),
  );
}

module.exports = { buildConditionPanelEmbeds };
