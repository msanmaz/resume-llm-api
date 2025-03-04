import { QueueService } from '../../services/queue/queue.service.js';
import { AppError } from '../../utils/errors/appError.js';
import logger from '../../utils/logger/index.js';
import redisService from '../../services/storage/redis.service.js';
import prismaService from '../../services/db/prisma.service.js';


export const generateContent = async (req, res, next) => {
  let queueService = null;
  
  try {
    const { section, content, context, parameters } = req.body;

    logger.info('Content generation requested', { section });
    
    // STEP 1: Connect to Queue Service
    try {
      queueService = new QueueService();
      logger.debug('Queue service initialized');
      
      await queueService.connect();
      logger.info('Queue service connected successfully');
    } catch (queueError) {
      logger.error('Failed to initialize or connect queue service', { 
        error: queueError.message,
        stack: queueError.stack
      });
      throw queueError;
    }

    // STEP 2: Publish enhancement request
    let correlationId;
    try {
      correlationId = await queueService.publishEnhancementRequest(
        section,
        content,
        context,
        parameters
      );
      logger.info('Enhancement request published', { correlationId });
    } catch (publishError) {
      logger.error('Failed to publish enhancement request', { 
        error: publishError.message,
        stack: publishError.stack
      });
      throw publishError;
    }

    // STEP 3: Create Redis job
    try {
      logger.debug('Setting job in Redis', { 
        jobId: correlationId,
        redisUrl: process.env.REDIS_URL ? 'Set in env' : 'Using default' 
      });
      
      await redisService.setJob(correlationId, {
        status: 'pending',
        createdAt: new Date().toISOString(),
        section,
        contentLength: content?.length
      });
      logger.info('Job stored in Redis', { correlationId });
    } catch (redisError) {
      logger.error('Failed to store job in Redis', { 
        error: redisError.message,
        stack: redisError.stack,
        correlationId
      });
      throw redisError;
    }

    // STEP 4: Create database entry
    try {
      await prismaService.createEnhancementRequest({
        correlationId,
        section,
        content,
        context,
        parameters,
        ipAddress: req.ip,
        source: req.get('User-Agent')
      });
      logger.info('Enhancement request stored in database', { correlationId });
    } catch (dbError) {
      logger.error('Failed to store enhancement request in database', { 
        error: dbError.message,
        stack: dbError.stack,
        correlationId 
      });
      // Continue execution even if database fails
      // We don't want to fail the request just because of DB issues
      logger.warn('Continuing despite database error');
    }

    logger.info('Enhancement request queued', {
      correlationId,
      section,
      status: 'pending'
    });

    // STEP 5: Close queue connection
    try {
      if (queueService) {
        await queueService.close();
        logger.debug('Queue service connection closed');
      }
    } catch (closeError) {
      logger.warn('Error closing queue connection', { 
        error: closeError.message 
      });
      // Don't throw, as the main operation succeeded
    }

    res.status(202).json({
      status: 'success',
      message: 'Enhancement request queued successfully',
      data: {
        jobId: correlationId,
        status: 'pending',
        original: {
          section,
          contentLength: content?.length
        },
        checkStatusUrl: `/api/v1/llm/status/${correlationId}`
      }
    });
  } catch (error) {
    logger.error('Content generation request failed', { 
      error: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
    
    // Try to clean up and close connections if error occurred
    if (queueService) {
      try {
        await queueService.close();
      } catch (closeError) {
        logger.warn('Error closing queue connection during error handling', { 
          error: closeError.message 
        });
      }
    }
    
    next(new AppError(500, 'Failed to queue content generation request'));
  }
};

export const getJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    logger.info('Checking job status', { jobId });

    // STEP 1: Check Redis for job
    let job;
    try {
      job = await redisService.getJob(jobId);
      logger.debug('Redis job status check result', { 
        jobId, 
        exists: !!job,
        status: job?.status || 'not found' 
      });
    } catch (redisError) {
      logger.error('Error checking job in Redis', {
        jobId,
        error: redisError.message,
        stack: redisError.stack
      });
      throw redisError;
    }

    if (!job) {
      logger.warn('Job not found in Redis', { jobId });
      
      // STEP 2: Check database if not in Redis
      let dbJob;
      try {
        dbJob = await prismaService.getEnhancementWithResult(jobId);
        logger.debug('Database job check result', { 
          jobId, 
          exists: !!dbJob,
          status: dbJob?.status || 'not found' 
        });
      } catch (dbError) {
        logger.error('Error checking job in database', {
          jobId,
          error: dbError.message,
          stack: dbError.stack
        });
        throw dbError;
      }

      if (!dbJob) {
        logger.warn('Job not found in Redis or PostgreSQL', { jobId });
        return next(new AppError(404, 'Job not found'));
      }
      
      return res.status(200).json({
        status: 'success',
        data: {
          jobId,
          status: dbJob.status,
          createdAt: dbJob.createdAt.toISOString(),
          completedAt: dbJob.completedAt?.toISOString() || null,
          result: dbJob.result ? {
            enhanced: dbJob.result.enhancedContent,
            metadata: dbJob.result.metadata
          } : null,
          error: dbJob.status === 'failed' ? 'Processing failed' : null
        }
      });
    }

    // Return job status from Redis
    res.status(200).json({
      status: 'success',
      data: {
        jobId,
        status: job.status,
        createdAt: job.createdAt,
        result: job.result || null,
        error: job.error || null
      }
    });
  } catch (error) {
    logger.error('Failed to get job status', { 
      error: error.message, 
      stack: error.stack,
      jobId: req.params.jobId 
    });
    next(new AppError(500, 'Failed to get job status'));
  }
};

