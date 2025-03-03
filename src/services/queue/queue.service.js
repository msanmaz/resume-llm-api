import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/environment.js';
import logger from '../../utils/logger/index.js';

/**
 * Service to handle RabbitMQ queue operations
 */
export class QueueService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.connected = false;
    this.pendingRequests = new Map(); // Store pending requests by correlation ID
  }

  /**
   * Connect to RabbitMQ server
   */
  async connect() {
    try {
      if (this.connected) return;

      logger.info('Connecting to RabbitMQ server', { url: config.rabbitmq.url });
      this.connection = await amqp.connect(config.rabbitmq.url);
      
      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.connected = false;
        setTimeout(() => this.connect(), 5000);
      });
      
      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error', { error: err.message });
        this.connected = false;
      });
      
      this.channel = await this.connection.createChannel();
      
      await this.channel.prefetch(config.rabbitmq.prefetch);
      
      await this.channel.assertQueue(config.rabbitmq.queues.llmRequests, { 
        durable: true 
      });
      
      await this.channel.assertQueue(config.rabbitmq.queues.llmResults, { 
        durable: true 
      });
      
      this.connected = true;
      logger.info('Connected to RabbitMQ successfully');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ', { error: error.message });
      this.connected = false;
      throw error;
    }
  }

  /**
   * Publish an enhancement request to the queue
   * @param {string} section Section of resume
   * @param {string} content Original content
   * @param {Object} context Context data
   * @param {Object} parameters Enhancement parameters
   * @returns {Promise<string>} Correlation ID for tracking the request
   */
  async publishEnhancementRequest(section, content, context = {}, parameters = {}) {
    if (!this.connected) {
      await this.connect();
    }

    const correlationId = uuidv4();
    const request = {
      correlationId,
      section,
      content,
      context,
      parameters,
      timestamp: new Date().toISOString()
    };

    try {
      await this.channel.sendToQueue(
        config.rabbitmq.queues.llmRequests,
        Buffer.from(JSON.stringify(request)),
        { 
          persistent: true,
          correlationId,
          messageId: uuidv4(),
          timestamp: Date.now()
        }
      );

      logger.info('Enhancement request published to queue', { 
        correlationId, 
        section, 
        contentLength: content.length 
      });

      return correlationId;
    } catch (error) {
      logger.error('Failed to publish enhancement request', { 
        error: error.message, 
        correlationId 
      });
      throw error;
    }
  }

  /**
   * Set up a consumer to process enhancement requests from the queue
   * @param {Function} processCallback Function to process the enhancement request
   */
  async consumeEnhancementRequests(processCallback) {
    if (!this.connected) {
      await this.connect();
    }
  
    console.log("DEBUG: Setting up consumer for queue", {
      queueName: config.rabbitmq.queues.llmRequests,
      callbackExists: typeof processCallback === 'function'
    });
  
    try {
      await this.channel.consume(
        config.rabbitmq.queues.llmRequests,
        async (msg) => {
          if (!msg) {
            console.log("DEBUG: Received null message");
            return;
          }
  
          console.log("DEBUG: Received message with properties:", {
            messageId: msg.properties.messageId,
            correlationId: msg.properties.correlationId,
            contentType: msg.properties.contentType,
            headers: msg.properties.headers
          });
  
          try {
            // Parse message content
            const msgContent = JSON.parse(msg.content.toString());
            console.log("DEBUG: Parsed message content keys:", Object.keys(msgContent));
            
            const { correlationId, section, content, context, parameters } = msgContent;
            
            console.log("DEBUG: Extracted message data:", {
              correlationId,
              section,
              contentType: typeof content,
              contentLength: content ? content.length : 'undefined',
              contextType: typeof context,
              contextKeys: context ? Object.keys(context) : 'undefined',
              parametersKeys: parameters ? Object.keys(parameters) : 'undefined'
            });
  
            // Enhance context with correlationId
            const enhancedContext = {
              ...(context || {}),
              correlationId
            };
            
            console.log("DEBUG: Enhanced context:", {
              originalContext: context,
              enhancedContext: enhancedContext,
              correlationIdInEnhanced: enhancedContext.correlationId
            });
  
            try {
              console.log("DEBUG: Calling process callback");
              const result = await processCallback(
                section, 
                content, 
                enhancedContext, 
                parameters
              );
              
              console.log("DEBUG: Process callback returned result:", {
                hasResult: Boolean(result),
                resultType: typeof result,
                resultKeys: result ? Object.keys(result) : 'none'
              });
              
              this.channel.ack(msg);
              console.log("DEBUG: Message acknowledged:", correlationId);
              
            } catch (error) {
              console.log("ERROR: Process callback failed:", {
                error: error.message,
                stack: error.stack,
                correlationId,
                section
              });
              
              this.channel.nack(msg, false, true);
              console.log("DEBUG: Message negatively acknowledged (requeued):", correlationId);
            }
          } catch (parseError) {
            console.log("ERROR: Failed to parse message:", {
              error: parseError.message,
              content: msg.content.toString().substring(0, 100) + '...',
              properties: msg.properties
            });
            
            this.channel.nack(msg, false, false);
            console.log("DEBUG: Message negatively acknowledged (not requeued) due to parsing error");
          }
        },
        { noAck: false } // We handle acknowledgments manually
      );
  
      console.log("DEBUG: Consumer setup complete");
    } catch (error) {
      console.log("ERROR: Failed to set up consumer:", {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Publish an enhancement result to the results queue
   * @param {string} correlationId Correlation ID of the original request
   * @param {Object} result Enhancement result
   */
  async publishEnhancementResult(correlationId, result) {
    if (!this.connected) {
      await this.connect();
    }

    logger.info('Publishing enhancement result to queue', { 
      correlationId, 
      resultSize: JSON.stringify(result).length
    });
  

    try {
      await this.channel.sendToQueue(
        config.rabbitmq.queues.llmResults,
        Buffer.from(JSON.stringify({
          correlationId,
          status: 'success',
          result,
          timestamp: new Date().toISOString()
        })),
        { 
          persistent: true,
          correlationId,
          messageId: uuidv4(),
          timestamp: Date.now()
        }
      );

      logger.info('Enhancement result published to queue', { correlationId });
    } catch (error) {
      logger.error('Failed to publish enhancement result', { 
        error: error.message, 
        correlationId 
      });
      throw error;
    }
  }

  /**
   * Publish an enhancement error to the results queue
   * @param {string} correlationId Correlation ID of the original request
   * @param {string} errorMessage Error message
   */
  async publishEnhancementError(correlationId, errorMessage) {
    if (!this.connected) {
      await this.connect();
    }

    try {
      await this.channel.sendToQueue(
        config.rabbitmq.queues.llmResults,
        Buffer.from(JSON.stringify({
          correlationId,
          status: 'error',
          error: errorMessage,
          timestamp: new Date().toISOString()
        })),
        { 
          persistent: true,
          correlationId,
          messageId: uuidv4(),
          timestamp: Date.now()
        }
      );

      logger.info('Enhancement error published to queue', { 
        correlationId, 
        error: errorMessage 
      });
    } catch (error) {
      logger.error('Failed to publish enhancement error', { 
        error: error.message, 
        correlationId 
      });
      throw error;
    }
  }

  /**
   * Close RabbitMQ connection
   */
  async close() {
    if (this.channel) {
      await this.channel.close();
    }
    
    if (this.connection) {
      await this.connection.close();
    }
    
    this.connected = false;
    logger.info('RabbitMQ connection closed');
  }
}

export default QueueService;