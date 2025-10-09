/**
 * Simple Hello World Micro App
 * Demonstrates basic single-spa lifecycle with Vue and Element Plus
 */

import { createApp, h, ref } from 'vue'
import { ElCard, ElButton, ElMessage } from 'element-plus'

let app = null

export async function bootstrap(props) {
  console.log('[Hello World] Bootstrap', props)
}

export async function mount(props) {
  console.log('[Hello World] Mount', props)
  
  const HelloWorldApp = {
    name: 'HelloWorldApp',
    setup() {
      const count = ref(0)
      const title = props.title || 'Hello World'
      
      const increment = () => {
        count.value++
        ElMessage.success(`Count: ${count.value}`)
      }
      
      return () => h('div', { 
        class: 'hello-world-app',
        style: {
          padding: '20px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      }, [
        h(ElCard, {
          style: {
            minWidth: '400px'
          }
        }, {
          default: () => [
            h('h1', { 
              style: { 
                textAlign: 'center',
                marginBottom: '20px' 
              } 
            }, title),
            h('p', { 
              style: { 
                textAlign: 'center',
                fontSize: '16px',
                color: '#666',
                marginBottom: '20px'
              } 
            }, `This is a micro-app loaded dynamically!`),
            h('div', {
              style: {
                textAlign: 'center',
                marginBottom: '20px',
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#409EFF'
              }
            }, `Count: ${count.value}`),
            h('div', {
              style: {
                textAlign: 'center'
              }
            }, [
              h(ElButton, {
                type: 'primary',
                size: 'large',
                onClick: increment
              }, () => 'Click Me!')
            ])
          ]
        })
      ])
    }
  }
  
  app = createApp(HelloWorldApp)
  
  // Mount to the container provided by single-spa
  const container = props.domElement || 
                   document.getElementById(`micro-app-${props.name}`) ||
                   document.getElementById('app')
  
  if (container) {
    app.mount(container)
  } else {
    console.error('[Hello World] No container found for mounting')
  }
}

export async function unmount(props) {
  console.log('[Hello World] Unmount', props)
  
  if (app) {
    app.unmount()
    app = null
  }
}

export async function update(props) {
  console.log('[Hello World] Update', props)
}

