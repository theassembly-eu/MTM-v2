import { onMounted, onUnmounted } from 'vue';

/**
 * Composable for handling keyboard shortcuts
 * @param {Object} shortcuts - Object mapping key combinations to callbacks
 * @example
 * useKeyboardShortcuts({
 *   'ctrl+s': (e) => { e.preventDefault(); saveForm(); },
 *   'escape': () => closeModal(),
 * })
 */
export function useKeyboardShortcuts(shortcuts) {
  function handleKeyDown(event) {
    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const alt = event.altKey;

    // Build key combination string
    let combination = '';
    if (ctrl) combination += 'ctrl+';
    if (shift) combination += 'shift+';
    if (alt) combination += 'alt+';
    combination += key;

    // Check if this combination is registered
    if (shortcuts[combination]) {
      event.preventDefault();
      shortcuts[combination](event);
      return;
    }

    // Also check without modifiers (for single keys like 'escape')
    if (shortcuts[key] && !ctrl && !shift && !alt) {
      event.preventDefault();
      shortcuts[key](event);
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return {
    handleKeyDown, // Expose for manual use if needed
  };
}

