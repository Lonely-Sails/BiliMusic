<template>
  <div class="le-root">
    <!-- Header -->
    <div class="le-header">
      <h2>
        <Icon icon="mdi:playlist-edit" class="le-header-icon" />
        歌词编辑
      </h2>
      <button class="le-close-btn" @click="closeWindow">
        <Icon icon="mdi:close" />
      </button>
    </div>

    <!-- Splitter: Left / Right -->
    <Splitter
      class="splitter-group le-body"
      direction="horizontal"
      auto-save-id="lyrics-editor-splitter"
    >
      <SplitterPanel :default-size="36" :min-size="25" class="splitter-panel le-left">
        <div class="le-search-bar">
          <input
            v-model="searchQuery"
            class="le-input"
            placeholder="输入歌曲名搜索歌词..."
            @keyup.enter="doSearch"
          />
          <button
            class="le-search-btn"
            :disabled="searching || !searchQuery.trim()"
            @click="doSearch"
          >
            <Icon icon="mdi:magnify" />
          </button>
        </div>

        <div class="le-list-scroll">
          <div class="le-list">
            <div v-if="localLyrics.length > 0" class="le-section">
              <div class="le-section-title"><Icon icon="mdi:harddisk" /> 本地已保存</div>
              <div
                v-for="item in localLyrics"
                :key="'local-' + item.fileName"
                class="le-list-item"
                :class="{ selected: selectedKey === 'local|' + item.fileName }"
                @click="onSelect(item, 'local')"
              >
                <div class="le-list-item-radio">
                  <div v-if="selectedKey === 'local|' + item.fileName" class="le-list-item-dot" />
                </div>
                <div class="le-list-item-info">
                  <span class="le-list-item-title">{{
                    item.song || item.fileName.replace('.lrc', '')
                  }}</span>
                  <span class="le-list-item-meta"
                    >{{ item.artist || '未知歌手' }} · {{ item.lineCount }} 行</span
                  >
                </div>
              </div>
            </div>
            <div v-if="searchResults.length > 0" class="le-section">
              <div class="le-section-title"><Icon icon="mdi:cloud-outline" /> 在线搜索结果</div>
              <div
                v-for="item in searchResults"
                :key="'online-' + item.source + '-' + item.id"
                class="le-list-item"
                :class="{ selected: selectedKey === 'online|' + item.source + '|' + item.id }"
                @click="onSelect(item, 'online')"
              >
                <div class="le-list-item-radio">
                  <div
                    v-if="selectedKey === 'online|' + item.source + '|' + item.id"
                    class="le-list-item-dot"
                  />
                </div>
                <div class="le-list-item-info">
                  <span class="le-list-item-title">{{ item.song }}</span>
                  <span class="le-list-item-meta"
                    >{{ item.singer || '未知歌手' }}
                    <span class="le-list-item-source">{{ item.sourceName }}</span>
                  </span>
                </div>
                <div
                  v-if="item.score != null"
                  class="le-score-badge"
                  :class="scoreClass(item.score)"
                >
                  {{ (item.score * 100).toFixed(0) }}%
                </div>
                <template v-if="item.cover && !isCoverErrored(item)">
                  <img
                    v-if="item.sourceName.includes('QQ')"
                    :src="item.cover + '@48w_48h'"
                    class="le-list-item-cover"
                    @error="onCoverError(item)"
                  />
                  <img
                    v-else
                    :src="item.cover"
                    class="le-list-item-cover"
                    @error="onCoverError(item)"
                  />
                </template>
                <div v-else-if="isCoverErrored(item)" class="le-list-item-cover-fallback">
                  <Icon icon="mdi:music" />
                </div>
              </div>
            </div>
            <div
              v-if="localLyrics.length === 0 && searchResults.length === 0 && !searching"
              class="le-list-empty"
            >
              <Icon icon="mdi:file-music-outline" class="le-empty-icon" />
              <p>暂无歌词</p>
              <p class="le-empty-hint">搜索歌词后将在此显示</p>
            </div>
            <div v-if="searching" class="le-list-empty">
              <div class="spinner" />
              <p>搜索中...</p>
            </div>
          </div>
        </div>
      </SplitterPanel>

      <SplitterHandle class="splitter-handle" />

      <SplitterPanel :default-size="64" :min-size="30" class="splitter-panel le-right">
        <div class="le-toolbar">
          <div class="le-toolbar-group">
            <button
              class="le-tb-btn"
              :class="{ active: selectedLineIdx >= 0 }"
              :disabled="!lyricLines.length"
              :title="`选中行及之后全部减 ${stepValue} 秒`"
              @click="adjustFromSelected(-1)"
            >
              <Icon icon="mdi:clock-minus-outline" />
            </button>
            <NumberField
              v-model="stepValue"
              :min="0.01"
              :step="0.01"
              :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
            />
            <button
              class="le-tb-btn"
              :class="{ active: selectedLineIdx >= 0 }"
              :disabled="!lyricLines.length"
              :title="`选中行及之后全部加 ${stepValue} 秒`"
              @click="adjustFromSelected(1)"
            >
              <Icon icon="mdi:clock-plus-outline" />
            </button>
            <span class="le-tb-sep" />
            <button
              class="le-tb-btn"
              :disabled="selectedLineIdx < 0"
              title="删除选中行"
              @click="deleteSelectedLine"
            >
              <Icon icon="mdi:delete" />
            </button>
            <span class="le-tb-sep" />
            <button class="le-tb-btn" :disabled="!canUndo" title="撤销 (Ctrl+Z)" @click="undo">
              <Icon icon="mdi:undo" />
            </button>
            <button
              class="le-tb-btn"
              :disabled="!canRedo"
              title="重做 (Ctrl+Shift+Z)"
              @click="redo"
            >
              <Icon icon="mdi:redo" />
            </button>
            <span class="le-tb-sep" />
            <button
              class="le-tb-btn"
              :disabled="!lyricLines.length"
              title="保存为本地LRC文件"
              @click="saveLyrics"
            >
              <Icon icon="mdi:content-save" />
            </button>
          </div>
          <div v-if="lyricLines.length" class="le-toolbar-info">
            <span class="le-tb-source">{{ currentSourceLabel }}</span>
            <span class="le-tb-count">{{ lyricLines.length }} 行</span>
            <span v-if="selectedLineIdx >= 0" class="le-tb-idx">#{{ selectedLineIdx + 1 }}</span>
          </div>
        </div>

        <div class="le-lyrics-scroll">
          <div v-if="lyricLines.length === 0" class="le-lyrics-empty">
            <Icon icon="mdi:playlist-edit" class="le-empty-icon" />
            <p>选择歌词开始编辑</p>
            <p class="le-empty-hint">左侧列表选择后，歌词和时间戳将显示在此处</p>
          </div>
          <div v-else class="le-lyrics-list">
            <div
              v-for="(line, i) in lyricLines"
              :key="i"
              class="le-lyric-line"
              :class="{
                selected: i === selectedLineIdx,
                'after-selected': selectedLineIdx >= 0 && i > selectedLineIdx,
                'has-trans': !!line.trans,
              }"
              @click="selectLine(i)"
              @dblclick="startEdit(i)"
              @mouseenter="hoveredLineIdx = i"
              @mouseleave="hoveredLineIdx = -1"
            >
              <span class="le-lyric-time">{{ formatTimeTag(line.time) }}</span>
              <div class="le-lyric-content">
                <template v-if="editingLineIdx === i">
                  <input
                    ref="editInputRef"
                    v-model="editText"
                    class="le-lyric-edit-input"
                    @blur="finishEdit(i)"
                    @keyup.enter="finishEdit(i)"
                    @keyup.escape="cancelEdit"
                  />
                </template>
                <span v-else class="le-lyric-text">{{ line.text }}</span>
                <span v-if="line.trans" class="le-lyric-trans">{{ line.trans }}</span>
              </div>
              <button
                class="le-lyric-add-btn"
                :class="{ show: hoveredLineIdx === i }"
                title="在此后插入新行"
                @click.stop="insertLineAfter(i)"
              >
                <Icon icon="mdi:plus-circle" />
              </button>
            </div>
          </div>
        </div>
      </SplitterPanel>
    </Splitter>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import Splitter from '../../src/components/ui/Splitter.vue';
