/**
 * Embed + composants pour /panelrank
 */

const {
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { getGuildConfig } = require('./storage/guildRankConfig');
const { sortPanelRanks } = require('./panelRankResolver');

async function formatRanksList(guild, guildId) {
  const { panelRanks } = await getGuildConfig(guildId);
  const sorted = sortPanelRanks(panelRanks);
  if (sorted.length === 0) return '_Aucun palier — ajoute-en avec le menu rôle puis **Saisir prérequis**._';
  return sorted
    .map((r, i) => {
      const role = guild.roles.cache.get(r.roleId);
      const tag = role ? `<@&${r.roleId}>` : `\`${r.roleId}\``;
      return `**${i + 1}.** ${tag} — **${r.minMessages.toLocaleString('fr-FR')}** msgs · **${r.minVocalHours}** h vocal`;
    })
    .join('\n');
}

async function buildPanelrankPayload(guild, selectedRoleId = null) {
  const ranksList = await formatRanksList(guild, guild.id);
  const selLine = selectedRoleId
    ? `\n\n✅ **Rôle sélectionné :** <@&${selectedRoleId}> — clique **Saisir prérequis**.`
    : '';
  const embed = new EmbedBuilder()
    .setColor(0xf4b6c2)
    .setTitle('Paliers Sayuri (rôles + stats)')
    .setDescription(
      [
        'Définis **un rôle Discord** par palier et les **minimums** (messages + heures en vocal) pour y accéder sur la **carte /rank**.',
        '',
        '**Étapes**',
        '1. Choisis un **rôle** ci-dessous.',
        '2. Clique **Saisir prérequis** et entre messages + heures vocales.',
        '3. Répète pour chaque palier (du plus faible au plus fort en général).',
        '',
        '**Paliers enregistrés**',
        ranksList,
        selLine,
      ].join('\n'),
    )
    .setFooter({ text: 'Réservé aux modérateurs · Données messages/vocal : branche ta BDD plus tard (mock pour l’instant)' });

  const rolePick = new RoleSelectMenuBuilder()
    .setCustomId('panelrank_pick_role')
    .setPlaceholder('Choisir un rôle pour ce palier…')
    .setMinValues(1)
    .setMaxValues(1);

  const btn = new ButtonBuilder()
    .setCustomId('panelrank_open_modal')
    .setLabel('Saisir prérequis (messages + h vocal)')
    .setStyle(ButtonStyle.Primary);

  const { panelRanks } = await getGuildConfig(guild.id);
  const sorted = sortPanelRanks(panelRanks);
  const rows = [
    new ActionRowBuilder().addComponents(rolePick),
    new ActionRowBuilder().addComponents(btn),
  ];

  if (sorted.length > 0) {
    const remove = new StringSelectMenuBuilder()
      .setCustomId('panelrank_remove')
      .setPlaceholder('Supprimer un palier…')
      .addOptions(
        sorted.slice(0, 25).map((r) => {
          const role = guild.roles.cache.get(r.roleId);
          const label = (role?.name ?? r.roleId).slice(0, 100);
          return {
            label: label.length ? label : r.roleId,
            description: `${r.minMessages} msgs · ${r.minVocalHours}h`.slice(0, 100),
            value: r.roleId,
          };
        }),
      );
    rows.push(new ActionRowBuilder().addComponents(remove));
  }

  return { embeds: [embed], components: rows };
}

function buildPrereqModal() {
  return new ModalBuilder()
    .setCustomId('panelrank_modal')
    .setTitle('Prérequis du palier')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('panelrank_msgs')
          .setLabel('Nombre de messages minimum')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('ex: 500'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('panelrank_vocal')
          .setLabel('Heures vocales minimum')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('ex: 24 ou 12.5'),
      ),
    );
}

module.exports = {
  buildPanelrankPayload,
  buildPrereqModal,
  formatRanksList,
};
