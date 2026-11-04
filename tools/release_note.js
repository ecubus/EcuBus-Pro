const path = require('path')
const fsP = require('fs/promises')
const cp = require('child_process')
const util = require('util')
const exec = util.promisify(cp.exec)

const REPO_URL = 'https://github.com/ecubus/EcuBus-Pro'
// Conventional commits: feat(scope): ..., fix: ..., etc.
const CONVENTIONAL_RE =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?!?:\s+/i
// Legacy bracket tags: [feat]: ..., [bug]: ..., [opt]: ...
const LEGACY_TAG_RE = /^\[(feat|fix|bug|opt|docs|chore)\]:\s*/i

function shouldIncludeCommit(subject) {
  const s = subject.trim()
  if (!s) return false
  // version bump only, e.g. v0.8.67
  if (/^v?\d+\.\d+\.\d+$/.test(s)) return false
  // Crowdin noise
  if (/crowdin/i.test(s)) return false
  // keep conventional / legacy tagged commits, or anything that references a PR
  if (CONVENTIONAL_RE.test(s) || LEGACY_TAG_RE.test(s) || /#\d+/.test(s)) return true
  // other meaningful free-form commits (title case / sentence)
  return s.length > 8
}

function formatCommitLine(subject) {
  let line = subject.trim()
  // linkify bare URLs
  line = line.replace(/(https:\/\/\S+)/g, '[$1]($1)')
  // linkify #123 / (#123) to PR URLs
  line = line.replace(/#(\d+)/g, `[#$1](${REPO_URL}/pull/$1)`)
  return `* ${line}`
}

async function make_release_note_all() {
  try {
    // 获取并处理Git标签列表
    const ret = await exec('"git" tag -l --sort=-v:refname')
    let tagList = ret.stdout.match(/v\d+\.\d+\.\d+/g) // 匹配形如 'v1.0.0' 的版本号

    if (!tagList) {
      console.error('No tags found for release note generation.')
      return
    }

    //tag start from v0.8.4, ignore before v0.8.4
    tagList = tagList.splice(0, tagList.indexOf('v0.8.4') + 1)

    // 读取现有文件内容
    const releaseNotePath = path.join(__dirname, '..', 'docs', 'en', 'dev', 'releases_note.md')
    let existingContent = ''
    let fileExists = false
    try {
      existingContent = await fsP.readFile(releaseNotePath, 'utf-8')
      fileExists = true
    } catch (error) {
      console.log('No existing release note file found, creating new one')
    }

    // 检查当前commit是否有tag
    const { stdout: currentTag } = await exec('"git" tag --points-at HEAD')
    const hasCurrentTag = currentTag.trim() !== ''

    let newContent = ''

    if (!hasCurrentTag) {
      // 如果当前commit没有tag，添加Unreleased部分
      const latestTag = tagList[0]
      newContent += `## Unreleased\n`
      newContent += `Changes since ${latestTag}:\n\n`

      // 获取从最新tag到现在的提交记录
      const latestLogs = await exec(
        `"git" log --no-merges ${latestTag}..HEAD --pretty=format:"%s"`
      )

      for (const subject of latestLogs.stdout.split('\n')) {
        if (!shouldIncludeCommit(subject)) continue
        newContent += formatCommitLine(subject) + '\n'
      }
      newContent += '\n---\n\n'
    }

    // 合并新内容和现有内容
    let finalContent
    if (fileExists) {
      // 去掉旧的 Unreleased 段，避免重复追加
      const withoutUnreleased = existingContent.replace(
        /^## Unreleased\r?\n[\s\S]*?(?=\r?\n## |\r?\n#$)/m,
        ''
      )
      const titleMatch = withoutUnreleased.match(/^# EcuBus-Pro Release Notes\r?\n/)
      if (titleMatch) {
        finalContent =
          titleMatch[0] +
          '\n' +
          newContent +
          withoutUnreleased.replace(/^# EcuBus-Pro Release Notes\r?\n/, '')
      } else {
        finalContent = '# EcuBus-Pro Release Notes\n\n' + newContent + withoutUnreleased
      }
    } else {
      finalContent = '# EcuBus-Pro Release Notes\n\n' + newContent + existingContent
    }

    // 写入Markdown文件
    await fsP.writeFile(releaseNotePath, finalContent)
    console.log(`Release note updated: ${releaseNotePath}`)
  } catch (error) {
    console.error('Error generating release note:', error)
  }
}

module.exports = make_release_note_all
if (require.main === module) {
  make_release_note_all()
}
