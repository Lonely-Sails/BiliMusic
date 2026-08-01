function parseLRC(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const raw = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      let millis = parseInt(match[3]);
      if (match[3].length === 2) millis *= 10;
      const time = minutes * 60 + seconds + millis / 1000;
      const text = line.replace(timeRegex, '').trim();
      if (text) {
        raw.push({ time, text });
      }
    }
  }

  raw.sort((a, b) => a.time - b.time);

  // Merge consecutive lines with same timestamp into original + translation pairs
  const result = [];
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i];
    const next = raw[i + 1];
    if (next && Math.abs(next.time - cur.time) < 0.01) {
      result.push({ time: cur.time, text: cur.text, trans: next.text !== '//' ? next.text : '' });
      i++; // skip the next line
    } else {
      result.push({ time: cur.time, text: cur.text });
    }
  }

  return result;
}

/**
 * Merge original lyrics with translation lyrics.
 * For each original lyric line, find the closest translation line by time.
 * If they're close enough (within TIME_THRESHOLD seconds), merge the translation.
 *
 * @param {Array<{time:number,text:string}>} originals - Original lyric lines
 * @param {Array<{time:number,text:string}>} translations - Translation lyric lines
 * @param {number} threshold - Max time difference to consider a match (default 0.5s)
 * @returns {Array<{time:number,text:string,trans?:string}>}
 */
function mergeTranslations(originals, translations, threshold = 0.5) {
  if (!translations || translations.length === 0) {
    return originals.map((l) => ({ ...l }));
  }
  if (!originals || originals.length === 0) {
    return [];
  }

  let tIdx = 0;
  const result = [];

  for (const orig of originals) {
    const merged = { time: orig.time, text: orig.text };

    // Find the best matching translation line
    let bestMatch = null;
    let bestDiff = Infinity;

    // Search forward from current translation index
    for (let i = tIdx; i < translations.length; i++) {
      const diff = Math.abs(translations[i].time - orig.time);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestMatch = i;
      }
      // If translations are ahead, stop searching
      if (translations[i].time > orig.time + threshold) break;
    }

    if (bestMatch !== null && bestDiff <= threshold) {
      merged.trans = translations[bestMatch].text !== '//' ? translations[bestMatch].text : '';
      tIdx = bestMatch + 1; // Move past the matched translation
    }

    result.push(merged);
  }
  return result;
}

/**
 * 制作信息/版权声明关键词列表 — 匹配歌词行前缀
 * 这些行不是真正的歌词内容，应该被过滤掉
 */
const PRODUCTION_PREFIXES = [
  '作词',
  '作曲',
  '编曲',
  '制作人',
  '制作',
  'OP',
  'SP',
  '混音',
  '录音',
  '录制',
  '监制',
  '出品',
  '发行',
  '企划',
  '统筹',
  '原唱',
  '翻唱',
  '和声',
  '和音',
  '词',
  '曲',
  '封面',
  '摄影',
  '吉他',
  '贝斯',
  '鼓',
  '键盘',
  '弦乐',
  '配唱',
  '人声',
  '母带',
  '特别感谢',
  '未经授权',
  '未經授權',
  '本歌曲',
  'Lyrics',
  'Music',
  'Produced',
  'Arranged',
  'Mixed',
  'Mastered',
  'Recorded',
];

/**
 * 过滤歌词数组中的制作信息/版权声明等非歌词行
 * @param {Array<{time:number,text:string,trans?:string}>} lyrics
 * @returns {Array<{time:number,text:string,trans?:string}>}
 */
function cleanLyrics(lyrics) {
  if (!lyrics?.length) return lyrics;

  return lyrics.filter((line) => {
    const text = line.text?.trim();
    if (!text) return false;

    // 过滤纯标点/符号行（~~~、---、…等）
    if (/^[~\-—….#・·\s]{1,10}$/.test(text)) return false;

    // 过滤制作信息前缀行
    for (const prefix of PRODUCTION_PREFIXES) {
      if (text.startsWith(prefix + '：') || text.startsWith(prefix + ':') || text === prefix) {
        return false;
      }
    }

    // 过滤 ℗ © 版权声明
    if (/^[℗©P]/.test(text) && /(Copy|Right|Record|出品|发行|版权所有|All\s*Rights)/i.test(text))
      return false;

    return true;
  });
}

export { parseLRC, mergeTranslations, cleanLyrics };
