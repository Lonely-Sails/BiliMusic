function parseLRC(lrcText) {
  if (!lrcText) return []
  const lines = lrcText.split('\n')
  const lyricLines = []
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
        lyricLines.push({ time, text })
      }
    }
  }

  return lyricLines.sort((a, b) => a.time - b.time)
}

export { parseLRC }
