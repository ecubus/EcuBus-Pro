<template>
  <div class="container">
    <pre>{{ license }}</pre>
  </div>
</template>
<script setup lang="ts">
import license from './../../../../../license.txt?raw'
</script>
<style scoped>
.container {
  text-align: left;
  overflow-y: auto;
  height: 100%;
  background-color: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  padding: 30px;
  border-radius: 5px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

h1 {
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  padding-bottom: 10px;
}

h2 {
  color: #2980b9;
  margin-top: 30px;
}

ul {
  padding-left: 20px;
}

li {
  margin-bottom: 10px;
}

.cta {
  background-color: #3498db;
  color: white;
  padding: 10px 20px;
  text-decoration: none;
  display: inline-block;
  border-radius: 5px;
  margin-top: 20px;
  transition: background-color 0.3s;
}

.cta:hover {
  background-color: #2980b9;
}
</style>
