/** Rôles choisis dans /panelrank (perm + esthétique) avant le modal prérequis. */

const pending = new Map();

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

const TTL_MS = 15 * 60 * 1000;

/**
 * @param {string} guildId
 * @param {string} userId
 * @param {{ permRoleId?: string, aestheticRoleId?: string }} patch
 */
function setPendingPanelRoles(guildId, userId, patch) {
  const k = key(guildId, userId);
  const prev = pending.get(k);
  const next = {
    permRoleId: patch.permRoleId != null ? String(patch.permRoleId) : prev?.permRoleId,
    aestheticRoleId:
      patch.aestheticRoleId != null ? String(patch.aestheticRoleId) : prev?.aestheticRoleId,
    expires: Date.now() + TTL_MS,
  };
  pending.set(k, next);
}

/**
 * @returns {{ permRoleId?: string, aestheticRoleId?: string } | null}
 */
function getPendingPanelRoles(guildId, userId) {
  const k = key(guildId, userId);
  const p = pending.get(k);
  if (!p || p.expires < Date.now()) {
    pending.delete(k);
    return null;
  }
  return { permRoleId: p.permRoleId, aestheticRoleId: p.aestheticRoleId };
}

function hasBothPendingRoles(guildId, userId) {
  const p = getPendingPanelRoles(guildId, userId);
  return Boolean(p?.permRoleId && p?.aestheticRoleId);
}

function clearPendingPanelRoles(guildId, userId) {
  pending.delete(key(guildId, userId));
}

/** @deprecated compat */
function setPendingRole(guildId, userId, roleId) {
  setPendingPanelRoles(guildId, userId, { permRoleId: roleId, aestheticRoleId: roleId });
}

/** @deprecated compat */
function getPendingRole(guildId, userId) {
  const p = getPendingPanelRoles(guildId, userId);
  return p?.permRoleId ?? null;
}

/** @deprecated compat */
function clearPendingRole(guildId, userId) {
  clearPendingPanelRoles(guildId, userId);
}

module.exports = {
  setPendingPanelRoles,
  getPendingPanelRoles,
  hasBothPendingRoles,
  clearPendingPanelRoles,
  setPendingRole,
  getPendingRole,
  clearPendingRole,
};
