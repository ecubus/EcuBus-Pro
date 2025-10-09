/**
 * Dashboard Micro App
 * Demonstrates more complex micro-app with reactive data and Element Plus components
 */

import { createApp, h, ref, onMounted, onUnmounted } from 'vue'
import { 
  ElCard, 
  ElRow, 
  ElCol, 
  ElStatistic, 
  ElButton,
  ElMessage 
} from 'element-plus'

let app = null
let timer = null

export async function bootstrap(props) {
  console.log('[Dashboard] Bootstrap', props)
}

export async function mount(props) {
  console.log('[Dashboard] Mount', props)
  
  const DashboardApp = {
    name: 'DashboardApp',
    setup() {
      const cpuUsage = ref(0)
      const memoryUsage = ref(0)
      const activeUsers = ref(0)
      const requests = ref(0)
      
      // Simulate data updates
      const updateData = () => {
        cpuUsage.value = Math.floor(Math.random() * 100)
        memoryUsage.value = Math.floor(Math.random() * 100)
        activeUsers.value = Math.floor(Math.random() * 1000)
        requests.value = Math.floor(Math.random() * 10000)
      }
      
      const refresh = () => {
        updateData()
        ElMessage.success('Dashboard refreshed!')
      }
      
      onMounted(() => {
        updateData()
        // Auto refresh
        const interval = props.refreshInterval || 5000
        timer = setInterval(updateData, interval)
      })
      
      onUnmounted(() => {
        if (timer) {
          clearInterval(timer)
          timer = null
        }
      })
      
      return () => h('div', {
        class: 'dashboard-app',
        style: {
          padding: '20px',
          height: '100%',
          overflow: 'auto'
        }
      }, [
        h('div', {
          style: {
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }
        }, [
          h('h1', { 
            style: { margin: 0 } 
          }, 'System Dashboard'),
          h(ElButton, {
            type: 'primary',
            onClick: refresh
          }, () => 'Refresh')
        ]),
        
        h(ElRow, { gutter: 20 }, {
          default: () => [
            h(ElCol, { span: 6 }, {
              default: () => h(ElCard, null, {
                default: () => h(ElStatistic, {
                  title: 'CPU Usage',
                  value: cpuUsage.value,
                  suffix: '%',
                  valueStyle: {
                    color: cpuUsage.value > 80 ? '#F56C6C' : '#67C23A'
                  }
                })
              })
            }),
            
            h(ElCol, { span: 6 }, {
              default: () => h(ElCard, null, {
                default: () => h(ElStatistic, {
                  title: 'Memory Usage',
                  value: memoryUsage.value,
                  suffix: '%',
                  valueStyle: {
                    color: memoryUsage.value > 80 ? '#F56C6C' : '#67C23A'
                  }
                })
              })
            }),
            
            h(ElCol, { span: 6 }, {
              default: () => h(ElCard, null, {
                default: () => h(ElStatistic, {
                  title: 'Active Users',
                  value: activeUsers.value,
                  valueStyle: {
                    color: '#409EFF'
                  }
                })
              })
            }),
            
            h(ElCol, { span: 6 }, {
              default: () => h(ElCard, null, {
                default: () => h(ElStatistic, {
                  title: 'Requests/min',
                  value: requests.value,
                  valueStyle: {
                    color: '#E6A23C'
                  }
                })
              })
            })
          ]
        }),
        
        h('div', {
          style: {
            marginTop: '20px',
            padding: '20px',
            background: '#f5f7fa',
            borderRadius: '4px'
          }
        }, [
          h('p', {
            style: {
              margin: 0,
              color: '#606266',
              fontSize: '14px'
            }
          }, '📊 This dashboard demonstrates real-time data updates in a micro-app'),
          h('p', {
            style: {
              margin: '10px 0 0 0',
              color: '#909399',
              fontSize: '12px'
            }
          }, `Auto-refresh interval: ${(props.refreshInterval || 5000) / 1000}s`)
        ])
      ])
    }
  }
  
  app = createApp(DashboardApp)
  
  // Mount to the container provided by single-spa
  const container = props.domElement || 
                   document.getElementById(`micro-app-${props.name}`) ||
                   document.getElementById('app')
  
  if (container) {
    app.mount(container)
  } else {
    console.error('[Dashboard] No container found for mounting')
  }
}

export async function unmount(props) {
  console.log('[Dashboard] Unmount', props)
  
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  
  if (app) {
    app.unmount()
    app = null
  }
}

export async function update(props) {
  console.log('[Dashboard] Update', props)
}

