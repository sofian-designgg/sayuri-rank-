/**
 * Définitions slash — partagées entre index (enregistrement au ready) et deploy-commands.js
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

const pingCommand = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Test : vérifie que le bot répond (diagnostic).')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

const rankCommand = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Affiche ta carte Sayuri (paliers /panelrank si configurés).');

const panelrankCommand = new SlashCommandBuilder()
  .setName('panelrank')
  .setDescription('Panneau : définir les paliers (rôle + messages + heures vocal)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

const setchannelrankCommand = new SlashCommandBuilder()
  .setName('setchannelrank')
  .setDescription('Salon des annonces quand un membre monte de palier (après /rank)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('definir')
      .setDescription('Choisir le salon où poster les montées de palier')
      .addChannelOption((o) =>
        o
          .setName('salon')
          .setDescription('Salon texte ou annonces')
          .setRequired(true)
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement,
            ChannelType.GuildForum,
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('retirer').setDescription('Désactiver les annonces de palier'),
  );

const conditionpanelCommand = new SlashCommandBuilder()
  .setName('conditionpanel')
  .setDescription('Publie l’embed de la hiérarchie des rôles et des conditions (palier panel)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

const finishrankpanelCommand = new SlashCommandBuilder()
  .setName('finishrankpanel')
  .setDescription('Verrouiller ou rouvrir la config des paliers (requis avant /conditionpanel)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('terminer')
      .setDescription('Config terminée — autorise /conditionpanel'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('modifier')
      .setDescription('Rouvre la config — /conditionpanel bloqué jusqu’à terminer'),
  );

const slashCommandsJson = [
  pingCommand.toJSON(),
  rankCommand.toJSON(),
  panelrankCommand.toJSON(),
  setchannelrankCommand.toJSON(),
  conditionpanelCommand.toJSON(),
  finishrankpanelCommand.toJSON(),
];

module.exports = { slashCommandsJson };
