/**
 * Crypto utilities for secure metadata storage.
 * Encrypts and decrypts API keys using AES-GCM-256.
 */

// Cached key material to avoid re-deriving on every operation
let cachedKeyMaterial = null;
let pendingKeyMaterial = null;
let pendingStorageId = null;

/**
 * Encrypts sensitive data using AES-GCM-256.
 * Encrypts sensitive data (API keys) before saving to chrome.storage.
 * @param {string} data - Data to encrypt
 * @returns {Promise<string>} Base64-encoded encrypted data
 */
async function encryptData(data) {
  if (!data) {
    return "";
  }
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const key = await deriveKey();
  // Generate random IV for each encryption (security best practice)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, dataBuffer);
  // Combine IV + encrypted data for storage
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  let binary = "";
  for (let offset = 0; offset < combined.length; offset += 8192) {
    binary += String.fromCharCode(...combined.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

/**
 * Decrypts data using AES-GCM-256.
 * Decrypts encrypted data from chrome.storage.
 * @param {string} encryptedData - Base64-encoded encrypted data
 * @returns {Promise<string>} Decrypted data or empty string on error
 */
async function decryptData(encryptedData) {
  if (!encryptedData) {
    return "";
  }
  try {
    const combined = new Uint8Array(
      atob(encryptedData)
        .split("")
        .map((c) => c.charCodeAt(0))
    );
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const key = await deriveKey();
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error("[TB-Crypto] Failed to decrypt data:", error);
    return "";
  }
}

/**
 * Derives encryption key using PBKDF2 with per-user salt.
 * Generates encryption key from PBKDF2 with a unique salt for each user.
 * Uses a combination of fixed salt + user-specific identifier for uniqueness.
 * @returns {Promise<CryptoKey>} AES-GCM-256 key
 */
async function deriveKey() {
  if (!pendingKeyMaterial) {
    pendingKeyMaterial = deriveKeyOnce().catch((error) => {
      pendingKeyMaterial = null;
      throw error;
    });
  }
  return pendingKeyMaterial;
}

async function deriveKeyOnce() {
  // Use cached key material to avoid re-deriving on every operation
  if (cachedKeyMaterial) {
    return cachedKeyMaterial;
  }

  const encoder = new TextEncoder();

  // Generate user-specific salt component from chrome.storage ID
  // This makes each installation's encryption unique even with same master passphrase
  const storageId = await getUserStorageId();
  const combinedSalt = `backlog2redmine-${storageId}-2026`;

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(combinedSalt),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  // Cache the key material for reuse
  cachedKeyMaterial = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("additional-pepper-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  return cachedKeyMaterial;
}

/**
 * Gets or creates a unique storage ID for this Chrome installation.
 * Retrieves or creates a unique storage ID for this Chrome installation.
 * This ID is used to make encryption salt unique per user.
 * @returns {Promise<string>} Unique storage identifier
 */
async function getUserStorageId() {
  if (typeof window !== "undefined") {
    const response = await chrome.runtime.sendMessage({ type: "GET_CRYPTO_STORAGE_ID" });
    if (!response?.ok || typeof response.data !== "string") {
      throw new Error("Unable to initialize encrypted settings.");
    }
    return response.data;
  }
  if (pendingStorageId) return pendingStorageId;
  pendingStorageId = new Promise((resolve, reject) => {
    chrome.storage.local.get(["tb_storage_id"], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (result.tb_storage_id) {
        resolve(result.tb_storage_id);
        return;
      }

      // Generate new unique ID
      const newId = crypto.randomUUID();
      chrome.storage.local.set({ tb_storage_id: newId }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(newId);
      });
    });
  }).catch((error) => {
    pendingStorageId = null;
    throw error;
  });
  return pendingStorageId;
}
