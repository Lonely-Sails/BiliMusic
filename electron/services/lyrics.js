/**
 * 歌词服务 — 本地 LRC 管理与在线歌词候选编排
 */

import { app, shell } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { getVideoInfo } from '../api/video.js';
import { parseLRC, mergeTranslations } from '../api/lyricUtils.js';
import { searchCandidates, fetchLyric, searchRankedCandidates } from '../api/lyricSources.js';

function getLyricsDir() {
  const directory = join(app.getPath('userData'), 'lyrics');
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  return directory;
}

function getSafeLyricPath(fileName) {
  if (typeof fileName !== 'string' || !fileName || fileName !== basename(fileName)) {
    throw new Error('invalid lyric file name');
  }
  return join(getLyricsDir(), fileName);
}

function findLocalLyric(title, bvid) {
  if (!title && !bvid) return null;
  const directory = getLyricsDir();
  const keyword = title?.toLowerCase() || '';

  for (const file of readdirSync(directory).filter((item) => item.endsWith('.lrc'))) {
    try {
      const content = readFileSync(join(directory, file), 'utf-8');
      const lines = content.split('\n');
      const bvidLine = lines.find((line) => line.startsWith('[bvid:'));
      const fileBvid = bvidLine ? bvidLine.replace('[bvid:', '').replace(']', '').trim() : '';
      if (bvid && fileBvid === bvid) {
        const lyrics = parseLRC(content);
        if (lyrics.length > 0) return lyrics;
      }

      const titleLine = lines.find((line) => line.startsWith('[ti:'));
      const songTitle = titleLine
        ? titleLine.replace('[ti:', '').replace(']', '').trim()
        : file.replace('.lrc', '');
      if (
        title &&
        (songTitle.toLowerCase().includes(keyword) || keyword.includes(songTitle.toLowerCase()))
      ) {
        const lyrics = parseLRC(content);
        if (lyrics.length > 0) return lyrics;
      }
    } catch {
      // Ignore malformed files and continue searching.
    }
  }
  return null;
}

function extractSearchKeyword(videoInfo, fallbackTitle) {
  if (videoInfo?.bgm_info?.music_title) {
    const bgmTitle = videoInfo.bgm_info.music_title
      .replace(/^发现/, '')
      .replace(/[《》【】「」]/g, '')
      .trim();
    if (bgmTitle) return bgmTitle;
  }
  if (videoInfo?.title) {
    for (const pattern of [/《(.+?)》/, /【(.+?)】/, /「(.+?)」/, /"(.+?)"/]) {
      const match = videoInfo.title.match(pattern);
      if (match) return match[1].trim();
    }
    return videoInfo.title.trim();
  }
  return fallbackTitle?.trim() || '';
}

async function getLyrics(bvid, cid, title) {
  let videoInfo = null;
  if (bvid) {
    try {
      videoInfo = await getVideoInfo(bvid, null);
    } catch {
      /* Continue with title fallback. */
    }
  }

  const keyword = extractSearchKeyword(videoInfo, title);
  if (keyword || bvid) {
    const localLyrics = findLocalLyric(keyword, bvid);
    if (localLyrics) return { source: 'local', lyrics: localLyrics };
  }

  if (!keyword) return { source: 'none', lyrics: [] };

  const ranked = await searchRankedCandidates(
    keyword,
    videoInfo?.title || keyword,
    videoInfo?.author
  );
  const successful = [];
  for (const candidate of ranked) {
    const result = await fetchLyric(candidate.source, candidate.id);
    if (!result) continue;
    if (result.trans?.length) result.lyrics = mergeTranslations(result.lyrics, result.trans);
    successful.push({ ...result, candidate });
  }

  successful.sort((left, right) => {
    const scoreDifference = (right.candidate?.score || 0) - (left.candidate?.score || 0);
    if (scoreDifference !== 0) return scoreDifference;
    return (right.trans?.length > 0 ? 1 : 0) - (left.trans?.length > 0 ? 1 : 0);
  });
  return successful[0] || { source: 'none', lyrics: [] };
}

async function fetchMergedLyric(source, id) {
  const result = await fetchLyric(source, id);
  if (result?.trans?.length) result.lyrics = mergeTranslations(result.lyrics, result.trans);
  return result;
}

function listLocalLyrics() {
  try {
    const directory = getLyricsDir();
    return readdirSync(directory)
      .filter((file) => file.endsWith('.lrc'))
      .map((file) => {
        const filePath = join(directory, file);
        const lines = readFileSync(filePath, 'utf-8')
          .split('\n')
          .filter((line) => line.trim());
        const getTag = (tag) =>
          lines
            .find((line) => line.startsWith(`[${tag}:`))
            ?.replace(`[${tag}:`, '')
            .replace(']', '')
            .trim() || '';
        return {
          fileName: file,
          filePath,
          song: getTag('ti') || file.replace('.lrc', ''),
          artist: getTag('ar'),
          lineCount: lines.filter((line) => line.startsWith('[')).length,
          sourceName: getTag('source'),
          source: 'local',
        };
      });
  } catch {
    return [];
  }
}

function readLocalLyric(fileName) {
  const filePath = getSafeLyricPath(fileName);
  return existsSync(filePath) ? readFileSync(filePath, 'utf-8') : null;
}

function saveLocalLyric(fileName, content) {
  writeFileSync(getSafeLyricPath(fileName), content, 'utf-8');
}

async function openLyricsFolder() {
  await shell.openPath(getLyricsDir());
}

function clearLocalLyrics() {
  const directory = getLyricsDir();
  const files = readdirSync(directory).filter((file) => file.endsWith('.lrc'));
  for (const file of files) unlinkSync(join(directory, file));
  return files.length;
}

export {
  getLyrics,
  searchCandidates,
  searchRankedCandidates,
  fetchMergedLyric,
  listLocalLyrics,
  readLocalLyric,
  saveLocalLyric,
  openLyricsFolder,
  clearLocalLyrics,
};
