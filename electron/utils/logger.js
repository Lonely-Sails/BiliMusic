/**
 * 统一日志模块 — 为所有主进程日志添加 [BiliMusic] 前缀和时间戳
 *
 * 用法：
 *   logger.info('Window created')
 *   logger.warn('API rate limit', details)
 *   logger.error('Fatal:', err)
 *
 * 日志级别（可通过 setLevel 控制）：
 *   DEBUG < INFO < WARN < ERROR
 */

const PREFIX = '[BiliMusic]';

const Levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
let level = Levels.DEBUG;

/** @returns {string} 当前时间 HH:MM:SS */
function timestamp() {
  return new Date().toISOString().slice(11, 19);
}

export const logger = {
  /** 设置日志级别，低于此级别的不输出 */
  setLevel(l) {
    level = l;
  },

  debug(...args) {
    if (level > Levels.DEBUG) return;
    console.log(`${timestamp()} ${PREFIX} [DEBUG]`, ...args);
  },

  info(...args) {
    if (level > Levels.INFO) return;
    console.log(`${timestamp()} ${PREFIX} [INFO]`, ...args);
  },

  warn(...args) {
    if (level > Levels.WARN) return;
    console.warn(`${timestamp()} ${PREFIX} [WARN]`, ...args);
  },

  error(...args) {
    if (level > Levels.ERROR) return;
    console.error(`${timestamp()} ${PREFIX} [ERROR]`, ...args);
  },
};
