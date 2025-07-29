// Type definitions for our app
// Using JSDoc comments for type hints in JavaScript

/**
 * @typedef {Object} User
 * @property {string} id - User ID
 * @property {string} email - User email
 * @property {string} name - User name
 * @property {string} createdAt - User creation date
 */

/**
 * @typedef {Object} InventoryItem
 * @property {number} id - Item ID (database primary key)
 * @property {string} item_id - Custom item ID
 * @property {string} title - Item title
 * @property {string} description - Item description
 * @property {string} vendor - Vendor name
 * @property {string} manufacture_date - Manufacturing date
 * @property {string} image_url - Image URL/path
 * @property {string} created_at - Creation timestamp
 */

/**
 * @typedef {Object} LoginCredentials
 * @property {string} email - User email
 * @property {string} password - User password
 */

/**
 * @typedef {Object} AuthResponse
 * @property {boolean} success - Whether the operation was successful
 * @property {User} [user] - User object (if successful)
 * @property {string} [error] - Error message (if failed)
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the API call was successful
 * @property {*} [data] - Response data (if successful)
 * @property {string} [error] - Error message (if failed)
 */

// Export types for use in other files
export const Types = {
    User: 'User',
    InventoryItem: 'InventoryItem',
    LoginCredentials: 'LoginCredentials',
    AuthResponse: 'AuthResponse',
    ApiResponse: 'ApiResponse',
  };