<template>
  <a :href="link">国内CDN</a>
</template>
<script setup lang="ts">
import { version } from '../../package.json'
import { ref } from 'vue'

const link = ref(`https://ecubus.oss-cn-chengdu.aliyuncs.com/app/EcuBus-Pro%20${version}.exe`)
</script>
