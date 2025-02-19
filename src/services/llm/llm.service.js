// src/services/llm/llm.service.js
import OpenAI from 'openai';
import { config } from '../../config/environment.js';
import logger from '../../utils/logger/index.js';

export class LLMService {
    constructor() {

        if (!config.openai.apiKey) {
            throw new AppError(500, 'OpenAI API key is not configured');
        }

        this.openai = new OpenAI({
            apiKey: config.openai.apiKey
        });
    }

    async enhance(section, content, context = {}, parameters = {}) {
        try {
            const prompt = this.buildPrompt(section, content, context);

            logger.debug('Initiating OpenAI request', {
                section,
                contentLength: content.length
            });

            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional resume writer with expertise in creating impactful and achievement-oriented content."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: parameters.temperature || 0.7,
                max_tokens: 500
            });

            if (!completion.choices || completion.choices.length === 0) {
                throw new AppError(500, 'No content generated from OpenAI');
            }

            const enhancedContent = completion.choices[0].message.content;

            logger.debug('OpenAI request successful', {
                originalLength: content.length,
                enhancedLength: enhancedContent.length
            });

            return enhancedContent;

        } catch (error) {
            logger.error('LLM service error', {
                error: error.message,
                section,
                contentLength: content.length
            });

            // Handle specific OpenAI errors
            if (error.response) {
                // The API request was received and processed, but returned an error
                throw new AppError(
                    error.response.status || 500,
                    `OpenAI API error: ${error.response.data?.error?.message || error.message}`
                );
            } else if (error.request) {
                // The request was made but no response was received
                throw new AppError(503, 'No response from OpenAI API');
            }

            // Forward AppError instances
            if (error instanceof AppError) {
                throw error;
            }

            // Generic error
            throw new AppError(500, 'Failed to generate content');
        }
    }


    buildPrompt(section, content, context) {
        const basePrompt = `Enhance the following ${section} section for a resume. 
Make it more impactful and professional while maintaining accuracy:

Original Content:
${content}

Please provide an enhanced version that:
1. Uses strong action verbs
2. Includes specific achievements where possible
3. Maintains a professional tone
4. Is concise and impactful`;

        // Add context if provided
        if (context.role || context.industry) {
            return `${basePrompt}

Additional Context:
${context.role ? `Role: ${context.role}` : ''}
${context.industry ? `Industry: ${context.industry}` : ''}
${context.experienceLevel ? `Experience Level: ${context.experienceLevel}` : ''}`;
        }

        return basePrompt;
    }
}