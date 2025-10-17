/**
 * Tab 插件系统类型定义
 */

import type { Component } from 'vue'

// 插件中的按钮配置
export interface PluginButtonConfig {
  type: 'button'
  id: string // 唯一标识
  label: string
  icon?: string // iconify 图标名称
  iconSize?: string
  minWidth?: boolean
  class?: Record<string, boolean>
  style?: string
  // 点击事件处理器名称，会映射到插件注册的处理函数
  onClick?: string
}

// 插件中的下拉菜单配置
export interface PluginDropdownConfig {
  type: 'dropdown'
  id: string // 唯一标识
  label: string
  icon?: string
  iconSize?: string
  // 下拉菜单项
  items: Array<{
    command: string
    label: string
    icon?: string
    disabled?: boolean
    divided?: boolean
  }>
  // 命令处理器名称
  onCommand?: string
}

// 插件中的分隔符配置
export interface PluginDividerConfig {
  type: 'divider'
}

export type PluginItemConfig = PluginButtonConfig | PluginDropdownConfig | PluginDividerConfig

// 插件 Tab 配置
export interface PluginTabConfig {
  name: string // tab 名称（唯一标识）
  label: string // 显示标签
  icon?: string // iconify 图标名称
  items: PluginItemConfig[] // Tab 中的项目列表
}

// 扩展现有 Tab 的配置
export interface PluginTabExtension {
  targetTab: string // 目标 tab 名称（如 'home', 'hardware' 等）
  items: PluginItemConfig[]
}

// 插件清单配置
export interface PluginManifest {
  id: string // 插件唯一标识
  name: string // 插件名称
  version: string // 插件版本
  description?: string // 插件描述
  author?: string // 作者
  // 新增的 tabs
  tabs?: PluginTabConfig[]
  // 扩展现有 tabs
  extensions?: PluginTabExtension[]
}

// 完整的插件定义
export interface Plugin {
  manifest: PluginManifest
}
