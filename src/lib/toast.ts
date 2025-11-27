import toast from 'react-hot-toast';

// Success toast
export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-right',
    style: {
      background: '#10B981',
      color: '#fff',
    },
  });
};

// Error toast
export const showError = (message: string) => {
  toast.error(message, {
    duration: 4000,
    position: 'top-right',
    style: {
      background: '#EF4444',
      color: '#fff',
    },
  });
};

// Info toast
export const showInfo = (message: string) => {
  toast(message, {
    duration: 3000,
    position: 'top-right',
    icon: 'ℹ️',
  });
};

// Loading toast
export const showLoading = (message: string) => {
  return toast.loading(message, {
    position: 'top-right',
  });
};

// Dismiss a specific toast
export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};
