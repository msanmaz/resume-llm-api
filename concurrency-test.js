// concurrency-test.js
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs/promises';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
const API_KEY = process.env.API_KEY || 'api key needed for development';
const CONCURRENCY = process.env.CONCURRENCY ? parseInt(process.env.CONCURRENCY) : 10;
const POLL_INTERVAL = process.env.POLL_INTERVAL ? parseInt(process.env.POLL_INTERVAL) : 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = process.env.MAX_POLL_ATTEMPTS ? parseInt(process.env.MAX_POLL_ATTEMPTS) : 60; // 5 minutes

// Base test data
const baseTestData = {
  section: 'work',
  content: 'Developed a scalable API service using Node.js and Express that processes user data for a resume enhancement system',
  context: {
    role: 'Software Engineer',
    industry: 'Technology',
    experienceLevel: 'mid'
  },
  parameters: {
    temperature: 0.7,
    style: 'professional',
    focusAreas: ['keywords', 'achievements', 'metrics']
  }
};

// Metrics tracking
const metrics = {
  startTime: null,
  endTime: null,
  totalRequests: 0,
  successfulSubmissions: 0,
  failedSubmissions: 0,
  completedJobs: 0,
  failedJobs: 0,
  requestLatencies: [],
  processingTimes: [],
  errors: []
};

// Generate slightly varied test data
function generateTestData(index) {
  const roles = ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'DevOps Engineer'];
  const industries = ['Technology', 'Finance', 'Healthcare', 'Education', 'E-commerce'];
  const levels = ['entry', 'mid', 'senior'];
  const styles = ['professional', 'technical', 'executive'];

  return {
    ...baseTestData,
    content: `${baseTestData.content} - Request ${index}`,
    context: {
      role: roles[index % roles.length],
      industry: industries[index % industries.length],
      experienceLevel: levels[index % levels.length]
    },
    parameters: {
      ...baseTestData.parameters,
      style: styles[index % styles.length]
    }
  };
}

