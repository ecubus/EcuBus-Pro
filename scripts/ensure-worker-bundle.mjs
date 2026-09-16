import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bundlePath = path.join(root, 'resources/lib/js/index.js')
const typingsPath = path.join(root, 'src/main/share/index.d.ts.html')
const workerDir = path.join(root, 'src/main/worker')

function newestMtime(targetPath, onlyFiles = false) {
  if (!fs.existsSync(targetPath)) {
    return 0
  }

  const stat = fs.statSync(targetPath)
  if (onlyFiles || stat.isFile()) {
    return stat.mtimeMs
  }

  let latest = stat.mtimeMs
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const childPath = path.join(targetPath, entry.name)
    latest = Math.max(
      latest,
      entry.isDirectory() ? newestMtime(childPath) : fs.statSync(childPath).mtimeMs
    )
  }
  return latest
}

const bundleMtime = Math.max(newestMtime(bundlePath, true), newestMtime(typingsPath, true))
const sourceMtime = newestMtime(workerDir)

if (!fs.existsSync(bundlePath) || !fs.existsSync(typingsPath) || sourceMtime > bundleMtime) {
  console.log('[ensure-worker-bundle] rebuilding worker API bundle...')
  execSync('npm run worker:js', { cwd: root, stdio: 'inherit' })
} else {
  console.log('[ensure-worker-bundle] worker API bundle is up to date')
}
