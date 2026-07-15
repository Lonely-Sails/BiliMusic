# BiliMusic 项目上下文

## 项目概述

BiliMusic 是一个基于 Electron + Vue 3 的 Bilibili 音乐播放器桌面应用，通过 Bilibili 的 API 获取视频音频流实现音乐播放。

## 技术栈

- **前端**: Vue 3 (Composition API / `<script setup>`) + Pinia + Vue Router
- **UI 库**: Reka UI (无样式可访问性组件库)
- **图标**: @iconify/vue (Material Design Icons, 本地注册)
- **桌面端**: Electron 42.x + vite-plugin-electron
- **构建**: Vite 6 + Rollup
- **包管理**: bun
- **其他**: QRCode (二维码生成)

## 项目结构

```
BiliMusic/
├── electron/                    # Electron 主进程
│   ├── main.js                  # 入口：协议注册、session、窗口、托盘
│   ├── ipc-handlers.js          # 所有 IPC handler（按领域组织）
│   ├── window-manager.js        # 窗口管理（主窗口/桌面歌词/歌词编辑器）
│   ├── tray.js                  # 托盘图标管理
│   ├── preload.js               # 主窗口预加载（暴露 electronAPI）
│   ├── preload/                 # 子窗口预加载
│   │   ├── desktopLyrics.js     # 桌面歌词窗口 preload
│   │   └── lyricsEditor.js     # 歌词编辑器窗口 preload
│   ├── api/                     # Bilibili API 模块
│   │   ├── client.js            # HTTP 客户端（Cookie 管理、session 持久化）
│   │   ├── cache.js             # LRU 响应缓存
│   │   ├── sign.js              # WBI 签名
│   │   ├── auth.js              # 登录（二维码）/ 登出
│   │   ├── search.js            # 搜索 / 搜索建议 / 热搜
│   │   ├── video.js             # 视频信息 / 音频 URL
│   │   ├── lyric.js             # 歌词编排（本地→字幕→在线）
│   │   ├── lyricSources.js      # 第三方歌词源（QQ/网易云）
│   │   ├── lrc.js               # LRC 解析 / 翻译合并
│   │   ├── fav.js               # 收藏夹 CRUD
│   │   ├── popular.js           # 热门视频
│   │   └── musicCenter.js       # 音乐中心（榜单/新歌/综合）
│   └── utils/
│       └── logger.js            # 日志工具（[BiliMusic] 前缀）
├── src/                         # 前端 Vue 应用
│   ├── main.js                  # Vue 入口（Pinia + Router + 全局错误处理）
│   ├── App.vue                  # 根组件（布局/搜索框/侧栏/播放栏/歌词/Toast）
│   ├── router/index.js          # Vue Router 路由配置
│   ├── stores/                  # Pinia 状态管理
│   │   ├── player.js            # 播放器状态（播放列表/歌词/音频缓存）
│   │   ├── user.js              # 用户/登录/收藏
│   │   └── toast.js             # Toast 通知
│   ├── components/
│   │   ├── PlayerBar.vue        # 底部播放控制栏
│   │   ├── LyricsOverlay.vue    # 歌词弹层（左右布局）
│   │   ├── LoginPanel.vue       # 登录面板（Avatar/QR扫码）
│   │   ├── SongCard.vue         # 歌曲卡片组件
│   │   └── views/
│   │       ├── HomeView.vue     # 首页（Hero/TOP10/热门/新歌）
│   │       ├── SearchView.vue   # 搜索结果
│   │       ├── PlaylistView.vue # 播放列表
│   │       ├── FavView.vue      # 收藏夹
│   │       └── SettingsView.vue # 设置页
│   ├── styles/
│   │   ├── main.css             # 仅 CSS 变量 + Reset + 滚动条（全局）
│   │   └── ui.css               # Reka UI 组件全局样式（不删除）
│   └── utils/
│       └── icon-init.js         # 本地注册 Material Design Icons
├── pages/                       # 独立页面（非主窗口）
│   ├── desktop-lyrics/          # 桌面歌词悬浮窗
│   └── lyrics-editor/           # 歌词编辑器
└── icons/                       # 应用图标
```

