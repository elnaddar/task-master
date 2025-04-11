import { Anthropic } from '@anthropic-ai/sdk';
import { AIProvider } from '../base/AIProvider.js';

/**
 * Anthropic AI provider implementation
 */
export default class AnthropicProvider extends AIProvider {
  #client = null;
  #config = null;

  /**
   * Initialize the Anthropic provider
   * @param {import('../base/AIProvider.js').ProviderConfig} config
   */
  async initialize(config) {
    this.#config = config;
    this.#client = new Anthropic({
      apiKey: config.apiKey,
      defaultHeaders: {
        'anthropic-beta': 'output-128k-2025-02-19' // Enable 128k token output
      }
    });
  }

  /**
   * Generate tasks from a PRD
   * @param {string} prd - PRD content
   * @param {import('../base/AIProvider.js').TaskGenOptions} options
   */
  async generateTasks(prd, options = {}) {
    const { numTasks = 10 } = options;

    const systemPrompt = `You are an AI assistant helping to break down a Product Requirements Document (PRD) into a set of sequential development tasks. 
Your goal is to create ${numTasks} well-structured, actionable development tasks based on the PRD provided.

Each task should follow this JSON structure:
{
  "id": number,
  "title": string,
  "description": string,
  "status": "pending",
  "dependencies": number[] (IDs of tasks this depends on),
  "priority": "high" | "medium" | "low",
  "details": string (implementation details),
  "testStrategy": string (validation approach)
}

Guidelines:
1. Create exactly ${numTasks} tasks, numbered from 1 to ${numTasks}
2. Each task should be atomic and focused on a single responsibility
3. Order tasks logically - consider dependencies and implementation sequence
4. Early tasks should focus on setup, core functionality first, then advanced features
5. Include clear validation/testing approach for each task
6. Set appropriate dependency IDs (a task can only depend on tasks with lower IDs)
7. Assign priority (high/medium/low) based on criticality and dependency order
8. Include detailed implementation guidance in the "details" field
9. If the PRD contains specific requirements for libraries, database schemas, frameworks, tech stacks, or any other implementation details, STRICTLY ADHERE to these requirements
10. Focus on filling in any gaps left by the PRD while preserving all explicit requirements
11. Always aim to provide the most direct path to implementation

Expected output format:
{
  "tasks": [
    {
      "id": 1,
      "title": "Setup Project Repository",
      ...
    },
    ...
  ]
}`;

    try {
      const response = await this.#client.messages.create({
        model: this.#config.model || 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: prd }]
      });

      const content = response.content[0].text;
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('Failed to parse JSON from response');
      }

      const parsed = JSON.parse(match[0]);
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        throw new Error('Invalid response format');
      }

      return parsed.tasks;
    } catch (error) {
      throw new Error(this.handleError(error));
    }
  }

  /**
   * Expand a task into subtasks
   * @param {Object} task - The task to expand
   * @param {import('../base/AIProvider.js').ExpandOptions} options
   */
  async expandTask(task, options = {}) {
    const { numSubtasks = 3, prompt = '' } = options;

    const systemPrompt = `You are an AI assistant helping to break down a development task into smaller subtasks.
Your goal is to create ${numSubtasks} well-structured, actionable subtasks for the given task.

Each subtask should follow this JSON structure:
{
  "id": string,          // Format: "parentId.subtaskNumber" (e.g., "1.1")
  "title": string,       // Brief, descriptive title
  "description": string, // What needs to be done
  "status": "pending",   // Always "pending" for new subtasks
  "details": string      // Implementation guidance
}

Guidelines:
1. Create exactly ${numSubtasks} subtasks
2. Each subtask should be atomic and focused
3. Order subtasks logically in sequence
4. Include clear implementation guidance
5. Consider any additional context provided

Expected output format:
{
  "subtasks": [
    {
      "id": "${task.id}.1",
      "title": "First Subtask",
      ...
    },
    ...
  ]
}`;

    const userMessage = `Task to expand:
${JSON.stringify(task, null, 2)}

${prompt ? `\nAdditional context:\n${prompt}` : ''}`;

    try {
      const response = await this.#client.messages.create({
        model: this.#config.model || 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      });

      const content = response.content[0].text;
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('Failed to parse JSON from response');
      }

      const parsed = JSON.parse(match[0]);
      if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) {
        throw new Error('Invalid response format');
      }

      return parsed.subtasks;
    } catch (error) {
      throw new Error(this.handleError(error));
    }
  }

  /**
   * Analyze task complexity
   * @param {Object} task - The task to analyze
   */
  async analyzeComplexity(task) {
    const systemPrompt = `You are an AI assistant analyzing the complexity of a development task.
Your goal is to provide a detailed complexity analysis with a score from 1-10 and explanation.

Expected output format:
{
  "score": number,        // 1-10 complexity score
  "explanation": string,  // Detailed explanation of the score
  "factors": {           // Factors contributing to complexity
    "scope": string,     // Breadth of changes needed
    "technical": string, // Technical challenges
    "dependencies": string, // External dependencies
    "risks": string      // Potential risks
  }
}`;

    const userMessage = `Task to analyze:
${JSON.stringify(task, null, 2)}`;

    try {
      const response = await this.#client.messages.create({
        model: this.#config.model || 'claude-3-7-sonnet-20250219',
        max_tokens: 2000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      });

      const content = response.content[0].text;
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('Failed to parse JSON from response');
      }

      return JSON.parse(match[0]);
    } catch (error) {
      throw new Error(this.handleError(error));
    }
  }

  /**
   * Handle Anthropic-specific errors
   * @param {Error} error - The error to handle
   */
  handleError(error) {
    // Check if it's a structured error response
    if (error.type === 'error' && error.error) {
      switch (error.error.type) {
        case 'overloaded_error':
          return 'Claude is currently experiencing high demand and is overloaded. Please wait a few minutes and try again.';
        case 'rate_limit_error':
          return 'You have exceeded the rate limit. Please wait a few minutes before making more requests.';
        case 'invalid_request_error':
          return 'There was an issue with the request format. If this persists, please report it as a bug.';
        default:
          return `Claude API error: ${error.error.message}`;
      }
    }

    // Check for network/timeout errors
    if (error.message?.toLowerCase().includes('timeout')) {
      return 'The request to Claude timed out. Please try again.';
    }
    if (error.message?.toLowerCase().includes('network')) {
      return 'There was a network error connecting to Claude. Please check your internet connection and try again.';
    }

    // Default error message
    return `Error communicating with Claude: ${error.message}`;
  }

  /**
   * Check if the provider is available
   */
  async isAvailable() {
    try {
      if (!this.#config?.apiKey) {
        return false;
      }
      // Make a minimal API call to verify connectivity
      await this.#client.messages.create({
        model: this.#config.model || 'claude-3-7-sonnet-20250219',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      });
      return true;
    } catch (error) {
      return false;
    }
  }
} 