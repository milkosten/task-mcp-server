#!/usr/bin/env node
/**
 * HTTP wrapper for MCP Task API Server
 * 
 * This server creates an HTTP endpoint that Cursor IDE can connect to
 * while using the MCP SDK server implementation
 */

import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get directory name for the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to the MCP server
const MCP_SERVER_PATH = path.join(__dirname, 'task-manager-mcp-server.js');

// Configure the server
const PORT = process.env.MCP_HTTP_PORT || 3510;

// Setup logging to file to avoid console pollution
const logDebug = (message) => {
  fs.appendFileSync("http_debug.log", `${new Date().toISOString()} - ${message}\n`);
};

const logError = (message) => {
  fs.appendFileSync("http_error.log", `${new Date().toISOString()} - ${message}\n`);
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Only accept POST requests to /mcp endpoint
  if (req.method === 'POST' && req.url === '/mcp') {
    // Set CORS headers to allow requests from Cursor
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Collect request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Parse the JSON body
        const requestData = JSON.parse(body);
        logDebug(`Received request: ${JSON.stringify(requestData)}`);
        
        // Spawn the MCP server process
        const mcpProcess = spawn('node', [MCP_SERVER_PATH]);
        
        // Send the request to the MCP server
        mcpProcess.stdin.write(JSON.stringify(requestData) + '\n');
        
        // Collect response from MCP server
        let responseData = '';
        mcpProcess.stdout.on('data', (data) => {
          responseData += data.toString();
        });
        
        // Handle errors
        mcpProcess.stderr.on('data', (data) => {
          logError(`MCP server error: ${data}`);
        });
        
        // When MCP server is done, send response
        mcpProcess.on('close', (code) => {
          if (code === 0) {
            try {
              // Parse and send the response
              const jsonResponse = JSON.parse(responseData.trim());
              logDebug(`Sending response: ${JSON.stringify(jsonResponse)}`);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(jsonResponse));
            } catch (error) {
              logError(`Error parsing MCP server response: ${error}`);
              res.statusCode = 500;
              res.end(JSON.stringify({
                error: 'Failed to parse MCP server response',
                details: error.message
              }));
            }
          } else {
            // Handle non-zero exit code
            logError(`MCP server exited with code ${code}`);
            res.statusCode = 500;
            res.end(JSON.stringify({
              error: `MCP server exited with code ${code}`,
              output: responseData
            }));
          }
        });
      } catch (error) {
        // Handle JSON parsing error
        logError(`Error parsing request: ${error}`);
        res.statusCode = 400;
        res.end(JSON.stringify({
          error: 'Invalid JSON in request body',
          details: error.message
        }));
      }
    });
  } 
  // Handle OPTIONS requests for CORS preflight
  else if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204; // No content
    res.end();
  }
  // Handle any other request
  else {
    res.statusCode = 404;
    res.end(JSON.stringify({
      error: 'Not found',
      message: 'This server only accepts POST requests to /mcp endpoint'
    }));
  }
});

// Start the server
server.listen(PORT, () => {
  // It's okay to use console.log here since this is not the MCP stdio server
  console.log(`MCP HTTP Server running at http://localhost:${PORT}`);
  console.log(`POST endpoint available at http://localhost:${PORT}/mcp`);
  console.log(`MCP Server path: ${MCP_SERVER_PATH}`);
  console.log('Press Ctrl+C to stop the server');
});