export const processJobResult = async (jobId, result) => {
  logger.info('Processing job result', { jobId, resultStatus: result.status });

  try {
    // STEP 1: Check if job exists in Redis
    let exists;
    try {
      exists = await redisService.jobExists(jobId);
      logger.debug('Job existence check', { jobId, exists });
    } catch (existsError) {
      logger.error('Error checking if job exists', {
        jobId, 
        error: existsError.message,
        stack: existsError.stack
      });
      throw existsError;
    }

    if (!exists) {
      logger.warn('Received result for unknown job', { jobId });
      return;
    }

    // STEP 2: Get current job data
    let job;
    try {
      job = await redisService.getJob(jobId);
      logger.debug('Retrieved job from Redis', { jobId, currentStatus: job.status });
    } catch (getJobError) {
      logger.error('Error getting job data', {
        jobId, 
        error: getJobError.message,
        stack: getJobError.stack
      });
      throw getJobError;
    }

    const startTime = new Date(job.processingStartedAt || job.createdAt).getTime();
    const endTime = new Date().getTime();
    const processingTimeMs = endTime - startTime;

    if (result.status === 'success') {
      // STEP 3A: Update job in Redis for success
      try {
        await redisService.updateJob(jobId, {
          status: 'completed',
          result: result.result,
          completedAt: new Date().toISOString()
        });
        logger.debug('Updated Redis job status to completed', { jobId });
      } catch (updateError) {
        logger.error('Error updating job to completed in Redis', {
          jobId, 
          error: updateError.message,
          stack: updateError.stack
        });
        throw updateError;
      }

      // STEP 4A: Update database for success
      try {
        await prismaService.updateRequestStatus(
          jobId,
          'completed',
          new Date(),
          processingTimeMs
        );

        await prismaService.createEnhancementResult(
          jobId,
          result.result.enhanced,
          result.result.metadata,
          result.result.metadata?.model || 'gpt-3.5-turbo',
          result.result.metadata?.tokensUsed || 0
        );

        // Record API usage
        await prismaService.recordApiUsage(
          new Date(),
          null, // userId
          true, // success
          result.result.metadata?.tokensUsed || 0,
          processingTimeMs
        );
        logger.info('Job status updated to completed in database', { jobId });
      } catch (dbError) {
        logger.error('Error updating job in database', {
          jobId, 
          error: dbError.message,
          stack: dbError.stack
        });
        // Continue even if database update fails
        logger.warn('Continuing despite database error');
      }
      
      logger.info('Job status updated to completed', { jobId });
    } else {
      // STEP 3B: Update job in Redis for failure
      try {
        await redisService.updateJob(jobId, {
          status: 'failed',
          error: result.error,
          failedAt: new Date().toISOString()
        });
        logger.debug('Updated Redis job status to failed', { jobId });
      } catch (updateError) {
        logger.error('Error updating job to failed in Redis', {
          jobId, 
          error: updateError.message,
          stack: updateError.stack
        });
        throw updateError;
      }

      // STEP 4B: Update database for failure
      try {
        await prismaService.updateRequestStatus(
          jobId,
          'failed',
          new Date(),
          processingTimeMs
        );

        await prismaService.recordApiUsage(
          new Date(),
          null, // userId
          false, // success
          0, // tokens used
          processingTimeMs
        );
        logger.info('Job status updated to failed in database', { jobId });
      } catch (dbError) {
        logger.error('Error updating job failure in database', {
          jobId, 
          error: dbError.message,
          stack: dbError.stack
        });
        // Continue even if database update fails
        logger.warn('Continuing despite database error');
      }

      logger.info('Job status updated to failed', { jobId, error: result.error });
    }
  } catch (error) {
    logger.error('Error processing job result', { 
      jobId, 
      error: error.message,
      stack: error.stack 
    });
  }
};