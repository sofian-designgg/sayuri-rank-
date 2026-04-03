/**
 * Embed + composants /panelrank : 2 rôles, navigation ◀ ▶, nouveau palier, vocal en **minutes**.
 */

const {
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
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
  if (sorted.length === 0) return '_Aucun palier — utilise **+ Nouveau** ou les flèches après avoir choisi 2 rôles._';
  return sorted
    .map((r, i) => {
      const n = normalizePanelRankEntry(r);
      const p = roleTag(guild, n.permRoleId);
      const a = roleTag(guild, n.aestheticRoleId);
      return `**${i + 1}.** Perm ${p} · Esth. ${a} — **${n.minMessages.toLocaleString('fr-FR')}** msgs · **${n.minVocalMinutes}** min vocal`;
    })
    .join('\n');
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {{
 *   slotIndex: number,
 *   editingTierId?: string,
 *   permRoleId?: string,
 *   aestheticRoleId?: string,
 * }} session
 */
async function buildPanelrankPayload(guild, session) {
  const { panelRanks } = await getGuildConfig(guild.id);
  const sorted = sortPanelRanks(panelRanks);
  const maxSlot = sorted.length;
  let slot = session.slotIndex;
  if (slot === undefined || slot === null || Number.isNaN(slot)) slot = maxSlot;
  slot = Math.max(0, Math.min(slot, maxSlot));

  const ranksList = await formatRanksList(guild, guild.id);

  const posLabel =
    slot < maxSlot
      ? `**Palier ${slot + 1} / ${maxSlot}** (tri : faible → fort)`
      : `**Nouveau palier** (${maxSlot + 1}ᵉ emplacement)`;

  const lines = [];
  if (session.permRoleId) lines.push(`✅ **Rôle permissions :** <@&${session.permRoleId}>`);
  if (session.aestheticRoleId) lines.push(`✅ **Rôle esthétique :** <@&${session.aestheticRoleId}>`);
  const selBlock =
    lines.length > 0
      ? `\n\n${lines.join('\n')}\n\n_Avec les **deux** rôles choisis → **Prérequis**._`
      : '';

  const embed = new EmbedBuilder()
    .setColor(0xf4b6c2)
    .setTitle('Paliers Sayuri')
    .setDescription(
      [
        '📍 ' + posLabel,
        '',
        'Chaque palier peut utiliser **les mêmes rôles** qu’un autre (seuil différent).',
        'Temps vocal des prérequis en **minutes**.',
        '',
        '**Paliers enregistrés**',
        ranksList,
        selBlock,
      ].join('\n'),
    )
    .setFooter({ text: '◀ ▶ naviguer · + Nouveau · Supprimer = palier affiché' });

  const pickPerm = new RoleSelectMenuBuilder()
    .setCustomId('panelrank_pick_perm')
    .setPlaceholder('Rôle permissions…')
    .setMinValues(1)
    .setMaxValues(1);

  const pickAesthetic = new RoleSelectMenuBuilder()
    .setCustomId('panelrank_pick_aesthetic')
    .setPlaceholder('Rôle esthétique…')
    .setMinValues(1)
    .setMaxValues(1);

  const btnPrereq = new ButtonBuilder()
    .setCustomId('panelrank_open_modal')
    .setLabel('Prérequis')
    .setStyle(ButtonStyle.Primary);

  const btnPrev = new ButtonBuilder()
    .setCustomId('panelrank_nav_prev')
    .setLabel('◀')
    .setStyle(ButtonStyle.Secondary);

  const btnNext = new ButtonBuilder()
    .setCustomId('panelrank_nav_next')
    .setLabel('▶')
    .setStyle(ButtonStyle.Secondary);

  const btnNew = new ButtonBuilder()
    .setCustomId('panelrank_nav_new')
    .setLabel('+ Nouveau')
    .setStyle(ButtonStyle.Success);

  const btnDelete = new ButtonBuilder()
    .setCustomId('panelrank_delete_current')
    .setLabel('Supprimer ce palier')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(slot >= maxSlot);

  const rows = [
    new ActionRowBuilder().addComponents(pickPerm),
    new ActionRowBuilder().addComponents(pickAesthetic),
    new ActionRowBuilder().addComponents(btnPrereq, btnPrev, btnNext, btnNew),
    new ActionRowBuilder().addComponents(btnDelete),
  ];

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
          .setLabel('Messages minimum')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('ex: 500'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('panelrank_vocal')
          .setLabel('Minutes en vocal minimum')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('ex: 120 (= 2 h)'),
      ),
    );
}

module.exports = {
  buildPanelrankPayload,
  buildPrereqModal,
  formatRanksList,
};
