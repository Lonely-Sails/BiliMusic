# 🎵 BiliMusic

> 基于 Bilibili 视频音源的跨平台桌面音乐播放器

<p align="center">
  <img src="https://img.shields.io/badge/Electron-33+-47848F?logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white" alt="Vue" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Bun-000?logo=bun&logoColor=white" alt="Bun" />
  <img src="https://img.shields.io/badge/Pinia-3-FFD859?logo=pinia&logoColor=white" alt="Pinia" />
</p>

## 📖 简介

**BiliMusic** 是一款基于 Electron + Vue 3 构建的桌面音乐播放器，以 Bilibili 视频为音乐源，支持搜索、音频播放、歌词同步显示、B 站账号登录、收藏夹管理以及独立的桌面歌词窗口。

## ✨ 功能特色

| 功能 | 说明 |
|------|------|
| 🔍 **搜索** | 调用搜索 API 获取音乐视频，支持搜索建议、热搜排行、搜索历史持久化 |
| ▶️ **音频播放** | 获取视频音频流播放，支持播放控制、进度拖拽、音量调节 |
| 📃 **歌词同步** | 优先获取视频字幕，回退至第三方歌词源，LRC 格式解析，支持多源切换 |
| 🔐 **B 站登录** | 二维码扫码登录，Cookie 持久化 |
| ⭐ **收藏管理** | 浏览收藏夹、加载收藏歌曲、一键收藏/取消，状态实时同步 |
| 📋 **播放列表** | 队列管理（添加、删除），当前曲目高亮 + 音频条动画，localStorage 持久化 |
| 🔁 **播放模式** | 顺序播放、随机播放、单曲循环三种模式一键切换 |
| 🖥️ **桌面歌词** | 独立窗口，歌词动画，自动调整字号，锁定/穿透模式，拖拽移动，置顶显示 |
| 🎛️ **设置面板** | 收藏夹选择器、音频/歌词 LRU 缓存上限调节、缓存用量查看与清理 |

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 🏗️ 桌面框架 | [Electron 33+](https://www.electronjs.org/) — 主进程 + 渲染进程隔离 |
| 🎨 前端框架 | [Vue 3](https://vuejs.org/) + [Vue Router 4](https://router.vuejs.org/)（Hash History） |
| 📦 状态管理 | [Pinia 3](https://pinia.vuejs.org/) — 三个 Store（player / user / toast） |
| 🧩 UI 组件 | [Reka UI 2](https://reka-ui.com/) — Autocomplete, Slider, Dialog, Select, Tooltip, Toast, ScrollArea, NumberField |
| 🎭 图标 | [Iconify](https://iconify.design/)（`@iconify/vue`）— Material Design Icons |
| ⚡ 构建工具 | [Vite 6](https://vitejs.dev/) + [`vite-plugin-electron`](https://github.com/electron-vite/vite-plugin-electron) |
| 📦 包管理 | [Bun](https://bun.sh/) |
| 🔲 二维码 | [`qrcode`](https://www.npmjs.com/package/qrcode) — 登录二维码生成 |
| 🎵 歌词源 | 视频自带字幕 + 第三方歌词 API（QQ 音乐 / 网易云） |

## 🗺️ 项目结构

```
BiliMusic/
├── 📁 electron/          # Electron 主进程
│   ├── 📁 api/           #   数据 API 层
│   └── 📁 preload/       #   桌面歌词窗口 preload
├── 📁 pages/
│   └── 📁 desktop-lyrics/ # 桌面歌词独立窗口
├── 📁 src/               # Vue 3 渲染进程
│   ├── 📁 components/    #   功能组件
│   ├── 📁 router/        #   路由配置
│   ├── 📁 stores/        #   Pinia 状态管理
│   └── 📁 styles/        #   全局样式
├── 📁 dist-electron/     # 构建输出
├── index.html / vite.config.mjs / package.json 等
```

## 🚀 快速开始

### 环境要求

- [Bun](https://bun.sh/) ≥ 1.0（推荐，也可用 npm/pnpm）
- Node.js ≥ 18
- 操作系统：macOS / Windows / Linux

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/Lonely-Sails/BiliMusic.git
cd BiliMusic

# 安装依赖（使用 Bun）
bun install

# 🎯 启动开发模式（Vite 热重载 + Electron 窗口）
bun run dev

# 📦 构建生产版本
bun run build

# 🚀 启动生产版 Electron 应用
bun run start
```

### npm 替代

```bash
npm install
npm run dev
```

### 脚本说明

| 命令 | 说明 |
|------|------|
| `bun run dev` | 启动 Vite 开发服务器 + Electron 窗口，Vue 文件热重载，主进程自动重启 |
| `bun run build` | Vite 构建 + 复制 `electron/api/` 和 `electron/preload/` 到 `dist-electron/` |
| `bun run start` | 以生产模式启动 Electron（加载 `dist/` 中的构建产物） |

## 📡 IPC 通信架构

```
┌──────────────────────────────────────────────────────────┐
│                   渲染进程 (Vue 3)                         │
│  window.electronAPI.invoke(channel, args...)              │
│         │                                    ▲           │
│         │  ipcRenderer.invoke()              │  return    │
│         ▼                                    │           │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Electron 主进程 (Node.js)             │    │
│  │  ipcMain.handle(channel, handler)                 │    │
│  │                                                    │    │
│  │  ┌─────────┐  ┌──────────┐  ┌────────────────┐    │    │
│  │  │ 搜索 API │  │ 视频 API  │  │ 认证 / 收藏 API  │    │    │
│  │  └────┬────┘  └────┬─────┘  └───────┬────────┘    │    │
│  │       │            │                │              │    │
│  │       ▼            ▼                ▼              │    │
│  │  ┌─────────────────────────────────┐         │    │
│  │  │     HTTP 客户端 + 签名 + Cookie  │         │    │
│  │  └─────────────────────────────────┘         │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│        桌面歌词窗口 ←──── IPC send ──── 主进程            │
└──────────────────────────────────────────────────────────┘
```

<!-- ### IPC 通道一览

**🔹 invoke/handle 模式（渲染进程请求，主进程响应）：**

| 通道 | 用途 | 参数 |
|------|------|------|
| `search:video` | 搜索视频 | `keyword, page` |
| `search:suggest` | 搜索建议词 | `term` |
| `search:hot` | 热搜列表 | — |
| `player:get-video-info` | 视频信息（标题/封面/分P） | `bvid` |
| `player:get-audio-url` | 获取音频流地址 | `bvid, cid` |
| `auth:get-qrcode` | 获取登录二维码 | — |
| `auth:poll-login` | 轮询扫码状态 | `qrcodeKey` |
| `auth:check-login` | 检查登录状态 | — |
| `auth:logout` | 登出 | — |
| `auth:clear` | 清除认证数据 | — |
| `fav:list-folders` | 收藏夹列表 | `upMid` |
| `fav:list-resources` | 收藏夹内容 | `mediaId, page, upMid` |
| `fav:add` | 添加收藏 | `bvid, mediaId` |
| `fav:remove` | 取消收藏 | `bvid, mediaId` |
| `lyric:get` | 获取歌词 | `bvid, cid, title` |
| `lyric:search-candidates` | 搜索歌词候选 | `title` |
| `lyric:fetch` | 获取歌词（指定源） | `source, id` |

**🔸 send/on 模式（主进程 → 桌面歌词窗口）：**

| 通道 | 用途 |
|------|------|
| `desktop-lyrics:update` | 更新歌词数据 |
| `desktop-lyrics:time` | 更新当前播放时间 |
| `desktop-lyrics:track` | 更新曲目信息 |
| `desktop-lyrics:play-state` | 更新播放状态 |
| `desktop-lyrics:visibility` | 窗口可见性通知 |
| `desktop-lyrics:set-ignore-events` | 设置鼠标点击穿透 |
| `desktop-lyrics:set-always-on-top` | 设置窗口置顶 |
| `desktop-lyrics:hide` | 隐藏窗口 |
| `desktop-lyrics:minimize` | 最小化窗口 |
| `desktop-lyrics:move-window` | 拖拽移动窗口 |
| `desktop-lyrics:prev` / `next` / `toggle-play` | 播放控制（转发到主窗口） |

## 🔄 核心流程

### 音频播放流程

```
用户点击播放
    → 添加/切换到播放列表
    → 获取视频的音频流地址
    → 缓存复用（LRU 策略）
    → <audio> 元素加载并播放
    → 异步加载歌词
```

### 歌词获取流程

```
播放歌曲后自动请求歌词
    ├─ ① 优先获取视频自带字幕
    └─ ② 无字幕 → 第三方歌词源
        ├─ QQ 音乐
        └─ 网易云音乐
            └─ 获取 LRC → 解析 → 展示
```

### 登录流程

```
用户点击"登录B站"
    → 获取二维码
    → 生成二维码图片
    → 轮询扫码状态
    → 扫码确认 → 完成登录认证
    → 获取用户信息
    → 会话持久化
```

### 桌面歌词窗口

- **独立窗口**：透明背景、置顶、无边框
- **歌词动画**：活跃行高亮放大，过渡平滑
- **自定义拖拽**：鼠标拖拽移动窗口位置
- **锁定模式**：点击穿透，鼠标悬停时显示工具栏
- **自动字体大小**：根据窗口高度自适应
- **位置记忆**：自动保存与恢复窗口位置

## 🎨 界面布局

```
┌─ Header (60px) ──────────────────────────────────────────┐
│  🎵 BiliMusic  │  🔍 搜索框 (Autocomplete)    │  👤 登录  │
├─── Sidebar (68px) ────┬─── Main Content ─────────────────┤
│                        │                                  │
│  📋 播放列表           │                                  │
│  ⭐ 收藏夹             │     <router-view>                 │
│  🎤 歌词              │                                  │
│                        │                                  │
│  ───────────────       │                                  │
│  ⚙️ 设置              │                                  │
│                        │                                  │
├─── PlayerBar (80px) ─────────────────────────────────────┤
│  🖼️ 封面 标题 作者  │  🔀 ⏮ ▶️ ⏭ 🎤 🖥️  │  🔊 音量   │
└──────────────────────────────────────────────────────────┘
``` -->

## ⚙️ 内部实现亮点

- **数据缓存**：音频 URL 和歌词数据使用 LRU 淘汰策略，缓存上限可自定义
- **会话持久化**：登录状态安全保存，重启后自动恢复
- **CSP 安全策略**：严格的 Content-Security-Policy
- **错误处理**：全局错误捕获三层兜底
- **搜索防抖**：避免频繁请求

## 📄 开源协议

本项目基于 [Apache License Version 2.0](LICENSE) 开源。

## ⚠️ 免责声明

- 本项目仅用于学习和研究，不提供任何形式的商业服务
- 所有音乐内容来自对应视频平台，版权归原作者及平台所有
