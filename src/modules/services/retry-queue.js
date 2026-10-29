/**
 * Offline & Network Resilience Retry Queue for Backlog2Redmine.
 * Persists pending/failed synchronization operations during network loss
 * and allows retrying them automatically or manually once reconnected.
 */
(function (global) {
  const STORAGE_KEY = "tb_retry_queue";
  const MAX_QUEUE_ITEMS = 50;

  function generateId() {
    return "rq_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  async function getQueue() {
    try {
      const items = await chrome.storage.local.get(STORAGE_KEY);
      const queue = items[STORAGE_KEY];
      return Array.isArray(queue) ? queue : [];
    } catch (_error) {
      return [];
    }
  }

  async function saveQueue(queue) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: queue.slice(0, MAX_QUEUE_ITEMS) });
      return true;
    } catch (error) {
      console.warn("[RETRY-QUEUE] Save failed:", error.message);
      return false;
    }
  }

  async function enqueue(item) {
    if (!item || typeof item !== "object") {
      throw new TypeError("Invalid retry queue item.");
    }
    const queue = await getQueue();
    const entry = {
      id: item.id || generateId(),
      type: String(item.type || "SEND_TO_REDMINE"),
      payload: item.payload || {},
      label: String(item.label || "Tác vụ đồng bộ"),
      error: String(item.error || "Mất kết nối mạng"),
      timestamp: item.timestamp || Date.now(),
      retryCount: Number(item.retryCount || 0),
      maxRetries: Number(item.maxRetries || 3),
      status: "pending",
    };

    // Avoid duplicate item for the same operation if already in queue
    const existingIndex = queue.findIndex(
      (q) => q.type === entry.type && JSON.stringify(q.payload) === JSON.stringify(entry.payload)
    );

    if (existingIndex >= 0) {
      queue[existingIndex].error = entry.error;
      queue[existingIndex].timestamp = Date.now();
      queue[existingIndex].status = "pending";
    } else {
      queue.unshift(entry);
    }

    if (queue.length > MAX_QUEUE_ITEMS) {
      queue.length = MAX_QUEUE_ITEMS;
    }

    await saveQueue(queue);
    return entry;
  }

  async function list() {
    return await getQueue();
  }

  async function get(id) {
    const queue = await getQueue();
    return queue.find((q) => q.id === id) || null;
  }

  async function remove(id) {
    const queue = await getQueue();
    const filtered = queue.filter((q) => q.id !== id);
    await saveQueue(filtered);
    return filtered.length < queue.length;
  }

  async function clear() {
    await chrome.storage.local.remove(STORAGE_KEY);
    return true;
  }

  async function count() {
    const queue = await getQueue();
    return queue.length;
  }

  async function markStatus(id, status, errorMsg = "") {
    const queue = await getQueue();
    const item = queue.find((q) => q.id === id);
    if (!item) return false;

    item.status = status;
    item.retryCount = (item.retryCount || 0) + 1;
    if (errorMsg) {
      item.error = String(errorMsg);
    }
    await saveQueue(queue);
    return true;
  }

  global.TB_RETRY_QUEUE = Object.freeze({
    enqueue,
    list,
    get,
    remove,
    clear,
    count,
    markStatus,
  });
})(typeof window !== "undefined" ? window : globalThis);
