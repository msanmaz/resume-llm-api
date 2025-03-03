// test-llm-integration.js
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
const API_KEY = process.env.API_KEY || 'api key needed for development';

// Test data
const testData = {
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

async function runIntegrationTest() {
  console.log('Starting LLM API integration test...');
  console.log('Test data:', JSON.stringify(testData, null, 2));
  
  try {
    // Step 1: Submit a job
    console.log('\nSubmitting job...');
    const submitResponse = await fetch(`${API_URL}/llm/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(testData)
    });
    
    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`Failed to submit job: ${submitResponse.status} ${errorText}`);
    }
    
    const submitData = await submitResponse.json();
    console.log('Response:', JSON.stringify(submitData, null, 2));
    
    if (submitData.status !== 'success') {
      throw new Error(`Job submission failed: ${submitData.message}`);
    }
    
    const jobId = submitData.data.jobId;
    console.log(`Job submitted successfully with ID: ${jobId}`);
    
    // Step 2: Poll for job completion
    console.log('\nPolling for job completion...');
    let isComplete = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes if polling every 5 seconds
    
    while (!isComplete && attempts < maxAttempts) {
      // Wait between polls
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
      
      // Check job status
      const statusResponse = await fetch(`${API_URL}/llm/status/${jobId}`, {
        headers: {
          'X-API-Key': API_KEY
        }
      });
      
      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new Error(`Failed to check job status: ${statusResponse.status} ${errorText}`);
      }
      
      const statusData = await statusResponse.json();
      
      if (statusData.status !== 'success') {
        throw new Error(`Job status check failed: ${statusData.message}`);
      }
      
      const jobStatus = statusData.data.status;
      const progress = statusData.data.progress || 0;
      
      console.log(`Attempt ${attempts + 1}: Status: ${jobStatus}, Progress: ${progress}%`);
      
      if (jobStatus === 'completed' || jobStatus === 'failed') {
        isComplete = true;
        
        if (jobStatus === 'completed') {
          console.log('\nJob completed successfully!');
          console.log('\nOriginal content:');
          console.log(testData.content);
          console.log('\nEnhanced content:');
          console.log(statusData.data.result.enhanced);
        } else {
          console.error('\nJob failed!');
          console.error('Error:', statusData.data.error);
        }
      }
      
      attempts++;
    }
    
    if (!isComplete) {
      throw new Error('Test timed out waiting for job completion');
    }
    
    console.log('\nTest completed successfully');
  } catch (error) {
    console.error('\nTest failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runIntegrationTest();