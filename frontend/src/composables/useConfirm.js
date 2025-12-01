import { ref } from 'vue';

const confirmState = ref({
  isOpen: false,
  title: 'Bevestigen',
  message: '',
  description: '',
  confirmText: 'Bevestigen',
  cancelText: 'Annuleren',
  type: 'info',
  loading: false,
  resolve: null,
  reject: null,
});

export function useConfirm() {
  function confirm(options = {}) {
    return new Promise((resolve, reject) => {
      confirmState.value = {
        isOpen: true,
        title: options.title || 'Bevestigen',
        message: options.message || '',
        description: options.description || '',
        confirmText: options.confirmText || 'Bevestigen',
        cancelText: options.cancelText || 'Annuleren',
        type: options.type || 'info',
        loading: false,
        resolve,
        reject,
      };
    });
  }
  
  function handleConfirm() {
    if (confirmState.value.resolve) {
      confirmState.value.resolve(true);
    }
    confirmState.value.isOpen = false;
    confirmState.value.resolve = null;
    confirmState.value.reject = null;
  }
  
  function handleCancel() {
    if (confirmState.value.reject) {
      confirmState.value.reject(false);
    }
    confirmState.value.isOpen = false;
    confirmState.value.resolve = null;
    confirmState.value.reject = null;
  }
  
  function setLoading(loading) {
    confirmState.value.loading = loading;
  }
  
  return {
    confirmState,
    confirm,
    handleConfirm,
    handleCancel,
    setLoading,
  };
}

