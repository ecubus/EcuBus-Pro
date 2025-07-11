<template>
  <div class="purchase-links">
    <h3 class="purchase-title">Purchase LinCable</h3>
    <p class="purchase-subtitle">Choose your preferred platform to purchase LinCable</p>

    <div class="purchase-options">
      <div class="purchase-option">
        <div class="platform-info">
          <div class="platform-icon taobao">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div class="platform-details">
            <h4>Taobao</h4>
            <p>China's largest e-commerce platform</p>
            <div class="price-info">
              <span class="price">¥299</span>
              <span class="currency">CNY</span>
            </div>
          </div>
        </div>
        <a
          href="https://item.taobao.com/item.htm?id=123456789"
          target="_blank"
          rel="noopener noreferrer"
          class="purchase-button taobao-button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
          Buy on Taobao
        </a>
      </div>

      <div class="purchase-option">
        <div class="platform-info">
          <div class="platform-icon aliexpress">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div class="platform-details">
            <h4>AliExpress</h4>
            <p>Global shipping available</p>
            <div class="price-info">
              <span class="price">$42</span>
              <span class="currency">USD</span>
            </div>
          </div>
        </div>
        <a
          href="https://www.aliexpress.com/item/123456789.html"
          target="_blank"
          rel="noopener noreferrer"
          class="purchase-button aliexpress-button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
          Buy on AliExpress
        </a>
      </div>
    </div>

    <div class="purchase-features">
      <div class="feature">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Free shipping worldwide</span>
      </div>
      <div class="feature">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>30-day money back guarantee</span>
      </div>
      <div class="feature">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>1-year warranty</span>
      </div>
    </div>
  </div>
</template>

<script setup>
// Component logic can be added here if needed
</script>

<style scoped>
.purchase-links {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border-radius: 16px;
  padding: 32px;
  margin: 32px 0;
  border: 1px solid #e2e8f0;
}

.purchase-title {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px 0;
  text-align: center;
}

.purchase-subtitle {
  font-size: 16px;
  color: #64748b;
  margin: 0 0 32px 0;
  text-align: center;
}

.purchase-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 32px;
}

.purchase-option {
  background: white;
  border-radius: 12px;
  padding: 24px;
  border: 2px solid #e2e8f0;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.purchase-option:hover {
  border-color: #3b82f6;
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.15);
  transform: translateY(-2px);
}

.platform-info {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.platform-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  color: white;
}

.platform-icon.taobao {
  background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
}

.platform-icon.aliexpress {
  background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
}

.platform-details h4 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.platform-details p {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 8px 0;
}

.price-info {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.price {
  font-size: 24px;
  font-weight: 700;
  color: #059669;
}

.currency {
  font-size: 14px;
  color: #64748b;
}

.purchase-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 16px;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
  color: white;
}

.taobao-button {
  background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
}

.taobao-button:hover {
  background: linear-gradient(135deg, #e55a2b 0%, #e0851a 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
}

.aliexpress-button {
  background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
}

.aliexpress-button:hover {
  background: linear-gradient(135deg, #e55a2b 0%, #e0851a 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
}

.purchase-features {
  display: flex;
  justify-content: center;
  gap: 32px;
  flex-wrap: wrap;
}

.feature {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #64748b;
}

.feature svg {
  color: #059669;
}

@media (max-width: 768px) {
  .purchase-options {
    grid-template-columns: 1fr;
  }

  .purchase-features {
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .purchase-links {
    padding: 24px;
  }
}
</style>
