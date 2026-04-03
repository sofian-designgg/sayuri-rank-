/**
 * Enregistre les slash commands sans lancer le bot.
 * Usage : npm run deploy
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');
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

async function main() {
  if (!TOKEN || !CLIENT_ID) {
    console.error('Il manque DISCORD_TOKEN ou CLIENT_ID dans .env');
    process.exit(1);
  }
  if (!SNOWFLAKE.test(CLIENT_ID)) {
    console.error('CLIENT_ID doit être l’Application ID (chiffres uniquement).');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  if (GUILD_ID && SNOWFLAKE.test(GUILD_ID)) {
    try {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: slashCommandsJson,
      });
      console.log(`OK — guilde ${GUILD_ID} : commandes staff + /rank public.`);
      return;
    } catch (e) {
      console.error('Erreur guilde :', e?.rawError ?? e?.message ?? e);
    }
  } else if (GUILD_ID) {
    console.warn(`GUILD_ID ignoré : "${String(GUILD_ID).slice(0, 14)}..."`);
  }

  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommandsJson });
  console.log('OK — commandes GLOBAL (délai jusqu’à ~1 h).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
