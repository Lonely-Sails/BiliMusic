// afterPack.js — 打包后处理脚本
// 移除 Electron 框架中不必要的多语言文件，减小应用体积

const fs = require('fs')
const path = require('path')

exports.default = async function (context) {
  const { appOutDir, packager } = context
  const productName = packager.appInfo.productName
  
  // Electron Framework 的 Resources 路径
  const resourcesPath = path.join(
    appOutDir,
    `${productName}.app`,
    'Contents',
    'Frameworks',
    'Electron Framework.framework',
    'Versions',
    'Current',
    'Resources'
  )

  if (!fs.existsSync(resourcesPath)) {
    console.log('  • afterPack: Resources path not found, skipping locale cleanup')
    return
  }

  // 需要保留的语言列表
  const keepLocales = new Set([
    'en.lproj',
    'zh-Hans.lproj',
    'zh-Hans_CN.lproj'
  ])

  let removedCount = 0
  let removedSize = 0

  const entries = fs.readdirSync(resourcesPath)
  for (const entry of entries) {
    // 只处理 .lproj 目录
    if (!entry.endsWith('.lproj')) continue
    if (keepLocales.has(entry)) continue

    const fullPath = path.join(resourcesPath, entry)
    try {
      // 计算目录大小
      const size = getDirSize(fullPath)
      fs.rmSync(fullPath, { recursive: true, force: true })
      removedCount++
      removedSize += size
      console.log(`  • afterPack: Removed locale ${entry} (${(size / 1024 / 1024).toFixed(1)}MB)`)
    } catch (err) {
      console.warn(`  • afterPack: Failed to remove ${entry}: ${err.message}`)
    }
  }

  const savedMB = (removedSize / 1024 / 1024).toFixed(1)
  console.log(`  • afterPack: Removed ${removedCount} locale packs, saved ${savedMB}MB`)
}

function getDirSize(dirPath) {
  let total = 0
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += getDirSize(fullPath)
      } else if (entry.isFile()) {
        total += fs.statSync(fullPath).size
      }
    }
  } catch (e) {
    // ignore
  }
  return total
}
