import { QueueService } from '../../services/queue/queue.service.js';
import { AppError } from '../../utils/errors/appError.js';
import logger from '../../utils/logger/index.js';
import redisService from '../../services/storage/redis.service.js';
import prismaService from '../../services/db/prisma.service.js';


export const generateContent = async (req, res, next) => {
  try {
    const { section, content, context, parameters } = req.body;

    logger.info('Content generation requested', { section });

    const queueService = new QueueService();
    await queueService.connect();

    const correlationId = await queueService.publishEnhancementRequest(
      section,
      content,
      context,
      parameters
    );

    await redisService.setJob(correlationId, {
      status: 'pending',
      createdAt: new Date().toISOString(),
      section,
      contentLength: content?.length
    });

    await prismaService.createEnhancementRequest({
      correlationId,
      section,
      content,
      context,
      parameters,
      ipAddress: req.ip,
      source: req.get('User-Agent')
    });

    logger.info('Enhancement request queued', {
      correlationId,
      section,
      status: 'pending'
    });

    await queueService.close();

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
    logger.error('Content generation request failed', { error: error.message });
    next(new AppError(500, 'Failed to queue content generation request'));
  }
};

export const getJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    logger.info('Checking job status', { jobId });

    const job = await redisService.getJob(jobId);

    if (!job) {
      logger.warn('Job not found in Redis', { jobId });
      const dbJob = await prismaService.getEnhancementWithResult(jobId);


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

    // Return job status
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
    logger.error('Failed to get job status', { error: error.message, jobId: req.params.jobId });
    next(new AppError(500, 'Failed to get job status'));
  }
};

export const processJobResult = async (jobId, result) => {
  logger.info('Processing job result', { jobId, resultStatus: result.status });

  try {
    const exists = await redisService.jobExists(jobId);

    if (!exists) {
      logger.warn('Received result for unknown job', { jobId });
      return;
    }

    const job = await redisService.getJob(jobId);
    logger.debug('Retrieved job from Redis', { jobId, currentStatus: job.status });

    const startTime = new Date(job.processingStartedAt || job.createdAt).getTime();
    const endTime = new Date().getTime();
    const processingTimeMs = endTime - startTime;

    if (result.status === 'success') {
      await redisService.updateJob(jobId, {
        status: 'completed',
        result: result.result,
        completedAt: new Date().toISOString()
      });


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
      logger.info('Job status updated to completed', { jobId });
    } else {
      await redisService.updateJob(jobId, {
        status: 'failed',
        error: result.error,
        failedAt: new Date().toISOString()
      });

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


      logger.info('Job status updated to failed', { jobId, error: result.error });
    }
  } catch (error) {
    logger.error('Error processing job result', { jobId, error: error.message });
  }
};