// Submit a job
async function submitJob(testData, index) {
  const startTime = Date.now();
  try {
    console.log(`Submitting job ${index}...`);
    const response = await fetch(`${API_URL}/llm/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(testData)
    });

    const requestLatency = Date.now() - startTime;
    metrics.requestLatencies.push(requestLatency);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to submit job ${index}: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    metrics.successfulSubmissions++;
    console.log(`Job ${index} submitted successfully with ID: ${data.data.jobId} (${requestLatency}ms)`);
    
    return {
      success: true,
      jobId: data.data.jobId,
      submitTime: startTime,
      latency: requestLatency
    };
  } catch (error) {
    metrics.failedSubmissions++;
    metrics.errors.push(`Submission ${index}: ${error.message}`);
    console.error(`Job submission ${index} failed:`, error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Poll for job completion
async function pollForCompletion(jobId, index, submitTime) {
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    try {
      // Wait between polls
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      
      // Check job status
      const response = await fetch(`${API_URL}/llm/status/${jobId}`, {
        headers: {
          'X-API-Key': API_KEY
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to check job ${index} status: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      const jobStatus = data.data.status;
      const progress = data.data.progress || 0;
      
      console.log(`Job ${index} status: ${jobStatus}, Progress: ${progress}%`);
      
      if (jobStatus === 'completed' || jobStatus === 'failed') {
        const processingTime = Date.now() - submitTime;
        metrics.processingTimes.push(processingTime);
        
        if (jobStatus === 'completed') {
          metrics.completedJobs++;
          console.log(`Job ${index} completed in ${processingTime}ms`);
          return { success: true, time: processingTime, result: data.data.result };
        } else {
          metrics.failedJobs++;
          metrics.errors.push(`Job ${index}: Processing failed: ${data.data.error || 'Unknown error'}`);
          console.error(`Job ${index} failed:`, data.data.error);
          return { success: false, error: data.data.error };
        }
      }
      
      attempts++;
    } catch (error) {
      attempts++;
      console.error(`Error polling job ${index}:`, error.message);
      
      // If we've reached the maximum attempts, report failure
      if (attempts >= MAX_POLL_ATTEMPTS) {
        metrics.failedJobs++;
        metrics.errors.push(`Job ${index}: Polling timed out: ${error.message}`);
        return { success: false, error: 'Polling timed out' };
      }
    }
  }
  
  // If we got here, we timed out
  metrics.failedJobs++;
  metrics.errors.push(`Job ${index}: Polling timed out after ${MAX_POLL_ATTEMPTS} attempts`);
  return { success: false, error: 'Polling timed out' };
}

// Display results
function displayResults() {
  const totalTime = metrics.endTime - metrics.startTime;
  
  // Calculate average, min, max for latencies
  const avgRequestLatency = metrics.requestLatencies.length > 0 
    ? metrics.requestLatencies.reduce((sum, time) => sum + time, 0) / metrics.requestLatencies.length 
    : 0;
  const minRequestLatency = metrics.requestLatencies.length > 0 
    ? Math.min(...metrics.requestLatencies) 
    : 0;
  const maxRequestLatency = metrics.requestLatencies.length > 0 
    ? Math.max(...metrics.requestLatencies) 
    : 0;
  
  // Calculate average, min, max for processing times
  const avgProcessingTime = metrics.processingTimes.length > 0 
    ? metrics.processingTimes.reduce((sum, time) => sum + time, 0) / metrics.processingTimes.length 
    : 0;
  const minProcessingTime = metrics.processingTimes.length > 0 
    ? Math.min(...metrics.processingTimes) 
    : 0;
  const maxProcessingTime = metrics.processingTimes.length > 0 
    ? Math.max(...metrics.processingTimes) 
    : 0;
  
  // Calculate throughput and success rates
  const requestThroughput = (metrics.totalRequests / (totalTime / 1000)).toFixed(2);
  const submissionSuccessRate = ((metrics.successfulSubmissions / metrics.totalRequests) * 100).toFixed(2);
  const jobSuccessRate = metrics.successfulSubmissions > 0 
    ? ((metrics.completedJobs / metrics.successfulSubmissions) * 100).toFixed(2) 
    : '0.00';
  
  console.log('\n=== Concurrency Test Results ===');
  console.log(`Concurrency Level: ${CONCURRENCY}`);
  console.log(`Total Test Time: ${(totalTime / 1000).toFixed(2)} seconds`);
  console.log('\nRequest Metrics:');
  console.log(`  Total Requests: ${metrics.totalRequests}`);
  console.log(`  Successful Submissions: ${metrics.successfulSubmissions} (${submissionSuccessRate}%)`);
  console.log(`  Failed Submissions: ${metrics.failedSubmissions}`);
  console.log(`  Completed Jobs: ${metrics.completedJobs} (${jobSuccessRate}% of submissions)`);
  console.log(`  Failed Jobs: ${metrics.failedJobs}`);
  console.log(`  Request Throughput: ${requestThroughput} requests/second`);
  
  console.log('\nPerformance Metrics:');
  console.log(`  Request Latency (time to queue job):`);
  console.log(`    Average: ${avgRequestLatency.toFixed(2)}ms`);
  console.log(`    Min: ${minRequestLatency}ms`);
  console.log(`    Max: ${maxRequestLatency}ms`);
  
  console.log(`  Processing Time (end-to-end):`);
  console.log(`    Average: ${avgProcessingTime.toFixed(2)}ms`);
  console.log(`    Min: ${minProcessingTime}ms`);
  console.log(`    Max: ${maxProcessingTime}ms`);

  if (metrics.errors.length > 0) {
    console.log('\nErrors:');
    metrics.errors.slice(0, 10).forEach((error, i) => {
      console.log(`  ${i+1}. ${error}`);
    });
    
    if (metrics.errors.length > 10) {
      console.log(`  ... and ${metrics.errors.length - 10} more errors`);
    }
  }
}

// Save results to a file
async function saveResultsToFile() {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `concurrency-test-${CONCURRENCY}-${timestamp}.json`;
  
  const results = {
    timestamp: new Date().toISOString(),
    config: {
      concurrency: CONCURRENCY,
      pollInterval: POLL_INTERVAL,
      maxPollAttempts: MAX_POLL_ATTEMPTS
    },
    metrics: metrics
  };
  
  try {
    await fs.writeFile(filename, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to ${filename}`);
  } catch (error) {
    console.error('Failed to save results:', error);
  }
}

// Run the concurrency test
async function runConcurrencyTest() {
  console.log(`Starting concurrency test with ${CONCURRENCY} concurrent requests...`);
  
  metrics.startTime = Date.now();
  metrics.totalRequests = CONCURRENCY;
  
  // Submit all jobs
  const submitPromises = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    const testData = generateTestData(i);
    submitPromises.push(submitJob(testData, i));
  }
  
  // Wait for all submissions
  const submissionResults = await Promise.all(submitPromises);
  
  // Start polling for each successful submission
  const pollPromises = submissionResults
    .filter(result => result.success)
    .map((result, i) => 
      pollForCompletion(result.jobId, i, result.submitTime)
    );
  
  // Wait for all polls to complete
  await Promise.all(pollPromises);
  
  metrics.endTime = Date.now();
  
  // Display results
  displayResults();
  
  // Save results to file
  await saveResultsToFile();
}

// Run the test
runConcurrencyTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});