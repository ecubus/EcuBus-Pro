<template>
  <div class="product-carousel">
    <div class="carousel-container" ref="carouselContainer">
      <div class="carousel-track" :style="{ transform: `translateX(-${currentIndex * 100}%)` }">
        <div v-for="(image, index) in images" :key="index" class="carousel-slide">
          <div v-if="!image.src || image.src.includes('placeholder')" class="placeholder-image">
            <div class="placeholder-content">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                />
              </svg>
              <h3>{{ image.alt || 'Product Image' }}</h3>
              <p>Professional LIN Hardware Device</p>
            </div>
          </div>
          <img v-else :src="image.src" :alt="image.alt" class="carousel-image" />
        </div>
      </div>

      <!-- Navigation arrows -->
      <button class="carousel-nav carousel-prev" @click="previous" :disabled="currentIndex === 0">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <button
        class="carousel-nav carousel-next"
        @click="next"
        :disabled="currentIndex === images.length - 1"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      <!-- Indicators -->
      <div class="carousel-indicators">
        <button
          v-for="(image, index) in images"
          :key="index"
          class="indicator"
          :class="{ active: index === currentIndex }"
          @click="goToSlide(index)"
        ></button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  images: {
    type: Array,
    required: true,
    default: () => []
  },
  autoplay: {
    type: Boolean,
    default: true
  },
  interval: {
    type: Number,
    default: 5000
  }
})

const currentIndex = ref(0)
const carouselContainer = ref(null)
let autoplayTimer = null

const next = () => {
  if (currentIndex.value < props.images.length - 1) {
    currentIndex.value++
  } else {
    currentIndex.value = 0
  }
}

const previous = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  } else {
    currentIndex.value = props.images.length - 1
  }
}

const goToSlide = (index) => {
  currentIndex.value = index
}

const startAutoplay = () => {
  if (props.autoplay && props.images.length > 1) {
    autoplayTimer = setInterval(() => {
      next()
    }, props.interval)
  }
}

const stopAutoplay = () => {
  if (autoplayTimer) {
    clearInterval(autoplayTimer)
    autoplayTimer = null
  }
}

onMounted(() => {
  startAutoplay()

  // Pause autoplay on hover
  if (carouselContainer.value) {
    carouselContainer.value.addEventListener('mouseenter', stopAutoplay)
    carouselContainer.value.addEventListener('mouseleave', startAutoplay)
  }
})

onUnmounted(() => {
  stopAutoplay()
  if (carouselContainer.value) {
    carouselContainer.value.removeEventListener('mouseenter', stopAutoplay)
    carouselContainer.value.removeEventListener('mouseleave', startAutoplay)
  }
})
</script>

<style scoped>
.product-carousel {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.carousel-container {
  position: relative;
  width: 100%;
  height: 400px;
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.carousel-track {
  display: flex;
  width: 100%;
  height: 100%;
  transition: transform 0.5s ease-in-out;
}

.carousel-slide {
  flex: 0 0 100%;
  width: 100%;
  height: 100%;
}

.carousel-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.placeholder-image {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.placeholder-content {
  text-align: center;
  padding: 40px;
}

.placeholder-content svg {
  margin-bottom: 16px;
  opacity: 0.8;
}

.placeholder-content h3 {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.placeholder-content p {
  font-size: 16px;
  opacity: 0.9;
  margin: 0;
}

.carousel-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 10;
}

.carousel-nav:hover:not(:disabled) {
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.carousel-nav:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.carousel-prev {
  left: 16px;
}

.carousel-next {
  right: 16px;
}

.carousel-indicators {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 10;
}

.indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.8);
  background: transparent;
  cursor: pointer;
  transition: all 0.3s ease;
}

.indicator:hover {
  background: rgba(255, 255, 255, 0.5);
}

.indicator.active {
  background: rgba(255, 255, 255, 1);
  border-color: rgba(255, 255, 255, 1);
}

@media (max-width: 768px) {
  .carousel-container {
    height: 300px;
  }

  .carousel-nav {
    width: 40px;
    height: 40px;
  }

  .carousel-prev {
    left: 8px;
  }

  .carousel-next {
    right: 8px;
  }

  .placeholder-content h3 {
    font-size: 20px;
  }

  .placeholder-content p {
    font-size: 14px;
  }
}
</style>