import SplitterPanel from '../../src/components/ui/SplitterPanel.vue';
import SplitterHandle from '../../src/components/ui/SplitterHandle.vue';
import NumberField from '../../src/components/ui/NumberField.vue';

const api = window.lyricsEditorAPI;

// ── LRC 解析 / 序列化（原 lrc.js）──
function parseLRC(lrcText) {
  if (!lrcText) return [];

  const raw = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  for (const line of lrcText.split('\n')) {
    const match = line.match(timeRegex);
    if (!match) continue;

    const minutes = Number.parseInt(match[1]);
    const seconds = Number.parseInt(match[2]);
    let millis = Number.parseInt(match[3]);
    if (match[3].length === 2) millis *= 10;

    const text = line.replace(timeRegex, '').trim();
    if (text) raw.push({ time: minutes * 60 + seconds + millis / 1000, text });
  }
  raw.sort((first, second) => first.time - second.time);

  const result = [];
  for (let index = 0; index < raw.length; index++) {
    const current = raw[index];
    const next = raw[index + 1];
    if (next && Math.abs(next.time - current.time) < 0.01) {
      result.push({ time: current.time, text: current.text, trans: next.text });
      index++;
    } else {
      result.push({ time: current.time, text: current.text });
    }
  }
  return result;
}

