/** Rôle choisi dans /panelrank avant le modal prérequis. */

const pending = new Map();

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

const TTL_MS = 15 * 60 * 1000;

function setPendingRole(guildId, userId, roleId) {
  pending.set(key(guildId, userId), { roleId, expires: Date.now() + TTL_MS });
}

function getPendingRole(guildId, userId) {
  const k = key(guildId, userId);
  const p = pending.get(k);
  if (!p || p.expires < Date.now()) {
    pending.delete(k);
    return null;
  }
  return p.roleId;
}

function clearPendingRole(guildId, userId) {
  pending.delete(key(guildId, userId));
}

module.exports = {
  setPendingRole,
  getPendingRole,
  clearPendingRole,
};
