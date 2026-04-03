/**
 * Embeds pour /conditionpanel — hiérarchie des paliers (panel).
 */

const { EmbedBuilder } = require('discord.js');
const { sortPanelRanks } = require('./panelRankResolver');

const MAX_DESC = 3900;

/**
 * @param {import('discord.js').Guild} guild
 * @param {{ panelRanks: { roleId: string, minMessages: number, minVocalHours: number }[] }} guildConfig
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
    const role = guild.roles.cache.get(r.roleId);
    const name = role?.name ?? `ID ${r.roleId}`;
    return (
      `**${i + 1}.** ${role ? `<@&${r.roleId}>` : `\`${r.roleId}\``} — **${name}**\n` +
      `  · Messages minimum : **${r.minMessages.toLocaleString('fr-FR')}**\n` +
      `  · Heures vocal minimum : **${r.minVocalHours}**`
    );
  });

  const header =
    'Palier le plus accessible en haut, le plus exigeant en bas (ordre des prérequis).\n\n';
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
