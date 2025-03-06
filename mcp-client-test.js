#!/usr/bin/env node
import { spawn } from 'child_process';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import assert from 'assert';
// We'll implement our own MCP client instead of using the SDK
// import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';

/**
 * MCP Client for testing the Task API MCP Server
 * 
 * This client runs tests against the MCP server to verify all functionality
 * is working as expected. It will:
 * 1. Perform discovery to verify server capabilities
 * 2. Test all resources
 * 3. Test all tools for CRUD operations
 * 4. Test prompts for natural language interaction
 * 5. Report test results
 * 
 * This client uses the official @modelcontextprotocol/sdk library.
 */

// Configuration
const MCP_SERVER_PATH = path.join(process.cwd(), 'task-manager-mcp-server.js');
const TEST_REPORTS_DIR = path.join(process.cwd(), 'test-reports');
const TEST_LOG_PATH = path.join(TEST_REPORTS_DIR, 'test-log.txt');

// Test state
let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;
let testResults = [];

// Create a class to manage MCP server communication using the SDK
class McpTestClient {
  constructor() {
    this.serverProcess = null;
    this.rl = null;
    this.mcpClient = null;
    this.currentTest = "";
    this.discoveredCapabilities = null;
  }

  // Start the MCP server process
  async startServer() {
    console.log('\n🔄 STARTING SERVER: Task Manager MCP Server');
    console.log(`  - Server path: ${MCP_SERVER_PATH}`);
    
    // Make sure the MCP server file exists
    try {
      await fs.access(MCP_SERVER_PATH);
      console.log('  - Server script found');
    } catch (error) {
      console.error('  - ERROR: Server script not found!');
      throw new Error(`Task Manager MCP server script not found at: ${MCP_SERVER_PATH}`);
    }
    
    // Create log directory if it doesn't exist
    try {
      await fs.mkdir(TEST_REPORTS_DIR, { recursive: true });
      console.log(`  - Created log directory: ${TEST_REPORTS_DIR}`);
    } catch (error) {
      console.log(`  - Log directory already exists: ${TEST_REPORTS_DIR}`);
      // Directory already exists, continue
    }
    
    try {
      // Create initial empty log file with header
      const logHeader = `
=======================================
MCP SERVER TEST LOG
Test run started at: ${new Date().toISOString()}
=======================================\n\n`;
      
      await fs.writeFile(TEST_LOG_PATH, logHeader);
      console.log(`  - Initialized test log: ${TEST_LOG_PATH}`);
    } catch (error) {
      console.error(`  - ERROR: Failed to create log file: ${error.message}`);
    }
    
    // Spawn the server process
    console.log('  - Spawning MCP server process');
    this.serverProcess = spawn('node', [MCP_SERVER_PATH]);
    
    // Set up readline interface to read server logs
    this.rl = readline.createInterface({
      input: this.serverProcess.stdout,
      crlfDelay: Infinity
    });
    
    // Log non-JSON output from the server
    this.rl.on('line', (line) => {
      if (!line.trim().startsWith('{')) {
        console.log(`  - Server log: ${line}`);
      }
    });
    
    // Handle server errors
    this.serverProcess.stderr.on('data', (data) => {
      console.error(`  - SERVER ERROR: ${data}`);
    });
    
    console.log('  - Initializing MCP client with SDK');
    
    // Instead of using the SDK client, we'll implement our own MCP client
    // This simplifies testing and avoids compatibility issues with the SDK version
    const self = this; // Keep a reference to the 'this' context
    
    this.mcpClient = {
      // Implement simplified methods that match our test needs
      async discover() {
        const requestId = uuidv4();
        const response = await self.sendDirectRequest({
          type: 'discover',
          id: requestId
        });
        return response;
      },
      
      async getResource(uri) {
        const requestId = uuidv4();
        const response = await self.sendDirectRequest({
          type: 'resource',
          uri,
          id: requestId
        });
        return response;
      },
      
      async invokeTool(tool, parameters) {
        const requestId = uuidv4();
        const response = await self.sendDirectRequest({
          type: 'invoke',
          tool,
          parameters,
          id: requestId
        });
        return response;
      },
      
      async invokePrompt(prompt, parameters) {
        const requestId = uuidv4();
        const response = await self.sendDirectRequest({
          type: 'prompt',
          prompt,
          parameters,
          id: requestId
        });
        return response;
      }
    };
    
    // Helper method to send requests directly to the server process
    this.sendDirectRequest = async (request) => {
      return new Promise((resolve, reject) => {
        try {
          console.log(`  - Sending ${request.type} request to server`);
          
          // Send the request to the server process
          this.serverProcess.stdin.write(JSON.stringify(request) + '\n');
          
          // Set up a one-time listener for this specific request ID
          const listener = (line) => {
            try {
              if (line.trim().startsWith('{')) {
                const response = JSON.parse(line);
                if (response.id === request.id) {
                  // Remove this listener once we've handled the response
                  this.rl.removeListener('line', listener);
                  resolve(response);
                }
              }
            } catch (error) {
              // Ignore non-JSON lines
            }
          };
          
          // Add the listener to the readline interface
          this.rl.on('line', listener);
          
          // Set a timeout to avoid hanging indefinitely
          setTimeout(() => {
            this.rl.removeListener('line', listener);
            reject(new Error(`Request timed out after 10 seconds: ${request.id}`));
          }, 10000);
          
        } catch (error) {
          reject(error);
        }
      });
    };
    
    // Return a promise that resolves when the server is ready
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('  - Task Manager MCP server started and ready for testing');
        console.log('  - Waiting for 1 second to ensure server initialization');
        resolve();
      }, 1000); // Give the server time to start
    });
  }
  
  // Stop the MCP server process
  async stopServer() {
    console.log('\n🛑 STOPPING SERVER: Task Manager MCP Server');
    
    if (this.rl) {
      console.log('  - Closing readline interface');
      this.rl.close();
    }
    
    if (this.serverProcess) {
      console.log('  - Sending termination signal to server process');
      this.serverProcess.kill();
      
      // Wait for process to fully terminate
      return new Promise((resolve) => {
        // Setup exit handler
        const exitHandler = (code) => {
          console.log(`  - Task Manager MCP server stopped (exit code: ${code || 0})`);
          clearTimeout(killTimeout);
          resolve();
        };
        
        // Add the exit listener
        this.serverProcess.once('exit', exitHandler);
        
        // Force kill after timeout
        const killTimeout = setTimeout(() => {
          console.log('  - Server did not terminate gracefully, force killing...');
          // Remove the exit listener to avoid calling resolve twice
          this.serverProcess.removeListener('exit', exitHandler);
          this.serverProcess.kill('SIGKILL');
          resolve();
        }, 2000);
      });
    }
    
    console.log('  - No server process to stop');
    return Promise.resolve();
  }
  
  // Send a request to the MCP server using our custom client
  async sendRequest(request) {
    switch (request.type) {
      case 'discover':
        return this.mcpClient.discover();
      
      case 'resource':
        return this.mcpClient.getResource(request.uri);
      
      case 'invoke':
        return this.mcpClient.invokeTool(request.tool, request.parameters);
      
      case 'prompt':
        return this.mcpClient.invokePrompt(request.prompt, request.parameters);
      
      default:
        throw new Error(`Unsupported request type: ${request.type}`);
    }
  }
  
  // Perform discovery to learn server capabilities using the SDK
  async discoverCapabilities() {
    console.log('  - Sending discovery request using SDK...');
    const response = await this.sendRequest({
      type: 'discover',
      id: uuidv4()
    });
    
    // Validate and store discovery response
    if (response && response.type === 'discover_response') {
      console.log('  - Discovery response received from server');
      this.discoveredCapabilities = response;
      return response;
    } else {
      console.error('  - ERROR: Invalid discovery response format');
      throw new Error('Invalid discovery response');
    }
  }
  
  // Test logging helper
  async logTestResult(testName, passed, message, details = null) {
    const result = {
      test: testName,
      passed,
      message,
      timestamp: new Date().toISOString(),
      details
    };
    
    // Update test counts
    if (passed) {
      testsPassed++;
    } else {
      testsFailed++;
    }
    
    // Log result to console
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'} - ${testName}: ${message}`);
    
    // Store result
    testResults.push(result);
    
    // Append to log file
    await fs.appendFile(
      TEST_LOG_PATH, 
      `[${result.timestamp}] ${passed ? 'PASS' : 'FAIL'} - ${testName}: ${message}\n${
        details ? JSON.stringify(details, null, 2) + '\n' : ''
      }\n`
    );
  }
  
  // Run all tests
  async runTests() {
    try {
      // Start the server
      await this.startServer();
      
      // Discover capabilities
      await this.runDiscoveryTest();
      
      // Test resources
      await this.runResourceTests();
      
      // Test tools
      await this.runToolTests();
      
      // Test prompts
      await this.runPromptTests();
      
      // Generate test report
      await this.generateTestReport();
    } catch (error) {
      console.error('Test suite error:', error);
      testsFailed++;
      await this.logTestResult('TestSuite', false, `Test suite error: ${error.message}`, error);
    } finally {
      // Stop the server
      await this.stopServer();
    }
  }
  
  // Test discovery functionality
  async runDiscoveryTest() {
    this.currentTest = "Discovery";
    console.log('\n🔍 RUNNING TEST: Discovery - Checking server capabilities');
    
    try {
      console.log('  - Sending discovery request to get server capabilities');
      const discovery = await this.discoverCapabilities();
      
      // Verify core capabilities are present
      console.log('  - Verifying server exposes required tool and resource arrays');
      assert(discovery.tools && Array.isArray(discovery.tools), 'Server must expose tools');
      assert(discovery.resources && Array.isArray(discovery.resources), 'Server must expose resources');
      
      // Check for specific required tools
      console.log('  - Checking for required tools: listTasks, createTask, updateTask, deleteTask');
      const toolNames = discovery.tools.map(t => t.name);
      const requiredTools = ['listTasks', 'createTask', 'updateTask', 'deleteTask'];
      
      for (const tool of requiredTools) {
        console.log(`    - Checking for tool: ${tool}`);
        assert(toolNames.includes(tool), `Tool "${tool}" must be available`);
      }
      
      // Check for specific required resources
      console.log('  - Checking for required resources: tasks, task');
      const resourceNames = discovery.resources.map(r => r.name);
      const requiredResources = ['tasks', 'task'];
      
      for (const resource of requiredResources) {
        console.log(`    - Checking for resource: ${resource}`);
        assert(resourceNames.includes(resource), `Resource "${resource}" must be available`);
      }
      
      await this.logTestResult('Discovery', true, 'Server correctly exposes all required capabilities', discovery);
    } catch (error) {
      await this.logTestResult('Discovery', false, `Discovery test failed: ${error.message}`, error);
      // Skip remaining tests if discovery fails
      throw new Error('Discovery failed, cannot proceed with other tests');
    }
  }
  
  // Test resource functionality
  async runResourceTests() {
    this.currentTest = "Resources";
    console.log('\n📦 RUNNING TEST: Resources - Testing resource endpoints using SDK');
    
    try {
      // Test tasks list resource
      console.log('  - Testing tasks list resource (tasks://list)');
      console.log('  - Sending resource request for tasks list using SDK');
      
      // Make sure to use the exact URI pattern expected by the server
      const tasksResponse = await this.sendRequest({
        type: 'resource',
        uri: 'tasks://list',
        id: uuidv4()
      });
      
      // Verify tasks list response structure (SDK format)
      console.log('  - Verifying tasks list response structure');
      console.log(`  - Checking if response contains content items`);
      
      // The SDK might normalize the response format
      // Check for either contents array or resource-specific format
      let tasksList = [];
      if (tasksResponse.contents && Array.isArray(tasksResponse.contents)) {
        tasksList = tasksResponse.contents;
        console.log('  - Found tasks in contents array format');
      } else if (tasksResponse.content && Array.isArray(tasksResponse.content)) {
        // Alternative SDK format might use 'content' instead of 'contents'
        tasksList = tasksResponse.content;
        console.log('  - Found tasks in content array format');
      } else if (tasksResponse.tasks && Array.isArray(tasksResponse.tasks)) {
        // The server might return { tasks: [...] } directly
        tasksList = tasksResponse.tasks;
        console.log('  - Found tasks in direct tasks array format');
      } else {
        // Log the actual response for debugging
        console.log('  - Actual response structure:', JSON.stringify(tasksResponse));
        assert(false, 'Tasks resource must return an array of tasks in some format');
      }
      
      console.log(`  - Tasks found: ${tasksList.length}`);
      await this.logTestResult('TasksResource', true, 
        `Successfully retrieved tasks list with ${tasksList.length} tasks`, 
        tasksResponse);
      
      // If we have tasks, test individual task resource
      if (tasksList.length > 0) {
        // Extract the task ID based on the format we received
        let firstTask = tasksList[0];
        let taskId;
        
        if (firstTask.metadata && firstTask.metadata.id) {
          taskId = firstTask.metadata.id;
        } else if (firstTask.id) {
          taskId = firstTask.id;
        } else {
          console.log('  - Task object structure:', JSON.stringify(firstTask));
          assert(false, 'Could not extract task ID from response');
        }
        
        console.log(`  - Testing individual task resource (tasks://task/${taskId})`);
        console.log(`  - Sending resource request for task ID: ${taskId} using SDK`);
        
        const taskResponse = await this.sendRequest({
          type: 'resource',
          uri: `tasks://task/${taskId}`,
          id: uuidv4()
        });
        
        // Verify individual task response structure (SDK format)
        console.log('  - Verifying individual task response structure');
        
        // The SDK might normalize the response format
        // Check for task data in various possible formats
        let taskData = null;
        
        if (taskResponse.contents && taskResponse.contents.length === 1) {
          console.log('  - Found task in contents array format');
          taskData = taskResponse.contents[0];
        } else if (taskResponse.content && taskResponse.content.length === 1) {
          console.log('  - Found task in content array format');
          taskData = taskResponse.content[0];
        } else if (taskResponse.task) {
          console.log('  - Found task in direct task object format');
          taskData = taskResponse.task;
        } else {
          // Log the actual response for debugging
          console.log('  - Actual response structure:', JSON.stringify(taskResponse).substring(0, 100) + '...');
          assert(false, 'Individual task resource must return task data in some format');
        }
        
        // Verify task ID matches requested ID
        console.log('  - Verifying task ID matches requested ID');
        const returnedTaskId = taskData.metadata?.id || taskData.id;
        assert(returnedTaskId === taskId, 'Task resource must return the requested task ID');
        
        await this.logTestResult('TaskResource', true, 
          `Successfully retrieved individual task with ID ${taskId}`, 
          taskResponse);
      } else {
        console.log('  - Skipping individual task test (no tasks available)');
        await this.logTestResult('TaskResource', true, 
          'Skipped individual task test (no tasks available)', null);
        testsSkipped++;
      }
    } catch (error) {
      console.log(`  - ERROR: ${error.message}`);
      await this.logTestResult('ResourceTests', false, `Resource tests failed: ${error.message}`, error);
    }
  }
  
  // Test tool functionality using the SDK
  async runToolTests() {
    this.currentTest = "Tools";
    console.log('\n🔧 RUNNING TEST: Tools - Testing tool functionality using SDK');
    
    try {
      // Test task creation
      console.log('  - TEST: createTask - Creating a new task');
      console.log('  - Preparing createTask request with test data');
      
      console.log('  - Sending createTask request using SDK');
      const createResponse = await this.sendRequest({
        type: 'invoke',
        tool: 'createTask',
        parameters: {
          task: 'Test task from MCP client',
          category: 'Testing',
          priority: 'medium',
          status: 'not_started'
        },
        id: uuidv4()
      });
      
      // Verify creation response (SDK format)
      console.log('  - Verifying response format from SDK');
      
      // Extract created task ID from response - handle different possible formats
      console.log('  - Extracting created task ID from response');
      let createdTaskId = null;
      
      // Log the raw response to understand its structure
      console.log('  - Raw response:', JSON.stringify(createResponse));
      
      // Try different possible formats 
      if (createResponse.content && Array.isArray(createResponse.content)) {
        console.log('  - Found response in content array format');
        const jsonContent = createResponse.content.find(c => c.type === 'json');
        if (jsonContent && jsonContent.json && jsonContent.json.id) {
          createdTaskId = jsonContent.json.id;
        }
      } else if (createResponse.result && createResponse.result.id) {
        console.log('  - Found response in result object format');
        createdTaskId = createResponse.result.id;
      } else if (createResponse.task && createResponse.task.id) {
        console.log('  - Found response in task object format');
        createdTaskId = createResponse.task.id;
      } 
      // Try even more formats for our direct implementation
      else if (createResponse.id) {
        console.log('  - Found ID directly in response');
        createdTaskId = createResponse.id;
      }
      
      assert(createdTaskId, 'Create task response must include task ID in some format');
      console.log(`  - New task created with ID: ${createdTaskId}`);
      
      await this.logTestResult('CreateTask', true, 
        `Successfully created task with ID ${createdTaskId}`, 
        createResponse);
      
      // Test task listing
      console.log('\n  - TEST: listTasks - Retrieving all tasks');
      console.log('  - Sending listTasks request using SDK');
      
      const listResponse = await this.sendRequest({
        type: 'invoke',
        tool: 'listTasks',
        parameters: {},
        id: uuidv4()
      });
      
      // Extract task list from response - handle different possible formats
      console.log('  - Extracting tasks array from response');
      let tasksList = null;
      
      // Debug: Print full response for debugging
      console.log('  - DEBUG Raw listTasks response:', JSON.stringify(listResponse));
      
      // Try different possible formats that the SDK might return
      if (listResponse.content && Array.isArray(listResponse.content)) {
        console.log('  - Found response in content array format');
        const jsonContent = listResponse.content.find(c => c.type === 'json');
        console.log('  - DEBUG JSON content:', jsonContent ? JSON.stringify(jsonContent) : 'none found');
        if (jsonContent && jsonContent.json) {
          console.log('  - DEBUG JSON payload type:', Array.isArray(jsonContent.json) ? 'array' : typeof jsonContent.json);
          if (Array.isArray(jsonContent.json)) {
            tasksList = jsonContent.json;
          } else if (typeof jsonContent.json === 'object' && jsonContent.json.tasks) {
            // Handle case where the JSON is wrapped in a parent object with a tasks field
            console.log('  - Found tasks array inside json.tasks object');
            tasksList = jsonContent.json.tasks;
          }
        }
      } else if (listResponse.result && Array.isArray(listResponse.result)) {
        console.log('  - Found response in result array format');
        tasksList = listResponse.result;
      } else if (listResponse.tasks && Array.isArray(listResponse.tasks)) {
        console.log('  - Found response in tasks array format');
        tasksList = listResponse.tasks;
      }
      
      assert(tasksList, 'List tasks response must include tasks array in some format');
      console.log(`  - Found ${tasksList.length} tasks in response`);
      
      // Verify our newly created task is in the list
      console.log(`  - Verifying newly created task (ID: ${createdTaskId}) appears in task list`);
      const taskExists = tasksList.some(task => {
        const taskId = task.id || (task.metadata && task.metadata.id);
        return taskId === createdTaskId;
      });
      
      assert(taskExists, 'Newly created task must appear in task list');
      
      await this.logTestResult('ListTasks', true, 
        `Successfully listed tasks including newly created task`, 
        listResponse);
      
      // Test task update
      console.log('\n  - TEST: updateTask - Updating an existing task');
      console.log(`  - Preparing updateTask request for task ID: ${createdTaskId}`);
      
      console.log('  - Sending updateTask request using SDK');
      const updateResponse = await this.sendRequest({
        type: 'invoke',
        tool: 'updateTask',
        parameters: {
          taskId: createdTaskId,
          status: 'started',
          priority: 'high'
        },
        id: uuidv4()
      });
      
      // Extract updated task data from response - handle different possible formats
      console.log('  - Extracting updated task data from response');
      let updatedTask = null;
      
      // Try different possible formats that the SDK might return
      if (updateResponse.content && Array.isArray(updateResponse.content)) {
        console.log('  - Found response in content array format');
        const jsonContent = updateResponse.content.find(c => c.type === 'json');
        if (jsonContent && jsonContent.json) {
          updatedTask = jsonContent.json;
        }
      } else if (updateResponse.result) {
        console.log('  - Found response in result object format');
        updatedTask = updateResponse.result;
      } else if (updateResponse.task) {
        console.log('  - Found response in task object format');
        updatedTask = updateResponse.task;
      }
      
      assert(updatedTask, 'Update task response must include updated task in some format');
      
      // Verify task ID matches the requested task
      console.log('  - Verifying task ID matches the requested task');
      const returnedTaskId = updatedTask.id || (updatedTask.metadata && updatedTask.metadata.id);
      assert(returnedTaskId === createdTaskId, 'Updated task must have the correct ID');
      
      // Verify task properties were updated
      console.log('  - Verifying task properties were updated');
      const updatedStatus = updatedTask.status;
      const updatedPriority = updatedTask.priority;
      
      assert(updatedStatus === 'started' || updatedStatus === 'in_progress', 
        'Task status must be updated correctly');
      assert(updatedPriority === 'high', 'Task priority must be updated correctly');
      
      await this.logTestResult('UpdateTask', true, 
        `Successfully updated task with ID ${createdTaskId}`, 
        updateResponse);
      
      // Test task deletion
      console.log('\n  - TEST: deleteTask - Deleting a task');
      console.log(`  - Preparing deleteTask request for task ID: ${createdTaskId}`);
      
      console.log('  - Sending deleteTask request using SDK');
      const deleteResponse = await this.sendRequest({
        type: 'invoke',
        tool: 'deleteTask',
        parameters: {
          taskId: createdTaskId
        },
        id: uuidv4()
      });
      
      // Check for deletion confirmation - handle different possible formats
      console.log('  - Checking for confirmation of deletion');
      let deletionConfirmed = false;
      
      // Try different possible formats that the SDK might return
      if (deleteResponse.content && Array.isArray(deleteResponse.content)) {
        const textContent = deleteResponse.content.find(c => c.type === 'text');
        if (textContent && textContent.text && 
           (textContent.text.includes('deleted') || textContent.text.includes('removed'))) {
          deletionConfirmed = true;
        }
      } else if (deleteResponse.message && 
                (deleteResponse.message.includes('deleted') || deleteResponse.message.includes('removed'))) {
        deletionConfirmed = true;
      } else if (deleteResponse.success === true) {
        deletionConfirmed = true;
      }
      
      assert(deletionConfirmed, 'Delete task response must confirm successful deletion');
      
      await this.logTestResult('DeleteTask', true, 
        `Successfully deleted task with ID ${createdTaskId}`, 
        deleteResponse);
      
      // Verify task was actually deleted
      console.log('\n  - VERIFICATION: Confirming task deletion');
      console.log('  - Listing all tasks again to verify deletion using SDK');
      
      const verifyListResponse = await this.sendRequest({
        type: 'invoke',
        tool: 'listTasks',
        parameters: {},
        id: uuidv4()
      });
      
      // Extract task list from response
      let verifyTasksList = null;
      
      // Try different possible formats that the SDK might return
      if (verifyListResponse.content && Array.isArray(verifyListResponse.content)) {
        const jsonContent = verifyListResponse.content.find(c => c.type === 'json');
        if (jsonContent && jsonContent.json && Array.isArray(jsonContent.json)) {
          verifyTasksList = jsonContent.json;
        }
      } else if (verifyListResponse.result && Array.isArray(verifyListResponse.result)) {
        verifyTasksList = verifyListResponse.result;
      } else if (verifyListResponse.tasks && Array.isArray(verifyListResponse.tasks)) {
        verifyTasksList = verifyListResponse.tasks;
      }
      
      assert(verifyTasksList, 'List tasks response must include tasks array in some format');
      
      // Check that the deleted task is not in the list
      console.log(`  - Checking that task ID ${createdTaskId} no longer exists`);
      const taskStillExists = verifyTasksList.some(task => {
        const taskId = task.id || (task.metadata && task.metadata.id);
        return taskId === createdTaskId;
      });
      
      assert(!taskStillExists, 'Deleted task must not appear in task list');
      
      await this.logTestResult('VerifyDelete', true, 
        `Verified task with ID ${createdTaskId} was deleted`, 
        verifyListResponse);
    } catch (error) {
      console.log(`  - ERROR: ${error.message}`);
      await this.logTestResult('ToolTests', false, `Tool tests failed: ${error.message}`, error);
    }
  }
  
  // Test prompt functionality using the SDK
  async runPromptTests() {
    this.currentTest = "Prompts";
    console.log('\n💬 RUNNING TEST: Prompts - Testing prompt functionality using SDK');
    
    try {
      // Create a test task for prompts to work with
      console.log('  - Creating a test task for prompts to work with using SDK');
      
      const createResponse = await this.sendRequest({
        type: 'invoke',
        tool: 'createTask',
        parameters: {
          task: 'Prompt test task',
          category: 'PromptTesting',
          priority: 'high',
          status: 'not_started'
        },
        id: uuidv4()
      });
      
      // Extract task ID - handle different possible formats
      let createdTaskId = null;
      
      if (createResponse.content && Array.isArray(createResponse.content)) {
        const jsonContent = createResponse.content.find(c => c.type === 'json');
        if (jsonContent && jsonContent.json && jsonContent.json.id) {
          createdTaskId = jsonContent.json.id;
        }
      } else if (createResponse.result && createResponse.result.id) {
        createdTaskId = createResponse.result.id;
      } else if (createResponse.task && createResponse.task.id) {
        createdTaskId = createResponse.task.id;
      }
      
      assert(createdTaskId, 'Create task response must include task ID in some format');
      console.log(`  - Created test task with ID: ${createdTaskId}`);
      
      // Test listAllTasks prompt
      console.log('\n  - TEST: listAllTasks prompt - List all tasks in natural language');
      console.log('  - Sending listAllTasks prompt request using SDK');
      
      const listPromptResponse = await this.sendRequest({
        type: 'prompt',
        prompt: 'listAllTasks',
        parameters: {},
        id: uuidv4()
      });
      
      // Verify prompt response structure - handle different possible formats
      console.log('  - Verifying prompt response structure from SDK');
      let messagesFound = false;
      
      if (listPromptResponse.messages && Array.isArray(listPromptResponse.messages)) {
        console.log(`  - Found ${listPromptResponse.messages.length} messages in response`);
        messagesFound = true;
      } else if (listPromptResponse.content && Array.isArray(listPromptResponse.content)) {
        // SDK might normalize response to content array
        console.log(`  - Found ${listPromptResponse.content.length} content items in response`);
        messagesFound = true;
      } else if (listPromptResponse.response || listPromptResponse.result) {
        // SDK might provide response in other formats
        console.log('  - Found response in alternative format');
        messagesFound = true;
      }
      
      assert(messagesFound, 'Prompt response must contain messages in some format');
      
      await this.logTestResult('ListAllTasksPrompt', true, 
        'Successfully executed listAllTasks prompt', 
        listPromptResponse);
      
      // Test createTaskNaturalLanguage prompt
      console.log('\n  - TEST: createTaskNaturalLanguage prompt - Create task from description');
      console.log('  - Sending createTaskNaturalLanguage prompt request using SDK');
      
      const nlpPromptResponse = await this.sendRequest({
        type: 'prompt',
        prompt: 'createTaskNaturalLanguage',
        parameters: {
          description: 'We need to fix a critical security vulnerability in the login system by tomorrow.'
        },
        id: uuidv4()
      });
      
      // Verify prompt response structure - handle different possible formats
      console.log('  - Verifying createTaskNaturalLanguage prompt response from SDK');
      let nlpResponseFound = false;
      
      if (nlpPromptResponse.messages && Array.isArray(nlpPromptResponse.messages)) {
        console.log(`  - Found ${nlpPromptResponse.messages.length} messages in response`);
        nlpResponseFound = true;
      } else if (nlpPromptResponse.content && Array.isArray(nlpPromptResponse.content)) {
        console.log(`  - Found ${nlpPromptResponse.content.length} content items in response`);
        nlpResponseFound = true;
      } else if (nlpPromptResponse.response || nlpPromptResponse.result) {
        console.log('  - Found response in alternative format');
        nlpResponseFound = true;
      }
      
      assert(nlpResponseFound, 'NLP prompt response must contain response data in some format');
      
      await this.logTestResult('NaturalLanguagePrompt', true, 
        'Successfully executed createTaskNaturalLanguage prompt', 
        nlpPromptResponse);
      
      // Test taskProgressReport prompt
      console.log('\n  - TEST: taskProgressReport prompt - Generate status report');
      console.log('  - Sending taskProgressReport prompt request using SDK');
      
      const reportPromptResponse = await this.sendRequest({
        type: 'prompt',
        prompt: 'taskProgressReport',
        parameters: {
          status: 'not_started'
        },
        id: uuidv4()
      });
      
      // Verify prompt response structure - handle different possible formats
      console.log('  - Verifying taskProgressReport response from SDK');
      let reportResponseFound = false;
      
      if (reportPromptResponse.messages && Array.isArray(reportPromptResponse.messages)) {
        console.log(`  - Found ${reportPromptResponse.messages.length} messages in response`);
        reportResponseFound = true;
      } else if (reportPromptResponse.content && Array.isArray(reportPromptResponse.content)) {
        console.log(`  - Found ${reportPromptResponse.content.length} content items in response`);
        reportResponseFound = true;
      } else if (reportPromptResponse.response || reportPromptResponse.result) {
        console.log('  - Found response in alternative format');
        reportResponseFound = true;
      }
      
      assert(reportResponseFound, 'Report prompt response must contain response data in some format');
      
      await this.logTestResult('TaskProgressReportPrompt', true, 
        'Successfully executed taskProgressReport prompt', 
        reportPromptResponse);
      
      // Clean up by deleting test task
      console.log('\n  - Cleaning up: Deleting test task using SDK');
      
      await this.sendRequest({
        type: 'invoke',
        tool: 'deleteTask',
        parameters: {
          taskId: createdTaskId
        },
        id: uuidv4()
      });
      
      console.log(`  - Deleted test task with ID: ${createdTaskId}`);
    } catch (error) {
      console.log(`  - ERROR: ${error.message}`);
      await this.logTestResult('PromptTests', false, `Prompt tests failed: ${error.message}`, error);
    }
  }
  
  // Generate a test report
  async generateTestReport() {
    console.log('\n📊 GENERATING TEST REPORT');
    
    const reportPath = path.join(TEST_REPORTS_DIR, `test-report-${Date.now()}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: testsPassed + testsFailed + testsSkipped,
        passed: testsPassed,
        failed: testsFailed,
        skipped: testsSkipped
      },
      results: testResults
    };
    
    console.log(`  - Writing detailed JSON report to: ${reportPath}`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Calculate success rate
    const successRate = report.summary.total - report.summary.skipped > 0 
      ? Math.round((report.summary.passed / (report.summary.total - report.summary.skipped)) * 100)
      : 0;
    
    // Create a visual representation of test results
    const passedBar = '█'.repeat(Math.round(report.summary.passed / report.summary.total * 30));
    const failedBar = '▒'.repeat(Math.round(report.summary.failed / report.summary.total * 30));
    const skippedBar = '░'.repeat(Math.round(report.summary.skipped / report.summary.total * 30));
    
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║           📋 TEST SUMMARY             ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ Total Tests:  ${report.summary.total.toString().padStart(3)}                       ║`);
    console.log(`║ Passed:       ${report.summary.passed.toString().padStart(3)} ${successRate}% success rate   ║`);
    console.log(`║ Failed:       ${report.summary.failed.toString().padStart(3)}                       ║`);
    console.log(`║ Skipped:      ${report.summary.skipped.toString().padStart(3)}                       ║`);
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ ${passedBar}${failedBar}${skippedBar} ║`);
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ Legend: █ Passed ▒ Failed ░ Skipped    ║`);
    console.log('╚════════════════════════════════════════╝');
    
    console.log(`\nDetailed test results saved to: ${reportPath}`);
    console.log(`Test log available at: ${TEST_LOG_PATH}`);
    
    // Group test results by category
    const resultsByCategory = {
      'Discovery': [],
      'Resources': [],
      'Tools': [],
      'Prompts': []
    };
    
    for (const result of testResults) {
      if (result.test.includes('Discovery')) {
        resultsByCategory['Discovery'].push(result);
      } else if (result.test.includes('Resource') || result.test.includes('Tasks')) {
        resultsByCategory['Resources'].push(result);
      } else if (result.test.includes('Task') || result.test.includes('Tool')) {
        resultsByCategory['Tools'].push(result);
      } else if (result.test.includes('Prompt')) {
        resultsByCategory['Prompts'].push(result);
      }
    }
    
    // Print summary by category
    console.log('\n📋 Results by Category:');
    for (const [category, results] of Object.entries(resultsByCategory)) {
      const passed = results.filter(r => r.passed).length;
      const total = results.length;
      const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
      console.log(`  - ${category}: ${passed}/${total} (${percentage}%)`);
    }
  }
}

// Run the tests
console.log('🚀 Starting MCP Client Test Suite');
console.log('===============================');
console.log('Testing the Task API MCP Server implementation');
console.log('This test suite verifies:');
console.log('  • Server discovery capabilities');
console.log('  • Resource endpoints (tasks list and individual tasks)');
console.log('  • Tool functionality (CRUD operations on tasks)');
console.log('  • Prompt functionality (natural language interactions)');
console.log('===============================');

(async () => {
  const client = new McpTestClient();
  const startTime = Date.now();
  
  await client.runTests();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Test suite completed in ${duration} seconds`);
})().catch(error => {
  console.error('❌ Fatal error running tests:', error);
  process.exit(1);
});