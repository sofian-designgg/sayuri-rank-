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
} = require('discord.js');
const { generateSayuriCard } = require('./generateSayuriCard');
const { buildRankCardData } = require('./rankCardData');
const {
  initStorage,
  getGuildConfig,
  upsertPanelRank,
  removePanelRankByTierId,
  setRankAnnounceChannel,
  setRankPanelFinished,
  incrementMemberMessages,
  addMemberVocalMinutes,
} = require('./storage/guildRankConfig');
const { buildPanelrankPayload, buildPrereqModal } = require('./panelrankUi');
const { sortPanelRanks } = require('./panelRankResolver');
const {
  setPendingPanelRoles,
  getPanelSession,
  initPanelSession,
  patchPanelSession,
  setSessionToSlot,
  hasBothPendingRoles,
} = require('./pendingPanelRank');
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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
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

/** Vocal : début de session par membre (perte si redémarrage bot). */
const voiceSessionStartedAt = new Map();

client.on('messageCreate', async (msg) => {
  try {
    if (!msg.guild || msg.author.bot) return;
    await incrementMemberMessages(msg.guild.id, msg.author.id, 1);
  } catch (e) {
    console.error('messageCreate stats:', e);
  }
});

client.on('voiceStateUpdate', async (oldS, newS) => {
  try {
    const guild = newS.guild;
    const member = newS.member ?? oldS.member;
    if (!guild || !member?.user || member.user.bot) return;
    const guildId = guild.id;
    const userId = member.id;
    const key = `${guildId}:${userId}`;
    const oldCh = oldS.channelId;
    const newCh = newS.channelId;
    if (oldCh === newCh) return;

    const flush = async () => {
      const started = voiceSessionStartedAt.get(key);
      voiceSessionStartedAt.delete(key);
      if (started == null) return;
      const mins = (Date.now() - started) / 60000;
      await addMemberVocalMinutes(guildId, userId, mins);
    };

    if (oldCh && !newCh) {
      await flush();
    } else if (!oldCh && newCh) {
      voiceSessionStartedAt.set(key, Date.now());
    } else if (oldCh && newCh) {
      await flush();
      voiceSessionStartedAt.set(key, Date.now());
    }
  } catch (e) {
    console.error('voiceStateUpdate stats:', e);
  }
});

function isSlashCommand(interaction) {
  return (
    interaction.type === InteractionType.ApplicationCommand &&
    typeof interaction.commandName === 'string'
  );
}

/**
 * Slash : toute ApplicationCommand sauf menus contextuels et primary entry point.
 * (Évite les faux négatifs si commandType n’est pas exactement ChatInput côté lib/API.)
 */
function isGuildSlashChatCommand(interaction) {
  if (!interaction.isCommand()) return false;
  if (interaction.isContextMenuCommand()) return false;
  if (typeof interaction.isPrimaryEntryPointCommand === 'function' && interaction.isPrimaryEntryPointCommand()) {
    return false;
  }
  return true;
}

