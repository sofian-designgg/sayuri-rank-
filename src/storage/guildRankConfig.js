/**
 * Configuration par serveur — MongoDB (MONGO_URL) ou fichier JSON (fallback dev).
 */

const fs = require('fs');
const path = require('path');
const { connectMongo, getDb } = require('./mongoDb');
const { normalizePanelRanksArray, tierPermKey, normalizePanelRankEntry } = require('../panelRankUtils');

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'guildRankConfig.json');

/** @type {'mongo' | 'file'} */
let storageMode = 'file';

function normalizeGuildKey(guildId) {
  return String(guildId ?? '')
    .trim()
    .replace(/^\uFEFF/, '');
}

function ensureDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadAllFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveAllFile(data) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function emptyGuildBlob() {
  return {
    roles: {},
    tierOverrides: {},
    panelRanks: [],
    rankAnnounceChannelId: null,
    rankPanelFinished: false,
    memberRankNotify: {},
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} g
 * @returns {{ roles: Record<string, string>, tierOverrides: Record<string, unknown>, panelRanks: { permRoleId: string, aestheticRoleId: string, minMessages: number, minVocalHours: number }[], rankAnnounceChannelId: string | null, rankPanelFinished: boolean, memberRankNotify: Record<string, { p?: number, l?: number }> }}
 */
function normalizeGuildBlob(g) {
  if (!g) return { ...emptyGuildBlob() };
  const mr = g.memberRankNotify;
  return {
    roles: { ...(g.roles || {}) },
    tierOverrides: { ...(g.tierOverrides || {}) },
    panelRanks: normalizePanelRanksArray(g.panelRanks),
    rankAnnounceChannelId:
      g.rankAnnounceChannelId != null && String(g.rankAnnounceChannelId).trim() !== ''
        ? String(g.rankAnnounceChannelId).trim()
        : null,
    rankPanelFinished: Boolean(g.rankPanelFinished),
    memberRankNotify:
      typeof mr === 'object' && mr !== null && !Array.isArray(mr) ? { ...mr } : {},
  };
}

async function initStorage() {
  const url = String(process.env.MONGO_URL ?? '')
    .trim()
    .replace(/^\uFEFF/, '');
  if (url) {
    await connectMongo();
    storageMode = 'mongo';
    console.log('[storage] MongoDB (variable MONGO_URL)');
    return;
  }
  storageMode = 'file';
  console.warn('[storage] Fichier JSON (MONGO_URL non défini) — pour Railway, ajoute MONGO_URL.');
}

function isMongo() {
  return storageMode === 'mongo';
}

/** @returns {import('mongodb').Collection} */
function guildColl() {
  return getDb().collection('guilds');
}

async function mongoLoadRaw(id) {
  const doc = await guildColl().findOne({ _id: id });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest };
}

async function mongoSaveFull(id, blob) {
  await guildColl().replaceOne(
    { _id: id },
    {
      _id: id,
      roles: blob.roles,
      tierOverrides: blob.tierOverrides,
      panelRanks: blob.panelRanks,
      rankAnnounceChannelId: blob.rankAnnounceChannelId,
      rankPanelFinished: blob.rankPanelFinished,
      memberRankNotify: blob.memberRankNotify,
    },
    { upsert: true },
  );
}

async function loadGuildBlob(id) {
  if (isMongo()) {
    const raw = await mongoLoadRaw(id);
    return normalizeGuildBlob(raw);
  }
  const all = loadAllFile();
  return normalizeGuildBlob(all[id]);
}

async function saveGuildBlob(id, blob) {
  const n = normalizeGuildBlob(blob);
  if (isMongo()) {
    await mongoSaveFull(id, n);
    return;
  }
  const all = loadAllFile();
  all[id] = n;
  saveAllFile(all);
}

/** @returns {Promise<{ roles: Record<string, string>, tierOverrides: Record<string, unknown>, panelRanks: { permRoleId: string, aestheticRoleId: string, minMessages: number, minVocalHours: number }[], rankAnnounceChannelId: string | null, rankPanelFinished: boolean, memberRankNotify: Record<string, { p?: number, l?: number }> }>} */
async function getGuildConfig(guildId) {
  const id = normalizeGuildKey(guildId);
  if (!id) return normalizeGuildBlob(null);
  return loadGuildBlob(id);
}

