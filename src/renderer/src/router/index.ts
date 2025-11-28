import { createRouter, createMemoryHistory, RouteRecordRaw } from 'vue-router'
import HomeView from '@r/views/home/home.vue'
import UdsView from '@r/views/uds/uds.vue'
import { layoutMap } from '@r/views/uds/layout'

// Create routes for components with allowExt
const extRoutes = Object.entries(layoutMap)
  .filter(([_, layout]) => layout.allowExt)
  .map(([key]) => ({
    path: `/${key}`,
    name: layoutMap[key].i,
    component: layoutMap[key].component,
    props: true
  }))

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/uds',
    name: 'uds',
    component: UdsView
  },
  ...extRoutes
]

const router = createRouter({
  history: createMemoryHistory(),
  routes: routes
})

export default router
