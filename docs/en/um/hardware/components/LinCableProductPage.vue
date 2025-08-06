<template>
  <div class="lincable-product-page-simple">
    <!-- Product Card Top Section -->
    <div class="product-card">
      <img class="product-image" src="./lincable.png" alt="LinCable" />
      <div class="product-info">
        <h1 class="product-title">EcuBus LinCable</h1>

        <button class="cart-btn" @click="showModal = true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          Buy Now
        </button>
      </div>
    </div>

    <!-- Modal for Purchase Links -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <button class="modal-close" @click="showModal = false">×</button>
        <PurchaseLinks />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PurchaseLinks from './PurchaseLinks.vue'
const showModal = ref(false)
</script>

<style scoped>
.lincable-product-page-simple {
  max-width: 700px;
  margin: 0 auto;
  padding: 32px 8px;
  background: #fff;
}
.product-card {
  display: flex;
  align-items: center;
  gap: 32px;
  background: #f8fafc;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 32px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}
.product-image {
  width: 300px;
  height: 300px;
  object-fit: contain;
  border-radius: 8px;
  background: #e2e8f0;
}
.product-image:hover {
  cursor: pointer;
}
.product-info {
  flex: 1;
  position: relative;
}
.product-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 8px 0;
}
.product-meta {
  display: flex;
  gap: 24px;
  font-size: 1rem;
  color: #64748b;
  margin-bottom: 16px;
}
.product-price {
  color: #059669;
  font-weight: 700;
  font-size: 1.25rem;
}
.cart-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #ff9800 0%, #ff6b35 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 22px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(255, 152, 0, 0.08);
  transition:
    background 0.2s,
    box-shadow 0.2s;
}
.cart-btn:hover {
  background: linear-gradient(135deg, #ff6b35 0%, #ff9800 100%);
  box-shadow: 0 4px 16px rgba(255, 152, 0, 0.15);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(30, 41, 59, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-content {
  background: #f8fafc;
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.13);
  padding: 36px 32px 28px 32px;
  min-width: 340px;
  max-width: 95vw;
  position: relative;
}
.modal-close {
  position: absolute;
  top: 12px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  color: #64748b;
  cursor: pointer;
  line-height: 1;
}

.accordion {
  margin-top: 16px;
}
details {
  background: #f8fafc;
  border-radius: 8px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}
summary {
  font-size: 1.1rem;
  font-weight: 600;
  padding: 16px 20px;
  cursor: pointer;
  outline: none;
  color: #334155;
  border-bottom: 1px solid #e2e8f0;
  user-select: none;
}
.accordion-content {
  padding: 16px 24px;
  color: #374151;
}
@media (max-width: 600px) {
  .product-card {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }
  .product-image {
    width: 100%;
    height: 240px;
  }
  .accordion-content {
    padding: 12px 8px;
  }
  .modal-content {
    padding: 18px 4vw 18px 4vw;
    min-width: 0;
  }
}
.highlight {
  color: #ff9800;
  font-weight: 700;
}

/* Dark mode: prefers-color-scheme and .dark class support */
@media (prefers-color-scheme: dark) {
  .lincable-product-page-simple {
    background: #181a20 !important;
  }
  .product-card {
    background: #23272f !important;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18) !important;
  }
  .product-title {
    color: #f1f5f9 !important;
  }
  .product-meta {
    color: #a0aec0 !important;
  }
  .product-price {
    color: #ffb300 !important;
  }
  .product-image {
    background: #23272f !important;
  }
  .cart-btn {
    background: linear-gradient(135deg, #ff9800 0%, #ff6b35 100%) !important;
    color: #fff !important;
  }
  .cart-btn:hover {
    background: linear-gradient(135deg, #ff6b35 0%, #ff9800 100%) !important;
    color: #fff !important;
  }
  .modal-content {
    background: #23272f !important;
    color: #f1f5f9 !important;
  }
  .modal-close {
    color: #a0aec0 !important;
  }
  details {
    background: #23272f !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.13) !important;
    border: 1px solid #2d3748 !important;
  }
  summary {
    color: #f1f5f9 !important;
    border-bottom: 1px solid #2d3748 !important;
  }
  .accordion-content {
    color: #e2e8f0 !important;
  }
  .highlight {
    color: #ffb300 !important;
  }
}

.dark .lincable-product-page-simple {
  background: #181a20 !important;
}
.dark .product-card {
  background: #23272f !important;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18) !important;
}
.dark .product-title {
  color: #f1f5f9 !important;
}
.dark .product-meta {
  color: #a0aec0 !important;
}
.dark .product-price {
  color: #ffb300 !important;
}
.dark .product-image {
  background: #23272f !important;
}
.dark .cart-btn {
  background: linear-gradient(135deg, #ff9800 0%, #ff6b35 100%) !important;
  color: #fff !important;
}
.dark .cart-btn:hover {
  background: linear-gradient(135deg, #ff6b35 0%, #ff9800 100%) !important;
  color: #fff !important;
}
.dark .modal-content {
  background: #23272f !important;
  color: #f1f5f9 !important;
}
.dark .modal-close {
  color: #a0aec0 !important;
}
.dark details {
  background: #23272f !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.13) !important;
  border: 1px solid #2d3748 !important;
}
.dark summary {
  color: #f1f5f9 !important;
  border-bottom: 1px solid #2d3748 !important;
}
.dark .accordion-content {
  color: #e2e8f0 !important;
}
.dark .highlight {
  color: #ffb300 !important;
}
</style>