function serializeLRC(lines, songName, sourceName, bvid) {
  const header = [
    `[ti:${songName}]`,
    '[ar:]',
    bvid ? `[bvid:${bvid}]` : '',
    '[by:BiliMusic]',
    `[source:${sourceName}]`,
    '[re:本歌词来源自网络搜索，仅供个人学习交流使用，请勿用于商业用途]',
    '',
  ].filter(Boolean);

  const body = [];
  for (const line of lines) {
    body.push(`[${formatTimeTag(line.time)}]${line.text}`);
    if (line.trans) body.push(`[${formatTimeTag(line.time)}]${line.trans}`);
  }
  return [...header, ...body].join('\n');
}

function formatTimeTag(time) {
  if (time == null) return '00:00.00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const centiseconds = Math.floor((time % 1) * 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function extractKeyword(title) {
  if (!title) return '';
  const patterns = [/《(.+?)》/, /【(.+?)】/, /「(.+?)」/, /"(.+?)"/];
  for (const p of patterns) {
    const m = title.match(p);
    if (m) return m[1].trim();
  }
  return title.trim();
}

const searchQuery = ref('');
const searching = ref(false);
const allLocalLyrics = ref([]);
const localLyrics = ref([]);
const searchResults = ref([]);
const selectedKey = ref('');
const lyricLines = ref([]);
const currentSourceLabel = ref('');
const currentTrackBvid = ref('');
const currentTrackTitle = ref('');
const currentTrackAuthor = ref('');

// ── 歌词编辑状态（原 use_lyric_editing.js）──
const MAX_HISTORY = 50;
const selectedLineIdx = ref(-1);
const editingLineIdx = ref(-1);
const editText = ref('');
const hoveredLineIdx = ref(-1);
const editInputRef = ref(null);
const stepValue = ref(1);
const undoStack = ref([]);
const redoStack = ref([]);
const canUndo = ref(false);
const canRedo = ref(false);

// 候选封面错误记录（原 use_candidate_display.js）
const erroredCovers = ref(new Set());

function saveSnapshot() {
  return JSON.parse(JSON.stringify(lyricLines.value));
}

function pushHistory() {
  undoStack.value.push(saveSnapshot());
  if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift();
  redoStack.value = [];
  canUndo.value = undoStack.value.length > 0;
  canRedo.value = false;
}

function undo() {
  if (!undoStack.value.length) return;
  redoStack.value.push(saveSnapshot());
  lyricLines.value = undoStack.value.pop();
  canUndo.value = undoStack.value.length > 0;
  canRedo.value = true;
}

function redo() {
  if (!redoStack.value.length) return;
  undoStack.value.push(saveSnapshot());
  lyricLines.value = redoStack.value.pop();
  canUndo.value = true;
  canRedo.value = redoStack.value.length > 0;
}

function resetHistory() {
  undoStack.value = [];
  redoStack.value = [];
  canUndo.value = false;
  canRedo.value = false;
}

function selectLine(index) {
  selectedLineIdx.value = selectedLineIdx.value === index ? -1 : index;
}

function startEdit(index) {
  editingLineIdx.value = index;
  editText.value = lyricLines.value[index]?.text || '';
  selectedLineIdx.value = index;
  requestAnimationFrame(() => editInputRef.value?.focus());
}

function finishEdit(index) {
  if (editingLineIdx.value === index && lyricLines.value[index]) {
    const newText = editText.value.trim() || lyricLines.value[index].text;
    if (newText !== lyricLines.value[index].text) {
      pushHistory();
      lyricLines.value[index].text = newText;
    }
  }
  editingLineIdx.value = -1;
  editText.value = '';
}

function cancelEdit() {
  editingLineIdx.value = -1;
  editText.value = '';
}

function insertLineAfter(index) {
  pushHistory();
  lyricLines.value.splice(index + 1, 0, { time: 0, text: '' });
  selectedLineIdx.value = -1;
  requestAnimationFrame(() => startEdit(index + 1));
}

