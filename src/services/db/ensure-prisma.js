import prismaService from './prisma.service.js';
import logger from '../../utils/logger/index.js';

export const ensurePrismaConnection = async () => {
  try {
    await prismaService.prisma.$queryRaw`SELECT 1 as test`;
    logger.info('Prisma connected successfully');
    return true;
  } catch (error) {
    logger.error('Prisma connection failed:', { 
      error: error.message,
      stack: error.stack
    });
    return false;
  }
};