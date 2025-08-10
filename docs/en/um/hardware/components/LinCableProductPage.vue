<template>
  <div class="lincable-product-page-simple">
    <!-- Product Card Top Section -->
    <div class="product-card">
      <img class="product-image" src="./lincable.png" alt="LinCable" />
      <div class="product-info">
        <h1 class="product-title">EcuBus LinCable</h1>
        <p class="product-subtitle">USB to LIN Adapter for Automotive Development</p>

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
  color: #1e293b;
}
.product-subtitle {
  font-size: 1.1rem;
  color: #64748b;
  margin: 0 0 24px 0;
  line-height: 1.5;
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
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #ff9800 0%, #ff6b35 100%);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 16px 32px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(255, 152, 0, 0.2);
  transition: all 0.3s ease;
  width: 100%;
  max-width: 300px;
}
.cart-btn:hover {
  background: linear-gradient(135deg, #ff6b35 0%, #ff9800 100%);
  box-shadow: 0 6px 20px rgba(255, 152, 0, 0.3);
  transform: translateY(-2px);
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

/* Enhanced Mobile Responsive Design */
@media (max-width: 768px) {
  .lincable-product-page-simple {
    padding: 16px 8px;
  }

  .product-card {
    flex-direction: column;
    gap: 20px;
    padding: 20px;
    margin-bottom: 24px;
    border-radius: 12px;
  }

  .product-image {
    width: 100%;
    max-width: 280px;
    height: 280px;
    border-radius: 12px;
  }

  .product-info {
    text-align: center;
    width: 100%;
  }

  .product-title {
    font-size: 1.75rem;
    margin: 0 0 12px 0;
  }

  .product-subtitle {
    font-size: 1rem;
    margin: 0 0 28px 0;
    padding: 0 8px;
  }

  .cart-btn {
    padding: 18px 32px;
    font-size: 1.2rem;
    border-radius: 16px;
    max-width: 100%;
    box-shadow: 0 6px 20px rgba(255, 152, 0, 0.25);
  }

  .modal-content {
    padding: 24px 20px 20px 20px;
    margin: 20px;
    border-radius: 16px;
    min-width: 0;
    width: calc(100vw - 40px);
    max-width: 400px;
  }
}

@media (max-width: 480px) {
  .lincable-product-page-simple {
    padding: 12px 6px;
  }

  .product-card {
    padding: 16px;
    gap: 16px;
    margin-bottom: 20px;
  }

  .product-image {
    max-width: 240px;
    height: 240px;
  }

  .product-title {
    font-size: 1.5rem;
    margin: 0 0 10px 0;
  }

  .product-subtitle {
    font-size: 0.95rem;
    margin: 0 0 24px 0;
    padding: 0 4px;
  }

  .cart-btn {
    padding: 16px 24px;
    font-size: 1.1rem;
    border-radius: 14px;
  }

  .modal-content {
    padding: 20px 16px 16px 16px;
    margin: 16px;
    width: calc(100vw - 32px);
  }

  .modal-close {
    top: 8px;
    right: 12px;
    font-size: 1.75rem;
  }
}

@media (max-width: 360px) {
  .product-card {
    padding: 12px;
    gap: 12px;
  }

  .product-image {
    max-width: 200px;
    height: 200px;
  }

  .product-title {
    font-size: 1.35rem;
    margin: 0 0 8px 0;
  }

  .product-subtitle {
    font-size: 0.9rem;
    margin: 0 0 20px 0;
  }

  .cart-btn {
    padding: 14px 20px;
    font-size: 1rem;
    border-radius: 12px;
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
  .product-subtitle {
    color: #a0aec0 !important;
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
.dark .product-subtitle {
  color: #a0aec0 !important;
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
