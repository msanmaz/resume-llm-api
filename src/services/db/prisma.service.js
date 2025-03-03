import logger from '../../utils/logger/index.js';
import { PrismaClient, Prisma } from '@prisma/client';

class PrismaService {
  constructor() {
    this.prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });

    // Set up logging
    this.prisma.$on('query', (e) => {
      logger.debug('Prisma Query', {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      });
    });

    this.prisma.$on('error', (e) => {
      logger.error('Prisma Error', {
        message: e.message,
        target: e.target,
      });
    });
  }

  async createEnhancementRequest(data) {
    try {
      return await this.prisma.enhancementRequest.create({
        data: {
          correlationId: data.correlationId,
          section: data.section,
          originalContent: data.content,
          context: data.context || {},
          parameters: data.parameters || {},
          ipAddress: data.ipAddress,
          source: data.source,
        },
      });
    } catch (error) {
      logger.error('Failed to create enhancement request', {
        error: error.message,
        data,
      });
      throw error;
    }
  }

  async updateRequestStatus(correlationId, status, completedAt = null, processingTimeMs = null) {
    try {
      const updateData = { status };
      
      if (completedAt) {
        updateData.completedAt = completedAt;
      }
      
      if (processingTimeMs) {
        updateData.processingTimeMs = processingTimeMs;
      }
      
      return await this.prisma.enhancementRequest.update({
        where: { correlationId },
        data: updateData,
      });
    } catch (error) {
      logger.error('Failed to update request status', {
        error: error.message,
        correlationId,
        status,
      });
      throw error;
    }
  }

  async createEnhancementResult(correlationId, enhancedContent, metadata, modelUsed, tokensUsed) {
    try {
      const request = await this.prisma.enhancementRequest.findUnique({
        where: { correlationId },
        select: { id: true }
      });
      
      if (!request) {
        throw new Error(`Request with correlationId ${correlationId} not found`);
      }
      
      return await this.prisma.enhancementResult.create({
        data: {
          requestId: request.id,
          enhancedContent,
          metadata,
          modelUsed,
          tokensUsed,
        },
      });
    } catch (error) {
      logger.error('Failed to create enhancement result', {
        error: error.message,
        correlationId,
      });
      throw error;
    }
  }

  async getEnhancementWithResult(correlationId) {
    try {
      return await this.prisma.enhancementRequest.findUnique({
        where: { correlationId },
        include: { result: true },
      });
    } catch (error) {
      logger.error('Failed to get enhancement with result', {
        error: error.message,
        correlationId,
      });
      throw error;
    }
  }

async recordApiUsage(date, userId = null, success = true, tokensUsed = 0, processingTime = 0) {
    try {
      const day = new Date(date);
      day.setHours(0, 0, 0, 0);
      
      const existingUsage = await this.prisma.apiUsage.findUnique({
        where: {
          date_userId: {
            date: day,
            userId: userId || 'anonymous',
          }
        }
      });
      
      let newAvgProcessingTime = processingTime;
      if (existingUsage) {
        newAvgProcessingTime = 
          (existingUsage.averageProcessingTime * existingUsage.totalRequests + processingTime) / 
          (existingUsage.totalRequests + 1);
      }
      
      return await this.prisma.apiUsage.upsert({
        where: {
          date_userId: {
            date: day,
            userId: userId || 'anonymous',
          },
        },
        update: {
          totalRequests: { increment: 1 },
          successfulRequests: { increment: success ? 1 : 0 },
          failedRequests: { increment: success ? 0 : 1 },
          totalTokens: { increment: tokensUsed },
          averageProcessingTime: newAvgProcessingTime,
        },
        create: {
          date: day,
          userId: userId || 'anonymous',
          totalRequests: 1,
          successfulRequests: success ? 1 : 0,
          failedRequests: success ? 0 : 1,
          totalTokens: tokensUsed,
          averageProcessingTime: processingTime,
        },
      });
    } catch (error) {
      logger.error('Failed to record API usage', {
        error: error.message,
        date,
        userId,
      });
      throw error;
    }
  }

  async disconnect() {
    await this.prisma.$disconnect();
    logger.info('Disconnected from Prisma/PostgreSQL');
  }
}

// Create a singleton instance
const prismaService = new PrismaService();

export default prismaService;