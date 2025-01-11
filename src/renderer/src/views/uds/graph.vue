<template>
    <div>
        <div
            style="justify-content: flex-start;display: flex;align-items: center;gap:4px;margin-left: 5px;padding:4px 2px;">
            <el-tooltip effect="light" :content="isPaused ? 'Resume' : 'Pause'" placement="bottom" :show-after="1000">
                <el-button :type="isPaused ? 'success' : 'warning'" link :class="{ 'pause-active': isPaused }">
                    <Icon :icon="isPaused ? playIcon : pauseIcon" />
                </el-button>
            </el-tooltip>

        </div>
    </div>
</template>
<script lang="ts" setup>
import pauseIcon from '@iconify/icons-material-symbols/pause-circle-outline'
import playIcon from '@iconify/icons-material-symbols/play-circle-outline'
import { ref } from 'vue';
import { Icon } from '@iconify/vue'
const isPaused = ref(false);

</script>
<style scoped>
.pause-active {
    box-shadow: inset 0 0 4px var(--el-color-info-light-5);
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.05);
}
</style>