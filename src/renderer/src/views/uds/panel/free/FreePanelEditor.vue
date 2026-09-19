<template>
  <section
    class="free-panel-editor"
    :style="{ height: `${height}px` }"
    tabindex="0"
    @keydown="keyboard"
  >
    <header class="panel-toolbar">
      <el-button
        size="small"
        type="primary"
        @click="emit('save', name.trim(), cloneDocument(document))"
        >{{ t('save') }}</el-button
      >
      <el-button-group
        ><el-button size="small" :disabled="!history.canUndo || preview" @click="restore('undo')">{{
          t('undo')
        }}</el-button
        ><el-button size="small" :disabled="!history.canRedo || preview" @click="restore('redo')">{{
          t('redo')
        }}</el-button></el-button-group
      >
      <el-dropdown :disabled="!canArrange || preview" @command="arrange"
        ><el-button size="small" :disabled="!canArrange || preview">{{ t('arrange') }}</el-button
        ><template #dropdown
          ><el-dropdown-menu
            ><el-dropdown-item v-for="mode in arrangements" :key="mode" :command="mode">{{
              t(mode)
            }}</el-dropdown-item></el-dropdown-menu
          ></template
        ></el-dropdown
      >
      <el-button size="small" :disabled="!selected.length || preview" @click="duplicate">{{
        t('duplicate')
      }}</el-button>
      <el-button size="small" :disabled="!editableSelection.length || preview" @click="remove">{{
        t('delete')
      }}</el-button>
      <el-button size="small" :disabled="!canArrange || preview" @click="groupSelected">{{
        t('groupSelection')
      }}</el-button>
      <el-button
        size="small"
        :disabled="
          selected.length !== 1 || active?.type !== 'group' || !editableSelection.length || preview
        "
        @click="ungroup"
        >{{ t('ungroup') }}</el-button
      >
      <span class="toolbar-fill"></span>
      <el-button size="small" @click="emit('saveAs', name.trim(), cloneDocument(document))">{{
        t('savePanelAs')
      }}</el-button>
      <el-button size="small" :type="preview ? 'primary' : 'default'" @click="togglePreview">{{
        t(preview ? 'edit' : 'preview')
      }}</el-button>
    </header>
    <div
      ref="workspace"
      class="panel-workspace"
      :class="{ preview }"
      :style="
        preview
          ? undefined
          : {
              gridTemplateColumns: `${sidebarWidths.left}px 5px minmax(180px, 1fr) 5px ${sidebarWidths.right}px`
            }
      "
    >
      <aside v-if="!preview" class="panel-library">
        <nav class="panel-tabs">
          <button :class="{ active: tab === 'components' }" @click="tab = 'components'">
            {{ t('components') }}</button
          ><button :class="{ active: tab === 'layers' }" @click="tab = 'layers'">
            {{ t('layers') }}
          </button>
          <button :class="{ active: tab === 'sources' }" @click="tab = 'sources'">
            {{ t('data') }}
          </button>
        </nav>
        <div v-if="tab === 'components'" class="panel-palette">
          <button
            v-for="type in controlTypes"
            :key="type"
            draggable="true"
            :disabled="!!active && isLocked(document, active)"
            @dragstart="$event.dataTransfer?.setData('application/ecubus-control', type)"
            @click="add(type)"
          >
            <span class="palette-symbol">{{ symbols[type] }}</span
            >{{ t(type) }}
          </button>
        </div>
        <div v-else-if="tab === 'layers'" class="panel-layers">
          <button
            v-for="control in layerControls"
            :key="control.id"
            :class="{ active: selected.includes(control.id) }"
            :style="{ paddingLeft: `${8 + ancestors(document, control).length * 12}px` }"
            @click="selectLayer(control, $event.shiftKey)"
          >
            <span>{{ control.label }}</span
            ><span v-if="control.locked">▣</span>
          </button>
        </div>
        <SourceLibrary
          v-else
          :sources="sources"
          :disabled="!!active && isLocked(document, active)"
          @add="addSource"
        />
      </aside>
      <div
        v-if="!preview"
        class="panel-splitter"
        role="separator"
        aria-orientation="vertical"
        :aria-label="t('resizeSidebar')"
        tabindex="0"
        :aria-valuenow="sidebarWidths.left"
        @pointerdown.prevent="startSidebarResize($event, 'left')"
        @pointermove="moveSidebarResize"
        @pointerup="endSidebarResize"
        @pointercancel="cancelSidebarResize"
        @lostpointercapture="cancelSidebarResize"
        @keydown.left.prevent="resizeSidebar('left', sidebarWidths.left - 8)"
        @keydown.right.prevent="resizeSidebar('left', sidebarWidths.left + 8)"
      />
      <main class="panel-center" @dragover.prevent @drop="drop">
        <div class="panel-canvas-heading">
          <span>{{ preview ? t('preview') : t('canvas') }}</span
          ><span>{{ document.width }} × {{ document.height }}</span>
        </div>
        <PanelCanvas
          :document="document"
          :selected="selected"
          :zoom="zoom"
          :snap="snap"
          :preview="preview"
          :values="previewValues"
          :pages="pages"
          @change="commit"
          @resize="(value, done) => (done ? commit(value) : (document = value))"
          @select="selectControls"
          @page="switchPage"
          @write="(id, value) => (previewValues[id] = value)"
        />
      </main>
      <div
        v-if="!preview"
        class="panel-splitter"
        role="separator"
        aria-orientation="vertical"
        :aria-label="t('resizeSidebar')"
        tabindex="0"
        :aria-valuenow="sidebarWidths.right"
        @pointerdown.prevent="startSidebarResize($event, 'right')"
        @pointermove="moveSidebarResize"
        @pointerup="endSidebarResize"
        @pointercancel="cancelSidebarResize"
        @lostpointercapture="cancelSidebarResize"
        @keydown.left.prevent="resizeSidebar('right', sidebarWidths.right + 8)"
        @keydown.right.prevent="resizeSidebar('right', sidebarWidths.right - 8)"
      />
      <aside v-if="!preview" class="panel-inspector">
        <h3>
          {{ t('properties') }}<span v-if="selected.length > 1">{{ selected.length }}</span>
        </h3>
        <div v-if="!active" class="panel-property-section">
          <label
            >{{ t('name') }}<el-input v-model="name" size="small" :aria-label="t('name')"
          /></label>
          <label v-for="axis in ['width', 'height'] as const" :key="axis"
            >{{ axis === 'width' ? 'W' : 'H'
            }}<el-input-number
              :model-value="document[axis]"
              :min="160"
              :max="4096"
              :step="8"
              size="small"
              controls-position="right"
              @change="resizeDocument(axis, $event)"
          /></label>
        </div>
        <template v-else>
          <div v-if="selected.length === 1" class="panel-property-section">
            <label
              >{{ t('parent')
              }}<el-select
                :model-value="active.parentId || '__canvas__'"
                size="small"
                :disabled="!editableSelection.length"
                @change="changeParent"
              >
                <el-option :label="t('canvas')" value="__canvas__" />
                <el-option
                  v-for="parent in parentOptions"
                  :key="parent.id"
                  :label="parent.label"
                  :value="parent.id"
                /> </el-select
            ></label>
            <label v-if="activeParent?.type === 'tabs'"
              >{{ t('page')
              }}<el-select
                :model-value="active.tabId"
                size="small"
                :disabled="!editableSelection.length"
                @change="changeParent(active!.parentId || '', $event)"
              >
                <el-option
                  v-for="page in activeParent.tabs"
                  :key="page.id"
                  :label="page.label"
                  :value="page.id"
                /> </el-select
            ></label>
          </div>
          <div class="panel-property-section">
            <h4>{{ t('geometry') }}</h4>
            <label v-for="key in geometryKeys" :key="key"
              >{{ key === 'width' ? 'W' : key === 'height' ? 'H' : key.toUpperCase()
              }}<span v-if="mixed(key)" class="mixed">{{ t('mixed') }}</span
              ><el-input-number
                :model-value="active[key]"
                :min="key === 'width' ? 32 : key === 'height' ? 24 : 0"
                :max="4096"
                size="small"
                controls-position="right"
                :disabled="!editableSelection.length"
                @change="patch(key, $event)"
            /></label>
            <label
              >{{ t('locked')
              }}<el-switch
                :model-value="active.locked"
                :disabled="ancestors(document, active).some((c) => c.locked)"
                size="small"
                @change="patch('locked', $event, true)"
            /></label>
            <div class="property-actions">
              <el-button
                size="small"
                :disabled="!editableSelection.length"
                @click="reorder(true)"
                >{{ t('front') }}</el-button
              ><el-button
                size="small"
                :disabled="!editableSelection.length"
                @click="reorder(false)"
                >{{ t('back') }}</el-button
              >
            </div>
          </div>
          <div
            v-if="selected.length === 1 && active.type === 'tabs'"
            class="panel-property-section"
          >
            <h4>{{ t('tabs') }}</h4>
            <div v-for="page in active.tabs" :key="page.id" class="enum-row">
              <el-input
                :model-value="page.label"
                :aria-label="t('page')"
                size="small"
                :disabled="!editableSelection.length"
                @update:model-value="renamePage(page.id, $event, false)"
                @change="renamePage(page.id, $event)"
              />
              <button
                :aria-label="t('delete')"
                :disabled="
                  !editableSelection.length ||
                  active.tabs!.length < 2 ||
                  document.controls.some((c) => c.parentId === active!.id && c.tabId === page.id)
                "
                @click="removePage(page.id)"
              >
                ×
              </button>
            </div>
            <el-button size="small" :disabled="!editableSelection.length" @click="addPage">{{
              t('add')
            }}</el-button>
            <label
              >{{ t('defaultPage')
              }}<el-select
                :model-value="active.defaultTabId || active.tabs?.[0]?.id"
                size="small"
                :disabled="!editableSelection.length"
                @change="patch('defaultTabId', $event)"
              >
                <el-option
                  v-for="page in active.tabs"
                  :key="page.id"
                  :label="page.label"
                  :value="page.id"
                /> </el-select
            ></label>
          </div>
          <div class="panel-property-section">
            <h4>{{ t('appearance') }}</h4>
            <label v-if="selected.length === 1"
              >{{ t('label')
              }}<el-input
                :model-value="active.label"
                size="small"
                :disabled="isLocked(document, active)"
                @update:model-value="patch('label', $event, false, false)"
                @change="patch('label', $event)"
            /></label>
            <label v-if="selected.length === 1 && active.type === 'button'">
              {{ t('buttonShape')
              }}<el-select
                :model-value="active.buttonShape || 'rounded'"
                size="small"
                :disabled="isLocked(document, active)"
                @change="patch('buttonShape', $event)"
              >
                <el-option
                  v-for="shape in ['rectangle', 'rounded', 'circle'] as const"
                  :key="shape"
                  :value="shape"
                  :label="t(`button_${shape}`)"
                />
              </el-select>
            </label>
            <template v-if="selected.length === 1 && active.type === 'led'">
              <label
                >{{ t('ledShape')
                }}<el-select
                  :model-value="active.ledShape || 'ellipse'"
                  size="small"
                  :disabled="isLocked(document, active)"
                  @change="patch('ledShape', $event)"
                  ><el-option
                    v-for="shape in ledShapes"
                    :key="shape"
                    :value="shape"
                    :label="t(`led_${shape}`)" /></el-select
              ></label>
              <label v-for="key in ['ledOnColor', 'ledOffColor'] as const" :key="key"
                >{{ t(key)
                }}<el-color-picker
                  :model-value="active[key] || (key === 'ledOnColor' ? '#67c23a' : '#dcdfe6')"
                  :disabled="isLocked(document, active)"
                  size="small"
                  @change="patch(key, $event || '')"
              /></label>
              <label v-for="key in ['ledFrame', 'ledKeepAspect'] as const" :key="key"
                >{{ t(key)
                }}<el-switch
                  :model-value="active[key] !== false"
                  :disabled="isLocked(document, active)"
                  @change="patch(key, $event)"
              /></label>
              <label v-for="key in ['pressValue', 'releaseValue'] as const" :key="key"
                >{{ t(key === 'pressValue' ? 'ledOnValue' : 'ledOffValue')
                }}<el-input-number
                  :model-value="active[key]"
                  size="small"
                  controls-position="right"
                  :disabled="isLocked(document, active)"
                  @change="patch(key, $event)"
              /></label>
            </template>
            <label v-if="labelPositionShared">
              {{ t('labelPosition')
              }}<span v-if="mixedLabelPosition" class="mixed">{{ t('mixed') }}</span>
              <el-select
                :model-value="mixedLabelPosition ? undefined : labelPosition(active)"
                placeholder=""
                size="small"
                :disabled="!editableSelection.length"
                @change="patch('labelPosition', $event)"
              >
                <el-option
                  v-for="position in labelPositions"
                  :key="position"
                  :value="position"
                  :label="t(`label_${position}`)"
                />
              </el-select>
            </label>
            <label v-if="appearanceShared"
              >{{ t('fontSize')
              }}<span v-if="mixed('fontSize')" class="mixed">{{ t('mixed') }}</span
              ><el-input-number
                :model-value="mixed('fontSize') ? undefined : active.fontSize"
                :min="10"
                :max="72"
                size="small"
                controls-position="right"
                :disabled="!editableSelection.length"
                @change="patch('fontSize', $event)"
            /></label>
            <label v-if="appearanceShared"
              >{{ t('color') }}<span v-if="mixed('color')" class="mixed">{{ t('mixed') }}</span
              ><el-color-picker
                :model-value="mixed('color') ? '' : active.color"
                size="small"
                :disabled="!editableSelection.length"
                @change="patch('color', $event || '')"
            /></label>
          </div>
          <div v-if="selected.length > 1 && sharedProperties.length" class="panel-property-section">
            <h4>{{ t('batch') }}</h4>
            <label v-for="key in sharedProperties" :key="key"
              >{{ t(key) }}<span v-if="mixed(key)" class="mixed">{{ t('mixed') }}</span>
              <el-input
                v-if="key === 'unit'"
                :model-value="batchUnit ?? (mixed(key) ? '' : active.unit)"
                size="small"
                :disabled="!editableSelection.length"
                @update:model-value="batchUnit = $event"
                @change="commitBatchUnit"
              />
              <el-checkbox
                v-else-if="key === 'readOnly' || key === 'toggle'"
                :model-value="editableSelection[0]?.[key] ?? active[key]"
                :indeterminate="mixed(key)"
                :aria-label="t(key)"
                :disabled="!editableSelection.length"
                @change="patch(key, !!$event)"
              />
              <el-input-number
                v-else
                :model-value="mixed(key) ? undefined : active[key]"
                :min="key === 'step' ? 0.001 : undefined"
                size="small"
                controls-position="right"
                :disabled="!editableSelection.length"
                @change="patch(key, $event)"
              />
            </label>
          </div>
          <div
            v-if="selected.length === 1 && active.type === 'image'"
            class="panel-property-section"
          >
            <h4>{{ t('image') }}</h4>
            <input
              ref="imageInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              @change="importImage"
            />
            <div class="property-actions">
              <el-button
                size="small"
                :disabled="isLocked(document, active)"
                @click="imageInput?.click()"
                >{{ t('chooseImage') }}</el-button
              >
              <el-button
                size="small"
                :disabled="isLocked(document, active) || !active.imageSrc"
                @click="patch('imageSrc', '')"
                >{{ t('clear') }}</el-button
              >
            </div>
            <label
              >{{ t('imageFit')
              }}<el-select
                :model-value="active.imageFit || 'contain'"
                size="small"
                :disabled="isLocked(document, active)"
                @change="patch('imageFit', $event)"
              >
                <el-option
                  v-for="fit in ['contain', 'cover', 'fill'] as const"
                  :key="fit"
                  :label="t(fit)"
                  :value="fit"
                /> </el-select
            ></label>
          </div>
          <div
            v-if="selected.length === 1 && active.type === 'html'"
            class="panel-property-section html-properties"
          >
            <h4>{{ t('html') }}</h4>
            <div class="property-note">{{ t('htmlScriptHelp') }}</div>
            <label
              >{{ t('htmlContent')
              }}<el-input
                type="textarea"
                :rows="8"
                :model-value="active.htmlContent || ''"
                :disabled="isLocked(document, active)"
                @update:model-value="patch('htmlContent', $event, false, false)"
                @change="patch('htmlContent', $event)"
            /></label>
            <label
              >{{ t('scriptContent')
              }}<el-input
                type="textarea"
                :rows="8"
                :model-value="active.scriptContent || ''"
                :disabled="isLocked(document, active)"
                @update:model-value="patch('scriptContent', $event, false, false)"
                @change="patch('scriptContent', $event)"
            /></label>
          </div>
          <template
            v-if="
              selected.length === 1 &&
              !['text', 'image', 'html', 'group', 'tabs'].includes(active.type)
            "
          >
            <div
              v-if="
                active.type !== 'startStop' &&
                (active.type !== 'button' ||
                  !active.buttonAction ||
                  active.buttonAction === 'write')
              "
              class="panel-property-section"
            >
              <h4>{{ t('data') }}</h4>
              <div class="binding-name">{{ active.binding?.node.name || t('unbound') }}</div>
              <div
                v-if="
                  active.binding?.kind === 'signal' && !['number', 'display'].includes(active.type)
                "
                class="binding-name"
              >
                {{ t('raw') }}
              </div>
              <div class="property-actions">
                <el-button
                  v-if="!['input', 'path'].includes(active.type)"
                  size="small"
                  :disabled="isLocked(document, active)"
                  @click="bindingKind = 'signal'"
                  >{{ t('signal') }}</el-button
                ><el-button
                  size="small"
                  :disabled="isLocked(document, active)"
                  @click="bindingKind = 'variable'"
                  >{{ t('variable') }}</el-button
                ><el-button
                  size="small"
                  :disabled="isLocked(document, active) || !active.binding"
                  @click="patch('binding', undefined)"
                  >{{ t('clear') }}</el-button
                >
              </div>
              <label v-if="!['input', 'path'].includes(active.type)"
                >{{ t('unit')
                }}<el-input
                  :model-value="active.unit"
                  size="small"
                  :disabled="isLocked(document, active)"
                  @update:model-value="patch('unit', $event, false, false)"
                  @change="patch('unit', $event)"
              /></label>
              <label v-if="['input', 'path'].includes(active.type)"
                >{{ t('initialText')
                }}<el-input
                  :model-value="active.initialText || ''"
                  size="small"
                  :disabled="isLocked(document, active)"
                  @update:model-value="patch('initialText', $event, false, false)"
                  @change="patch('initialText', $event)"
              /></label>
              <label v-if="active.type === 'input'"
                >{{ t('editorMode')
                }}<el-select
                  :model-value="active.editorMode || 'text'"
                  size="small"
                  :disabled="isLocked(document, active)"
                  @change="patch('editorMode', $event)"
                  ><el-option
                    v-for="mode in ['text', 'hex', 'both'] as const"
                    :key="mode"
                    :value="mode"
                    :label="t(`editor_${mode}`)" /></el-select
              ></label>
              <label v-if="active.type === 'path'"
                >{{ t('pathMode')
                }}<el-select
                  :model-value="active.pathMode || 'file'"
                  size="small"
                  :disabled="isLocked(document, active)"
                  @change="patch('pathMode', $event)"
                >
                  <el-option
                    v-for="mode in ['file', 'directory', 'save'] as const"
                    :key="mode"
                    :value="mode"
                    :label="t(`path_${mode}`)"
                  /> </el-select
              ></label>
              <label v-for="key in numericKeys" :key="key"
                >{{ t(key)
                }}<el-input-number
                  :model-value="active[key]"
                  :min="key === 'step' ? 0.001 : undefined"
                  size="small"
                  controls-position="right"
                  :disabled="isLocked(document, active)"
                  @change="patch(key, $event)"
              /></label>
              <template v-if="['number', 'display'].includes(active.type)">
                <label
                  >{{ t('numberFormat')
                  }}<el-select
                    :model-value="active.numberFormat || 'decimal'"
                    size="small"
                    :disabled="isLocked(document, active)"
                    @change="patch('numberFormat', $event)"
                    ><el-option
                      v-for="format in ['decimal', 'hex', 'binary'] as const"
                      :key="format"
                      :value="format"
                      :label="t(`format_${format}`)" /></el-select
                ></label>
                <label v-if="!active.numberFormat || active.numberFormat === 'decimal'"
                  >{{ t('numberDecimals')
                  }}<el-input-number
                    :model-value="active.numberDecimals"
                    :min="0"
                    :max="10"
                    :precision="0"
                    size="small"
                    :disabled="isLocked(document, active)"
                    @change="patch('numberDecimals', $event)"
                /></label>
                <label v-for="key in ['numberShowUnit', 'numberShowRange'] as const" :key="key"
                  >{{ t(key)
                  }}<el-switch
                    :model-value="
                      active[key] ?? (key === 'numberShowUnit' && active.type === 'display')
                    "
                    :disabled="isLocked(document, active)"
                    @change="patch(key, $event)"
                /></label>
                <label v-if="active.binding?.kind === 'signal'"
                  >{{ t('numberValueType')
                  }}<el-select
                    :model-value="active.numberValueType || 'raw'"
                    size="small"
                    :disabled="isLocked(document, active)"
                    @change="patch('numberValueType', $event)"
                    ><el-option
                      v-for="mode in ['raw', 'physical'] as const"
                      :key="mode"
                      :value="mode"
                      :label="t(mode)" /></el-select
                ></label>
                <label
                  >{{ t('alarmMode')
                  }}<el-select
                    :model-value="active.alarmMode || 'none'"
                    size="small"
                    :disabled="isLocked(document, active)"
                    @change="patch('alarmMode', $event)"
                    ><el-option
                      v-for="mode in ['none', 'limits'] as const"
                      :key="mode"
                      :value="mode"
                      :label="t(`alarm_${mode}`)" /></el-select
                ></label>
                <template v-if="active.alarmMode === 'limits'">
                  <label v-for="key in ['alarmLower', 'alarmUpper'] as const" :key="key"
                    >{{ t(key)
                    }}<el-input-number
                      :model-value="active[key]"
                      :min="key === 'alarmUpper' ? active.alarmLower : undefined"
                      :max="key === 'alarmLower' ? active.alarmUpper : undefined"
                      size="small"
                      :disabled="isLocked(document, active)"
                      @change="patch(key, $event)"
                  /></label>
                  <label v-for="key in ['alarmLowerColor', 'alarmUpperColor'] as const" :key="key"
                    >{{ t(key)
                    }}<el-color-picker
                      :model-value="
                        active[key] || (key === 'alarmLowerColor' ? '#fa8072' : '#cd5c5c')
                      "
                      size="small"
                      :disabled="isLocked(document, active)"
                      @change="patch(key, $event || '')"
                  /></label>
                </template>
              </template>
              <template v-if="active.type === 'progress'">
                <label
                  >{{ t('progressValuePosition')
                  }}<el-select
                    :model-value="progressValuePosition(active)"
                    size="small"
                    :disabled="isLocked(document, active)"
                    @change="changeProgressPosition"
                    ><el-option
                      v-for="position in ['hidden', 'left', 'top', 'right', 'bottom'] as const"
                      :key="position"
                      :value="position"
                      :label="t(`label_${position}`)" /></el-select
                ></label>
                <label
                  >{{ t('progressDirection')
                  }}<el-select
                    :model-value="active.progressDirection || 'right'"
                    size="small"
                    :disabled="isLocked(document, active)"
                    @change="patch('progressDirection', $event)"
                  >
                    <el-option
                      v-for="direction in ['right', 'left', 'up', 'down'] as const"
                      :key="direction"
                      :value="direction"
                      :label="t(`progress_${direction}`)"
                    /> </el-select
                ></label>
                <label
                  >{{ t('progressText')
                  }}<el-select
                    :model-value="active.progressText === 'percent' ? 'percent' : 'value'"
                    size="small"
                    :disabled="isLocked(document, active)"
                    @change="patch('progressText', $event)"
                  >
                    <el-option
                      v-for="mode in ['value', 'percent'] as const"
                      :key="mode"
                      :value="mode"
                      :label="t(`progress_${mode}`)"
                    /> </el-select
                ></label>
                <label
                  >{{ t('progressDecimals')
                  }}<el-input-number
                    :model-value="active.progressDecimals"
                    :min="0"
                    :max="6"
                    :precision="0"
                    size="small"
                    controls-position="right"
                    :disabled="isLocked(document, active)"
                    @change="patch('progressDecimals', $event)"
                /></label>
                <label
                  >{{ t('progressOrigin')
                  }}<el-input-number
                    :model-value="active.progressOrigin"
                    :min="active.min"
                    :max="active.max"
                    size="small"
                    controls-position="right"
                    :disabled="isLocked(document, active)"
                    @change="patch('progressOrigin', $event)"
                /></label>
                <label
                  >{{ t('progressShowLimits')
                  }}<el-switch
                    :model-value="!!active.progressShowLimits"
                    size="small"
                    :disabled="isLocked(document, active)"
                    @change="patch('progressShowLimits', $event)"
                /></label>
              </template>
              <template v-if="['select', 'radio'].includes(active.type)"
                ><h4>{{ t('options') }}</h4>
                <div v-for="(option, index) in active.options" :key="index" class="enum-row">
                  <el-input
                    :model-value="option.label"
                    size="small"
                    :aria-label="t('label')"
                    :disabled="isLocked(document, active)"
                    @update:model-value="optionPatch(index, 'label', $event, false)"
                    @change="optionPatch(index, 'label', $event)"
                  /><el-input-number
                    :model-value="option.value"
                    size="small"
                    :controls="false"
                    :aria-label="t('value')"
                    :disabled="isLocked(document, active)"
                    @change="optionPatch(index, 'value', $event)"
                  /><button
                    :disabled="isLocked(document, active)"
                    :aria-label="t('delete')"
                    @click="
                      patch(
                        'options',
                        active.options.filter((_, i) => i !== index)
                      )
                    "
                  >
                    ×
                  </button>
                </div>
                <el-button
                  size="small"
                  :disabled="isLocked(document, active)"
                  @click="
                    patch('options', [
                      ...active.options,
                      { label: String(active.options.length), value: active.options.length }
                    ])
                  "
                  >{{ t('add') }}</el-button
                ></template
              >
            </div>
            <div
              v-if="!['display', 'led', 'progress', 'gauge', 'html'].includes(active.type)"
              class="panel-property-section"
            >
              <h4>{{ t('behavior') }}</h4>
              <template v-if="active.type === 'button'">
                <label
                  >{{ t('buttonAction')
                  }}<el-select
                    :model-value="active.buttonAction || 'write'"
                    size="small"
                    :disabled="isLocked(document, active)"
                    @change="changeAction"
                  >
                    <el-option
                      v-for="action in buttonActions"
                      :key="action"
                      :value="action"
                      :label="t(`action_${action}`)"
                    /> </el-select
                ></label>
                <template v-if="active.buttonAction === 'openFile'">
                  <label
                    >{{ t('actionPath')
                    }}<el-input
                      :model-value="active.actionPath || ''"
                      size="small"
                      :disabled="isLocked(document, active)"
                      @update:model-value="patch('actionPath', $event, false, false)"
                      @change="patch('actionPath', $event)"
                  /></label>
                  <el-button
                    size="small"
                    :disabled="isLocked(document, active)"
                    @click="chooseActionFile"
                    >{{ t('browse') }}</el-button
                  >
                </template>
                <label v-if="active.buttonAction === 'openPanel'"
                  >{{ t('actionPanelId')
                  }}<el-select
                    :model-value="active.actionPanelId"
                    size="small"
                    :disabled="isLocked(document, active)"
                    @change="patch('actionPanelId', $event)"
                  >
                    <el-option
                      v-for="panel in data.panels"
                      :key="panel.id"
                      :value="panel.id"
                      :label="panel.name"
                    /> </el-select
                ></label>
              </template>
              <label
                >{{ t('readOnly')
                }}<el-switch
                  :model-value="active.readOnly"
                  :disabled="isLocked(document, active)"
                  @change="patch('readOnly', $event)"
              /></label>
              <label
                v-if="
                  active.type === 'button' &&
                  (!active.buttonAction || active.buttonAction === 'write')
                "
                >{{ t('toggle')
                }}<el-switch
                  :model-value="active.toggle"
                  :disabled="isLocked(document, active)"
                  @change="patch('toggle', $event)"
              /></label>
              <template
                v-if="
                  ['button', 'switch', 'checkbox'].includes(active.type) &&
                  (!active.buttonAction || active.buttonAction === 'write')
                "
                ><label v-for="key in ['pressValue', 'releaseValue'] as const" :key="key"
                  >{{ t(key)
                  }}<el-input-number
                    :model-value="active[key]"
                    :disabled="isLocked(document, active)"
                    size="small"
                    controls-position="right"
                    @change="patch(key, $event)" /></label
              ></template>
            </div>
          </template>
        </template>
      </aside>
    </div>
    <footer class="panel-status">
      <span>{{ t('selected') }} {{ selected.length }} / {{ document.controls.length }}</span
      ><span class="toolbar-fill"></span
      ><el-checkbox v-if="!preview" v-model="snap" size="small">{{ t('snap') }}</el-checkbox
      ><span>{{ t('zoom') }}</span
      ><el-select v-model="zoom" size="small" :aria-label="t('zoom')"
        ><el-option
          v-for="value in [0.5, 0.75, 1, 1.25, 1.5, 2]"
          :key="value"
          :label="`${value * 100}%`"
          :value="value"
      /></el-select>
    </footer>
    <el-dialog
      :model-value="!!bindingKind"
      :title="bindingKind ? t(bindingKind) : ''"
      width="min(800px, 90vw)"
      destroy-on-close
      :append-to="dialogTarget"
      @close="bindingKind = null"
    >
      <SignalPicker
        v-if="bindingKind === 'signal'"
        :height="400"
        :highlight-id="active?.binding?.node.id"
        @add-signal="bindSignal"
      />
      <VariablePicker
        v-if="bindingKind === 'variable'"
        :height="400"
        :highlight-id="active?.binding?.node.id"
        @add-variable="bindVariable"
      />
    </el-dialog>
  </section>
