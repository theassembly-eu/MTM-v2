import { ref, computed } from 'vue';

/**
 * Composable for form validation with real-time feedback
 * @param {Object} rules - Validation rules object
 * @returns {Object} Validation state and methods
 */
export function useFormValidation(rules = {}) {
  const errors = ref({});
  const touched = ref({});

  /**
   * Validate a single field
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @returns {string|null} Error message or null if valid
   */
  function validateField(field, value) {
    const fieldRules = rules[field];
    if (!fieldRules) return null;

    // Required check
    if (fieldRules.required && (!value || (typeof value === 'string' && !value.trim()))) {
      return fieldRules.requiredMessage || `${field} is verplicht`;
    }

    // Min length check
    if (fieldRules.minLength && value && value.length < fieldRules.minLength) {
      return fieldRules.minLengthMessage || `${field} moet minimaal ${fieldRules.minLength} tekens bevatten`;
    }

    // Max length check
    if (fieldRules.maxLength && value && value.length > fieldRules.maxLength) {
      return fieldRules.maxLengthMessage || `${field} mag maximaal ${fieldRules.maxLength} tekens bevatten`;
    }

    // Email validation
    if (fieldRules.email && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return fieldRules.emailMessage || 'Ongeldig e-mailadres';
      }
    }

    // Custom validator
    if (fieldRules.validator && typeof fieldRules.validator === 'function') {
      const customError = fieldRules.validator(value);
      if (customError) return customError;
    }

    return null;
  }

  /**
   * Validate all fields
   * @param {Object} values - Form values object
   * @returns {boolean} True if valid, false otherwise
   */
  function validate(values) {
    const newErrors = {};
    let isValid = true;

    Object.keys(rules).forEach(field => {
      const error = validateField(field, values[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    errors.value = newErrors;
    return isValid;
  }

  /**
   * Mark field as touched
   * @param {string} field - Field name
   */
  function touchField(field) {
    touched.value[field] = true;
  }

  /**
   * Reset validation state
   */
  function reset() {
    errors.value = {};
    touched.value = {};
  }

  /**
   * Get error for a field (only if touched)
   * @param {string} field - Field name
   * @returns {string|null} Error message or null
   */
  function getFieldError(field) {
    if (!touched.value[field]) return null;
    return errors.value[field] || null;
  }

  /**
   * Check if field has error
   * @param {string} field - Field name
   * @returns {boolean}
   */
  function hasFieldError(field) {
    return touched.value[field] && !!errors.value[field];
  }

  /**
   * Check if form is valid
   * @returns {boolean}
   */
  const isValid = computed(() => {
    return Object.keys(errors.value).length === 0;
  });

  return {
    errors,
    touched,
    validate,
    validateField,
    touchField,
    reset,
    getFieldError,
    hasFieldError,
    isValid,
  };
}

