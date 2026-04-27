const { OpenAI } = require('openai');
const config = require('../config');
const logger = require('../utils/logger');

class OpenAIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  async generateHint(userInput) {
    if (!config.openaiApiKey || config.openaiApiKey === 'your_openai_api_key_here') {
      return this._getMockResponse(userInput);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4",
        messages: [
          { 
            role: "system", 
            content: "You are an expert technical interviewer assistant. Provide a concise, professional hint based on the candidate's input. Also list 2-3 key technical concepts relevant to the answer." 
          },
          { role: "user", content: userInput }
        ],
        response_format: { type: "json_object" }
      });

      // Expected JSON: { "hint": "...", "concepts": ["...", "..."] }
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('OpenAI Service Error:', error);
      throw new Error('Failed to generate AI hint');
    }
  }

  _getMockResponse(input) {
    // Advanced mock logic for professional demonstration
    return {
      hint: "Great point about architecture. Consider mentioning how this scales under high concurrency.",
      concepts: ["Scalability", "Concurrency", "Load Balancing"]
    };
  }
}

module.exports = new OpenAIService();
