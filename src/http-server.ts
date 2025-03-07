#!/usr/bin/env node

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from 'express';
import cors from 'cors';
import { z } from "zod";
import * as fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Base URL for the Task API from environment variables
const API_BASE_URL = process.env.TASK_MANAGER_API_BASE_URL || "https://task-master-pro-mikaelwestoo.replit.app/api";
// API Key from environment variables
const API_KEY = process.env.TASK_MANAGER_API_KEY;
// HTTP server port - prioritize PORT for backward compatibility, then TASK_MANAGER_HTTP_PORT from .env, then default to 3000
const PORT = process.env.PORT || process.env.TASK_MANAGER_HTTP_PORT || 3000;

// Helper function for logging to file
function logToFile(filename: string, message: string): void {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(filename, logEntry);
}

// Helper function to log errors
function logError(message: string, details: any = null): void {
  let errorMessage = `[ERROR] ${message}`;
  if (details) {
    errorMessage += `\nDetails: ${JSON.stringify(details, null, 2)}`;
  }
  logToFile("server_error.log", errorMessage);
}

// Helper function to log debug info
function logDebug(message: string, data: any = null): void {
  let debugMessage = `[DEBUG] ${message}`;
  if (data) {
    debugMessage += `\nData: ${JSON.stringify(data, null, 2)}`;
  }
  logToFile("server_debug.log", debugMessage);
}

// Schema definitions
const TaskSchema = z.object({
  id: z.number().int().positive().describe("Unique task identifier"),
  task: z.string().describe("The task description/title"),
  category: z.string().describe("Task category (e.g., 'Development', 'Documentation')"),
  priority: z.enum(["low", "medium", "high"]).describe("Task priority level"),
  status: z.enum(["not_started", "started", "done"]).describe("Current task status"),
  create_time: z.string().describe("Task creation timestamp in ISO format"),
});

const TaskListSchema = z.object({
  tasks: z.array(TaskSchema).describe("List of tasks"),
});

// Helper function to make authenticated API requests
async function makeApiRequest(method: string, endpoint: string, data: any = null, params: any = null): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Validate that API_KEY is defined
  if (!API_KEY) {
    throw new Error("TASK_MANAGER_API_KEY environment variable is not defined. Please check your .env file.");
  }
  
  logDebug(`API Request: ${method} ${url}`);
  
  // Standard headers
  const headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json; charset=utf-8",
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "TaskMcpServer/1.0",
    "Connection": "close",
    "Cache-Control": "no-cache"
  };

  try {
    // Log request details
    const logEntry = `Timestamp: ${new Date().toISOString()}\nMethod: ${method}\nURL: ${url}\nParams: ${JSON.stringify(params)}\nData: ${JSON.stringify(data)}\nHeaders: ${JSON.stringify(headers)}\n\n`;
    fs.appendFileSync("api_debug.log", logEntry);

    // Configure axios request options
    const requestConfig: any = {
      method,
      url,
      headers,
      data,
      params,
      maxRedirects: 0,
      timeout: 20000,
      decompress: false,
      validateStatus: function (status: number) {
        return status < 500; // Don't reject if status code is less than 500
      }
    };
    
    // Ensure proper data encoding for all requests
    if (data) {
      requestConfig.data = JSON.stringify(data);
    }
    
    // Add transform request for properly handling all requests
    requestConfig.transformRequest = [(data: any, headers: any) => {
      // Force proper content type
      headers['Content-Type'] = 'application/json; charset=utf-8';
      return typeof data === 'string' ? data : JSON.stringify(data);
    }];
    
    // Add specific URL handling for individual task endpoints
    if (endpoint.startsWith('/tasks/') && method === 'GET') {
      // Fix to retrieve individual task by adding specific query parameters
      requestConfig.params = { ...params, id: endpoint.split('/')[2] };
    }
    
    const response = await axios(requestConfig);
    
    // Check for HTTP error status codes we didn't automatically reject
    if (response.status >= 400 && response.status < 500) {
      logError(`HTTP error ${response.status} from API`, response.data);
      
      // Enhanced error logging
      const errorLogEntry = `Timestamp: ${new Date().toISOString()}\nError: HTTP ${response.status}\nURL: ${url}\nMethod: ${method}\nResponse: ${JSON.stringify(response.data)}\n\n`;
      fs.appendFileSync("api_error.log", errorLogEntry);
      
      throw new Error(`API Error (${response.status}): ${JSON.stringify(response.data)}`);
    }
    
    // Check if response has expected format
    if ((method === "POST" && endpoint === "/tasks/list") || (method === "GET" && endpoint === "/tasks")) {
      logDebug(`listTasks response`, response.data.tasks || []);
      if (!response.data || !response.data.tasks || response.data.tasks.length === 0) {
        logDebug("API returned empty tasks array");
      }
    }
    
    return response.data;
  } catch (error: any) {
    logError(`API Error: ${error.message}`);
    
    // Enhanced error logging with more details
    const errorDetails = error.response 
      ? `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data || 'No response data')}` 
      : (error.request ? 'No response received' : error.message);
    
    const errorLogEntry = `Timestamp: ${new Date().toISOString()}\nError: ${error.message}\nDetails: ${errorDetails}\nURL: ${url}\nMethod: ${method}\n\n`;
    fs.appendFileSync("api_error.log", errorLogEntry);
    
    if (error.response) {
      throw new Error(
        `API Error (${error.response.status}): ${JSON.stringify(error.response.data || 'No response data')}`,
      );
    } else if (error.request) {
      throw new Error(`API Request Error: No response received (possible network issue)`);
    }
    throw error;
  }
}

