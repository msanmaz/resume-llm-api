import amqp from 'amqplib';
import dotenv from 'dotenv';

dotenv.config();

// Simple helper to mask sensitive parts of URL for logging
const safeRabbitMqUrl = (url) => {
  if (!url) return 'undefined';
  try {
    // For AMQP URLs, we need special handling as they have a different format
    // amqp://user:pass@hostname:port/vhost
    const matches = url.match(/^(amqp[s]?:\/\/)([^:]+):([^@]+)@(.+)$/);
    if (matches) {
      return `${matches[1]}${matches[2]}:***@${matches[4]}`;
    }
    return url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  } catch (e) {
    return 'invalid-url-format';
  }
};

const testRabbitMqConnection = async () => {
  console.log('RabbitMQ Connection Test - Starting');
  console.log('==========================================');
  
  // Get RabbitMQ URL from environment
  const rabbitMqUrl = process.env.RABBITMQ_URL;
  console.log(`RabbitMQ URL (safe): ${safeRabbitMqUrl(rabbitMqUrl)}`);
  
  if (!rabbitMqUrl) {
    console.error('ERROR: RABBITMQ_URL environment variable is not set');
    process.exit(1);
  }
  
  let connection;
  let channel;
  
  try {
    console.log('Creating RabbitMQ connection...');
    connection = await amqp.connect(rabbitMqUrl);
    console.log('Connection established successfully');
    
    console.log('Creating channel...');
    channel = await connection.createChannel();
    console.log('Channel created successfully');
    
    // Define test queue
    const testQueueName = 'test-queue-' + Math.random().toString(36).substring(2, 8);
    console.log(`Asserting test queue: ${testQueueName}`);
    await channel.assertQueue(testQueueName, { durable: false });
    console.log('Queue created successfully');
    
    // Send a test message
    const testMessage = { test: true, timestamp: new Date().toISOString() };
    console.log('Sending test message:', testMessage);
    const sent = channel.sendToQueue(testQueueName, Buffer.from(JSON.stringify(testMessage)));
    console.log(`Message sent: ${sent}`);
    
    // Consume the message back
    console.log('Setting up consumer to receive the test message...');
    const receivedMessage = await new Promise((resolve) => {
      channel.consume(testQueueName, (msg) => {
        if (msg) {
          channel.ack(msg);
          resolve(JSON.parse(msg.content.toString()));
        }
      });
    });
    
    console.log('Received message:', receivedMessage);
    
    // Clean up by deleting the test queue
    console.log(`Deleting test queue: ${testQueueName}`);
    await channel.deleteQueue(testQueueName);
    console.log('Queue deleted successfully');
    
    console.log('==========================================');
    console.log('RabbitMQ connection test completed successfully!');
    
  } catch (error) {
    console.error('RabbitMQ connection test failed:');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    process.exit(1);
  } finally {
    if (channel) {
      console.log('Closing channel...');
      await channel.close();
      console.log('Channel closed');
    }
    if (connection) {
      console.log('Closing connection...');
      await connection.close();
      console.log('Connection closed');
    }
    process.exit(0);
  }
};

testRabbitMqConnection().catch(err => {
  console.error('Unhandled error in test:', err);
  process.exit(1);
});