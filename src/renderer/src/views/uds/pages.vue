<template>
  <div class="uds-pages">
    <div class="pages-list">
      <div
        v-for="(page, index) in pages"
        :key="index"
        class="page-item"
        :class="{ active: index === currentPageIndex }"
        @click="setActive(index)"
      >
        <el-dropdown trigger="contextmenu" @command="(cmd: string) => handleCommand(cmd, index)">
          <span class="page-label">
            <span class="page-name">{{ page.name }}</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="rename">Rename</el-dropdown-item>
              <el-dropdown-item command="delete">Delete</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <span class="page-add" @click="createNewPage">
        <ElIcon>
          <CirclePlusFilled />
        </ElIcon>
      </span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeMount } from 'vue'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import {
  ElIcon,
  ElMessage,
  ElMessageBox,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem
} from 'element-plus'
import { useProjectStore } from '@r/stores/project'

const project = useProjectStore()

const pages = computed(() => project.project.pages || [])

const currentPageIndex = computed(() => project.project.activePageId || 0)

function setActive(index: number) {
  project.project.activePageId = index
}

function createNewPage() {
  const list = project.project.pages
  const index = list.length + 1
  list.push({
    name: `Page${index}`
  })
  project.project.activePageId = list.length - 1
}

function removePage(index: number) {
  const pages = project.project.pages
  if (!pages || pages.length <= 1) {
    ElMessageBox({
      title: 'Warning',
      message: 'At least one page is required',
      type: 'warning',
      buttonSize: 'small'
    })
    return
  }

  const removedIndex = index
  const targetIndex = removedIndex > 0 ? removedIndex - 1 : 0

  // 重新分配窗口的 pageId
  for (const win of Object.values(project.project.wins)) {
    const pid = typeof win.pageId === 'number' ? win.pageId : 0
    if (pid === removedIndex || pid >= pages.length) {
      win.pageId = targetIndex
    } else if (pid > removedIndex) {
      win.pageId = pid - 1
    }
  }

  pages.splice(removedIndex, 1)

  if (
    typeof project.project.activePageId !== 'number' ||
    project.project.activePageId >= pages.length
  ) {
    project.project.activePageId = targetIndex
  }
}

async function renamePage(index: number) {
  const pages = project.project.pages || []
  const page = pages[index]
  if (!page) return

  try {
    const { value } = await ElMessageBox.prompt('输入新的页面名称', '重命名页面', {
      inputValue: page.name,
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      closeOnClickModal: false
    })
    const v = (value || '').trim()
    if (v) {
      page.name = v
    }
  } catch {
    // cancelled
  }
}
onBeforeMount(() => {
  if (!project.project.pages) {
    project.project.pages = []
  }
  if (project.project.pages.length === 0) {
    project.project.pages.push({
      name: 'Page1'
    })
  }
  if (project.project.activePageId === undefined) {
    project.project.activePageId = 0
  }
})
function handleCommand(command: string, index: number) {
  if (command === 'rename') {
    renamePage(index)
  } else if (command === 'delete') {
    removePage(index)
  }
}
</script>

<style scoped>
.uds-pages {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 30px;
  padding: 0;
  box-sizing: border-box;
  background-color: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-light);
  display: flex;
  align-items: center;
  user-select: none;
}

.pages-list {
  display: flex;
  align-items: center;
  height: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.pages-list::-webkit-scrollbar {
  display: none;
}

.page-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  height: 100%;
  cursor: pointer;
  border-right: 1px solid var(--el-border-color-light);
  font-size: 12px;
  color: var(--el-text-color-regular);
  transition: all 0.15s;
  min-width: 60px;
  position: relative;
}

.page-item:hover {
  background-color: var(--el-fill-color-light);
}

.page-item.active {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.page-item :deep(.el-dropdown) {
  display: flex;
  align-items: center;
  height: 100%;
  width: 100%;
  justify-content: center;
}

.page-label {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
}

.page-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* Ensure descenders (g, j, p, q, y) are not cut off */
  line-height: normal;
  padding-bottom: 1px;
}

.page-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 100%;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  transition: all 0.2s;
  font-size: 14px;
}

.page-add:hover {
  background-color: var(--el-fill-color-light);
  color: var(--el-color-primary);
}
</style>
