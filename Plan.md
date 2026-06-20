# BiliMusic — Electron Bilibili Music Player

## 概述

基于 Electron + Bun + JavaScript 的桌面音乐播放器，以 Bilibili 视频为音乐源，支持搜索、播放、歌词展示、B站账号登录与收藏歌曲。

## 技术栈

- **Runtime**: Bun (包管理 + 脚本执行)
- **Desktop**: Electron 33+
- **前端**: Vue 3 + Reka UI (headless 组件库)
- **UI 组件**: Reka UI Slider/Dialog/Tooltip
- **音视频**: Electron 内置 Chromium `<audio>` 播放 DASH 音频流

## 核心架构

```
BiliMusic/
├── package.json              # 依赖: electron, vue3, vite
├── vite.config.mjs           # Vite + electron plugin
├── index.html                # Vite 入口（主窗口）
├── electron/                 # Electron 主进程
│   ├── main.js               #   主进程入口
│   ├── preload.js            #   主窗口 preload (contextBridge IPC)
│   ├── preload/
│   │   └── desktopLyrics.js  #   桌面歌词窗口 preload
│   └── api/                  #   Bilibili API 实现
│       ├── sign.js           #   WBI 签名
│       ├── client.js         #   HTTP 客户端 + Cookie 管理
│       ├── search.js         #   搜索 API
│       ├── video.js          #   视频信息 + 音频流
│       ├── auth.js           #   二维码登录
│       ├── fav.js            #   收藏夹 API
│       ├── lyric.js          #   歌词 API
│       ├── lrc.js            #   LRC 解析
│       └── lyricSources.js   #   第三方歌词源
├── pages/                    # 独立渲染页面（非 Vite 构建）
│   └── desktop-lyrics/
│       └── index.html        #   桌面歌词窗口
├── src/                      # Vue 3 渲染进程 (Vite 构建)
│   ├── main.js               # Vue 入口
│   ├── App.vue               # 根组件
│   ├── components/
│   │   ├── SearchView.vue    # 搜索界面
│   │   ├── PlayerBar.vue     # 底部播放栏
│   │   ├── LoginPanel.vue    # 登录面板
│   │   ├── PlaylistView.vue  # 播放列表
│   │   ├── FavView.vue       # 收藏夹
│   │   └── LyricsView.vue    # 歌词
│   ├── router/
│   │   └── index.js
│   ├── stores/
│   │   ├── player.js
│   │   └── user.js
│   └── styles/
│       └── main.css          # 全局样式
```

## 功能模块

### 1. 搜索
- 调用 Bilibili 搜索 API (`/x/web-interface/wbi/search/type`)
- 按关键词搜索视频，展示结果列表（封面、标题、时长、UP主）
- 支持将搜索结果添加到播放列表

### 2. 播放
- 通过视频 playurl API 获取 DASH 音频流 URL
- HTML5 `<audio>` 播放，支持播放/暂停/上一首/下一首
- 进度条、音量控制、播放模式（顺序/随机/单曲循环）
- 迷你播放条（固定在底部）

### 3. 歌词
- 优先从 Bilibili 字幕 API 获取字幕/CC
- 回退到第三方歌词 API（如 歌词源）
- LRC 格式解析与同步滚动显示

### 4. 登录
- 二维码登录流程：获取二维码 → 轮询扫码状态 → 保存 Cookie
- Cookie 持久化到本地文件（`session.json`）
- 显示用户头像、昵称

### 5. 收藏
- 展示用户的 Bilibili 收藏夹列表
- 从收藏夹加载视频到播放列表
- 将当前播放歌曲添加到指定收藏夹

### 6. 播放列表
- 当前队列管理（添加、删除、拖拽排序）
- 本地持久化播放列表
- 支持从搜索结果/收藏夹添加

## 数据流

```
用户操作 → Renderer (IPC) → Main Process → Bilibili API
                ↑                        ↓
           UI 更新 ← (IPC) ← 处理响应 & 签名
```

- **Main Process**: 所有 HTTP 请求、签名、Cookie 管理
- **Renderer**: 纯 UI 渲染、用户交互、本地存储
- **Preload**: 暴露安全的 IPC 接口给 Renderer

## Bilibili API 使用

| 用途 | 端点 | 认证 |
|------|------|------|
| 搜索视频 | `/x/web-interface/wbi/search/type` | WBI 签名 |
| 视频信息 | `/x/web-interface/wbi/view` | WBI 签名 |
| 音频流 | `/x/player/wbi/playurl` | WBI 签名 + Cookie |
| 二维码登录 | `/x/passport-login/web/qrcode/generate` | 无 |
| 轮询扫码 | `/x/passport-login/web/qrcode/poll` | 无 |
| 收藏夹列表 | `/x/v3/fav/folder/created/list-all` | Cookie |
| 收藏夹内容 | `/x/v3/fav/resource/list` | Cookie |
| 收藏操作 | `/x/v3/fav/resource/deal` | Cookie + CSRF |
| 字幕 | `/x/player/v2` | WBI 签名 |

## 实施步骤

### Step 1: 项目初始化
- 初始化 `package.json`，安装 Electron
- 创建主进程 `main.js`、`preload.js`

### Step 2: Bilibili API 核心
- 实现 WBI 签名工具 (`src/api/sign.js`)
- 实现 HTTP 客户端 (`src/api/client.js`)
- 实现搜索 API (`src/api/search.js`)
- 实现视频+音频流 API (`src/api/video.js`)

### Step 3: 登录系统
- 实现二维码登录 (`src/api/auth.js`)
- Cookie 持久化
- 渲染进程登录面板 UI

### Step 4: 播放器 UI
- 搜索界面（搜索框 + 结果列表）
- 播放器控制栏（封面、标题、进度条、控制按钮）
- 歌词面板
- 播放列表侧栏

### Step 5: 收藏功能
- 收藏夹列表展示
- 从收藏夹添加歌曲
- 收藏/取消收藏当前歌曲

### Step 6: 完善与测试
- 播放模式切换
- 键盘快捷键
- 错误处理
- 体验优化

## 验证方式

1. `bun install` 安装依赖
2. `bun run dev` 开发模式启动（Vite dev server + Electron）
3. `bun run build` 构建生产版本
4. 搜索关键词验证搜索功能
2. 搜索关键词验证搜索功能
3. 点击搜索结果验证播放
4. 验证登录流程
5. 验证收藏功能
6. 验证歌词显示
