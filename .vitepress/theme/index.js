import DefaultTheme from 'vitepress/theme'
import './custom.css'

import MyLayout from './MyLayout.vue'
import ProductCarousel from './components/ProductCarousel.vue'
import PurchaseLinks from './components/PurchaseLinks.vue'
import LinCableProductPage from './components/LinCableProductPage.vue'

export default {
  extends: DefaultTheme,
  // override the Layout with a wrapper component that
  // injects the slots
  Layout: MyLayout,
  enhanceApp({ app }) {
    // register global components
    app.component('ProductCarousel', ProductCarousel)
    app.component('PurchaseLinks', PurchaseLinks)
    app.component('LinCableProductPage', LinCableProductPage)
  }
}
