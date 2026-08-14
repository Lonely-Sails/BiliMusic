/**
 * Session 持久化 — 使用 Electron safeStorage 加密存储 B站登录态
 *
 * 存储格式（v1）：{ v: 1, encrypted: <base64> }，使用系统钥匙串加密
 * （macOS Keychain / Windows DPAPI）。
 *
 * 兼容性：
 * - Linux 无可用钥匙串时（safeStorage 不可用）回退为明文存储，并记录警告
 * - 旧版本无版本字段的明文 session.json 可直接读取（读后由调用方重写为加密格式）
 */

import { safeStorage } from 'electron';
import { readFileSync, writeFileSync } from 'fs';
import { logger } from './logger.js';

const FILE_VERSION = 1;

export function saveSessionFile(filePath, session) {
  const payload = JSON.stringify(session);
  let content;
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(payload);
    content = JSON.stringify({ v: FILE_VERSION, encrypted: encrypted.toString('base64') });
  } else {
    logger.warn('safeStorage unavailable, session will be stored in plaintext');
    content = JSON.stringify({ v: FILE_VERSION, plain: payload });
  }
  writeFileSync(filePath, content);
}

export function loadSessionFile(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);

  if (parsed && parsed.v === FILE_VERSION) {
    if (parsed.encrypted) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('safeStorage unavailable, cannot decrypt session');
      }
      const decrypted = safeStorage.decryptString(Buffer.from(parsed.encrypted, 'base64'));
      return JSON.parse(decrypted);
    }
    return parsed.plain ? JSON.parse(parsed.plain) : null;
  }

  // 旧版本：无版本字段的明文 session JSON
  return parsed;
}