function deleteSelectedLine() {
  if (selectedLineIdx.value < 0 || selectedLineIdx.value >= lyricLines.value.length) return;
  pushHistory();
  lyricLines.value.splice(selectedLineIdx.value, 1);
  selectedLineIdx.value = Math.min(selectedLineIdx.value, lyricLines.value.length - 1);
}

function adjustFromSelected(delta) {
  if (!lyricLines.value.length) return;
  pushHistory();
  const start = selectedLineIdx.value >= 0 ? selectedLineIdx.value : 0;
  for (let index = start; index < lyricLines.value.length; index++) {
    const adjustedTime = lyricLines.value[index].time + delta * stepValue.value;
    lyricLines.value[index].time = Math.max(0, +adjustedTime.toFixed(3));
  }
}

function onKeydown(event) {
  if (event.target?.tagName === 'INPUT') return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.shiftKey ? redo() : undo();
    event.preventDefault();
  }
}

function scoreClass(score) {
  if (score >= 0.7) return 'score-high';
  if (score >= 0.4) return 'score-mid';
  return 'score-low';
}

function onCoverError(item) {
  const coverKey = `${item.source}-${item.id}`;
  erroredCovers.value = new Set(erroredCovers.value).add(coverKey);
}

function isCoverErrored(item) {
  return erroredCovers.value.has(`${item.source}-${item.id}`);
}

async function loadLocalLyrics() {
  try {
    allLocalLyrics.value = (await api.listLocalLyrics()) || [];
    localLyrics.value = [...allLocalLyrics.value];
  } catch {
    allLocalLyrics.value = [];
    localLyrics.value = [];
  }
}

async function doSearch() {
  const q = searchQuery.value.trim();
  if (!q) return;
  searching.value = true;
  searchResults.value = [];

  const kw = q.toLowerCase();
  localLyrics.value = allLocalLyrics.value.filter((f) =>
    (f.song || f.fileName.replace('.lrc', '')).toLowerCase().includes(kw)
  );

  try {
    const videoTitle = currentTrackTitle.value || q;
    const author = currentTrackAuthor.value || '';
    if (api.searchRankedCandidates) {
      searchResults.value = (await api.searchRankedCandidates(q, videoTitle, author)) || [];
    } else {
      searchResults.value = (await api.searchLyricCandidates(q)) || [];
    }
  } catch {
    searchResults.value = [];
  }
  searching.value = false;
}

async function onSelect(item, type) {
  resetHistory();
  if (type === 'local') {
    selectedKey.value = 'local|' + item.fileName;
    try {
      const content = await api.readLocalLyric(item.fileName);
      lyricLines.value = content ? parseLRC(content) : [];
      currentSourceLabel.value = '本地文件';
    } catch {
      lyricLines.value = [];
    }
  } else {
    selectedKey.value = 'online|' + item.source + '|' + item.id;
    try {
      const result = await api.fetchLyric(item.source, item.id);
      lyricLines.value = result?.lyrics ? result.lyrics.map((l) => ({ ...l })) : [];
      currentSourceLabel.value = item.sourceName || item.source;
    } catch {
      lyricLines.value = [];
    }
  }
  selectedLineIdx.value = -1;
}

async function saveLyrics() {
  if (!lyricLines.value.length) return;
  const songName = searchQuery.value.trim() || 'unknown';
  const fileName = songName.replace(/[\\/:*?"<>|]/g, '_') + '.lrc';
  const content = serializeLRC(
    lyricLines.value,
    songName,
    currentSourceLabel.value,
    currentTrackBvid.value
  );
  try {
    const result = await api.saveLocalLyric(fileName, content);
    if (result?.success) {
      await loadLocalLyrics();
      const kw = searchQuery.value.trim().toLowerCase();
      if (kw) {
        localLyrics.value = allLocalLyrics.value.filter((f) =>
          (f.song || f.fileName.replace('.lrc', '')).toLowerCase().includes(kw)
        );
      }
    }
  } catch {
    /* ignore */
  }
}

function closeWindow() {
  api.closeWindow();
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  loadLocalLyrics();
  if (api.onTrackInfo) {
    api.onTrackInfo((info) => {
      if (info?.title) {
        searchQuery.value = extractKeyword(info.title) || info.title;
        currentTrackBvid.value = info.bvid || '';
        currentTrackTitle.value = info.title || '';
        currentTrackAuthor.value = info.author || '';
        doSearch();
      }
    });
  }
});
</script>

<style>
/* 独立子窗口页面：自带设计变量与全局滚动条样式（原 styles.css） */
:root {
  --bg-deep: #0a0a14;
  --bg-primary: #0f0f1a;
  --bg-secondary: #16162a;
  --bg-tertiary: #1c1c36;
  --bg-card: #1a1a32;
  --bg-hover: #242444;
  --text-primary: #e8e8f0;
  --text-secondary: #9494b8;
  --text-muted: #5c5c7a;
  --accent: #fb7299;
  --accent-hover: #ff8db0;
  --accent-dim: rgba(251, 114, 153, 0.1);
  --border: #2a2a48;
  --border-light: #363658;
  --shadow: rgba(0, 0, 0, 0.5);
  --radius-sm: 6px;
  --radius-md: 10px;
  --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

.le-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.le-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.le-header h2 {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  -webkit-app-region: no-drag;
}

.le-header-icon {
  font-size: 18px;
  color: var(--accent);
}

.le-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition);
  -webkit-app-region: no-drag;
}

