function parseLRC(lrcText) {
  if (!lrcText) return []
  const lines = lrcText.split('\n')
  const raw = []
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/

  for (const line of lines) {
    const match = line.match(timeRegex)
    if (match) {
      const minutes = parseInt(match[1])
      const seconds = parseInt(match[2])
      let millis = parseInt(match[3])
      if (match[3].length === 2) millis *= 10
      const time = minutes * 60 + seconds + millis / 1000
      const text = line.replace(timeRegex, '').trim()
      if (text) {
        raw.push({ time, text })
      }
    }
  }

  raw.sort((a, b) => a.time - b.time)

  // Merge consecutive lines with same timestamp into original + translation pairs
  const result = []
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i]
    const next = raw[i + 1]
    if (next && Math.abs(next.time - cur.time) < 0.01) {
      result.push({ time: cur.time, text: cur.text, trans: next.text !== '//' ? next.text : '' })
      i++ // skip the next line
    } else {
      result.push({ time: cur.time, text: cur.text })
    }
  }
  
  return result
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
    return originals.map(l => ({ ...l }))
  }
  if (!originals || originals.length === 0) {
    return []
  }

  let tIdx = 0
  const result = []

  for (const orig of originals) {
    const merged = { time: orig.time, text: orig.text }

    // Find the best matching translation line
    let bestMatch = null
    let bestDiff = Infinity

    // Search forward from current translation index
    for (let i = tIdx; i < translations.length; i++) {
      const diff = Math.abs(translations[i].time - orig.time)
      if (diff < bestDiff) {
        bestDiff = diff
        bestMatch = i
      }
      // If translations are ahead, stop searching
      if (translations[i].time > orig.time + threshold) break
    }

    if (bestMatch !== null && bestDiff <= threshold) {
      merged.trans = translations[bestMatch].text !== '//' ? translations[bestMatch].text : ''
      tIdx = bestMatch + 1 // Move past the matched translation
    }

    result.push(merged)
  }
  return result
}

export { parseLRC, mergeTranslations }
