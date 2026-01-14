/**
 * Netlify Serverless Function: Multi-Form Submission API
 * 
 * Supports multiple forms via form_id, with dynamic validation,
 * extensible hooks for notifications, webhooks, and storage.
 */

// ============================================================
// FORM CONFIGURATIONS
// Add new forms here without creating new functions
// ============================================================
const FORM_CONFIGS = {
  contact: {
    requiredFields: ['name', 'email', 'message'],
    optionalFields: ['phone', 'company'],
    // Extension hooks (implement as needed)
    onSuccess: async (data) => {
      // await sendEmail({ to: 'admin@example.com', subject: 'New Contact', body: data });
      // await triggerWebhook('https://hooks.example.com/contact', data);
      // await saveToCSV('contact-submissions.csv', data);
      console.log('[Contact Form] Submission received:', data);
    }
  },
  
  newsletter: {
    requiredFields: ['email'],
    optionalFields: ['name', 'preferences'],
    onSuccess: async (data) => {
      // await addToMailingList(data.email, data.name);
      console.log('[Newsletter] Subscription received:', data);
    }
  },
  
  quote: {
    requiredFields: ['name', 'email', 'service_type', 'budget'],
    optionalFields: ['phone', 'company', 'details', 'timeline'],
    onSuccess: async (data) => {
      // await sendEmail({ to: 'sales@example.com', subject: 'Quote Request', body: data });
      console.log('[Quote Form] Request received:', data);
    }
  },

  callback: {
    requiredFields: ['name', 'phone'],
    optionalFields: ['preferred_time', 'notes'],
    onSuccess: async (data) => {
      console.log('[Callback Form] Request received:', data);
    }
  }
};

// ============================================================
// VALIDATION HELPERS
// ============================================================
const validators = {
  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : 'Invalid email format';
  },
  
  phone: (value) => {
    if (!value) return null; // Optional field
    const phoneRegex = /^[\d\s\-+()]{7,20}$/;
    return phoneRegex.test(value) ? null : 'Invalid phone format';
  },
  
  // Add more field-specific validators as needed
};

function validateField(field, value) {
  // Check if field has a specific validator
  if (validators[field]) {
    return validators[field](value);
  }
  return null;
}

function validateRequiredFields(data, requiredFields) {
  const errors = [];
  
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      errors.push(`Missing required field: ${field}`);
    } else {
      const validationError = validateField(field, data[field]);
      if (validationError) {
        errors.push(`${field}: ${validationError}`);
      }
    }
  }
  
  return errors;
}

// ============================================================
// SECURITY HELPERS
// ============================================================
function checkHoneypot(data) {
  // Honeypot field - should be empty if submitted by human
  // Add a hidden field named "_honey" to your forms
  if (data._honey && data._honey.trim() !== '') {
    return false; // Bot detected
  }
  return true;
}

function checkTimestamp(data) {
  // Optional: Check if form was submitted too quickly (bot behavior)
  // Add a hidden field "_timestamp" with Date.now() when form loads
  if (data._timestamp) {
    const submissionTime = Date.now() - parseInt(data._timestamp, 10);
    if (submissionTime < 2000) { // Less than 2 seconds
      return false; // Likely a bot
    }
  }
  return true;
}

function sanitizeInput(value) {
  if (typeof value !== 'string') return value;
  // Basic XSS prevention
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function sanitizeData(data) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    // Skip internal fields
    if (key.startsWith('_')) continue;
    sanitized[key] = sanitizeInput(value);
  }
  return sanitized;
}

// ============================================================
// RESPONSE HELPERS
// ============================================================
function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Configure for your domain in production
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function successResponse(message = 'Form submitted successfully') {
  return jsonResponse(200, { success: true, message });
}

function errorResponse(error, statusCode = 400) {
  return jsonResponse(statusCode, { success: false, error });
}

// ============================================================
// MAIN HANDLER
// ============================================================
exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, {});
  }

  // Method check - only allow POST
  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', 405);
  }

  // Parse JSON body
  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return errorResponse('Invalid JSON in request body');
  }

  // Validate form_id exists
  const { form_id } = data;
  if (!form_id) {
    return errorResponse('Missing form_id in request body');
  }

  // Check if form_id is configured
  const formConfig = FORM_CONFIGS[form_id];
  if (!formConfig) {
    return errorResponse(`Unknown form_id: ${form_id}. Available forms: ${Object.keys(FORM_CONFIGS).join(', ')}`);
  }

  // Anti-spam checks
  if (!checkHoneypot(data)) {
    // Silent success for bots (don't reveal detection)
    return successResponse();
  }

  if (!checkTimestamp(data)) {
    return errorResponse('Please wait a moment before submitting');
  }

  // Validate required fields
  const validationErrors = validateRequiredFields(data, formConfig.requiredFields);
  if (validationErrors.length > 0) {
    return errorResponse(validationErrors.join('; '));
  }

  // Sanitize input data
  const sanitizedData = sanitizeData(data);
  sanitizedData.form_id = form_id;
  sanitizedData.submitted_at = new Date().toISOString();

  // Execute form-specific success handler
  try {
    if (formConfig.onSuccess) {
      await formConfig.onSuccess(sanitizedData);
    }
  } catch (e) {
    console.error(`[${form_id}] onSuccess handler failed:`, e);
    // Don't expose internal errors to client
    return errorResponse('Submission processing failed. Please try again.', 500);
  }

  return successResponse(`${form_id} form submitted successfully`);
};
