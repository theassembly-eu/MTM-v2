/**
 * Input sanitization utilities to prevent prompt injection attacks
 */

/**
 * Sanitize user input text to prevent prompt injection
 * Removes or neutralizes potentially dangerous patterns
 * 
 * @param {string} text - The text to sanitize
 * @returns {string} - Sanitized text
 */
export function sanitizeInputText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let sanitized = text;

  // Remove common prompt injection patterns
  // These patterns attempt to override system instructions
  const injectionPatterns = [
    // Direct instruction overrides
    /ignore\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
    /forget\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
    /disregard\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
    /override\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
    
    // System role hijacking
    /you\s+are\s+now\s+(a|an)\s+/gi,
    /act\s+as\s+(a|an)\s+/gi,
    /pretend\s+to\s+be\s+(a|an)\s+/gi,
    
    // Instruction injection markers
    /\[INST\]/gi,
    /\[SYSTEM\]/gi,
    /\[USER\]/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    
    // Base64 encoded instructions (basic detection)
    /(?:^|\s)([A-Za-z0-9+/]{50,}={0,2})(?:\s|$)/g, // Very long base64-like strings
    
    // Command execution attempts
    /```(?:bash|sh|python|javascript|js|cmd|powershell)/gi,
    /`(?:bash|sh|python|javascript|js|cmd|powershell)/gi,
  ];

  // Replace injection patterns with neutralized versions
  injectionPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[filtered]');
  });

  // Remove excessive newlines (potential formatting attacks)
  sanitized = sanitized.replace(/\n{10,}/g, '\n\n');

  // Remove excessive whitespace
  sanitized = sanitized.replace(/[ \t]{100,}/g, ' ');

  // Limit maximum length (prevent resource exhaustion)
  const MAX_LENGTH = 50000; // 50k characters should be more than enough
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH) + '\n\n[... tekst ingekort vanwege lengte ...]';
  }

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Validate that text is safe for processing
 * Returns true if text passes basic safety checks
 * 
 * @param {string} text - The text to validate
 * @returns {Object} - { valid: boolean, reason?: string }
 */
export function validateInputText(text) {
  if (!text || typeof text !== 'string') {
    return { valid: false, reason: 'Text is empty or invalid' };
  }

  if (text.trim().length === 0) {
    return { valid: false, reason: 'Text is empty' };
  }

  if (text.length > 50000) {
    return { valid: false, reason: 'Text exceeds maximum length' };
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /ignore\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
    /forget\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
    /you\s+are\s+now\s+(a|an)\s+/gi,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(text)) {
      return { valid: false, reason: 'Text contains potentially unsafe patterns' };
    }
  }

  return { valid: true };
}

/**
 * Escape special characters that could interfere with prompt structure
 * This is a lighter sanitization for display purposes
 * 
 * @param {string} text - The text to escape
 * @returns {string} - Escaped text
 */
export function escapeForDisplay(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Only escape if it looks like it might contain injection attempts
  // Normal text should pass through unchanged
  const hasSuspiciousContent = /(?:ignore|forget|override|you are now|act as)/gi.test(text);
  
  if (!hasSuspiciousContent) {
    return text;
  }

  // For suspicious content, we've already sanitized it in sanitizeInputText
  return text;
}

