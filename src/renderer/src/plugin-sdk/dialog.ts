// ============ 文件对话框相关类型定义 ============

/**
 * 文件过滤器，用于限制可选择的文件类型
 */
export interface FileFilter {
  /** 过滤器名称，例如 "Images" */
  name: string
  /** 文件扩展名数组，例如 ["png", "jpg"] */
  extensions: string[]
}

/**
 * 打开文件对话框的配置选项
 */
export interface OpenDialogOptions {
  /** 对话框标题 */
  title?: string
  /** 默认路径 */
  defaultPath?: string
  /**
   * 确认按钮的自定义标签，留空时使用默认标签
   */
  buttonLabel?: string
  /** 文件过滤器数组 */
  filters?: FileFilter[]
  /**
   * 对话框的功能配置
   * - openFile: 允许选择文件
   * - openDirectory: 允许选择文件夹
   * - multiSelections: 允许多选
   * - showHiddenFiles: 显示隐藏文件
   * - createDirectory: 允许创建新目录 (macOS)
   * - promptToCreate: 如果输入的路径不存在，提示创建 (Windows)
   * - noResolveAliases: 禁用自动别名解析 (macOS)
   * - treatPackageAsDirectory: 将包视为目录 (macOS)
   * - dontAddToRecent: 不添加到最近文档 (Windows)
   */
  properties?: Array<
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'promptToCreate'
    | 'noResolveAliases'
    | 'treatPackageAsDirectory'
    | 'dontAddToRecent'
  >
  /**
   * 显示在输入框上方的消息 (仅 macOS)
   * @platform darwin
   */
  message?: string
  /**
   * 创建安全作用域书签 (仅 macOS)
   * @platform darwin,mas
   */
  securityScopedBookmarks?: boolean
}

/**
 * 打开文件对话框的返回值
 */
export interface OpenDialogReturnValue {
  /** 对话框是否被取消 */
  canceled: boolean
  /** 用户选择的文件路径数组。如果对话框被取消，这将是一个空数组 */
  filePaths: string[]
  /**
   * 与 filePaths 数组匹配的 base64 编码字符串数组，包含安全作用域书签数据
   * 必须启用 securityScopedBookmarks 才会填充此字段 (仅 macOS)
   * @platform darwin,mas
   */
  bookmarks?: string[]
}

/**
 * 保存文件对话框的配置选项
 */
export interface SaveDialogOptions {
  /**
   * 对话框标题。在某些 Linux 桌面环境中无法显示
   */
  title?: string
  /**
   * 默认使用的绝对目录路径、绝对文件路径或文件名
   */
  defaultPath?: string
  /**
   * 确认按钮的自定义标签，留空时使用默认标签
   */
  buttonLabel?: string
  /** 文件过滤器数组 */
  filters?: FileFilter[]
  /**
   * 显示在文本字段上方的消息 (仅 macOS)
   * @platform darwin
   */
  message?: string
  /**
   * 显示在文件名文本字段前的自定义标签 (仅 macOS)
   * @platform darwin
   */
  nameFieldLabel?: string
  /**
   * 显示标签输入框，默认为 true (仅 macOS)
   * @platform darwin
   */
  showsTagField?: boolean
  /**
   * 对话框的功能配置
   * - showHiddenFiles: 显示隐藏文件
   * - createDirectory: 允许创建新目录 (macOS)
   * - treatPackageAsDirectory: 将包视为目录 (macOS)
   * - showOverwriteConfirmation: 如果文件已存在，显示覆盖确认
   * - dontAddToRecent: 不添加到最近文档 (Windows)
   */
  properties?: Array<
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'treatPackageAsDirectory'
    | 'showOverwriteConfirmation'
    | 'dontAddToRecent'
  >
  /**
   * 为 Mac App Store 打包时创建安全作用域书签
   * 如果启用此选项且文件不存在，将在选择的路径创建一个空文件 (仅 macOS)
   * @platform darwin,mas
   */
  securityScopedBookmarks?: boolean
}

/**
 * 保存文件对话框的返回值
 */
export interface SaveDialogReturnValue {
  /** 对话框是否被取消 */
  canceled: boolean
  /** 用户选择的文件路径。如果对话框被取消，这将是一个空字符串 */
  filePath: string
  /**
   * Base64 编码的字符串，包含已保存文件的安全作用域书签数据
   * 必须启用 securityScopedBookmarks 才会填充此字段 (仅 macOS)
   * @platform darwin,mas
   */
  bookmark?: string
}

/**
 * 显示打开文件对话框
 * @param options 对话框选项
 * @returns Promise，包含用户选择的文件路径和取消状态
 * @example
 * ```typescript
 * const result = await showOpenDialog({
 *   title: '选择文件',
 *   filters: [{ name: 'Images', extensions: ['jpg', 'png'] }],
 *   properties: ['openFile', 'multiSelections']
 * })
 * if (!result.canceled) {
 *   console.log('选择的文件:', result.filePaths)
 * }
 * ```
 */
export async function showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
  return window.parent.electron.ipcRenderer.invoke('ipc-show-open-dialog', options)
}

/**
 * 显示保存文件对话框
 * @param options 对话框选项
 * @returns Promise，包含用户选择的保存路径和取消状态
 * @example
 * ```typescript
 * const result = await showSaveDialog({
 *   title: '保存文件',
 *   defaultPath: 'untitled.txt',
 *   filters: [{ name: 'Text Files', extensions: ['txt'] }]
 * })
 * if (!result.canceled) {
 *   console.log('保存路径:', result.filePath)
 * }
 * ```
 */
export async function showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogReturnValue> {
  return window.parent.electron.ipcRenderer.invoke('ipc-show-save-dialog', options)
}