## 架构模式

### 分层架构
```
渲染进程 (Vue) → IPC (preload.js) → 主进程 (ipc-handlers.js) → API 模块 (electron/api/)
```

### 核心原则
1. **后端优先**: 复杂逻辑（WBI 签名、歌词编排、Cookie 管理、缓存）全部在 Electron 主进程
2. **前端仅渲染**: Vue 组件只负责 UI 和调用 `window.electronAPI.xxx()` 获取数据
3. **统一日志**: 所有日志使用 `[BiliMusic]` 前缀（主进程用 logger 模块，渲染进程用 console）
4. **组件风格**: 全部使用 `<script setup>` Composition API，CSS scoped 到组件
5. **无括号 if/for**: 简短的模板表达式不使用大括号

### IPC 通信
- `ipcMain.handle` / `ipcRenderer.invoke`: 请求-响应模式（多数 API）
- `ipcMain.on` / `ipcRenderer.send`: 事件推送（桌面歌词、窗口控制）
- 预加载脚本通过 `contextBridge.exposeInMainWorld` 暴露安全 API

## 关键功能

### 播放流程
1. 点击歌曲 → `player.playTrack(track)` 
2. 获取视频信息（bvid/cid）→ 获取音频 URL
3. 通过自定义协议 `bili://` 代理音频流（避免 CORS）
4. 歌词获取：本地 LRC → B站AI字幕 → 在线搜索（按相似度排序）

### 歌词获取编排 (electron/api/lyric.js → ipc-handlers.js `lyric:get`)
1. 获取视频完整信息（含 bgm_info）
2. 提取最佳搜索关键词（优先 bgm_info，其次标题）
3. 匹配本地 LRC 文件
4. 获取 B站 AI 字幕
5. 在线搜索（按相似度排序，插件式歌词源）

### 登录流程
1. 获取二维码 → 生成 QR Code 图片
2. 轮询扫码状态（2s 间隔）
3. 扫码成功 → 跟随 SSO 跳转获取 Cookie
4. 持久化 Session 到 `userData/session.json`

### 桌面歌词
- 独立 Electron 窗口（透明、无边框、置顶）
- 通过 IPC 实时同步歌词/时间/曲目
- 支持锁定模式（点击穿透）
- 位置和状态持久化到 `userData/desktop-lyrics-pos.json`

## 使用的 Reka UI 组件

| 组件 | 用途 |
|------|------|
| ScrollArea | 内容区域滚动 |
| Autocomplete | 搜索框（建议/历史/热搜） |
| Tooltip | 按钮提示 |
| Slider | 进度条、音量 |
| Dialog | 扫码登录弹窗 |
| Avatar | 用户头像 |
| Select | 收藏夹选择 |
| NumberField | 缓存上限设置 |
| Progress | 热度进度条 |
| Separator | 分割线 |
| Toast | 通知提示 |
| Toolbar | 桌面歌词工具栏 |

## 快捷键

- 桌面歌词中: `Escape` 解锁
- 歌词弹层: `Escape` 关闭
- 全局: F12 打开 DevTools（开发模式）

## 构建命令

```bash
bun run dev       # 开发模式
bun run build     # 构建
bun run dist:mac  # 打包 macOS
bun run dist:win  # 打包 Windows
bun run dist:linux # 打包 Linux
```

## 注意事项

1. `__dirname` 在 vite-plugin-electron 打包后指向 `dist-electron/`，项目根为 `join(__dirname, '..')`
2. 自定义协议 `bili://` 必须在 `app.whenReady()` 之后注册
3. 桌面歌词窗口使用独立的 preload 脚本（`electron/preload/desktopLyrics.js`），暴露 `desktopLyricsAPI`
4. 歌词编辑器同样使用独立 preload（`electron/preload/lyricsEditor.js`），暴露 `lyricsEditorAPI`
5. `src/styles/ui.css` 包含 Reka UI 组件的全局样式（滑动条/工具提示/对话框等），不要删除
6. 音频 URL 缓存（前端 LRU）+ API 响应缓存（后端 LRU）双层缓存策略
7. 托盘图标在 macOS 上标记为 `templateImage`，自动适配明暗模式