</template>
<script setup lang="ts">
import { progressValuePosition } from './progress'
import { ledShapes } from './led'
import { labelPositions, labelPosition, supportsLabelPosition } from './model'
import { computed, defineAsyncComponent, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { v4 } from 'uuid'
import type { GraphBindSignalValue, GraphBindVariableValue, GraphNode } from 'src/preload/data'
import type { PanelBinding, PanelControl, PanelControlType, PanelDocument } from 'src/preload/panel'
import {
  arrangeControls,
  boundControl,
  cloneDocument,
  controlTypes,
  createControl,
  duplicateControls,
  PanelHistory,
  type Arrangement
} from './model'
import {
  activePage,
  ancestors,
  containerHeader,
  groupControls,
  isContainer,
  isLocked,
  removeControls,
  reparentControl,
  sameScope,
  selectionRoots,
  resizeCanvas,
  ungroupControl,
  worldPosition
} from './model'
import { usePanelLocale } from './locale'
import PanelCanvas from './PanelCanvas.vue'
import SourceLibrary from './SourceLibrary.vue'
import { useDataStore } from '@r/stores/data'
import { getAllSysVar } from 'nodeCan/sysVar'
import { panelSources, applyBinding, acceptsBinding } from './sources'
import { commonProperties, patchControls } from './properties'
const workspace = ref<HTMLElement>()
const sidebarWidths = reactive({ left: 164, right: 242 })
let sidebarDrag:
  | { side: 'left' | 'right'; x: number; width: number; id: number; element: HTMLElement }
  | undefined
function resizeSidebar(side: 'left' | 'right', width: number) {
  const other = side === 'left' ? 'right' : 'left'
  const min = side === 'left' ? 132 : 200
  const max = Math.max(
    min,
    Math.min(560, (workspace.value?.clientWidth || 1000) - sidebarWidths[other] - 190)
  )
  sidebarWidths[side] = Math.round(Math.max(min, Math.min(max, width)))
}
function startSidebarResize(event: PointerEvent, side: 'left' | 'right') {
  if (event.button !== 0) return
  const element = event.currentTarget as HTMLElement
  sidebarDrag = { side, x: event.clientX, width: sidebarWidths[side], id: event.pointerId, element }
  element.setPointerCapture(event.pointerId)
}
function moveSidebarResize(event: PointerEvent) {
  if (!sidebarDrag || sidebarDrag.id !== event.pointerId) return
  resizeSidebar(
    sidebarDrag.side,
    sidebarDrag.width + (event.clientX - sidebarDrag.x) * (sidebarDrag.side === 'left' ? 1 : -1)
  )
}
function endSidebarResize() {
  const drag = sidebarDrag
  sidebarDrag = undefined
  if (drag?.element.hasPointerCapture(drag.id)) drag.element.releasePointerCapture(drag.id)
}
function cancelSidebarResize() {
  if (sidebarDrag) sidebarWidths[sidebarDrag.side] = sidebarDrag.width
  endSidebarResize()
}
onUnmounted(endSidebarResize)
const SignalPicker = defineAsyncComponent(() => import('../../components/signal.vue'))
const VariablePicker = defineAsyncComponent(() => import('../../components/addVar.vue'))
const props = defineProps<{
  initialDocument: PanelDocument
  initialName: string
  height: number
  dialogTarget?: string
}>()
const emit = defineEmits<{
  save: [name: string, document: PanelDocument]
  dirty: [value: boolean]
  saveAs: [name: string, document: PanelDocument]
}>()
const t = usePanelLocale()
const data = useDataStore()
const sources = computed(() =>
  panelSources(data.database, {
    ...data.vars,
    ...getAllSysVar(data.devices, data.tester, data.database.orti)
  })
)
const selectedControls = computed(() =>
  document.value.controls.filter((c) => selected.value.includes(c.id))
)
const sharedProperties = computed(() => commonProperties(selectedControls.value))
const labelPositionShared = computed(() => selectedControls.value.every(supportsLabelPosition))
const mixedLabelPosition = computed(
  () => new Set(selectedControls.value.map(labelPosition)).size > 1
)
const appearanceShared = computed(() => selectedControls.value.every((c) => c.type !== 'image'))
const document = ref(cloneDocument(props.initialDocument))
const name = ref(props.initialName)
const history = reactive(new PanelHistory(document.value))
const selected = ref<string[]>([])
const batchUnit = ref<string>()
watch(selected, () => {
  batchUnit.value = undefined
})
const active = computed(() => document.value.controls.find((c) => c.id === selected.value[0]))
const editableSelection = computed(() =>
  document.value.controls.filter(
    (c) => selected.value.includes(c.id) && !isLocked(document.value, c)
  )
)
const canArrange = computed(
  () => editableSelection.value.length > 1 && sameScope(editableSelection.value)
)
const pages = ref<Record<string, string>>({})
const activeParent = computed(() =>
  document.value.controls.find((c) => c.id === active.value?.parentId)
)
const parentOptions = computed(() =>
  document.value.controls.filter(
    (c) =>
      isContainer(c) &&
      c.id !== active.value?.id &&
      !isLocked(document.value, c) &&
      !ancestors(document.value, c).some((p) => p.id === active.value?.id)
  )
)
const layerControls = computed(() => {
  const walk = (parentId?: string): PanelControl[] =>
    document.value.controls
      .filter((c) => c.parentId === parentId)
      .reverse()
      .flatMap((c) => [c, ...walk(c.id)])
  return walk()
})
const tab = ref<'components' | 'layers' | 'sources'>('components')
const preview = ref(false)
const zoom = ref(1)
const snap = ref(true)
const previewValues = ref<Record<string, number | string | number[]>>({})
const bindingKind = ref<'signal' | 'variable' | null>(null)
const imageInput = ref<HTMLInputElement>()
const arrangements: Arrangement[] = ['left', 'top', 'width', 'height', 'horizontal', 'vertical']
const geometryKeys = ['x', 'y', 'width', 'height'] as const
const buttonActions = computed(() => {
  const actions: NonNullable<PanelControl['buttonAction']>[] = ['write', 'openFile', 'openPanel']
  if (active.value?.buttonAction === 'start' || active.value?.buttonAction === 'stop')
    actions.push('start', 'stop')
  return actions
})
const numericKeys = computed(() =>
  active.value && ['input', 'path'].includes(active.value.type)
    ? []
    : active.value && ['number', 'slider'].includes(active.value.type)
      ? (['min', 'max', 'step', 'initialValue'] as const)
      : active.value && ['progress', 'gauge', 'display'].includes(active.value.type)
        ? (['min', 'max', 'initialValue'] as const)
        : (['initialValue'] as const)
)
const symbols: Record<PanelControlType, string> = {
  text: 'T',
  display: '123',
  number: '±',
  input: 'Aa',
  path: '…',
  checkbox: '☑',
  radio: '⊙',
  button: '▭',
  startStop: '▶',
  switch: '◉',
  led: '●',
  slider: '⊶',
  select: '≡',
  progress: '▰',
  gauge: '◴',
  image: '▧',
  html: '</>',
  group: '▣',
  tabs: '▤'
}
watch(
  [document, name],
  () =>
    emit(
      'dirty',
      JSON.stringify(document.value) !== JSON.stringify(props.initialDocument) ||
        name.value !== props.initialName
    ),
  { deep: true }
)
function commit(value: PanelDocument) {
  document.value = value
  history.record(value)
}
function mutate(action: (value: PanelDocument) => void, record = true) {
  const value = cloneDocument(document.value)
  action(value)
  if (record) commit(value)
  else document.value = value
}
function selectControls(ids: string[]) {
  selected.value = selectionRoots(document.value, ids)
}
function selectLayer(control: PanelControl, append = false) {
  let child = control
  for (const parent of ancestors(document.value, control)) {
    if (parent.type === 'tabs' && child.tabId) pages.value[parent.id] = child.tabId
    child = parent
  }
  selectControls(append ? [...new Set([...selected.value, control.id])] : [control.id])
}
function switchPage(id: string, page: string) {
  pages.value[id] = page
  if (!preview.value) selectControls([id])
}
function changeParent(parentId: string, page?: string) {
  if (!active.value) return
  if (parentId === '__canvas__') parentId = ''
  const id = active.value.id
  const parent = document.value.controls.find((c) => c.id === parentId)
  const tab = page || (parent?.type === 'tabs' ? activePage(parent, pages.value) : undefined)
  mutate((doc) => {
    if (!reparentControl(doc, id, parentId || undefined, tab))
      ElMessage.error(t('containerTooSmall'))
  })
  if (parent && tab) pages.value[parent.id] = tab
}
function groupSelected() {
  if (!canArrange.value) return
  mutate((doc) => {
    const id = groupControls(doc, selected.value, v4(), t('group'))
    if (id) selected.value = [id]
  })
}
function ungroup() {
  if (!active.value) return
  const id = active.value.id
  mutate((doc) => {
    selected.value = ungroupControl(doc, id)
  })
}
function addPage() {
  if (!active.value?.tabs || isLocked(document.value, active.value)) return
  const id = v4()
  patch('tabs', [...active.value.tabs, { id, label: String(active.value.tabs.length + 1) }])
  pages.value[active.value.id] = id
}
function renamePage(id: string, label: string, record = true) {
  if (!active.value?.tabs) return
  patch(
    'tabs',
    active.value.tabs.map((tab) => (tab.id === id ? { ...tab, label } : tab)),
    false,
    record
  )
}
function removePage(id: string) {
  const control = active.value
  if (
    !control?.tabs ||
    control.tabs.length < 2 ||
    isLocked(document.value, control) ||
    document.value.controls.some((c) => c.parentId === control.id && c.tabId === id)
  )
    return
  mutate((doc) => {
    const target = doc.controls.find((c) => c.id === control.id)!
    target.tabs = target.tabs!.filter((tab) => tab.id !== id)
    if (target.defaultTabId === id) target.defaultTabId = target.tabs[0].id
  })
  if (pages.value[control.id] === id) delete pages.value[control.id]
}
function importImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const id = active.value?.id
  input.value = ''
  if (!file || !id || !active.value || isLocked(document.value, active.value)) return
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
    ElMessage.error(t('imageFailed'))
    return
  }
  const reader = new FileReader()
  reader.onerror = () => ElMessage.error(t('imageFailed'))
  reader.onload = () => {
    const source = reader.result
    if (typeof source !== 'string') return
    if (!document.value.controls.some((c) => c.id === id && !isLocked(document.value, c))) return
    mutate((doc) => {
      doc.controls.find((c) => c.id === id)!.imageSrc = source
    })
  }
  reader.readAsDataURL(file)
}
function add(
  type: PanelControlType,
  x = 32 + (document.value.controls.length % 10) * 16,
  y = x,
  parentId?: string | null,
  binding?: PanelBinding
) {
  if (active.value && isLocked(document.value, active.value) && parentId === undefined) return
  const control = createControl(type, v4(), binding?.node.name || t(type), x, y)
  if (binding) applyBinding(control, binding)
  const parent =
    parentId === null
      ? undefined
      : parentId
        ? document.value.controls.find((c) => c.id === parentId)
        : active.value && isContainer(active.value)
          ? active.value
          : activeParent.value
  if (parent && !isLocked(document.value, parent)) {
    control.parentId = parent.id
    control.tabId = parent.type === 'tabs' ? activePage(parent, pages.value) : undefined
    if (parentId === undefined) {
      control.x = 8
      control.y = 8
    }
  }
  boundControl(control, document.value)
  mutate((value) => value.controls.push(control))
  selected.value = [control.id]
}
function addSource(key: string) {
  const source = sources.value.find((item) => item.key === key)
  if (source) add('display', undefined, undefined, undefined, source.binding)
}
function commitBatchUnit(value: string) {
  patch('unit', value)
  batchUnit.value = undefined
}
function drop(event: DragEvent) {
  if (preview.value) return
  const type = event.dataTransfer?.getData('application/ecubus-control') as PanelControlType
  const source = sources.value.find(
    (item) => item.key === event.dataTransfer?.getData('application/ecubus-panel-source')
  )
  if (!source && !controlTypes.includes(type)) return
  const stage = (event.currentTarget as HTMLElement)
    .querySelector('.panel-stage')!
    .getBoundingClientRect()
  const targetId = (event.target as HTMLElement).closest<HTMLElement>('[data-control-id]')?.dataset
    .controlId
  const target = document.value.controls.find((c) => c.id === targetId)
  if (source && target && !['text', 'image', 'html', 'group', 'tabs'].includes(target.type)) {
    if (isLocked(document.value, target)) return
    if (!acceptsBinding(target, source.binding)) {
      ElMessage.error(t('bindingType'))
      return
    }
    mutate((doc) => {
      applyBinding(doc.controls.find((c) => c.id === target.id)!, source.binding)
    })
    selected.value = [target.id]
    return
  }
  const parent =
    target && isContainer(target)
      ? target
      : document.value.controls.find((c) => c.id === target?.parentId)
  if (parent && isLocked(document.value, parent)) return
  const origin = parent ? worldPosition(document.value, parent) : { x: 0, y: -containerHeader }
  add(
    source ? 'display' : type,
    Math.round((event.clientX - stage.left) / zoom.value - origin.x),
    Math.round((event.clientY - stage.top) / zoom.value - origin.y - containerHeader),
    parent?.id || null,
    source?.binding
  )
}
function patch<K extends keyof PanelControl>(
  key: K,
  value: PanelControl[K] | undefined,
  includeLocked = false,
  record = true
) {
  if (value === undefined && key !== 'binding') return
  mutate(
    (doc) => patchControls(doc, selected.value, key, value as PanelControl[K], includeLocked),
    record
  )
}
function mixed(key: keyof PanelControl) {
  return document.value.controls
    .filter((c) => selected.value.includes(c.id))
    .some((c) => c[key] !== active.value?.[key])
}
function resizeDocument(axis: 'width' | 'height', value?: number) {
  if (value != null)
    mutate((doc) => {
      resizeCanvas(
        doc,
        axis === 'width' ? value : doc.width,
        axis === 'height' ? value : doc.height
      )
    })
}
function duplicate() {
  mutate((doc) => {
    selected.value = duplicateControls(doc, selected.value, v4)
  })
}
function remove() {
  mutate((doc) => removeControls(doc, selected.value))
  selected.value = selected.value.filter((id) => document.value.controls.some((c) => c.id === id))
}
function arrange(mode: Arrangement) {
  mutate((doc) => arrangeControls(doc, selected.value, mode))
}
function reorder(front: boolean) {
  mutate((doc) => {
    const moving = doc.controls.filter(
      (c) => selected.value.includes(c.id) && !isLocked(document.value, c)
    )
    const rest = doc.controls.filter((c) => !moving.includes(c))
    doc.controls = front ? [...rest, ...moving] : [...moving, ...rest]
  })
}
function restore(direction: 'undo' | 'redo') {
  document.value = history[direction]()
  selected.value = selected.value.filter((id) => document.value.controls.some((c) => c.id === id))
  if (selected.value.length) {
    const ids = [...selected.value]
    selectLayer(document.value.controls.find((c) => c.id === ids[0])!)
    selectControls(ids)
  }
}
function togglePreview() {
  previewValues.value = {}
  pages.value = {}
  preview.value = !preview.value
}
function optionPatch(
  index: number,
  key: 'label' | 'value',
  value: string | number | undefined,
  record = true
) {
  if (!active.value || value == null) return
  const options = active.value.options.map((option, i) =>
    i === index ? { ...option, [key]: value } : option
  )
  patch('options', options, false, record)
}
function changeProgressPosition(position: PanelControl['progressValuePosition']) {
  mutate((doc) => {
    const control = doc.controls.find((c) => c.id === active.value?.id)
    if (!control || isLocked(doc, control)) return
    control.progressValuePosition = position
    if (control.progressText === 'hidden') control.progressText = 'value'
  })
}
function changeAction(action: PanelControl['buttonAction']) {
  mutate((doc) => {
    const control = doc.controls.find((c) => c.id === active.value?.id)
    if (!control || isLocked(doc, control)) return
    control.buttonAction = action
    if (action !== 'write') control.binding = undefined
  })
}
async function chooseActionFile() {
  const id = active.value?.id
  if (!id) return
  try {
    const result = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths?.[0]) return
    mutate((doc) => {
      const control = doc.controls.find((c) => c.id === id)
      if (control && !isLocked(doc, control) && control.buttonAction === 'openFile')
        control.actionPath = result.filePaths[0]
    })
  } catch {
    ElMessage.error(t('actionFailed'))
  }
}
function bind(binding?: PanelBinding) {
  if (!active.value || isLocked(document.value, active.value)) return
  mutate((doc) => {
    const c = doc.controls.find((c) => c.id === active.value!.id)!
    if (binding && !acceptsBinding(c, binding)) {
      ElMessage.error(t('bindingType'))
      return
    }
    if (binding) applyBinding(c, binding)
    else c.binding = undefined
  })
  bindingKind.value = null
}
function bindSignal(node: GraphNode<GraphBindSignalValue> | null) {
  bind(node ? { kind: 'signal', node } : undefined)
}
function bindVariable(node: GraphNode<GraphBindVariableValue> | null) {
  if (!bindingKind.value) return
  bind(node ? { kind: 'variable', node } : undefined)
}
function keyboard(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  const command = event.ctrlKey || event.metaKey
  if (command && event.key.toLowerCase() === 's' && !bindingKind.value) {
    event.preventDefault()
    event.stopPropagation()
    target.blur()
    void nextTick(() => emit('save', name.value.trim(), cloneDocument(document.value)))
    return
  }
  if (
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="slider"], [role="combobox"]'
    ) ||
    preview.value ||
    bindingKind.value
  )
    return
  if (command && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    restore(event.shiftKey ? 'redo' : 'undo')
  } else if (command && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    restore('redo')
  } else if (command && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    const scope = active.value
    selected.value = document.value.controls
      .filter((c) => c.parentId === scope?.parentId && c.tabId === scope?.tabId)
      .map((c) => c.id)
  } else if (command && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    duplicate()
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    remove()
  } else if (event.key === 'Escape') selected.value = []
  else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault()
    const delta = event.shiftKey ? 8 : 1
    mutate((doc) =>
      doc.controls
        .filter((c) => selected.value.includes(c.id) && !isLocked(document.value, c))
        .forEach((c) => {
          c.x += event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0
          c.y += event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0
          boundControl(c, doc)
        })
    )
  }
}
</script>
<style scoped>
.panel-splitter {
  cursor: col-resize;
  touch-action: none;
  background: var(--el-border-color-lighter);
}
.panel-splitter:hover,
.panel-splitter:focus-visible {
  background: var(--el-color-primary);
  outline: none;
}

