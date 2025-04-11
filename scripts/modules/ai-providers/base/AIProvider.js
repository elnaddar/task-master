/**
 * @typedef {Object} ProviderConfig
 * @property {string} apiKey - The API key for the provider
 * @property {string} [model] - The model to use (provider-specific)
 * @property {Object} [options] - Additional provider-specific options
 */

/**
 * @typedef {Object} TaskGenOptions
 * @property {number} [numTasks] - Target number of tasks to generate
 * @property {boolean} [research] - Whether to use research capabilities
 * @property {Object} [context] - Additional context for task generation
 */

/**
 * @typedef {Object} ExpandOptions
 * @property {number} [numSubtasks] - Target number of subtasks to generate
 * @property {boolean} [research] - Whether to use research capabilities
 * @property {string} [prompt] - Additional context for expansion
 */

/**
 * @typedef {Object} ComplexityAnalysis
 * @property {number} score - Complexity score (1-10)
 * @property {string} explanation - Explanation of the score
 * @property {Object} factors - Factors contributing to complexity
 */

/**
 * Abstract base class for AI providers
 * @abstract
 */
export class AIProvider {
  /**
   * Initialize the AI provider with configuration
   * @param {ProviderConfig} config - Provider configuration
   * @returns {Promise<void>}
   * @abstract
   */
  async initialize(config) {
    throw new Error('Method not implemented');
  }

  /**
   * Generate tasks from a PRD or description
   * @param {string} prd - The PRD or description text
   * @param {TaskGenOptions} options - Task generation options
   * @returns {Promise<Array<Object>>} Generated tasks
   * @abstract
   */
  async generateTasks(prd, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Expand a task into subtasks
   * @param {Object} task - The task to expand
   * @param {ExpandOptions} options - Expansion options
   * @returns {Promise<Array<Object>>} Generated subtasks
   * @abstract
   */
  async expandTask(task, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Analyze task complexity
   * @param {Object} task - The task to analyze
   * @returns {Promise<ComplexityAnalysis>} Complexity analysis
   * @abstract
   */
  async analyzeComplexity(task) {
    throw new Error('Method not implemented');
  }

  /**
   * Handle provider-specific errors
   * @param {Error} error - The error to handle
   * @returns {string} User-friendly error message
   * @abstract
   */
  handleError(error) {
    throw new Error('Method not implemented');
  }

  /**
   * Check if the provider is available and properly configured
   * @returns {Promise<boolean>} Whether the provider is available
   */
  async isAvailable() {
    try {
      // Basic check - override in provider implementations for more specific checks
      return true;
    } catch (error) {
      return false;
    }
  }
} 