/**
 * MUHAR STUDIO — Server-Side Validation Middleware
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,20}$/;

/**
 * Validate Consultation Form Submission
 */
function validateConsultation(req, res, next) {
  const { name, email, phone, projectType, budget, message } = req.body || {};
  const errors = {};

  // Name validation
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.name = 'Please enter your full name (at least 2 characters).';
  } else if (name.length > 100) {
    errors.name = 'Name cannot exceed 100 characters.';
  }

  // Email validation
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Please enter a valid email address.';
  } else if (email.length > 254) {
    errors.email = 'Email cannot exceed 254 characters.';
  }

  // Phone validation (Optional, but validated if present)
  if (phone && typeof phone === 'string' && phone.trim() !== '') {
    if (!PHONE_REGEX.test(phone.trim())) {
      errors.phone = 'Please enter a valid phone number.';
    } else if (phone.length > 30) {
      errors.phone = 'Phone number is too long.';
    }
  }

  // Project Type validation
  if (!projectType || typeof projectType !== 'string' || projectType.trim() === '') {
    errors.projectType = 'Please select a project type.';
  } else if (projectType.length > 100) {
    errors.projectType = 'Project type is invalid.';
  }

  // Budget validation
  if (!budget || typeof budget !== 'string' || budget.trim() === '') {
    errors.budget = 'Please select an approximate budget range.';
  } else if (budget.length > 100) {
    errors.budget = 'Budget selection is invalid.';
  }

  // Message validation
  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    errors.message = 'Please provide a brief project summary (at least 10 characters).';
  } else if (message.length > 3000) {
    errors.message = 'Project message cannot exceed 3000 characters.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please check the submitted fields.',
      errors
    });
  }

  next();
}

/**
 * Validate Contact Form Submission
 */
function validateContact(req, res, next) {
  const { name, email, phone, message } = req.body || {};
  const errors = {};

  // Name validation
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.name = 'Please enter your name (at least 2 characters).';
  } else if (name.length > 100) {
    errors.name = 'Name cannot exceed 100 characters.';
  }

  // Email validation
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Please enter a valid email address.';
  } else if (email.length > 254) {
    errors.email = 'Email cannot exceed 254 characters.';
  }

  // Phone validation (Optional)
  if (phone && typeof phone === 'string' && phone.trim() !== '') {
    if (!PHONE_REGEX.test(phone.trim())) {
      errors.phone = 'Please enter a valid phone number.';
    } else if (phone.length > 30) {
      errors.phone = 'Phone number is too long.';
    }
  }

  // Message validation
  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    errors.message = 'Please provide a message (at least 10 characters).';
  } else if (message.length > 3000) {
    errors.message = 'Message cannot exceed 3000 characters.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please check the submitted fields.',
      errors
    });
  }

  next();
}

module.exports = {
  validateConsultation,
  validateContact
};
