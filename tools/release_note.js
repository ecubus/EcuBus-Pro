const path = require('path')
const yaml = require('js-yaml')
const fsP = require('fs/promises')
const fs = require('fs')
const cp = require('child_process')
const util = require('util')
const exec = util.promisify(cp.exec)

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
    const releaseNotePath = path.join(__dirname, '..', 'docs', 'dev', 'releases_note.md')
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
      const LOG_FORMAT = '%Cgreen*%Creset %s'
      const latestLogs = await exec(
        `"git" log --no-merges ${latestTag}..HEAD --format="${LOG_FORMAT}" --date=short`
      )

      // 处理最新的提交记录
      for (let log of latestLogs.stdout.split('\n')) {
        if (/^\s*\*\s+\[(.*?)\]:/.test(log)) {
          log = log.replace(/(https:\/\/\S+)/g, '[$1]($1)')
          for (let i = 1; i < log.length; i++) {
            if (log[i] === '[' && i != 0 && log[i+1]!='h') {
              newContent += '\n* '
            }
            newContent += log[i]
          }
        }
      }
      newContent += '\n---\n\n'
    }

    // 合并新内容和现有内容
    let finalContent
    if (fileExists) {
      // 如果文件存在，保留标题，只替换内容部分
      const titleMatch = existingContent.match(/^# EcuBus-Pro Release Notes\n\n/)
      if (titleMatch) {
        // 保留标题，移除现有内容，添加新内容
        finalContent = titleMatch[0] + newContent + existingContent.replace(/^# EcuBus-Pro Release Notes\n\n/, '')
      } else {
        // 如果没有找到标题，添加标题
        finalContent = '# EcuBus-Pro Release Notes\n\n' + newContent + existingContent
      }
    } else {
      // 如果文件不存在，创建新文件并添加标题
      finalContent = '# EcuBus-Pro Release Notes\n\n' + newContent + existingContent
    }

    // 写入Markdown文件
    await fsP.writeFile(releaseNotePath, finalContent)
  } catch (error) {
    console.error('Error generating release note:', error)
  }
}

module.exports = make_release_note_all
if (require.main === module) {
  make_release_note_all()
}