// Create an Express app
const app = express();

// Configure middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store active transports for message routing
const activeTransports = new Map<string, SSEServerTransport>();

// Create an MCP server
const server = new McpServer({
  name: "Task Management API Server",
  version: "1.0.0",
  description: "Task Management API that provides CRUD operations for tasks with categories, priorities, and statuses",
});

// Add resources and tools similar to index.ts
// Resource: Tasks list
server.resource(
  "tasks",
  new ResourceTemplate("tasks://list", { list: undefined }),
  async (uri: any) => {
    try {
      const tasks = await makeApiRequest("POST", "/tasks/list");
      
      // Validate the tasks structure
      if (!tasks || !tasks.tasks || !Array.isArray(tasks.tasks)) {
        logError(`Invalid tasks data structure`, tasks);
        return {
          contents: [{
            uri: "tasks://error",
            text: `Error: Received invalid task data from API`,
            metadata: { error: "Invalid data structure", data: tasks }
          }]
        };
      }
      
      // Format tasks for easy display and use
      return {
        contents: tasks.tasks.map((task: any) => ({
          uri: `tasks://task/${task.id}`,
          text: `ID: ${task.id}
Task: ${task.task || 'No description'}
Category: ${task.category || 'Uncategorized'}
Priority: ${task.priority || 'medium'}
Status: ${task.status || 'not_started'}
Created: ${task.create_time || 'unknown'}`,
          metadata: {
            id: task.id,
            task: task.task || 'No description',
            category: task.category,
            priority: task.priority || 'medium',
            status: task.status || 'not_started',
            create_time: task.create_time,
          },
        })),
      };
    } catch (error: any) {
      logError(`Error fetching tasks: ${error.message}`);
      return {
        contents: [{
          uri: "tasks://error",
          text: `Error retrieving tasks: ${error.message}`,
          metadata: { error: error.message }
        }]
      };
    }
  }
);

