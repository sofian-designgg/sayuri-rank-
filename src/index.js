/**
 * Bot Discord — /rank (public), commandes staff (ManageGuild) + MongoDB (MONGO_URL).
 */

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  MessageFlags,
  InteractionType,
  ApplicationCommandType,
} = require('discord.js');
const { generateSayuriCard, mockRankData } = require('./generateSayuriCard');
const {
  initStorage,
  getGuildConfig,
  upsertPanelRank,
  removePanelRank,
  setRankAnnounceChannel,
  setRankPanelFinished,
} = require('./storage/guildRankConfig');
const { buildPanelrankPayload, buildPrereqModal } = require('./panelrankUi');
const { setPendingRole, getPendingRole, clearPendingRole } = require('./pendingPanelRank');
const { maybeAnnounceRankUp } = require('./rankAnnounce');
const { buildConditionPanelEmbeds } = require('./conditionPanelEmbed');
const { slashCommandsJson } = require('./slashCommands');

function envTrim(v) {
  if (v == null || v === undefined) return '';
  return String(v)
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^["']|["']$/g, '');
}

const TOKEN = envTrim(process.env.DISCORD_TOKEN);
const CLIENT_ID = envTrim(process.env.CLIENT_ID);
const GUILD_ID = envTrim(process.env.GUILD_ID);
const SNOWFLAKE = /^\d{17,20}$/;

async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  if (GUILD_ID && SNOWFLAKE.test(GUILD_ID) && SNOWFLAKE.test(CLIENT_ID)) {
    try {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: slashCommandsJson,
      });
      console.log(`Slash → guilde ${GUILD_ID} (staff + /rank).`);
      return;
    } catch (e) {
      console.error('Enregistrement guilde échoué :', e?.message ?? e);
    }
  } else if (GUILD_ID && !SNOWFLAKE.test(GUILD_ID)) {
    console.warn('GUILD_ID invalide — bascule en global.');
  }

  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommandsJson });
  console.log('Slash → GLOBAL (staff + /rank).');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once('ready', async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
  if (client.user?.id && CLIENT_ID && client.user.id !== CLIENT_ID) {
    console.warn(
      `[config] CLIENT_ID dans .env (${CLIENT_ID}) ≠ id du bot connecté (${client.user.id}). ` +
        'Les commandes déployées avec ce CLIENT_ID ne sont pas celles de ce token : utilise l’Application ID du même bot.',
    );
  }
  try {
    await registerSlashCommands();
  } catch (e) {
    console.error('Erreur enregistrement commandes:', e);
  }
});

client.on('error', (e) => console.error('Discord client error:', e));
process.on('unhandledRejection', (r) => console.error('unhandledRejection:', r));

function isSlashCommand(interaction) {
  return (
    interaction.type === InteractionType.ApplicationCommand &&
    typeof interaction.commandName === 'string'
  );
}

function isGuildSlashChatCommand(interaction) {
  if (!interaction.isCommand()) return false;
  if (interaction.isContextMenuCommand()) return false;
  if (typeof interaction.isPrimaryEntryPointCommand === 'function' && interaction.isPrimaryEntryPointCommand()) {
    return false;
  }
  const t = interaction.commandType;
  if (t === ApplicationCommandType.ChatInput || t === 1) return true;
  if (t == null) return true;
  return false;
}

