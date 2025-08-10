<template>
  <div class="purchase-links">
    <h3 class="purchase-title">Purchase EcuBus LinCable</h3>
    <p class="purchase-subtitle">Choose your preferred platform to purchase LinCable</p>

    <div class="purchase-options">
      <div class="purchase-option">
        <div class="platform-info">
          <div class="platform-icon taobao">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
              />
            </svg>
          </div>
          <div class="platform-details">
            <h4>淘宝</h4>
            <p>中国最大的电商平台</p>
          </div>
        </div>
        <a
          href="https://item.taobao.com/item.htm?id=952734340915"
          target="_blank"
          rel="noopener noreferrer"
          class="purchase-button taobao-button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
          在淘宝购买
        </a>
      </div>
      <div class="purchase-option">
        <div class="platform-info">
          <div class="platform-icon aliexpress">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
              />
            </svg>
          </div>
          <div class="platform-details">
            <h4>AliExpress</h4>
            <p>Global shipping available</p>
          </div>
        </div>
        <button class="purchase-button aliexpress-button disabled" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
          Buy on AliExpress
        </button>
        <div class="intl-note">
          Coming soon. For inquiries, please
          <a href="/docs/about/contact.html" target="_blank">contact EcuBus</a>.
        </div>
      </div>
    </div>

    <!-- <div class="purchase-features">
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
    </div> -->
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
  margin: 32px auto;
  border: 1px solid #e2e8f0;
  max-width: 1200px;
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
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.purchase-option {
  background: white;
  border-radius: 12px;
  padding: 24px;
  border: 2px solid #e2e8f0;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  min-height: 200px;
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
  flex-wrap: wrap;
  flex: 1;
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
  word-break: break-word;
}

.platform-details p {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 8px 0;
  word-break: break-word;
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
  width: 100%;
  box-sizing: border-box;
  margin-top: auto;
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

.disabled {
  opacity: 0.5;
  cursor: not-allowed !important;
  pointer-events: none;
  background: #cbd5e1 !important;
  color: #64748b !important;
  border: none !important;
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

.intl-note {
  margin-top: 10px;
  font-size: 13px;
  color: #f59e42;
  text-align: center;
}
.intl-note a {
  color: #3b82f6;
  text-decoration: underline;
  font-weight: 600;
}

@media (min-width: 1200px) {
  .purchase-options {
    max-width: 900px;
    gap: 32px;
  }

  .purchase-option {
    padding: 32px;
    min-height: 220px;
  }

  .purchase-title {
    font-size: 28px;
  }

  .purchase-subtitle {
    font-size: 18px;
  }
}

@media (max-width: 1024px) {
  .purchase-options {
    max-width: 600px;
  }
}

@media (max-width: 768px) {
  .purchase-options {
    grid-template-columns: 1fr;
    max-width: 400px;
    gap: 20px;
  }

  .purchase-features {
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .purchase-links {
    padding: 24px 20px;
    margin: 20px auto;
    border-radius: 12px;
  }

  .purchase-title {
    font-size: 22px;
    margin: 0 0 10px 0;
  }

  .purchase-subtitle {
    font-size: 15px;
    margin: 0 0 28px 0;
  }

  .purchase-option {
    padding: 20px;
    min-height: 180px;
  }

  .platform-icon {
    width: 44px;
    height: 44px;
    margin-right: 14px;
  }

  .platform-details h4 {
    font-size: 17px;
  }

  .platform-details p {
    font-size: 13px;
  }

  .purchase-button {
    padding: 14px 20px;
    font-size: 15px;
    border-radius: 10px;
  }
}

@media (max-width: 480px) {
  .purchase-links {
    padding: 20px 16px;
    margin: 16px 8px;
    border-radius: 10px;
  }

  .purchase-title {
    font-size: 20px;
    margin: 0 0 8px 0;
  }

  .purchase-subtitle {
    font-size: 14px;
    margin: 0 0 24px 0;
  }

  .purchase-options {
    gap: 16px;
    margin-bottom: 24px;
    max-width: 100%;
  }

  .purchase-option {
    padding: 16px;
    min-height: 160px;
  }

  .platform-info {
    margin-bottom: 16px;
  }

  .platform-icon {
    width: 40px;
    height: 40px;
    margin-right: 12px;
  }

  .platform-details h4 {
    font-size: 16px;
  }

  .platform-details p {
    font-size: 13px;
  }

  .purchase-button {
    padding: 12px 18px;
    font-size: 14px;
    border-radius: 8px;
  }

  .intl-note {
    font-size: 12px;
    margin-top: 8px;
  }
}

@media (max-width: 360px) {
  .purchase-links {
    padding: 16px 12px;
    margin: 12px 6px;
  }

  .purchase-title {
    font-size: 18px;
  }

  .purchase-subtitle {
    font-size: 13px;
  }

  .purchase-option {
    padding: 14px;
    min-height: 150px;
  }

  .platform-icon {
    width: 36px;
    height: 36px;
    margin-right: 10px;
  }

  .platform-details h4 {
    font-size: 15px;
  }

  .platform-details p {
    font-size: 12px;
  }

  .purchase-button {
    padding: 10px 16px;
    font-size: 13px;
  }
}

@media (prefers-color-scheme: dark) {
  .purchase-links {
    background: #23272f !important;
    border: 1px solid #2d3748 !important;
  }
  .purchase-title,
  .purchase-subtitle {
    color: #f1f5f9 !important;
  }
  .purchase-option {
    background: #181a20 !important;
    border: 2px solid #2d3748 !important;
  }
  .purchase-option:hover {
    border-color: #60a5fa !important;
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.1) !important;
  }
  .platform-details h4 {
    color: #f1f5f9 !important;
  }
  .platform-details p {
    color: #a0aec0 !important;
  }
  .purchase-button {
    color: #fff !important;
    background: linear-gradient(135deg, #ff9800 0%, #ff6b35 100%) !important;
    border: none !important;
  }
  .purchase-button:hover {
    background: linear-gradient(135deg, #ff6b35 0%, #ff9800 100%) !important;
    color: #fff !important;
  }
  .platform-icon {
    background: #23272f !important;
  }
}

.dark .purchase-links {
  background: #23272f !important;
  border: 1px solid #2d3748 !important;
}
.dark .purchase-title,
.dark .purchase-subtitle {
  color: #f1f5f9 !important;
}
.dark .purchase-option {
  background: #181a20 !important;
  border: 2px solid #2d3748 !important;
}
.dark .purchase-option:hover {
  border-color: #60a5fa !important;
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.1) !important;
}
.dark .platform-details h4 {
  color: #f1f5f9 !important;
}
.dark .platform-details p {
  color: #a0aec0 !important;
}
.dark .purchase-button {
  color: #fff !important;
  background: linear-gradient(135deg, #ff9800 0%, #ff6b35 100%) !important;
  border: none !important;
}
.dark .purchase-button:hover {
  background: linear-gradient(135deg, #ff6b35 0%, #ff9800 100%) !important;
  color: #fff !important;
}
.dark .platform-icon {
  background: #23272f !important;
}
</style>