client.on('interactionCreate', async (interaction) => {
  try {
    const cmd = isSlashCommand(interaction) ? interaction.commandName : null;
    if (cmd) console.log(`[interaction] /${cmd} par ${interaction.user?.tag}`);

    if (isGuildSlashChatCommand(interaction)) {
      const slashName = (interaction.commandName || '')
        .trim()
        .normalize('NFKC')
        .toLowerCase();

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
          ...buildRankCardData(guildConfig, interaction.member),
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
      } else if (slashName === 'panelrank') {
        if (!interaction.guild) {
          await interaction.reply({
            content: 'À utiliser sur un **serveur**.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const cfg0 = await getGuildConfig(interaction.guild.id);
        initPanelSession(
          interaction.guild.id,
          interaction.user.id,
          sortPanelRanks(cfg0.panelRanks),
        );
        const sess = getPanelSession(interaction.guild.id, interaction.user.id);
        const payload = await buildPanelrankPayload(interaction.guild, sess ?? {});
        await interaction.reply({
          ...payload,
          flags: MessageFlags.Ephemeral,
        });
        return;
      } else if (slashName === 'setchannelrank') {
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
        await interaction.reply({
          content: 'Sous-commande inconnue. Utilise **définir** ou **retirer**.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      } else if (slashName === 'finishrankpanel') {
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
        await interaction.reply({
          content: 'Sous-commande inconnue. Utilise **terminer** ou **modifier**.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      } else if (slashName === 'conditionpanel') {
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

    if (
      interaction.isRoleSelectMenu() &&
      (interaction.customId === 'panelrank_pick_perm' ||
        interaction.customId === 'panelrank_pick_aesthetic')
    ) {
      const role = interaction.roles.first();
      if (role) {
        if (interaction.customId === 'panelrank_pick_perm') {
          setPendingPanelRoles(interaction.guild.id, interaction.user.id, { permRoleId: role.id });
        } else {
          setPendingPanelRoles(interaction.guild.id, interaction.user.id, { aestheticRoleId: role.id });
        }
      }
      const sess = getPanelSession(interaction.guild.id, interaction.user.id) ?? {};
      const payload = await buildPanelrankPayload(interaction.guild, sess);
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
      if (!hasBothPendingRoles(interaction.guild.id, interaction.user.id)) {
        await interaction.reply({
          content:
            'Choisis un **rôle permissions** et un **rôle esthétique** dans les deux menus (en haut).',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.showModal(buildPrereqModal());
      return;
    }

    if (
      interaction.isButton() &&
      ['panelrank_nav_prev', 'panelrank_nav_next', 'panelrank_nav_new', 'panelrank_delete_current'].includes(
        interaction.customId,
      )
    ) {
      const cfg = await getGuildConfig(interaction.guild.id);
      const sorted = sortPanelRanks(cfg.panelRanks);
      let sess = getPanelSession(interaction.guild.id, interaction.user.id);
      if (!sess) {
        initPanelSession(interaction.guild.id, interaction.user.id, sorted);
        sess = getPanelSession(interaction.guild.id, interaction.user.id);
      }
      const maxSlot = sorted.length;
      let slot = sess?.slotIndex ?? maxSlot;
      slot = Math.max(0, Math.min(slot, maxSlot));

      if (interaction.customId === 'panelrank_nav_prev') {
        setSessionToSlot(interaction.guild.id, interaction.user.id, sorted, slot - 1);
      } else if (interaction.customId === 'panelrank_nav_next') {
        setSessionToSlot(interaction.guild.id, interaction.user.id, sorted, slot + 1);
      } else if (interaction.customId === 'panelrank_nav_new') {
        setSessionToSlot(interaction.guild.id, interaction.user.id, sorted, maxSlot);
      } else if (interaction.customId === 'panelrank_delete_current') {
        if (slot >= maxSlot || !sess?.editingTierId) {
          await interaction.reply({
            content: 'Place-toi sur un **palier existant** (flèches) pour le supprimer.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await removePanelRankByTierId(interaction.guild.id, sess.editingTierId);
        const cfg2 = await getGuildConfig(interaction.guild.id);
        const sorted2 = sortPanelRanks(cfg2.panelRanks);
        const newSlot = Math.min(slot, sorted2.length);
        setSessionToSlot(interaction.guild.id, interaction.user.id, sorted2, newSlot);
      }

      const sess2 = getPanelSession(interaction.guild.id, interaction.user.id) ?? {};
      const payload = await buildPanelrankPayload(interaction.guild, sess2);
      try {
        await interaction.update(payload);
      } catch (e) {
        console.error('panelrank_nav:', e);
        await interaction
          .reply({ content: 'Erreur — rouvre `/panelrank`.', flags: MessageFlags.Ephemeral })
          .catch(() => {});
      }
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'panelrank_modal') {
      const sess = getPanelSession(interaction.guild.id, interaction.user.id);
      if (!sess?.permRoleId || !sess?.aestheticRoleId) {
        await interaction.reply({
          content: 'Session expirée — refais **/panelrank** et choisis les **deux** rôles.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const rawM = interaction.fields.getTextInputValue('panelrank_msgs').trim();
      const rawV = interaction.fields.getTextInputValue('panelrank_vocal').trim().replace(',', '.');
      const minMessages = parseInt(rawM, 10);
      const minVocalMinutes = parseInt(rawV, 10);
      if (!Number.isFinite(minMessages) || minMessages < 0) {
        await interaction.reply({
          content: 'Nombre de **messages** invalide (entier ≥ 0).',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!Number.isFinite(minVocalMinutes) || minVocalMinutes < 0) {
        await interaction.reply({
          content: '**Minutes vocales** invalides (entier ≥ 0, ex. 120 pour 2 h).',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await upsertPanelRank(interaction.guild.id, {
        tierId: sess.editingTierId || undefined,
        permRoleId: sess.permRoleId,
        aestheticRoleId: sess.aestheticRoleId,
        minMessages,
        minVocalMinutes,
      });
      const cfg3 = await getGuildConfig(interaction.guild.id);
      const sortedAfter = sortPanelRanks(cfg3.panelRanks);
      // Ne pas vider les rôles : sinon l’embed du panel montre encore les coches mais la session est vide
      // (même rôle perm sur plusieurs paliers = enchaîner « Prérequis » sans tout re-sélectionner).
      patchPanelSession(interaction.guild.id, interaction.user.id, {
        slotIndex: sortedAfter.length,
        editingTierId: null,
        permRoleId: sess.permRoleId,
        aestheticRoleId: sess.aestheticRoleId,
      });
      const sessFresh = getPanelSession(interaction.guild.id, interaction.user.id) ?? {};
      const payloadFresh = await buildPanelrankPayload(interaction.guild, sessFresh);
      if (interaction.message?.editable) {
        await interaction.message.edit(payloadFresh).catch(() => {});
      }
      await interaction.reply({
        content:
          `Palier enregistré — **Perm** <@&${sess.permRoleId}> · **Esth.** <@&${sess.aestheticRoleId}> : **${minMessages}** msgs, **${minVocalMinutes}** min vocal. Les **deux rôles restent actifs** : tu peux cliquer **Prérequis** pour le palier suivant (même rôles OK). Sinon rouvre **/panelrank** pour rafraîchir.`,
        flags: MessageFlags.Ephemeral,
      });
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
