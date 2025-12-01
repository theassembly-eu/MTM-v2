// Global toast state
const toastCallbacks = [];

export function useToast() {
  function showToast(message, type = 'info', duration = 5000, description = null) {
    // Call all registered toast instances
    toastCallbacks.forEach(callback => {
      callback(message, type, duration, description);
    });
    
    // Fallback to console if no toast instance registered
    if (toastCallbacks.length === 0) {
      console[type === 'error' ? 'error' : 'log'](message);
    }
  }
  
  function success(message, description = null, duration = 5000) {
    return showToast(message, 'success', duration, description);
  }
  
  function error(message, description = null, duration = 7000) {
    return showToast(message, 'error', duration, description);
  }
  
  function warning(message, description = null, duration = 6000) {
    return showToast(message, 'warning', duration, description);
  }
  
  function info(message, description = null, duration = 5000) {
    return showToast(message, 'info', duration, description);
  }
  
  return {
    showToast,
    success,
    error,
    warning,
    info,
  };
}

// Register toast callback (called from Toast.vue)
export function registerToastCallback(callback) {
  toastCallbacks.push(callback);
  return () => {
    const index = toastCallbacks.indexOf(callback);
    if (index > -1) {
      toastCallbacks.splice(index, 1);
    }
  };
}

