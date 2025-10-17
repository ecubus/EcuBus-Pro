/**
 * Tab 插件系统类型定义
 */

// 现有的 Tab 位置类型
export type TabPos = 'home' | 'hardware' | 'diag' | 'soa' | 'test' | 'other'

// 扩展：允许插件添加自定义 Tab
export type TabName = TabPos | string
