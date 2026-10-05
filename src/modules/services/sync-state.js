/** Encrypted, workspace-scoped recovery records. Only loaded by the worker. */
(function (global) {
  const pending = new Map();
  const prefix = "b2r_sync_";

  function scope(settings) {
    return JSON.stringify([
      new URL(normalizeBacklogOrigin(settings.backlogDomain || TB.BACKLOG_DOMAIN)).origin,
      new URL(settings.redmineDomain).origin,
    ]);
  }

  async function key(settings, kind, identity, legacy = false) {
    const input = new TextEncoder().encode(JSON.stringify([scope(settings), kind, identity]));
    const digest = await crypto.subtle.digest("SHA-256", input);
    const identityHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    if (legacy) return prefix + identityHash;
    const workspaceHash = await workspacePrefix(settings);
    return `${workspaceHash}${kind}_${identityHash}`;
  }
  async function workspacePrefix(settings) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(scope(settings)));
    return (
      prefix +
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("") +
      "_"
    );
  }

  async function read(settings, kind, identity) {
    const storageKey = await key(settings, kind, identity);
    let items = await chrome.storage.local.get(storageKey);
    if (!items[storageKey]) {
      const legacyKey = await key(settings, kind, identity, true);
      const legacy = await chrome.storage.local.get(legacyKey);
      items = { [storageKey]: legacy[legacyKey] };
    }
    if (!items[storageKey]) return null;
    const plaintext = await decryptData(items[storageKey]);
    if (!plaintext) {
      throw new Error("Recovery data could not be decrypted. Do not repeat the remote operation.");
    }
    const value = JSON.parse(plaintext);
    if (value.scope !== scope(settings) || value.kind !== kind) {
      throw new Error("Invalid recovery record.");
    }
    return value;
  }

  async function write(settings, kind, identity, record) {
    const storageKey = await key(settings, kind, identity);
    const value = {
      ...record,
      scope: scope(settings),
      kind,
      identity,
      updatedAt: new Date().toISOString(),
    };
    const encrypted = await encryptData(JSON.stringify(value));
    await chrome.storage.local.set({ [storageKey]: encrypted });
    // Delete the legacy payload only after its replacement is durably stored.
    const legacyKey = await key(settings, kind, identity, true);
    const legacy = await chrome.storage.local.get(legacyKey);
    if (legacy[legacyKey] !== undefined) await chrome.storage.local.remove(legacyKey);
    return value;
  }

  function run(operation, settings, kind = "", identity = "") {
    const lockKey = settings ? JSON.stringify([scope(settings), kind, identity]) : "legacy";
    const result = (pending.get(lockKey) || Promise.resolve()).then(operation);
    const tail = result.catch(() => {});
    pending.set(lockKey, tail);
    void tail.then(() => {
      if (pending.get(lockKey) === tail) pending.delete(lockKey);
    });
    return result;
  }

  async function list(settings, kind) {
    const items = await chrome.storage.local.get(null);
    const records = new Map();
    const workspace = await workspacePrefix(settings);
    for (const [storageKey, encrypted] of Object.entries(items)) {
      if (!storageKey.startsWith(prefix)) continue;
      if (
        !/^b2r_sync_[a-f0-9]{64}$/.test(storageKey) &&
        !storageKey.startsWith(workspace + (kind ? `${kind}_` : ""))
      ) {
        continue;
      }
      const plaintext = await decryptData(encrypted);
      if (!plaintext) throw new Error("Recovery data could not be decrypted.");
      const record = JSON.parse(plaintext);
      if (record.scope === scope(settings) && (!kind || record.kind === kind)) {
        const recordKey = JSON.stringify([record.kind, record.identity]);
        if (!records.has(recordKey) || records.get(recordKey).updatedAt <= record.updatedAt) {
          records.set(recordKey, record);
        }
      }
    }
    return [...records.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async function remove(settings, kind, identity) {
    await chrome.storage.local.remove(await key(settings, kind, identity));
    await chrome.storage.local.remove(await key(settings, kind, identity, true));
  }

  global.TB_SYNC_STATE = Object.freeze({ scope, read, write, run, list, remove });
})(globalThis);
