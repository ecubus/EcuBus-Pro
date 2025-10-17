# 插件系统更新说明 - 移除 position 属性

## 更新日期
2025-10-17

## 更新内容

### 主要变更

**完全移除了插件 Tab 的 `position` 属性**

所有插件新增的 Tab **只能按照加载顺序追加在系统 Tab 之后**，无法通过 position 属性自定义顺序。

### 系统 Tab 固定顺序

1. Home（主页）
2. Hardware（硬件）
3. Diagnostics（诊断）
4. SOA
5. Test（测试）
6. Others（其他）

**插件 Tab 从第 7 位开始**

### 插件加载顺序

插件按照目录的字母顺序加载：

```
plugins/
├── aaa-plugin/     ← 最先加载
├── bbb-plugin/     ← 其次加载
└── zzz-plugin/     ← 最后加载
```

最终显示顺序：
```
Home → Hardware → Diagnostics → SOA → Test → Others → AAA Tab → BBB Tab → ZZZ Tab
```

### 修改的文件

#### 1. 类型定义
- `src/renderer/src/plugin/tabPluginTypes.ts`
  - 移除 `PluginTabConfig.position` 属性

#### 2. 插件管理器
- `src/renderer/src/plugin/tabPluginManager.ts`
  - 移除 `getNewTabs()` 中的排序逻辑
  - 直接按注册顺序返回

#### 3. UI 集成
- `src/renderer/src/views/uds/uds.vue`
  - 简化 `mergePluginTabs()` 函数
  - 移除 position 相关处理
  - 直接按顺序追加插件 tabs

#### 4. 示例插件
- `src/renderer/src/plugin/examples/my-custom-plugin/manifest.json`
  - 移除 `position: 4` 配置

#### 5. 文档
- `docs/plugin-system.zh.md`
  - 移除所有 position 相关说明
  - 添加加载顺序说明
  - 强调插件 Tab 顺序由目录名决定
  
- `docs/plugin-system.md`
  - 同步英文文档更新

### 配置示例对比

#### 之前（已废弃）
```json
{
  "tabs": [
    {
      "name": "my-tab",
      "label": "My Tab",
      "icon": "mdi:star",
      "position": 3,  ← 已移除
      "items": [...]
    }
  ]
}
```

#### 现在（正确）
```json
{
  "tabs": [
    {
      "name": "my-tab",
      "label": "My Tab",
      "icon": "mdi:star",
      "items": [...]
    }
  ]
}
```

### 重要提示

1. **删除旧配置**：如果您的插件 manifest.json 中有 `position` 字段，请删除它（不影响功能，但为了代码整洁）

2. **控制顺序**：如果需要控制插件 Tab 的显示顺序，可以通过重命名插件目录来实现：
   ```
   plugins/
   ├── 01-important-plugin/   ← 会先显示
   ├── 02-tool-plugin/        ← 其次显示
   └── 99-utility-plugin/     ← 最后显示
   ```

3. **扩展现有 Tab**：如果您的功能适合放在系统 Tab 中，请使用 `extensions` 而不是创建新 Tab：
   ```json
   {
     "extensions": [
       {
         "targetTab": "home",
         "position": "end",
         "items": [...]
       }
     ]
   }
   ```

### 兼容性

- ✅ 现有插件无需修改即可继续使用
- ✅ `position` 字段会被忽略（如果存在）
- ✅ 所有功能保持正常

### 优点

1. **简化配置**：不需要担心 position 冲突
2. **可预测性**：Tab 顺序完全由目录名决定
3. **易于管理**：通过重命名目录即可调整顺序
4. **代码更简洁**：减少了排序和冲突处理逻辑

### 查看更新

运行以下命令查看代码变更：
```bash
git diff HEAD~1 src/renderer/src/plugin/
git diff HEAD~1 docs/plugin-system*
```

## 如有疑问

请参阅：
- 📖 `docs/plugin-system.zh.md` - 完整中文文档
- 📖 `docs/plugin-system.md` - English documentation
- 💡 `src/renderer/src/plugin/examples/` - 示例插件

---

**总结**：插件 Tab 现在按照加载顺序（目录字母顺序）排列在系统 Tab 之后，更加简单和可预测！

