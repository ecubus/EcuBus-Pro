---
layout: false
---

<script setup>
import PluginMarketplace from '../../component/PluginMarketplace.vue'
import { ref, onMounted, onUnmounted } from 'vue'

const containerHeight = ref(800)

function updateHeight() {
  containerHeight.value = window.innerHeight
}

onMounted(() => {
  updateHeight()
  window.addEventListener('resize', updateHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateHeight)
})
</script>

<PluginMarketplace :height="containerHeight" />

<style>

</style>