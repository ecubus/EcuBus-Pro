<template>
  <div class="lincable-product-page">
    <!-- Carousel at the very top -->
    <ProductCarousel :images="carouselImages" :autoplay="true" :interval="4000" />

    <!-- Hero Section -->
    <section class="product-hero">
      <div class="product-intro">
        <h1 class="product-title">LinCable</h1>
        <p class="product-tagline">
          Professional USB to LIN Interface with Advanced Fault Injection Capabilities
        </p>
        <div class="product-highlights">
          <div class="highlight" v-for="(item, idx) in highlights" :key="idx">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ item }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Product Overview -->
    <section class="section">
      <h2>Product Overview</h2>
      <p>
        LinCable is our most affordable yet powerful LIN hardware device, designed specifically for
        automotive engineers and developers who need reliable USB to LIN connectivity with advanced
        testing capabilities. Built with precision engineering and robust components, LinCable
        delivers exceptional performance for LIN protocol development, testing, and debugging.
      </p>
      <h3>Key Features</h3>
      <ul class="feature-list">
        <li v-for="(feature, idx) in features" :key="idx">
          <b>{{ feature.title }}</b
          >: {{ feature.desc }}
        </li>
      </ul>
    </section>

    <!-- Technical Specifications -->
    <section class="section">
      <h2>Technical Specifications</h2>
      <h3>Hardware Specifications</h3>
      <div class="spec-table-wrapper">
        <table class="spec-table">
          <tbody>
            <tr v-for="(row, idx) in hardwareSpecs" :key="idx">
              <th>{{ row[0] }}</th>
              <td>{{ row[1] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3>Software Compatibility</h3>
      <ul>
        <li v-for="(item, idx) in softwareCompat" :key="idx">{{ item }}</li>
      </ul>
    </section>

    <!-- Applications -->
    <section class="section">
      <h2>Applications</h2>
      <div class="applications-grid">
        <div class="application-item" v-for="(app, idx) in applications" :key="idx">
          <h4>{{ app.title }}</h4>
          <ul>
            <li v-for="(item, i) in app.items" :key="i">{{ item }}</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Why Choose LinCable -->
    <section class="section">
      <h2>Why Choose LinCable?</h2>
      <ul class="feature-list">
        <li v-for="(reason, idx) in reasons" :key="idx">
          <b>{{ reason.title }}</b
          >: {{ reason.desc }}
        </li>
      </ul>
    </section>

    <!-- Package Contents -->
    <section class="section package-contents">
      <h2>Package Contents</h2>
      <ul>
        <li v-for="(item, idx) in packageContents" :key="idx">{{ item }}</li>
      </ul>
    </section>

    <!-- Support & Documentation -->
    <section class="section support-section">
      <h2>Support & Documentation</h2>
      <div class="support-grid">
        <div class="support-item" v-for="(support, idx) in supportInfo" :key="idx">
          <h4>{{ support.title }}</h4>
          <ul>
            <li v-for="(item, i) in support.items" :key="i">{{ item }}</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Purchase Links -->
    <section class="section">
      <h2>Purchase LinCable</h2>
      <PurchaseLinks />
    </section>

    <!-- Related Products -->
    <section class="section related-products">
      <h2>Related Products</h2>
      <ul>
        <li v-for="(prod, idx) in relatedProducts" :key="idx">
          <a :href="prod.link">{{ prod.name }}</a
          >: {{ prod.desc }}
        </li>
      </ul>
    </section>

    <footer class="product-footer">
      LinCable is part of the EcuBus Hardware family, designed and manufactured to the highest
      quality standards for automotive professionals worldwide.
    </footer>
  </div>
</template>

<script setup>
const carouselImages = [
  { src: 'placeholder', alt: 'LinCable Front View' },
  { src: 'placeholder', alt: 'LinCable Side View' },
  { src: 'placeholder', alt: 'LinCable Back View' },
  { src: 'placeholder', alt: 'LinCable Connector Detail' },
  { src: 'placeholder', alt: 'LinCable Package Contents' }
]

const highlights = [
  'USB 2.0 High-Speed Interface',
  'Advanced Fault Injection',
  'LIN Conformance Testing'
]

const features = [
  {
    title: 'High-Speed USB 2.0 Interface',
    desc: 'Ensures fast and reliable communication with your development environment'
  },
  {
    title: 'Advanced Fault Injection',
    desc: 'Built-in capabilities for LIN conformance testing and fault simulation'
  },
  {
    title: 'Robust Construction',
    desc: 'Industrial-grade components for reliable operation in demanding environments'
  },
  { title: 'Plug-and-Play', desc: 'No external power supply required, powered directly via USB' },
  { title: 'Cross-Platform Support', desc: 'Compatible with Windows, macOS, and Linux' },
  {
    title: 'Seamless EcuBus-Pro Integration',
    desc: 'Optimized for use with our flagship software platform'
  }
]

const hardwareSpecs = [
  ['Interface', 'USB 2.0 High-Speed'],
  ['LIN Protocol', 'LIN 2.0, LIN 2.1, LIN 2.2A'],
  ['Baud Rate', '1.2 kbps to 20 kbps'],
  ['Voltage Levels', '12V automotive standard'],
  ['Operating Temperature', '-40°C to +85°C'],
  ['Power Supply', 'USB powered (5V, 500mA max)'],
  ['Dimensions', '85mm × 45mm × 20mm'],
  ['Weight', '45g']
]

const softwareCompat = [
  'Operating Systems: Windows 10/11, macOS 10.15+, Ubuntu 18.04+',
  'EcuBus-Pro: Full integration with latest versions',
  'Third-party Tools: Compatible with industry-standard LIN development tools',
  'API Support: Comprehensive SDK and API documentation available'
]

const applications = [
  {
    title: 'Automotive Development',
    items: [
      'ECU Development: LIN slave and master node development',
      'Vehicle Integration: Testing LIN networks in vehicle environments',
      'Protocol Analysis: Deep analysis of LIN communication patterns'
    ]
  },
  {
    title: 'Testing & Validation',
    items: [
      'Conformance Testing: LIN protocol conformance validation',
      'Fault Injection: Advanced fault simulation for robustness testing',
      'Performance Testing: Network performance and timing analysis'
    ]
  },
  {
    title: 'Education & Training',
    items: [
      'Learning Platform: Ideal for automotive engineering education',
      'Research Projects: Academic and industrial research applications',
      'Prototyping: Rapid prototyping of LIN-based systems'
    ]
  }
]

const reasons = [
  {
    title: 'Cost-Effective Solution',
    desc: 'Professional-grade LIN capabilities at an affordable price point'
  },
  {
    title: 'Advanced Fault Injection',
    desc: 'Sophisticated fault injection for comprehensive testing'
  },
  {
    title: 'Seamless Integration',
    desc: 'Designed for EcuBus-Pro, eliminating compatibility issues'
  },
  {
    title: 'Reliable Performance',
    desc: 'Industrial-grade components and rigorous quality control'
  }
]

const packageContents = [
  '1× LinCable USB to LIN Interface',
  '1× LIN Connector (DB9 male)',
  '1× USB Type-A to Type-C Cable',
  '1× Quick Start Guide',
  '1× Software Installation CD',
  '1× Protective Carrying Case'
]

const supportInfo = [
  {
    title: 'Technical Support',
    items: [
      'Email Support: Available 24/7 for technical inquiries',
      'Documentation: Comprehensive user manual and API documentation',
      'Community Forum: Active community for sharing knowledge and solutions',
      'Video Tutorials: Step-by-step setup and usage guides'
    ]
  },
  {
    title: 'Warranty & Service',
    items: [
      '1-Year Warranty: Comprehensive coverage for manufacturing defects',
      '30-Day Return Policy: Risk-free purchase with full refund option',
      'Free Software Updates: Regular firmware and software updates',
      'Repair Service: Professional repair service for out-of-warranty devices'
    ]
  }
]

const relatedProducts = [
  {
    name: 'EcuBus CAN Interface',
    link: './can-interface.md',
    desc: 'Professional CAN bus interface'
  },
  {
    name: 'EcuBus DoIP Gateway',
    link: './doip-gateway.md',
    desc: 'Ethernet-based diagnostic interface'
  },
  { name: 'EcuBus Development Kit', link: './dev-kit.md', desc: 'Complete development solution' }
]
</script>

<style scoped>
.lincable-product-page {
  font-family: inherit;
  color: #1e293b;
  background: #fff;
}
.section {
  max-width: 900px;
  margin: 0 auto 48px auto;
  padding: 0 16px;
}
.product-hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 48px 0 32px 0;
  margin-bottom: 32px;
  border-radius: 0 0 16px 16px;
}
.product-intro {
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
}
.product-title {
  font-size: 48px;
  font-weight: 800;
  margin: 0 0 16px 0;
  background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.product-tagline {
  font-size: 20px;
  font-weight: 400;
  margin: 0 0 32px 0;
  opacity: 0.9;
}
.product-highlights {
  display: flex;
  justify-content: center;
  gap: 32px;
  flex-wrap: wrap;
}
.highlight {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
}
.highlight svg {
  color: #10b981;
}
.feature-list {
  margin: 16px 0 0 0;
  padding: 0 0 0 20px;
}
.feature-list li {
  margin-bottom: 8px;
  line-height: 1.7;
}
.spec-table-wrapper {
  overflow-x: auto;
}
.spec-table {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0 24px 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.spec-table th {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
  padding: 12px 16px;
  text-align: left;
  min-width: 160px;
}
.spec-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
}
.spec-table tr:nth-child(even) td {
  background: #f8fafc;
}
.spec-table tr:hover td {
  background: #f1f5f9;
}
.applications-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
  margin: 24px 0;
}
.application-item {
  background: white;
  border-radius: 8px;
  padding: 20px;
  border-left: 4px solid #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.08);
}
.application-item h4 {
  color: #1e293b;
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}
.application-item ul {
  margin: 0;
  padding-left: 18px;
}
.package-contents {
  background: white;
  border-radius: 12px;
  padding: 24px;
  border: 2px solid #e2e8f0;
  margin: 24px 0;
}
.package-contents ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.package-contents li {
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
  color: #374151;
}
.package-contents li:last-child {
  border-bottom: none;
}
.support-section {
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border-radius: 16px;
  padding: 32px;
  margin: 32px 0;
  border: 1px solid #a7f3d0;
}
.support-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}
.support-item {
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #a7f3d0;
}
.support-item h4 {
  color: #065f46;
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}
.related-products {
  margin: 40px 0;
  padding: 24px;
  background: #f8fafc;
  border-radius: 12px;
}
.related-products ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.related-products li {
  margin: 12px 0;
}
.related-products a {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
}
.related-products a:hover {
  color: #5a67d8;
  text-decoration: underline;
}
.product-footer {
  text-align: center;
  color: #64748b;
  font-style: italic;
  margin: 40px 0 0 0;
  padding: 24px;
  border-top: 1px solid #e2e8f0;
}
@media (max-width: 768px) {
  .product-title {
    font-size: 32px;
  }
  .product-hero {
    padding: 32px 0 16px 0;
  }
  .applications-grid {
    grid-template-columns: 1fr;
  }
  .section {
    padding: 0 4px;
  }
}
</style>