// Resource: Individual task
server.resource(
  "task",
  new ResourceTemplate("tasks://task/{taskId}", { list: undefined }),
  async (uri: any, params: any) => {
    try {
      const taskId = params.taskId;
      // Try direct task endpoint first
      let task;
      try {
        const taskResult = await makeApiRequest("GET", `/tasks/${taskId}`);
        if (taskResult && (taskResult.id || taskResult.task)) {
          task = taskResult;
        }
      } catch (directError) {
        logDebug(`Direct task fetch failed, using task list fallback: ${directError}`);
        // Fallback to getting all tasks and filtering
        const tasks = await makeApiRequest("POST", "/tasks/list");
        task = tasks.tasks.find((t: any) => t.id === Number(taskId) || t.id === taskId);
      }
      
      if (!task) {
        return {
          contents: [{
            uri: uri.href,
            text: `Task with ID ${taskId} not found`,
            metadata: { error: "Task not found" }
          }]
        };
      }

      // Format task for easy display
      return {
        contents: [
          {
            uri: uri.href,
            text: `ID: ${task.id}
Task: ${task.task}
Category: ${task.category}
Priority: ${task.priority}
Status: ${task.status}
Created: ${task.create_time}`,
            metadata: task,
          },
        ],
      };
    } catch (error: any) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error retrieving task ${params.taskId}: ${error.message}`,
          metadata: { error: error.message }
        }]
      };
    }
  }
);

// Tool: List Tasks
server.tool(
  "listTasks", 
  { 
    status: z.enum(["not_started", "started", "done"]).optional()
      .describe("Filter tasks by status (optional)"),
    priority: z.enum(["low", "medium", "high"]).optional()
      .describe("Filter tasks by priority level (optional)")
  }, 
  async ({ status, priority }: { status?: string, priority?: string }) => {
    try {
      const params: any = {};
      if (status) params.status = status;
      if (priority) params.priority = priority;

      const tasksResponse = await makeApiRequest("POST", "/tasks/list", { status, priority });
      
      // More flexible validation for tasks data structure
      let tasks: any[] = [];
      
      // Handle various response formats that might come from the API
      if (tasksResponse) {
        if (Array.isArray(tasksResponse.tasks)) {
          // Standard format: { tasks: [...] }
          tasks = tasksResponse.tasks;
          logDebug("Found tasks array in standard format");
        } else if (Array.isArray(tasksResponse)) {
          // Direct array format: [...]
          tasks = tasksResponse;
          logDebug("Found tasks in direct array format");
        } else if (typeof tasksResponse === 'object' && tasksResponse !== null) {
          // Try to extract tasks from any available property
          const possibleTasksProperties = Object.entries(tasksResponse)
            .filter(([_, value]) => Array.isArray(value))
            .map(([key, value]) => ({ key, value }));
            
          if (possibleTasksProperties.length > 0) {
            // Use the first array property as tasks
            const tasksProp = possibleTasksProperties[0];
            tasks = tasksProp.value as any[];
            logDebug(`Found tasks array in property: ${tasksProp.key}`);
          } else {
            logError(`No tasks array found in response`, tasksResponse);
          }
        }
      }
      
      // If we still couldn't find tasks, log error and return empty array
      if (tasks.length === 0) {
        logError(`Invalid or empty tasks data structure`, tasksResponse);
      }
      
      // Format response in a way that's useful for AI to parse
      const formattedTasks = tasks.map(task => ({
        id: task.id,
        task: task.task || "No description",
        category: task.category,
        priority: task.priority || "medium",
        status: task.status || "not_started",
        createTime: task.create_time || task.created_at || task.createTime || new Date().toISOString()
      }));
      
      // Log the formatted response for debugging
      logDebug(`listTasks formatted response`, formattedTasks);

      return {
        content: [
          {
            type: "text",
            text: `Found ${tasks.length} tasks${status ? ` with status '${status}'` : ''}${priority ? ` and priority '${priority}'` : ''}.`
          },
          {
            type: "text",
            text: JSON.stringify(formattedTasks, null, 2)
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing tasks: ${error.message}`
          }
        ]
      };
    }
  }
);