.le-close-btn:hover {
  background: rgba(255, 71, 87, 0.15);
  color: #ff4757;
}
.le-body {
  flex: 1;
  min-height: 0;
}
.le-left {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.le-list-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.le-search-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px;
  flex-shrink: 0;
}

.le-input {
  flex: 1;
  min-width: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color var(--transition);
}

.le-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-dim);
}
.le-input::placeholder {
  color: var(--text-muted);
}

.le-search-btn {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--bg-deep);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 18px;
  cursor: pointer;
  transition: background var(--transition);
}

.le-search-btn:hover {
  background: var(--accent-hover);
}
.le-search-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.le-list {
  padding: 0 8px 12px;
}
.le-section {
  margin-bottom: 8px;
}

.le-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.le-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition);
}

.le-list-item:hover {
  background: var(--bg-hover);
}
.le-list-item.selected {
  background: var(--accent-dim);
}

.le-list-item-radio {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--transition);
}

.le-list-item.selected .le-list-item-radio {
  border-color: var(--accent);
  background: var(--accent);
}

.le-list-item-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: white;
}

.le-list-item-info {
  flex: 1;
  min-width: 0;
}
.le-list-item-title {
  display: block;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.le-list-item-meta {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.le-list-item-source {
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--accent);
  background: var(--accent-dim);
  font-size: 10px;
}

.le-list-item-cover {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.le-list-item-cover-fallback {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  font-size: 16px;
}

.le-list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  color: var(--text-muted);
  gap: 8px;
}

.le-empty-icon {
  font-size: 40px;
  opacity: 0.4;
}
.le-empty-hint {
  font-size: 12px;
  opacity: 0.6;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.le-right {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.le-lyrics-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.le-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}

.le-toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.le-tb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  transition: all var(--transition);
}

.le-tb-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.le-tb-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.le-tb-sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 4px;
}
.le-toolbar-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.le-tb-source {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--accent-dim);
  color: var(--accent);
}
.le-tb-count {
  color: var(--text-muted);
}

.le-lyrics-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  gap: 8px;
}

.le-lyrics-list {
  padding: 12px;
}
.le-lyric-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  transition: background var(--transition);
  position: relative;
}

.le-lyric-line:hover {
  background: var(--bg-hover);
}
.le-lyric-line.selected {
  background: var(--accent-dim);
  outline: 1px solid var(--accent);
}
.le-lyric-line.after-selected {
  background: rgba(251, 114, 153, 0.06);
}
.le-lyric-time {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--text-muted);
  min-width: 70px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
}

.le-lyric-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.le-lyric-text {
  color: var(--text-primary);
  line-height: 1.6;
}
.le-lyric-line.has-trans .le-lyric-text {
  line-height: 1.4;
}
.le-lyric-line.selected .le-lyric-text {
  color: var(--accent);
}
.le-lyric-trans {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.7;
  line-height: 1.4;
}
.le-lyric-line.selected .le-lyric-trans {
  color: var(--accent);
  opacity: 0.6;
}

.le-lyric-edit-input {
  flex: 1;
  min-width: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 4px 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.le-lyric-add-btn {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  opacity: 0;
  transition: all var(--transition);
}

.le-lyric-add-btn.show {
  opacity: 1;
  color: var(--accent);
}
.le-lyric-add-btn:hover {
  background: var(--accent-dim);
  color: var(--accent);
}

.le-score-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  margin-right: 4px;
  flex-shrink: 0;
}

.le-score-badge.score-high {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}
.le-score-badge.score-mid {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}
.le-score-badge.score-low {
  background: rgba(156, 163, 175, 0.15);
  color: #9ca3af;
}
</style>
