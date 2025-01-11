<template>
    <div>
        <div style="justify-content: flex-start;display: flex;align-items: center;gap:4px;padding-left: 5px;padding: 1px" class="border-bottom">
            <el-button-group>


                <el-button link type="primary" :class="{ 'pause-active': hideTree }" @click="treeHide">
                    <Icon :icon="hideIcon" />
                </el-button>
            </el-button-group>
            <el-tooltip effect="light" :content="isPaused ? 'Resume' : 'Pause'" placement="bottom" :show-after="1000">
                <el-button :type="isPaused ? 'success' : 'warning'" link :class="{ 'pause-active': isPaused }" >
                    <Icon :icon="isPaused ? playIcon : pauseIcon" />
                </el-button>

            </el-tooltip>
        </div>
        <div>
            <div class="main">
                <div class="left">
                    <el-scrollbar :height="height">
                        <el-tree
                            :data="treeData"
                            :props="defaultProps"
                            @node-click="handleNodeClick"
                            default-expand-all
                        />
                    </el-scrollbar>
                </div>
                <div class="shift" id="graphShift" />
                <div class="right">
                    Right Panel Content
                </div>
            </div>
        </div>
    </div>
</template>
<script lang="ts" setup>
import pauseIcon from '@iconify/icons-material-symbols/pause-circle-outline'
import playIcon from '@iconify/icons-material-symbols/play-circle-outline'
import hideIcon from '@iconify/icons-material-symbols/hide'
import { ref, onMounted, computed } from 'vue';
import { Icon } from '@iconify/vue'

const isPaused = ref(false);
const hideTree = ref(false);
const leftWidth = ref(300)
const props=defineProps<{
    height: number
    width: number
}>()

const height = computed(() => props.height-22)
const treeData = ref([
    {
        label: 'Node 1',
        children: [{
            label: 'Child 1'
        }]
    }
])

const defaultProps = {
    children: 'children',
    label: 'label'
}

const handleNodeClick = (data: any) => {
    console.log(data)
}

function treeHide() {
    hideTree.value = !hideTree.value;
}

onMounted(() => {
    window.jQuery('#graphShift').resizable({
        handles: 'e',
        resize: (e, ui) => {
            leftWidth.value = ui.size.width
        },
        maxWidth: 400,
        minWidth: 200,
    })
})
</script>
<style scoped>
.pause-active {
    box-shadow: inset 0 0 4px var(--el-color-info-light-5);
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.05);
}

.main {
    position: relative;
    height: 100%;
    width: 100%;
}

.left {
    position: absolute;
    top: 0px;
    left: 0px;
    width: v-bind(leftWidth + 'px');
    z-index: 2;  /* changed from 1 to 2 */
    height: v-bind(height + 'px');
    overflow: hidden;
}

.shift {
    position: absolute;
    top: 0px;
    left: 0px;
    width: v-bind(leftWidth + 1 + 'px');
    height: v-bind(height + 'px');
    z-index: 1;  /* changed from 0 to 3 */
    border-right: solid 1px var(--el-border-color);
}

.shift:hover {
    border-right: solid 4px var(--el-color-primary);
    cursor: col-resize;
}

.shift:active {
    border-right: solid 4px var(--el-color-primary);
}

.right {
    position: absolute;
    left: v-bind(leftWidth + 5 + 'px');
    right: 0;
    height: v-bind(height + 'px');
    z-index: 1;  /* changed from 0 to 1 */
    overflow: auto;
}
.border-bottom{
    border-bottom: solid 1px var(--el-border-color);
    background-color: var(--el-background-color);
}
</style>