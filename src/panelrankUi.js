/**
 * Embed + composants pour /panelrank (2 rôles par palier : permissions + esthétique)
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
const { normalizePanelRankEntry, roleTag } = require('./panelRankUtils');

async function formatRanksList(guild, guildId) {
  const { panelRanks } = await getGuildConfig(guildId);
  const sorted = sortPanelRanks(panelRanks);
  if (sorted.length === 0) return '_Aucun palier — choisis **2 rôles** puis **Saisir prérequis**._';
  return sorted
    .map((r, i) => {
      const n = normalizePanelRankEntry(r);
      const p = roleTag(guild, n.permRoleId);
      const a = roleTag(guild, n.aestheticRoleId);
      return `**${i + 1}.** Perm ${p} · Esth. ${a} — **${n.minMessages.toLocaleString('fr-FR')}** msgs · **${n.minVocalHours}** h vocal`;
    })
    .join('\n');
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {{ permRoleId?: string, aestheticRoleId?: string }} [pending]
 */
async function buildPanelrankPayload(guild, pending = {}) {
  const ranksList = await formatRanksList(guild, guild.id);
  const lines = [];
  if (pending.permRoleId) {
    lines.push(`✅ **Rôle permissions :** <@&${pending.permRoleId}>`);
  }
  if (pending.aestheticRoleId) {
    lines.push(`✅ **Rôle esthétique :** <@&${pending.aestheticRoleId}>`);
  }
  const selBlock =
    lines.length > 0
      ? `\n\n${lines.join('\n')}\n\n_Quand les **deux** sont choisis, clique **Saisir prérequis**._`
      : '';

  const embed = new EmbedBuilder()
    .setColor(0xf4b6c2)
    .setTitle('Paliers Sayuri (2 rôles par palier)')
    .setDescription(
      [
        'Chaque palier = **rôle permissions** (hiérarchie / accès) + **rôle esthétique** (couleur, déco).',
        'Les **minimums** messages + vocal s’appliquent au palier entier.',
        '',
        '**Étapes**',
        '1. Menu **permissions** puis menu **esthétique**.',
        '2. **Saisir prérequis** (messages + h vocal).',
        '3. Répète pour chaque palier (du plus faible au plus fort en général).',
        '',
        '**Paliers enregistrés**',
        ranksList,
        selBlock,
      ].join('\n'),
    )
    .setFooter({ text: 'Réservé aux modérateurs' });

  const pickPerm = new RoleSelectMenuBuilder()
    .setCustomId('panelrank_pick_perm')
    .setPlaceholder('1. Rôle permissions / hiérarchie…')
    .setMinValues(1)
    .setMaxValues(1);

  const pickAesthetic = new RoleSelectMenuBuilder()
    .setCustomId('panelrank_pick_aesthetic')
    .setPlaceholder('2. Rôle esthétique / visuel…')
    .setMinValues(1)
    .setMaxValues(1);

  const btn = new ButtonBuilder()
    .setCustomId('panelrank_open_modal')
    .setLabel('Saisir prérequis (messages + h vocal)')
    .setStyle(ButtonStyle.Primary);

  const { panelRanks } = await getGuildConfig(guild.id);
  const sorted = sortPanelRanks(panelRanks);
  const rows = [
    new ActionRowBuilder().addComponents(pickPerm),
    new ActionRowBuilder().addComponents(pickAesthetic),
    new ActionRowBuilder().addComponents(btn),
  ];

  if (sorted.length > 0) {
    const remove = new StringSelectMenuBuilder()
      .setCustomId('panelrank_remove')
      .setPlaceholder('Supprimer un palier…')
      .addOptions(
        sorted.slice(0, 25).map((r) => {
          const n = normalizePanelRankEntry(r);
          const rp = guild.roles.cache.get(n.permRoleId);
          const ra = guild.roles.cache.get(n.aestheticRoleId);
          const label = `${rp?.name ?? n.permRoleId} / ${ra?.name ?? n.aestheticRoleId}`.slice(0, 100);
          return {
            label: label.length ? label : n.permRoleId,
            description: `${n.minMessages} msgs · ${n.minVocalHours}h`.slice(0, 100),
            value: n.permRoleId,
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
