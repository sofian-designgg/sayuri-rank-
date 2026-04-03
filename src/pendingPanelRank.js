/**
 * Session /panelrank : slot (navigation), brouillon rôles, tierId en édition.
 */

const { normalizePanelRankEntry, getTierId } = require('./panelRankUtils');

const pending = new Map();

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

const TTL_MS = 15 * 60 * 1000;

function mergeField(patchVal, prevVal) {
  if (patchVal !== undefined) return patchVal === null ? undefined : patchVal;
  return prevVal;
}

/**
 * @param {string} guildId
 * @param {string} userId
 * @param {{
 *   slotIndex?: number,
 *   editingTierId?: string | null,
 *   permRoleId?: string | null,
 *   aestheticRoleId?: string | null,
 * }} patch
 */
function patchPanelSession(guildId, userId, patch) {
  const k = key(guildId, userId);
  const prev = pending.get(k) || {};
  const next = {
    slotIndex: mergeField(patch.slotIndex, prev.slotIndex),
    editingTierId: mergeField(patch.editingTierId, prev.editingTierId),
    permRoleId: mergeField(patch.permRoleId, prev.permRoleId),
    aestheticRoleId: mergeField(patch.aestheticRoleId, prev.aestheticRoleId),
    expires: Date.now() + TTL_MS,
  };
  pending.set(k, next);
}

/**
 * @returns {{
 *   slotIndex: number,
 *   editingTierId?: string,
 *   permRoleId?: string,
 *   aestheticRoleId?: string,
 * } | null}
 */
function getPanelSession(guildId, userId) {
  const k = key(guildId, userId);
  const p = pending.get(k);
  if (!p || p.expires < Date.now()) {
    pending.delete(k);
    return null;
  }
  return {
    slotIndex: p.slotIndex,
    editingTierId: p.editingTierId,
    permRoleId: p.permRoleId,
    aestheticRoleId: p.aestheticRoleId,
  };
}

/**
 * Démarre une session : par défaut sur « nouveau palier » (slot = nombre de paliers).
 * @param {object[]} sortedPanelRanks — déjà triés
 */
function initPanelSession(guildId, userId, sortedPanelRanks) {
  const maxSlot = sortedPanelRanks.length;
  patchPanelSession(guildId, userId, {
    slotIndex: maxSlot,
    editingTierId: null,
    permRoleId: null,
    aestheticRoleId: null,
  });
}

/**
 * @param {object[]} sorted — sortPanelRanks
 * @param {number} slotIndex
 */
function setSessionToSlot(guildId, userId, sorted, slotIndex) {
  const maxSlot = sorted.length;
  const slot = Math.max(0, Math.min(slotIndex, maxSlot));
  if (slot < sorted.length) {
    const tier = normalizePanelRankEntry(sorted[slot]);
    patchPanelSession(guildId, userId, {
      slotIndex: slot,
      editingTierId: getTierId(tier) || null,
      permRoleId: tier.permRoleId,
      aestheticRoleId: tier.aestheticRoleId,
    });
  } else {
    patchPanelSession(guildId, userId, {
      slotIndex: slot,
      editingTierId: null,
      permRoleId: null,
      aestheticRoleId: null,
    });
  }
}

function hasBothPendingRoles(guildId, userId) {
  const p = getPanelSession(guildId, userId);
  return Boolean(p?.permRoleId && p?.aestheticRoleId);
}

function clearPanelSession(guildId, userId) {
  pending.delete(key(guildId, userId));
}

/** Compat : même chose que patch rôles */
function setPendingPanelRoles(guildId, userId, patch) {
  patchPanelSession(guildId, userId, {
    permRoleId: patch.permRoleId !== undefined ? patch.permRoleId : undefined,
    aestheticRoleId: patch.aestheticRoleId !== undefined ? patch.aestheticRoleId : undefined,
  });
}

function getPendingPanelRoles(guildId, userId) {
  const s = getPanelSession(guildId, userId);
  if (!s) return null;
  return { permRoleId: s.permRoleId, aestheticRoleId: s.aestheticRoleId };
}

function clearPendingPanelRoles(guildId, userId) {
  clearPanelSession(guildId, userId);
}

function setPendingRole(guildId, userId, roleId) {
  setPendingPanelRoles(guildId, userId, { permRoleId: roleId, aestheticRoleId: roleId });
}

function getPendingRole(guildId, userId) {
  return getPendingPanelRoles(guildId, userId)?.permRoleId ?? null;
}

function clearPendingRole(guildId, userId) {
  clearPanelSession(guildId, userId);
}

module.exports = {
  patchPanelSession,
  getPanelSession,
  initPanelSession,
  setSessionToSlot,
  hasBothPendingRoles,
  clearPanelSession,
  setPendingPanelRoles,
  getPendingPanelRoles,
  clearPendingPanelRoles,
  setPendingRole,
  getPendingRole,
  clearPendingRole,
};
