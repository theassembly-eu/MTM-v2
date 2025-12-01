<template>
  <div class="tooltip-wrapper" @mouseenter="show" @mouseleave="hide">
    <slot></slot>
    <Transition name="tooltip">
      <div
        v-if="isVisible"
        class="tooltip"
        :class="[
          `tooltip-${position}`,
          { 'tooltip-large': large }
        ]"
        :style="tooltipStyle"
      >
        <div class="tooltip-content">
          {{ text }}
        </div>
        <div class="tooltip-arrow" :class="`tooltip-arrow-${position}`"></div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  text: {
    type: String,
    required: true,
  },
  position: {
    type: String,
    default: 'top',
    validator: (value) => ['top', 'bottom', 'left', 'right'].includes(value),
  },
  large: {
    type: Boolean,
    default: false,
  },
});

const isVisible = ref(false);

function show() {
  isVisible.value = true;
}

function hide() {
  isVisible.value = false;
}

const tooltipStyle = computed(() => {
  return {};
});
</script>

<style scoped>
.tooltip-wrapper {
  position: relative;
  display: inline-block;
}

.tooltip {
  position: absolute;
  z-index: var(--z-tooltip);
  padding: var(--spacing-2) var(--spacing-3);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  font-size: var(--font-size-sm);
  border-radius: var(--radius-md);
  white-space: nowrap;
  pointer-events: none;
  max-width: 200px;
}

.tooltip-large {
  max-width: 300px;
  white-space: normal;
}

.tooltip-top {
  bottom: calc(100% + var(--spacing-2));
  left: 50%;
  transform: translateX(-50%);
}

.tooltip-bottom {
  top: calc(100% + var(--spacing-2));
  left: 50%;
  transform: translateX(-50%);
}

.tooltip-left {
  right: calc(100% + var(--spacing-2));
  top: 50%;
  transform: translateY(-50%);
}

.tooltip-right {
  left: calc(100% + var(--spacing-2));
  top: 50%;
  transform: translateY(-50%);
}

.tooltip-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
}

.tooltip-arrow-top {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 6px 6px 0 6px;
  border-color: rgba(0, 0, 0, 0.9) transparent transparent transparent;
}

.tooltip-arrow-bottom {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 0 6px 6px 6px;
  border-color: transparent transparent rgba(0, 0, 0, 0.9) transparent;
}

.tooltip-arrow-left {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-width: 6px 0 6px 6px;
  border-color: transparent transparent transparent rgba(0, 0, 0, 0.9);
}

.tooltip-arrow-right {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-width: 6px 6px 6px 0;
  border-color: transparent rgba(0, 0, 0, 0.9) transparent transparent;
}

.tooltip-content {
  line-height: var(--line-height-normal);
}

/* Transitions */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.2s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}
</style>

