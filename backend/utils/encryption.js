'use strict';

const crypto = require('crypto');

/**
 * Encryption utility for securely storing sensitive settings (API keys, etc.).
 *
 * Uses AES-256-GCM for authenticated encryption. The encryption key is derived
 * from the ENCRYPTION_KEY environment variable (or a development-only fallback).
 *
 * Key rotation is supported — old keys can be kept in ENCRYPTION_KEY_PREVIOUS
 * so that values encrypted with the previous key can still be decrypted.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;  // 96 bits (recommended for GCM)
const AUTH_TAG_LENGTH = 16;

/**
 * Resolve the encryption key from environment or generate a development fallback.
 * In production, ENCRYPTION_KEY MUST be set.
 */
function resolveEncryptionKey() {
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey) {
        // If the key is hex-encoded, use it directly; otherwise derive from passphrase
        if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
            return Buffer.from(envKey, 'hex');
        }
        // Derive a key from the passphrase using SHA-256
        return crypto.createHash('sha256').update(envKey).digest();
    }

    if (process.env.NODE_ENV === 'production') {
        console.error(
            '[SECURITY] FATAL: ENCRYPTION_KEY must be set in production for encrypted settings storage. ' +
            'Refusing to start with insecure encryption.'
        );
        process.exit(1);
    }

    // Development fallback: deterministic key derived from a fixed seed
    const devKey = crypto.createHash('sha256').update('rpg-generator-dev-encryption-key').digest();
    console.warn(
        '[SECURITY] WARNING: ENCRYPTION_KEY not set. Using development-only encryption key. ' +
        'Set ENCRYPTION_KEY in production.'
    );
    return devKey;
}

let currentKey = null;
let previousKey = null;

function getCurrentKey() {
    if (!currentKey) {
        currentKey = resolveEncryptionKey();
    }
    return currentKey;
}

function getPreviousKey() {
    if (previousKey !== undefined) {
        return previousKey; // might be null if no previous key
    }
    const prevEnvKey = process.env.ENCRYPTION_KEY_PREVIOUS;
    if (prevEnvKey) {
        if (prevEnvKey.length === 64 && /^[0-9a-fA-F]+$/.test(prevEnvKey)) {
            previousKey = Buffer.from(prevEnvKey, 'hex');
        } else {
            previousKey = crypto.createHash('sha256').update(prevEnvKey).digest();
        }
    } else {
        previousKey = null;
    }
    return previousKey;
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded string containing: iv + authTag + ciphertext.
 *
 * @param {string} plaintext - The text to encrypt
 * @returns {string} Base64-encoded encrypted payload
 */
function encrypt(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Encryption requires a non-empty string');
    }

    const key = getCurrentKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    // Format: iv(12) + authTag(16) + ciphertext(variable)
    const payload = Buffer.concat([iv, authTag, encrypted]);
    return payload.toString('base64');
}

/**
 * Decrypt a base64-encoded encrypted payload.
 * Tries the current key first, then falls back to the previous key
 * (for key rotation support).
 *
 * @param {string} encoded - Base64-encoded encrypted payload
 * @returns {string|null} Decrypted plaintext, or null if decryption fails
 */
function decrypt(encoded) {
    if (!encoded || typeof encoded !== 'string') {
        return null;
    }

    try {
        const payload = Buffer.from(encoded, 'base64');
        if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
            return null;
        }

        const iv = payload.subarray(0, IV_LENGTH);
        const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        // Try current key
        try {
            const decipher = crypto.createDecipheriv(ALGORITHM, getCurrentKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
            decipher.setAuthTag(authTag);
            return decipher.update(ciphertext) + decipher.final('utf8');
        } catch (_currentKeyError) {
            // Current key failed, try previous key for rotation support
            const prevKey = getPreviousKey();
            if (prevKey) {
                try {
                    const decipher = crypto.createDecipheriv(ALGORITHM, prevKey, iv, { authTagLength: AUTH_TAG_LENGTH });
                    decipher.setAuthTag(authTag);
                    return decipher.update(ciphertext) + decipher.final('utf8');
                } catch (_prevKeyError) {
                    return null;
                }
            }
            return null;
        }
    } catch (_error) {
        return null;
    }
}

/**
 * Mask a sensitive string for safe logging.
 * Shows first 4 and last 4 characters, replacing the middle with asterisks.
 *
 * @param {string} value - The sensitive string to mask
 * @returns {string} Masked string
 */
function maskSecret(value) {
    if (!value || typeof value !== 'string') return '****';
    if (value.length <= 8) return '****';
    return value.substring(0, 4) + '*'.repeat(Math.min(value.length - 8, 12)) + value.substring(value.length - 4);
}

module.exports = { encrypt, decrypt, maskSecret, getCurrentKey };