async function upsertPanelRank(guildId, { permRoleId, aestheticRoleId, minMessages, minVocalHours }) {
  const id = normalizeGuildKey(guildId);
  if (!id) return;
  const perm = String(permRoleId ?? '').trim();
  if (!perm) return;
  const aes = String(aestheticRoleId ?? perm).trim();
  const cur = await loadGuildBlob(id);
  const arr = cur.panelRanks.filter((r) => tierPermKey(r) !== perm);
  arr.push(
    normalizePanelRankEntry({
      permRoleId: perm,
      aestheticRoleId: aes || perm,
      minMessages,
      minVocalHours,
    }),
  );
  cur.panelRanks = arr;
  await saveGuildBlob(id, cur);
}

async function removePanelRank(guildId, permRoleId) {
  const id = normalizeGuildKey(guildId);
  if (!id) return;
  const key = String(permRoleId ?? '').trim();
  if (!key) return;
  const cur = await loadGuildBlob(id);
  cur.panelRanks = cur.panelRanks.filter((r) => tierPermKey(r) !== key);
  await saveGuildBlob(id, cur);
}

async function setRoleForTier(guildId, tierId, roleId) {
  const id = normalizeGuildKey(guildId);
  if (!id) return;
  const cur = await loadGuildBlob(id);
  cur.roles[tierId] = roleId;
  await saveGuildBlob(id, cur);
}

async function clearRoleForTier(guildId, tierId) {
  const id = normalizeGuildKey(guildId);
  if (!id) return;
  const cur = await loadGuildBlob(id);
  delete cur.roles[tierId];
  await saveGuildBlob(id, cur);
}

async function setTierDisplayOverride(guildId, tierId, patch) {
  const id = normalizeGuildKey(guildId);
  if (!id) return;
  const cur = await loadGuildBlob(id);
  const t = { ...(cur.tierOverrides[tierId] || {}) };

  if ('name' in patch) {
    if (patch.name === null || patch.name === '') delete t.name;
    else t.name = patch.name;
  }
  if ('requis' in patch) {
    if (!patch.requis || patch.requis.length === 0) delete t.requis;
    else t.requis = patch.requis;
  }

  if (Object.keys(t).length === 0) delete cur.tierOverrides[tierId];
  else cur.tierOverrides[tierId] = t;
  await saveGuildBlob(id, cur);
}

async function clearTierDisplayOverride(guildId, tierId) {
  const id = normalizeGuildKey(guildId);
  if (!id) return;
  const cur = await loadGuildBlob(id);
  delete cur.tierOverrides[tierId];
  await saveGuildBlob(id, cur);
}

async function setRankAnnounceChannel(guildId, channelId) {
  const id = normalizeGuildKey(guildId);
  if (!id) return;
  const cur = await loadGuildBlob(id);
  cur.rankAnnounceChannelId =
    channelId != null && String(channelId).trim() !== '' ? String(channelId).trim() : null;
  await saveGuildBlob(id, cur);
}

async function setRankPanelFinished(guildId, finished) {
  const id = normalizeGuildKey(guildId);
  if (!id) return;
  const cur = await loadGuildBlob(id);
  cur.rankPanelFinished = Boolean(finished);
  await saveGuildBlob(id, cur);
}

/**
 * @returns {Promise<{ p?: number, l?: number }>}
 */
async function getMemberRankNotifyState(guildId, userId) {
  const id = normalizeGuildKey(guildId);
  const uid = String(userId ?? '').trim();
  if (!id || !uid) return {};
  const cur = await loadGuildBlob(id);
  const s = cur.memberRankNotify[uid];
  if (!s || typeof s !== 'object') return {};
  return { ...s };
}

/**
 * @param {'p' | 'l'} key — p = panel, l = legacy (rankConfig)
 */
async function setMemberRankNotifyKey(guildId, userId, key, value) {
  const id = normalizeGuildKey(guildId);
  const uid = String(userId ?? '').trim();
  if (!id || !uid) return;
  const cur = await loadGuildBlob(id);
  if (!cur.memberRankNotify[uid] || typeof cur.memberRankNotify[uid] !== 'object') {
    cur.memberRankNotify[uid] = {};
  }
  cur.memberRankNotify[uid][key] = value;
  await saveGuildBlob(id, cur);
}

module.exports = {
  initStorage,
  getGuildConfig,
  upsertPanelRank,
  removePanelRank,
  setRoleForTier,
  clearRoleForTier,
  setTierDisplayOverride,
  clearTierDisplayOverride,
  setRankAnnounceChannel,
  setRankPanelFinished,
  getMemberRankNotifyState,
  setMemberRankNotifyKey,
};
