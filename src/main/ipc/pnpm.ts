import { ipcMain, shell } from 'electron'
import { glob } from 'glob'
import fsP from 'fs/promises'
import fs from 'fs'
import path from 'path'
import { exec, execSync, spawn } from 'child_process'
import { promisify } from 'util'
import dllFile from '../../../resources/lib/libusb-1.0.dll?asset&asarUnpack'

const execAsync = promisify(exec)
const dllPath = path.dirname(dllFile)
const ecb_cli = path.join(dllPath, 'ecb_cli')

// 执行命令的工具函数
async function execCommand(command: string, cwd: string) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ')
    const process = spawn(cmd, args, { cwd })

    process.stdout.on('data', (data) => {
      const output = data.toString()
      global.mainWindow?.webContents.send('ipc-pnpm-log', output)
    })

    process.stderr.on('data', (data) => {
      const output = data.toString()
      global.mainWindow?.webContents.send('ipc-pnpm-log', output)
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve(null)
      } else {
        reject(new Error(`Command failed with code ${code}`))
      }
    })

    process.on('error', (error) => {
      reject(error)
    })
  })
}

ipcMain.handle('ipc-pnpm-init', async (event, ...args) => {
  const projectPath = args[0]
  if (!projectPath) {
    throw new Error('Project path is required')
  }

  try {
    // 检查目录是否存在
    if (!fs.existsSync(projectPath)) {
      throw new Error('Project directory does not exist')
    }

    // 检查是否已经存在 package.json
    const packageJsonPath = path.join(projectPath, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      //read package.json
      const packageJson = await fsP.readFile(packageJsonPath, 'utf-8')
      return JSON.parse(packageJson)
    }

    // 执行 pnpm init 命令
    await execCommand(`${ecb_cli} pnpm init -y`, projectPath)

    // 读取生成的 package.json 并返回
    const packageJson = await fsP.readFile(packageJsonPath, 'utf-8')
    return JSON.parse(packageJson)
  } catch (error) {
    console.error('Failed to initialize package.json:', error)
    throw error
  }
})

// 安装包
ipcMain.handle('ipc-pnpm-install', async (event, ...args) => {
  const [projectPath, packageName, isDev] = args
  if (!projectPath || !packageName) {
    throw new Error('Project path and package name are required')
  }

  try {
    const command = `${ecb_cli} pnpm add ${packageName}${isDev ? ' -D' : ''}`
    await execCommand(command, projectPath)

    // 读取更新后的 package.json
    const packageJson = await fsP.readFile(path.join(projectPath, 'package.json'), 'utf-8')
    return JSON.parse(packageJson)
  } catch (error) {
    console.error('Failed to install package:', error)
    throw error
  }
})

// 卸载包
ipcMain.handle('ipc-pnpm-uninstall', async (event, ...args) => {
  const [projectPath, packageName] = args
  if (!projectPath || !packageName) {
    throw new Error('Project path and package name are required')
  }

  try {
    await execCommand(`${ecb_cli} pnpm remove ${packageName}`, projectPath)

    // 读取更新后的 package.json
    const packageJson = await fsP.readFile(path.join(projectPath, 'package.json'), 'utf-8')
    return JSON.parse(packageJson)
  } catch (error) {
    console.error('Failed to uninstall package:', error)
    throw error
  }
})

// 读取 package.json
ipcMain.handle('ipc-pnpm-read', async (event, ...args) => {
  const [projectPath] = args
  if (!projectPath) {
    throw new Error('Project path is required')
  }

  try {
    const packageJsonPath = path.join(projectPath, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      return null
    }

    const packageJson = await fsP.readFile(packageJsonPath, 'utf-8')
    return JSON.parse(packageJson)
  } catch (error) {
    console.error('Failed to read package.json:', error)
    throw error
  }
})
