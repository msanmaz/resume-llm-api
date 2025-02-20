// src/services/llm/llm.service.js
import OpenAI from 'openai';
import { config } from '../../config/environment.js';
import { AppError } from '../../utils/errors/AppError.js';
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
            logger.debug('LLMService.enhance called with:', {
                section,
                contentLength: content?.length,
                context: {
                    role: context?.role,
                    industry: context?.industry,
                    experienceLevel: context?.experienceLevel,
                    hasKeywords: Boolean(context?.keywords?.length)
                },
                parameters: {
                    temperature: parameters?.temperature,
                    style: parameters?.style,
                    focusAreas: parameters?.focusAreas
                }
            });

            const prompt = this.buildPrompt(section, content, context, parameters);

                        logger.debug('Built prompt for OpenAI', {
                            promptLength: prompt.length,
                            section,
                            context: JSON.stringify(context)
                        });
            
            logger.debug('Initiating OpenAI request', {
                section,
                contentLength: content.length,
                context: context ? JSON.stringify(context) : 'none'
            });

            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(parameters)
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: parameters.temperature || 0.7,
                max_tokens: 1000
            });

            if (!completion.choices || completion.choices.length === 0) {
                throw new AppError(500, 'No content generated from OpenAI');
            }

            const enhancedContent = completion.choices[0].message.content;

            logger.debug('OpenAI request successful', {
                originalLength: content.length,
                enhancedLength: enhancedContent.length
            });


                        logger.info('Content enhancement completed', {
                            section,
                            originalLength: content.length,
                            enhancedLength: enhancedContent.length,
                            processingSummary: {
                                hadMetrics: /\d+%|\d+x|\$\d+|\d+ [a-zA-Z]+/.test(enhancedContent),
                                hadActionVerbs: /\b(developed|implemented|managed|created|achieved)\b/i.test(enhancedContent)
                            }
                        });

            return {
                original: content,
                enhanced: enhancedContent,
                metadata: {
                    section,
                    timestamp: new Date().toISOString(),
                    enhancementFocus: parameters.focusAreas || ['keywords', 'achievements'],
                    preservedKeywords: parameters.preserveKeywords
                }
            };

        } catch (error) {
            logger.error('LLM service error', {
                error: error.message,
                section,
                contentLength: content?.length
            });

            if (error.response) {
                throw new AppError(
                    error.response.status || 500,
                    `OpenAI API error: ${error.response.data?.error?.message || error.message}`
                );
            } else if (error.request) {
                throw new AppError(503, 'No response from OpenAI API');
            }

            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError(500, 'Failed to generate content');
        }
    }

    getSystemPrompt(parameters) {
        return `You are an expert ATS-optimization and professional resume writing assistant. Your goal is to enhance resume content while:
- Optimizing for ATS systems and keyword recognition
- Maintaining professional and industry-appropriate tone
- Emphasizing quantifiable achievements and metrics
- Using strong action verbs and industry-specific terminology
- Preserving important technical terms and keywords
- Ensuring content is clear, concise, and impactful

Focus on making the content more:
1. Scannable by ATS systems
2. Rich in relevant keywords
3. Achievement-oriented with metrics
4. Professional and well-structured`;
    }

    buildPrompt(section, content, context = {}, parameters = {}) {
        const sectionPrompts = {
            work: this.buildWorkExperiencePrompt,
            summary: this.buildSummaryPrompt,
            skills: this.buildSkillsPrompt,
            education: this.buildEducationPrompt,
            achievements: this.buildAchievementsPrompt
        };

        const sectionPromptBuilder = sectionPrompts[section] || this.buildDefaultPrompt;
        return sectionPromptBuilder(content, context, parameters);
    }

    buildWorkExperiencePrompt(content, context, parameters) {
        return `Enhance the following work experience description for a resume, focusing on ATS optimization and professional impact:

Original Content:
${content}

Requirements:
1. Start with strong action verbs
2. Include specific metrics and achievements
3. Incorporate relevant keywords${context.keywords ? ` including: ${context.keywords.join(', ')}` : ''}
4. Maintain professional tone appropriate for ${context.experienceLevel || 'professional'} level
5. Ensure content is ATS-friendly and keyword-rich
6. Quantify achievements where possible (numbers, percentages, scales)

Additional Context:
${context.role ? `Target Role: ${context.role}` : ''}
${context.industry ? `Industry: ${context.industry}` : ''}
${context.experienceLevel ? `Experience Level: ${context.experienceLevel}` : ''}

Please provide an enhanced version that maintains accuracy while improving impact and ATS optimization.`;
    }

    buildSummaryPrompt(content, context, parameters) {
        return `Enhance the following professional summary, optimizing for ATS and professional impact:

Original Content:
${content}

Requirements:
1. Create a powerful opening statement
2. Highlight key qualifications and expertise
3. Include relevant industry keywords
4. Maintain professional tone
5. Focus on value proposition
6. Keep length between 3-5 lines

Additional Context:
${context.role ? `Target Role: ${context.role}` : ''}
${context.industry ? `Industry: ${context.industry}` : ''}

Please provide an enhanced version that is both impactful and ATS-friendly.`;
    }

    buildSkillsPrompt(content, context, parameters) {
        return `Enhance the following skills section, optimizing for ATS recognition:

Original Content:
${content}

Requirements:
1. Organize skills logically
2. Include both technical and soft skills
3. Use industry-standard terminology
4. Ensure keyword optimization
5. Remove any redundant skills

Additional Context:
${context.role ? `Target Role: ${context.role}` : ''}
${context.industry ? `Industry: ${context.industry}` : ''}

Please provide an enhanced version that maximizes ATS recognition while maintaining accuracy.`;
    }

    buildEducationPrompt(content, context, parameters) {
        return `Enhance the following education section, focusing on relevance and clarity:

Original Content:
${content}

Requirements:
1. Highlight relevant coursework and achievements
2. Include academic honors if applicable
3. Maintain clear formatting
4. Include relevant technical skills or certifications
5. Emphasize education-related achievements

Please provide an enhanced version that clearly presents educational qualifications.`;
    }

    buildAchievementsPrompt(content, context, parameters) {
        return `Enhance the following achievements, focusing on impact and metrics:

Original Content:
${content}

Requirements:
1. Start with strong action verbs
2. Include specific metrics and results
3. Quantify impact where possible
4. Maintain professional tone
5. Focus on business value
6. Include relevant technical terms

Please provide an enhanced version that demonstrates clear impact and results.`;
    }

    buildDefaultPrompt(content, context, parameters) {
        return `Enhance the following resume content, optimizing for professional impact:

Original Content:
${content}

Requirements:
1. Improve clarity and impact
2. Include relevant keywords
3. Maintain professional tone
4. Ensure ATS optimization
5. Focus on achievements and results

Please provide an enhanced version that is both professional and ATS-friendly.`;
    }
}