// Tool: Create Task
server.tool(
  "createTask",
  {
    task: z.string().min(1, "Task description is required")
      .describe("The task description or title"),
    category: z.string().min(1, "Category is required")
      .describe("Task category (e.g., 'Development', 'Documentation')"),
    priority: z.enum(["low", "medium", "high"]).optional()
      .describe("Task priority level (defaults to 'medium' if not specified)"),
    status: z.enum(["not_started", "started", "done"]).optional()
      .describe("Initial task status (defaults to 'not_started' if not specified)")
  },
  async ({ task, category, priority, status }: { 
    task: string; 
    category: string; 
    priority?: string; 
    status?: string 
  }) => {
    try {
      const requestBody: any = {
        task,
        category,
      };

      if (priority) requestBody.priority = priority;
      if (status) requestBody.status = status;

      const newTask = await makeApiRequest("POST", "/tasks", requestBody);
      
      logDebug(`Created new task with ID ${newTask.id}`);

      return {
        content: [
          {
            type: "text",
            text: `Task created successfully with ID: ${newTask.id}`
          },
          {
            type: "text",
            text: JSON.stringify({
              id: newTask.id,
              task: newTask.task || task,
              category: newTask.category || category,
              priority: newTask.priority || priority || "medium",
              status: newTask.status || status || "not_started",
              create_time: newTask.create_time || new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logError(`Error in createTask: ${error.message}`);
      
      return {
        content: [
          {
            type: "text",
            text: `Error creating task: ${error.message}`
          }
        ]
      };
    }
  }
);

// Tool: Update Task
server.tool(
  "updateTask",
  {
    taskId: z.number().int().positive("Task ID must be a positive integer")
      .describe("The unique ID of the task to update"),
    task: z.string().optional()
      .describe("New task description/title (if you want to change it)"),
    category: z.string().optional()
      .describe("New task category (if you want to change it)"),
    priority: z.enum(["low", "medium", "high"]).optional()
      .describe("New task priority (if you want to change it)"),
    status: z.enum(["not_started", "started", "done"]).optional()
      .describe("New task status (if you want to change it)")
  },
  async ({ taskId, task, category, priority, status }: {
    taskId: number;
    task?: string;
    category?: string;
    priority?: string;
    status?: string;
  }) => {
    try {
      const requestBody: any = {};

      if (task) requestBody.task = task;
      if (category) requestBody.category = category;
      if (priority) requestBody.priority = priority;
      if (status) requestBody.status = status;

      if (Object.keys(requestBody).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No updates provided. Task remains unchanged."
            }
          ]
        };
      }

      const updatedTask = await makeApiRequest(
        "PATCH",
        `/tasks/${taskId}`,
        requestBody
      );

      return {
        content: [
          {
            type: "text",
            text: `Task ${taskId} updated successfully.`
          },
          {
            type: "text",
            text: JSON.stringify({
              id: updatedTask.id,
              task: updatedTask.task,
              category: updatedTask.category,
              priority: updatedTask.priority,
              status: updatedTask.status,
              created: updatedTask.create_time
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating task: ${error.message}`
          }
        ]
      };
    }
  }
);

// Tool: Delete Task
server.tool(
  "deleteTask",
  {
    taskId: z.number().int().positive("Task ID must be a positive integer")
      .describe("The unique ID of the task to delete")
  },
  async ({ taskId }: { taskId: number }) => {
    try {
      const response = await makeApiRequest("DELETE", `/tasks/${taskId}`);
      
      logDebug(`Deleted task ID ${taskId}`);

      return {
        content: [
          {
            type: "text",
            text: response.message || `Task ${taskId} deleted successfully.`
          }
        ]
      };
    } catch (error: any) {
      logError(`Error in deleteTask: ${error.message}`);
      
      return {
        content: [
          {
            type: "text",
            text: `Error deleting task: ${error.message}`
          }
        ]
      };
    }
  }
);

// Prompts (same as index.ts)
server.prompt(
  "listAllTasks", 
  {},
  () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Please list all tasks in my task management system. Group them by category and summarize the priorities for each category."
        }
      }
    ]
  })
);

server.prompt(
  "createTaskNaturalLanguage",
  {
    description: z.string().min(10, "Task description must be at least 10 characters")
      .describe("A natural language description of the task to create")
  },
  ({ description }: { description: string }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please analyze this task description and create an appropriate task:

"${description}"

Extract the most suitable category, determine an appropriate priority level, and create the task with the right parameters.`
        }
      }
    ]
  })
);

server.prompt(
  "createNewTask",
  {
    task: z.string().min(1, "Task description is required")
      .describe("The task description or title"),
    category: z.string().min(1, "Category is required")
      .describe("Task category"),
    priority: z.enum(["low", "medium", "high"]).optional()
      .describe("Task priority level")
  },
  ({ task, category, priority }: { task: string; category: string; priority?: string }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please create a new task in my task management system with the following details:

Task: ${task}
Category: ${category}
${priority ? `Priority: ${priority}` : ""}

Please confirm once the task is created and provide the task ID for reference.`
        }
      }
    ]
  })
);

server.prompt(
  "taskProgressReport",
  {
    status: z.enum(["not_started", "started", "done"]).optional()
      .describe("Filter by task status")
  },
  ({ status }: { status?: string }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please provide a progress report on ${status ? `all ${status} tasks` : "all tasks"}.

Include:
1. How many tasks are in each status category
2. Which high priority tasks need attention
3. Any categories with a high concentration of incomplete tasks`
        }
      }
    ]
  })
);

// SSE endpoint
app.get('/sse', async (req, res) => {
  const connectionId = Date.now().toString();
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  // Send initial message
  res.write(`data: ${JSON.stringify({ type: 'connected', id: connectionId })}\n\n`);
  
  // Create and store transport
  const transport = new SSEServerTransport('/messages', res);
  activeTransports.set(connectionId, transport);
  
  // Connect the server to this transport instance
  await server.connect(transport);
  
  // Handle client disconnection
  req.on('close', () => {
    logDebug(`Client disconnected: ${connectionId}`);
    transport.close();
    activeTransports.delete(connectionId);
  });
});