client.on('interactionCreate', async (interaction) => {
  try {
    const cmd = isSlashCommand(interaction) ? interaction.commandName : null;
    if (cmd) console.log(`[interaction] /${cmd} par ${interaction.user?.tag}`);

    if (isGuildSlashChatCommand(interaction)) {
      const slashName = (interaction.commandName || '').trim();

      if (slashName === 'ping') {
        const ms = client.ws.ping;
        await interaction.reply({
          content: `Pong — WS ~${Number.isFinite(ms) ? ms : '?'} ms. Bot : **${client.user?.tag}**.`,
        });
        return;
      }

      if (slashName === 'rank') {
        await interaction.deferReply();
        const gid = interaction.guildId;
        const guildConfig = gid ? await getGuildConfig(gid) : {};
        const guild =
          interaction.guild ?? (gid ? interaction.client.guilds.cache.get(gid) : null);
        const data = {
          ...mockRankData,
          username: interaction.member?.user?.username ?? interaction.user.username,
        };
        try {
          const attachment = await generateSayuriCard(
            interaction.member,
            data,
            guildConfig,
            guild,
          );
          const embed = new EmbedBuilder()
            .setColor(0xd4af37)
            .setTitle('Sayuri Rank')
            .setImage('attachment://sayuri-rank.png');
          await interaction.editReply({ embeds: [embed], files: [attachment] });

          if (gid && guild && interaction.member) {
            await maybeAnnounceRankUp({
              guild,
              guildId: gid,
              member: interaction.member,
              guildConfig,
              data,
            });
          }
        } catch (err) {
          console.error('Erreur /rank:', err);
          const message = err instanceof Error ? err.message : String(err);
          await interaction.editReply({
            content: `Impossible de générer la carte : ${message}`,
            embeds: [],
            files: [],
          });
        }
        return;
      }

      if (slashName === 'panelrank') {
        if (!interaction.guild) {
          await interaction.reply({
            content: 'À utiliser sur un **serveur**.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const payload = await buildPanelrankPayload(interaction.guild, null);
        await interaction.reply({
          ...payload,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (slashName === 'setchannelrank') {
        if (!interaction.guild) {
          await interaction.reply({
            content: 'À utiliser sur un **serveur**.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'definir') {
          const ch = interaction.options.getChannel('salon', true);
          if (!ch.isTextBased()) {
            await interaction.reply({
              content: 'Choisis un salon **texte**, annonces ou forum.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          await setRankAnnounceChannel(interaction.guild.id, ch.id);
          await interaction.reply({
            content: `Annonces de palier : ${ch}. Les montées seront postées après **/rank** (mention + embed).`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (sub === 'retirer') {
          await setRankAnnounceChannel(interaction.guild.id, null);
          await interaction.reply({
            content: 'Annonces de palier **désactivées**.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      if (slashName === 'finishrankpanel') {
        if (!interaction.guild) {
          await interaction.reply({
            content: 'À utiliser sur un **serveur**.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const sub = interaction.options.getSubcommand();
        const cfg = await getGuildConfig(interaction.guild.id);
        if (sub === 'terminer') {
          if (!cfg.panelRanks?.length) {
            await interaction.reply({
              content:
                'Ajoute au moins un palier avec **/panelrank** avant de terminer la configuration.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          await setRankPanelFinished(interaction.guild.id, true);
          await interaction.reply({
            content:
              'Configuration des paliers **verrouillée**. Tu peux publier **/conditionpanel** dans un salon.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (sub === 'modifier') {
          await setRankPanelFinished(interaction.guild.id, false);
          await interaction.reply({
            content:
              'Tu peux à nouveau modifier les paliers avec **/panelrank**. **/conditionpanel** est bloqué jusqu’à **/finishrankpanel terminer**.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      if (slashName === 'conditionpanel') {
        if (!interaction.guild) {
          await interaction.reply({
            content: 'À utiliser sur un **serveur**.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const cfg = await getGuildConfig(interaction.guild.id);
        if (!cfg.rankPanelFinished) {
          await interaction.reply({
            content:
              'Termine d’abord la configuration : **/finishrankpanel terminer** (après **/panelrank**).',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (!cfg.panelRanks?.length) {
          await interaction.reply({
            content: 'Aucun palier configuré. Utilise **/panelrank**.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const embeds = buildConditionPanelEmbeds(interaction.guild, cfg);
        await interaction.reply({ embeds });
        return;
      }

      console.warn(
        '[interaction] Slash non géré :',
        JSON.stringify(slashName),
        'commandType=',
        interaction.commandType,
      );
      await interaction
        .reply({
          content: `Commande \`/${slashName || '?'}\` inconnue. Lance \`npm run deploy\` puis redémarre le bot.`,
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
      return;
    }

    if (!interaction.guild) return;

    if (interaction.isRoleSelectMenu() && interaction.customId === 'panelrank_pick_role') {
      const role = interaction.roles.first();
      if (role) setPendingRole(interaction.guild.id, interaction.user.id, role.id);
      const payload = await buildPanelrankPayload(interaction.guild, role?.id ?? null);
      try {
        await interaction.update(payload);
      } catch (e) {
        console.error('panelrank_pick_role:', e);
        await interaction
          .reply({
            content: `Erreur mise à jour. Rouvre \`/panelrank\`.`,
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
      return;
    }

    if (interaction.isButton() && interaction.customId === 'panelrank_open_modal') {
      const rid = getPendingRole(interaction.guild.id, interaction.user.id);
      if (!rid) {
        await interaction.reply({
          content: 'Choisis d’abord un **rôle** dans le menu.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.showModal(buildPrereqModal());
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'panelrank_modal') {
      const rid = getPendingRole(interaction.guild.id, interaction.user.id);
      if (!rid) {
        await interaction.reply({
          content: 'Session expirée — refais **/panelrank** et choisis un rôle.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const rawM = interaction.fields.getTextInputValue('panelrank_msgs').trim();
      const rawV = interaction.fields.getTextInputValue('panelrank_vocal').trim().replace(',', '.');
      const minMessages = parseInt(rawM, 10);
      const minVocalHours = parseFloat(rawV);
      if (!Number.isFinite(minMessages) || minMessages < 0) {
        await interaction.reply({
          content: 'Nombre de **messages** invalide (entier ≥ 0).',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!Number.isFinite(minVocalHours) || minVocalHours < 0) {
        await interaction.reply({
          content: '**Heures vocales** invalides (nombre ≥ 0, ex. 12 ou 12.5).',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await upsertPanelRank(interaction.guild.id, {
        roleId: rid,
        minMessages,
        minVocalHours,
      });
      clearPendingRole(interaction.guild.id, interaction.user.id);
      await interaction.reply({
        content: `Palier enregistré pour <@&${rid}> : **${minMessages}** messages, **${minVocalHours}** h vocal. Utilise **/panelrank** pour voir la liste ou **/rank** pour la carte.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'panelrank_remove') {
      const roleId = interaction.values[0];
      await removePanelRank(interaction.guild.id, roleId);
      const payload = await buildPanelrankPayload(interaction.guild);
      try {
        await interaction.update(payload);
      } catch (e) {
        console.error('panelrank_remove:', e);
        await interaction
          .reply({ content: 'Palier supprimé. Rouvre `/panelrank` si besoin.', flags: MessageFlags.Ephemeral })
          .catch(() => {});
      }
      return;
    }
  } catch (err) {
    console.error('interactionCreate:', err);
    try {
      const msg = err instanceof Error ? err.message : String(err);
      const text = `Erreur : ${msg.slice(0, 500)}`;
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: text, flags: MessageFlags.Ephemeral }).catch(() => {});
      } else {
        await interaction.reply({ content: text, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }
});

if (!TOKEN || !CLIENT_ID) {
  console.error('Renseigne DISCORD_TOKEN et CLIENT_ID dans .env (voir .env.example).');
  process.exit(1);
}
if (!SNOWFLAKE.test(CLIENT_ID)) {
  console.error('CLIENT_ID invalide : uniquement l’Application ID (chiffres).');
  process.exit(1);
}

(async () => {
  try {
    await initStorage();
    await client.login(TOKEN);
  } catch (e) {
    console.error('Démarrage impossible :', e);
    process.exit(1);
  }
})();
