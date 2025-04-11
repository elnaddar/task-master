import { AIProvider } from './base/AIProvider.js';

/**
 * Custom error class for provider-related errors
 */
class ProviderError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
  }
}

/**
 * Factory class for creating and managing AI provider instances
 */
export class AIProviderFactory {
  static #instances = new Map();
  static #SUPPORTED_PROVIDERS = ['anthropic', 'google'];

  /**
   * Validate provider type
   * @param {string} type - The provider type to validate
   * @throws {ProviderError} If provider type is invalid
   */
  static #validateProviderType(type) {
    if (!this.#SUPPORTED_PROVIDERS.includes(type)) {
      throw new ProviderError(
        `Provider type '${type}' not supported. Must be one of: ${this.#SUPPORTED_PROVIDERS.join(', ')}`,
        'INVALID_PROVIDER'
      );
    }
  }

  /**
   * Validate provider configuration
   * @param {import('./base/AIProvider.js').ProviderConfig} config - Provider configuration
   * @param {string} type - Provider type
   * @throws {ProviderError} If configuration is invalid
   */
  static #validateConfig(config, type) {
    if (!config?.apiKey) {
      throw new ProviderError(
        `API key is required for ${type} provider`,
        'INVALID_CONFIG'
      );
    }
  }

  /**
   * Get or create an AI provider instance
   * @param {string} type - The provider type ('anthropic' | 'google')
   * @param {import('./base/AIProvider.js').ProviderConfig} config - Provider configuration
   * @returns {Promise<AIProvider>} The provider instance
   * @throws {ProviderError} If provider creation fails
   */
  static async getProvider(type, config) {
    try {
      // Validate provider type
      this.#validateProviderType(type);
      
      // Validate configuration
      this.#validateConfig(config, type);

      // Check if we already have an instance
      if (this.#instances.has(type)) {
        const provider = this.#instances.get(type);
        // Verify the provider is still available
        if (await provider.isAvailable()) {
          return provider;
        }
        // If not available, remove it and create a new one
        this.#instances.delete(type);
      }

      // Dynamically import the provider module
      let ProviderClass;
      try {
        const module = await import(`./${type}/${type}Provider.js`);
        ProviderClass = module.default;
      } catch (error) {
        throw new ProviderError(
          `Failed to load ${type} provider module: ${error.message}`,
          'MODULE_LOAD_ERROR'
        );
      }

      // Create and initialize the provider
      const provider = new ProviderClass();
      try {
        await provider.initialize(config);
      } catch (error) {
        throw new ProviderError(
          `Failed to initialize ${type} provider: ${error.message}`,
          'INIT_ERROR'
        );
      }

      // Verify the provider is available
      if (!await provider.isAvailable()) {
        throw new ProviderError(
          `${type} provider is not available after initialization`,
          'PROVIDER_UNAVAILABLE'
        );
      }
      
      // Cache the instance
      this.#instances.set(type, provider);
      
      return provider;
    } catch (error) {
      // Wrap non-ProviderError errors
      if (!(error instanceof ProviderError)) {
        throw new ProviderError(
          `Unexpected error creating ${type} provider: ${error.message}`,
          'UNKNOWN_ERROR'
        );
      }
      throw error;
    }
  }

  /**
   * Get the best available provider based on configuration and availability
   * @param {Object} config - Configuration object with provider-specific settings
   * @returns {Promise<AIProvider>} The best available provider
   * @throws {ProviderError} If no provider is available
   */
  static async getBestProvider(config = {}) {
    // Try user-specified provider first
    const preferredType = process.env.AI_PROVIDER;
    if (preferredType) {
      try {
        return await this.getProvider(preferredType, {
          apiKey: process.env[`${preferredType.toUpperCase()}_API_KEY`],
          model: process.env[`${preferredType.toUpperCase()}_MODEL`],
          ...config[preferredType]
        });
      } catch (error) {
        console.warn(`Failed to initialize preferred provider (${preferredType}): ${error.message}`);
      }
    }

    // Try each provider in order of preference
    for (const type of ['anthropic', 'google']) {
      try {
        return await this.getProvider(type, {
          apiKey: process.env[`${type.toUpperCase()}_API_KEY`],
          model: process.env[`${type.toUpperCase()}_MODEL`],
          ...config[type]
        });
      } catch (error) {
        console.warn(`Failed to initialize ${type} provider: ${error.message}`);
      }
    }

    throw new ProviderError(
      'No AI providers are available. Please check your configuration and API keys.',
      'NO_PROVIDERS'
    );
  }

  /**
   * Get all available providers
   * @param {Object} config - Configuration object with provider-specific settings
   * @returns {Promise<Map<string, AIProvider>>} Map of available providers
   */
  static async getAllProviders(config = {}) {
    const providers = new Map();

    for (const type of this.#SUPPORTED_PROVIDERS) {
      try {
        const provider = await this.getProvider(type, {
          apiKey: process.env[`${type.toUpperCase()}_API_KEY`],
          model: process.env[`${type.toUpperCase()}_MODEL`],
          ...config[type]
        });
        providers.set(type, provider);
      } catch (error) {
        console.warn(`Failed to initialize ${type} provider: ${error.message}`);
      }
    }

    return providers;
  }

  /**
   * Clear all provider instances
   */
  static clearInstances() {
    this.#instances.clear();
  }
} 