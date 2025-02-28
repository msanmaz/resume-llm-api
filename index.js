#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Dynamically resolve the path to server.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to import server dynamically
try {
  const serverPath = join(__dirname, 'src', 'server.js');
  console.log(`Attempting to load server from: ${serverPath}`);
  await import(serverPath);
} catch (error) {
  console.error('Failed to load server:', error);
  process.exit(1);
}