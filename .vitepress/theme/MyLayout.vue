<!--.vitepress/theme/MyLayout.vue-->
<script setup>
import { useData, useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { onMounted, computed } from 'vue'
import { version } from '../../package.json'
const { Layout } = DefaultTheme
const { lang } = useData() // 获取当前语言，比如 'en-US' 或 'zh-CN'
const route = useRoute()

function getVerion() {
  const actionElements = document.querySelectorAll('.action')

  // Iterate over each 'action' element
  actionElements.forEach((actionElement) => {
    // Find all <a> elements within the current 'action' element
    const anchorElements = actionElement.querySelectorAll('a')

    // Modify the content of each <a> element
    anchorElements.forEach((anchor) => {
      if (anchor.textContent == 'Download') {
        anchor.textContent = `Download ${version}`
        //修改src
        anchor.href = `https://ecubus.oss-cn-chengdu.aliyuncs.com/app/EcuBus-Pro%20${data.version}.exe`
      }
    })
  })
}

onMounted(() => {
  getVerion()
})
</script>

<template>
  <Layout>
    <!-- <template #home-hero-actions-after>
      <p style="margin-top: 20px;">
        ECUBus-Pro 是一款创新的<strong>汽车电子系统仿真和测试软件</strong>，为 ECU
        开发、测试和诊断提供全面解决方案。我们的软件以<strong>卓越的性价比</strong>、<strong>灵活的定制选项</strong>和<strong>用户友好的界面</strong>著称，适用于各类规模的汽车电子开发团队。ECUBus-Pro
        支持多种汽车通信协议，提供<strong>强大的实时硬件在环（HIL）仿真</strong>能力，并集成了<strong>先进的诊断工具和数据分析功能</strong>。选择 ECUBus-Pro，体验高效、经济且灵活的
        ECU 开发环境，加速您的汽车电子项目进程。
      </p>
    </template> -->
    <template #home-features-before>
      <div class="container">
        <div class="item">
          <h2>发送和接收消息</h2>
          <div class="description">
            <p>支持手动发送、快捷键发送和循环发送。</p>
          </div>
          <img
            src="https://ecubus.oss-cn-chengdu.aliyuncs.com/main/main1.png"
            alt="发送和接收消息界面"
            class="featureImg"
          />
        </div>
        <div class="item">
          <h2>UDS 诊断</h2>
          <div class="description">
            <p>全面支持 UDS 服务，将多个服务整合为简化的序列，并具有强大的 TS 脚本功能。</p>
          </div>
          <img
            src="https://ecubus.oss-cn-chengdu.aliyuncs.com/main/main2.png"
            alt="加载数据库界面"
            class="featureImg"
          />
        </div>
      </div>
    </template>
    <!-- <template #doc-after>
      <span>test</span>
    </template> -->
  </Layout>
</template>
<style scoped>
.container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 10px 50px;
  max-width: 1800px;
  margin: 0 auto;
}

.item {
  flex: 1 1 calc(50% - 10px);
  min-width: 300px;
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow:
    0 6px 12px rgba(0, 0, 0, 0.15),
    0 3px 6px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease-in-out;
}

.item:hover {
  box-shadow:
    0 12px 24px rgba(0, 0, 0, 0.2),
    0 6px 12px rgba(0, 0, 0, 0.15);
}

h1 {
  color: #333;
  text-align: center;
}

h2 {
  /* color:var(--vp-home-hero-name-color); */
  font-weight: bold;
  font-size: 20px;
  margin-top: 0;
}

.description {
  position: relative;

  height: 4.5em;
  /* 约3行文字的高度 */
  display: flex;
  align-items: center;
  overflow: hidden;
}

p {
  color: #666;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  line-clamp: 3;
  -webkit-box-orient: vertical;
}

img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin-top: 10px;
  cursor: pointer;
}

@media (max-width: 900px) {
  .item {
    flex: 1 1 100%;
  }
}
</style>