.free-panel-editor {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-family: var(--el-font-family);
  font-size: 12px;
  outline: none;
}
.panel-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--el-border-color);
}
.panel-toolbar > * {
  flex-shrink: 0;
}
.panel-toolbar .el-button + .el-button,
.property-actions .el-button + .el-button {
  margin-left: 0;
}
.toolbar-fill {
  flex: 1;
}
.panel-workspace {
  display: grid;
  grid-template-columns: 164px 5px minmax(180px, 1fr) 5px 242px;
  flex: 1;
  min-height: 0;
}
.panel-workspace.preview {
  grid-template-columns: minmax(0, 1fr);
}
.panel-library {
  overflow: auto;
  border-right: 1px solid var(--el-border-color);
}
.panel-tabs {
  display: flex;
  height: 34px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.panel-tabs button {
  flex: 1;
  border-bottom: 2px solid transparent;
  text-align: center;
}
button:not(.el-button) {
  font: inherit;
  color: inherit;
  border: 0;
  background: transparent;
  cursor: pointer;
}
button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}
.panel-tabs button.active {
  color: var(--el-color-primary);
  border-bottom-color: var(--el-color-primary);
}
.panel-palette {
  padding: 8px;
  display: grid;
  gap: 4px;
}
.panel-palette button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 8px;
  text-align: left;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 3px;
}
.panel-palette button:hover {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
}
.palette-symbol {
  font:
    14px Consolas,
    monospace;
  width: 24px;
  text-align: center;
  color: var(--el-color-primary);
}
.panel-layers button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  text-align: left;
  padding: 9px 12px;
}
.panel-layers button.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.panel-center {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}
.panel-canvas-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  height: 34px;
  padding: 0 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-secondary);
}
.panel-canvas-heading span:last-child {
  font-family: Consolas, monospace;
  font-size: 11px;
}
.panel-inspector {
  overflow: auto;
  border-left: 1px solid var(--el-border-color);
}
.panel-inspector h3 {
  margin: 0;
  height: 34px;
  box-sizing: border-box;
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 500;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  justify-content: space-between;
}
.panel-property-section {
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.panel-property-section h4 {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}
.property-note {
  margin: -4px 0 8px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 16px;
}
.html-properties label {
  display: block;
}
.html-properties label > .el-input {
  display: block;
  width: 100%;
  margin-top: 4px;
}
.panel-property-section label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 30px;
  margin-bottom: 4px;
}
.panel-property-section label > .el-input,
.panel-property-section label > .el-input-number {
  width: 130px;
  flex-shrink: 0;
}
.panel-property-section label > .el-input-number :deep(input) {
  font-family: Consolas, monospace;
}
.property-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 0;
}
.binding-name {
  overflow-wrap: anywhere;
  font:
    11px Consolas,
    monospace;
  margin-bottom: 6px;
  color: var(--el-text-color-secondary);
}
.mixed {
  color: var(--el-text-color-secondary);
  font-size: 10px;
}
.enum-row {
  display: flex;
  gap: 3px;
  margin-bottom: 4px;
}
.enum-row .el-input-number {
  width: 64px;
  flex-shrink: 0;
}
.panel-status {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 30px;
  flex-shrink: 0;
  padding: 0 10px;
  border-top: 1px solid var(--el-border-color);
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
.panel-status .el-select {
  width: 82px;
}
@media (max-width: 900px) {
  .panel-property-section {
    padding: 8px;
  }
}
</style>