// Messages endpoint for client-to-server communication
app.post('/messages', express.json(), (req, res, next) => {
  const connectionId = req.headers['x-connection-id'] as string;
  
  if (!connectionId || !activeTransports.has(connectionId)) {
    logError('Invalid or missing connection ID', { connectionId });
    res.status(400).json({ error: 'Invalid or missing connection ID' });
    return;
  }
  
  const transport = activeTransports.get(connectionId);
  if (!transport) {
    logError('Transport not found', { connectionId });
    res.status(404).json({ error: 'Transport not found' });
    return;
  }

  // Handle the message and catch any errors
  transport.handlePostMessage(req as any, res as any, req.body)
    .then(() => {
      if (!res.headersSent) {
        res.status(200).end();
      }
    })
    .catch((error: any) => {
      logError('Error handling message', { error: error.message, connectionId });
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
      next(error);
    });
});

// Create a simple HTML page for interacting with the server
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MCP Task Manager</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        h1 { color: #333; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        button { margin: 5px; padding: 8px 16px; background: #4CAF50; color: white; border: none; 
                border-radius: 4px; cursor: pointer; }
        button:hover { background: #45a049; }
        #output { margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Task Manager MCP Server</h1>
      <p>This is an HTTP + SSE implementation of the Task Manager MCP Server.</p>
      
      <div>
        <button id="connect">Connect</button>
        <button id="discover" disabled>Discover</button>
        <button id="list-tasks" disabled>List Tasks</button>
        <button id="create-task" disabled>Create Test Task</button>
      </div>
      
      <pre id="output">Click 'Connect' to start...</pre>
      
      <script>
        const output = document.getElementById('output');
        const connectBtn = document.getElementById('connect');
        const discoverBtn = document.getElementById('discover');
        const listTasksBtn = document.getElementById('list-tasks');
        const createTaskBtn = document.getElementById('create-task');
        
        let connectionId = null;
        let eventSource = null;
        let messageId = 0;
        
        function log(message) {
          output.textContent += message + '\\n';
          output.scrollTop = output.scrollHeight;
        }
        
        connectBtn.addEventListener('click', () => {
          log('Connecting to server...');
          
          eventSource = new EventSource('/sse');
          
          eventSource.onopen = () => {
            log('SSE connection established');
          };
          
          eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            log('Received: ' + JSON.stringify(data, null, 2));
            
            if (data.type === 'connected') {
              connectionId = data.id;
              discoverBtn.disabled = false;
              listTasksBtn.disabled = false;
              createTaskBtn.disabled = false;
              connectBtn.disabled = true;
              log('Connected with ID: ' + connectionId);
            }
          };
          
          eventSource.onerror = (error) => {
            log('SSE Error: ' + JSON.stringify(error));
          };
        });
        
        async function sendMessage(message) {
          try {
            const response = await fetch('/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Connection-ID': connectionId
              },
              body: JSON.stringify(message)
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(\`HTTP error \${response.status}: \${errorText}\`);
            }
          } catch (error) {
            log('Error sending message: ' + error.message);
          }
        }
        
        discoverBtn.addEventListener('click', () => {
          const message = {
            id: 'discover_' + (++messageId),
            type: 'discover'
          };
          
          log('Sending discover request...');
          sendMessage(message);
        });
        
        listTasksBtn.addEventListener('click', () => {
          const message = {
            id: 'invoke_' + (++messageId),
            type: 'invoke',
            tool: 'listTasks',
            parameters: {}
          };
          
          log('Sending listTasks request...');
          sendMessage(message);
        });
        
        createTaskBtn.addEventListener('click', () => {
          const message = {
            id: 'invoke_' + (++messageId),
            type: 'invoke',
            tool: 'createTask',
            parameters: {
              task: 'Test task created at ' + new Date().toISOString(),
              category: 'Test',
              priority: 'medium'
            }
          };
          
          log('Sending createTask request...');
          sendMessage(message);
        });
      </script>
    </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  logDebug(`MCP HTTP Server with SSE is running on http://localhost:${PORT}`);
  console.log(`MCP HTTP Server with SSE is running on http://localhost:${PORT}`);
});