import OpenAI from 'openai';
import { config } from '../../config/environment.js';
import { AppError } from '../../utils/errors/appError.js';
import logger from '../../utils/logger/index.js';

export class LLMService {
    constructor(openaiClient = null) {
        if (!config.openai.apiKey) {
            throw new AppError(500, 'OpenAI API key is not configured');
        }


        this.openai = openaiClient; 
        
        if (!this.openai) {
            this.openai = new OpenAI({
                apiKey: config.openai.apiKey
            });
        }
    }

    async enhanceStreaming(section, content, context = {}, parameters = {}) {
        try {
          logger.debug('Starting streaming enhancement', { 
            section, 
            contentLength: content?.length 
          });
      
          const prompt = this.buildPrompt(section, content, context, parameters);
      
          const stream = await this.openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: this.getSystemPrompt(parameters) },
              { role: "user", content: prompt }
            ],
            temperature: parameters.temperature || 0.7,
            max_tokens: 1000,
            stream: false
          });
      
          return stream;
        } catch (error) {
          logger.error('LLM streaming error', { error: error.message });
          throw error;
        }
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
                },
                timestamp: new Date().toISOString()
            });

            const prompt = this.buildPrompt(section, content, context, parameters);

            logger.debug('Built prompt for OpenAI', {
                promptLength: prompt.length,
                section,
                context: JSON.stringify(context),
                timestamp: new Date().toISOString()
            });

            logger.debug('Initiating OpenAI request', {
                section,
                contentLength: content.length,
                context: context ? JSON.stringify(context) : 'none',
                timestamp: new Date().toISOString()
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
                enhancedLength: enhancedContent.length,
                timestamp: new Date().toISOString()
            });

            logger.info('Content enhancement completed', {
                section,
                originalLength: content.length,
                enhancedLength: enhancedContent.length,
                processingSummary: {
                    hadMetrics: /\d+%|\d+x|\$\d+|\d+ [a-zA-Z]+/.test(enhancedContent),
                    hadActionVerbs: /\b(developed|implemented|managed|created|achieved)\b/i.test(enhancedContent)
                },
                timestamp: new Date().toISOString()
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
                contentLength: content?.length,
                timestamp: new Date().toISOString()
            });

            if (error instanceof AppError) {
                throw error;
            }
            
            if (error.response) {
                throw new AppError(
                    error.response.status || 500,
                    `OpenAI API error: ${error.response.data?.error?.message || error.message}`
                );
            } else if (error.request) {
                throw new AppError(503, 'No response from OpenAI API');
            }

            throw new AppError(500, 'Failed to generate content');
        }
    }

    getSystemPrompt(parameters = {}) {
        const {
            style = "professional",
            focusAreas = ["keywords", "achievements"],
            preserveKeywords = true
        } = parameters;

        // Base system prompt
        const basePrompt = `You are an expert ATS-optimization and professional resume writing assistant specializing in ${style} content. Your goal is to enhance resume content while:`;

        // Core requirements
        const coreRequirements = [
            "Optimizing for ATS systems and keyword recognition",
            "Maintaining professional and industry-appropriate tone",
            "Emphasizing quantifiable achievements and metrics",
            "Using strong action verbs and industry-specific terminology",
            preserveKeywords ? "Preserving important technical terms and keywords" : "Optimizing keyword usage",
            "Ensuring content is clear, concise, and impactful"
        ];

        const focusAreasMap = {
            keywords: "Rich in relevant keywords and industry terminology",
            achievements: "Achievement-oriented with clear impact statements",
            metrics: "Quantified with specific metrics and results",
            action_verbs: "Led with powerful action verbs",
        };

        const selectedFocusAreas = focusAreas
            .filter(area => focusAreasMap[area])
            .map(area => focusAreasMap[area]);

        return `${basePrompt}
    ${coreRequirements.map(req => `- ${req}`).join('\n')}
    
    Focus on making the content:
    ${selectedFocusAreas.map((focus, i) => `${i + 1}. ${focus}`).join('\n')}
    
    Style Guide:
    - Tone: ${style} and authoritative
    - Format: Clear and scannable
    - Length: Concise but impactful
    - Keywords: ${preserveKeywords ? 'Preserve and enhance' : 'Optimize and standardize'}`;
    }

    buildPrompt(section, content, context = {}, parameters = {}) {
        const sectionPrompts = {
            work: this.buildWorkExperiencePrompt,
            summary: this.buildSummaryPrompt,
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


    buildEducationPrompt(content, context, parameters) {
        return `Enhance ONLY the description and achievements for this education entry. Do not include any headers, titles, or institution information.
    
    Original Content:
    ${content}
    
    Enhancement Requirements:
    1. Focus on relevant coursework that directly relates to industry applications
    2. Highlight specific projects or research that demonstrate practical skills
    3. Include technical competencies and tools learned
    4. Mention academic achievements that show professional potential
    5. Emphasize leadership or collaborative experiences
    6. Include relevant certifications or specialized training
    
    Formatting Guidelines:
    - Start each point with action verbs or key achievements
    - Include specific technologies, methodologies, or tools where relevant
    - Quantify achievements where possible (GPA, project outcomes, etc.)
    - Keep descriptions concise but detailed
    - Use industry-standard terminology for better ATS recognition
    
    IMPORTANT: Provide ONLY the enhanced bullet points. Do not include any headers, education titles, or institution information. Start directly with the achievement bullets.
    
    Please enhance while maintaining accuracy and avoiding exaggeration.`;
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