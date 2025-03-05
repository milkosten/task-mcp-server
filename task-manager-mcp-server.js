#!/usr/bin/env node
/**
 * Task Manager MCP Server - Standalone Version
 * 
 * This is a self-contained implementation that doesn't rely on external MCP SDK
 */

import fs from 'fs';
import axios from 'axios';
import { URL } from 'url';
import { createInterface } from 'readline';
import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Base URL for the Task API from environment variables
const API_BASE_URL = process.env.API_BASE_URL || "https://task-master-pro-mikaelwestoo.replit.app/api";

// API Key from environment variables
const API_KEY = process.env.API_KEY;

// Schema definitions to make inference easier for AI agents
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

// MCP Server setup
const server = {
  name: "Task Management API Server",
  version: "1.0.0",
  description: "Task Management API that provides CRUD operations for tasks with categories, priorities, and statuses",
  publisher: "TaskMaster API",
  
  // Store handlers for resources, tools, and prompts
  resources: new Map(),
  tools: new Map(),
  prompts: new Map(),
  
  // Tool and prompt metadata
  toolInfo: new Map(),
  promptInfo: new Map(),
  
  // Register a resource handler
  resource(name, template, handler) {
    this.resources.set(name, { template, handler });
    return this;
  },
  
  // Register a tool handler
  tool(name, parameters, handler, info = {}) {
    this.tools.set(name, { parameters, handler });
    this.toolInfo.set(name, info);
    return this;
  },
  
  // Register a prompt handler
  prompt(name, parameters, handler, info = {}) {
    this.prompts.set(name, { parameters, handler });
    this.promptInfo.set(name, info);
    return this;
  },
  
  // Handle a request
  async handleRequest(request) {
    if (!request || !request.type) {
      return { error: 'Invalid request format' };
    }
    
    const id = request.id || 'request_' + Date.now();
    
    try {
      switch (request.type) {
        case 'discover':
          return await handleDiscovery(id);
        case 'resource':
          return await handleResource(id, request);
        case 'invoke':
          return await handleInvoke(id, request);
        case 'prompt':
          return await handlePrompt(id, request);
        default:
          return {
            id,
            error: `Unsupported request type: ${request.type}`
          };
      }
    } catch (error) {
      console.error(`Error handling request: ${error.message}`);
      return {
        id,
        error: error.message
      };
    }
  }
};

// Helper function for discovery
async function handleDiscovery(id) {
  const tools = Array.from(server.tools.entries()).map(([name, { parameters }]) => {
    const info = server.toolInfo.get(name) || {};
    return {
      name,
      description: info.description || `Tool: ${name}`,
      parameters
    };
  });
  
  const resources = Array.from(server.resources.entries()).map(([name, { template }]) => {
    return {
      name,
      description: template.description || `Resource: ${name}`,
      template: template.pattern
    };
  });
  
  const prompts = Array.from(server.prompts.entries()).map(([name, { parameters }]) => {
    const info = server.promptInfo.get(name) || {};
    return {
      name,
      description: info.description || `Prompt: ${name}`,
      parameters
    };
  });
  
  return {
    id,
    type: 'discover_response',
    name: server.name,
    version: server.version,
    description: server.description,
    tools,
    resources,
    prompts
  };
}

// Helper function for resource requests
async function handleResource(id, request) {
  const uri = new URL(request.uri);
  const protocol = uri.protocol.replace(':', '');
  const path = uri.pathname.split('/');
  
  // Find matching resource handler
  for (const [name, { template, handler }] of server.resources.entries()) {
    const match = matchUri(uri, template.pattern);
    if (match) {
      try {
        const result = await handler(uri, match);
        return {
          id,
          type: 'resource_response',
          ...result
        };
      } catch (error) {
        return {
          id,
          error: `Resource handler error: ${error.message}`
        };
      }
    }
  }
  
  return {
    id,
    error: `No resource handler found for URI: ${request.uri}`
  };
}

// Helper function for tool invocation
async function handleInvoke(id, request) {
  const { tool, parameters } = request;
  
  if (!server.tools.has(tool)) {
    return {
      id,
      error: `Tool not found: ${tool}`
    };
  }
  
  const { handler } = server.tools.get(tool);
  
  try {
    const result = await handler(parameters || {});
    return {
      id,
      type: 'invoke_response',
      ...result
    };
  } catch (error) {
    return {
      id,
      error: `Tool invocation error: ${error.message}`
    };
  }
}

// Helper function for prompt requests
async function handlePrompt(id, request) {
  const { prompt, parameters } = request;
  
  if (!server.prompts.has(prompt)) {
    return {
      id,
      error: `Prompt not found: ${prompt}`
    };
  }
  
  const { handler } = server.prompts.get(prompt);
  
  try {
    const result = await handler(parameters || {});
    return {
      id,
      type: 'prompt_response',
      ...result
    };
  } catch (error) {
    return {
      id,
      error: `Prompt execution error: ${error.message}`
    };
  }
}

// Template helper
function ResourceTemplate(pattern, options = {}) {
  return {
    pattern,
    description: options.description || '',
    ...options
  };
}

// Helper to match URI against a template
function matchUri(uri, pattern) {
  const patternParts = pattern.split('/');
  const uriParts = uri.pathname.split('/');
  
  // Check protocol match
  if (!uri.href.startsWith(pattern.split('/')[0])) {
    return null;
  }
  
  // Match remaining parts
  const params = {};
  
  for (let i = 1; i < patternParts.length; i++) {
    const template = patternParts[i];
    const part = uriParts[i];
    
    if (template.startsWith('{') && template.endsWith('}')) {
      // Parameter part
      const paramName = template.substring(1, template.length - 1);
      params[paramName] = part;
    } else if (template !== part) {
      // Static part doesn't match
      return null;
    }
  }
  
  return params;
}

// Helper function to make authenticated API requests
async function makeApiRequest(method, endpoint, data = null, params = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Validate that API_KEY is defined
  if (!API_KEY) {
    throw new Error("API_KEY environment variable is not defined. Please check your .env file.");
  }
  
  const headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
  };

  try {
    // Log request details
    const logEntry = `Timestamp: ${new Date().toISOString()}\nMethod: ${method}\nURL: ${url}\nParams: ${JSON.stringify(params)}\nData: ${JSON.stringify(data)}\n\n`;
    fs.appendFileSync("api_debug.log", logEntry);

    const response = await axios({
      method,
      url,
      headers,
      data,
      params,
    });
    return response.data;
  } catch (error) {
    console.error(`API Error: ${error.message}`);
    
    // Enhanced error logging
    const errorLogEntry = `Timestamp: ${new Date().toISOString()}\nError: ${error.message}\nURL: ${url}\nMethod: ${method}\n\n`;
    fs.appendFileSync("api_error.log", errorLogEntry);
    
    if (error.response) {
      throw new Error(
        `API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`,
      );
    }
    throw error;
  }
}

// Resource: Tasks list
server.resource(
  "tasks",
  ResourceTemplate("tasks://list", { 
    description: "Retrieves a list of all tasks in the system with their details"
  }),
  async (uri) => {
    try {
      const tasks = await makeApiRequest("GET", "/tasks");
      
      // Format tasks for easy display and use
      return {
        contents: tasks.tasks.map((task) => ({
          uri: `tasks://task/${task.id}`,
          text: `ID: ${task.id}
Task: ${task.task}
Category: ${task.category}
Priority: ${task.priority}
Status: ${task.status}
Created: ${task.create_time}`,
          metadata: {
            id: task.id,
            task: task.task,
            category: task.category,
            priority: task.priority,
            status: task.status,
            create_time: task.create_time,
          },
        })),
      };
    } catch (error) {
      console.error(`Error fetching tasks: ${error.message}`);
      return {
        contents: [{
          uri: "tasks://error",
          text: `Error retrieving tasks: ${error.message}`,
          metadata: { error: error.message }
        }]
      };
    }
  },
);

// Resource: Individual task
server.resource(
  "task",
  ResourceTemplate("tasks://task/{taskId}", { 
    description: "Retrieves details of a specific task by its ID"
  }),
  async (uri, params) => {
    try {
      // Get all tasks and find the one we want
      // (A direct endpoint would be more efficient in a real API)
      const tasks = await makeApiRequest("GET", "/tasks");
      const task = tasks.tasks.find((t) => t.id === Number(params.taskId));
      
      if (!task) {
        return {
          contents: [{
            uri: uri.href,
            text: `Task with ID ${params.taskId} not found`,
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
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error retrieving task ${params.taskId}: ${error.message}`,
          metadata: { error: error.message }
        }]
      };
    }
  },
);

// Tool: List Tasks
server.tool(
  "listTasks",
  {
    status: z.enum(["not_started", "started", "done"]).optional()
      .describe("Filter tasks by status (optional)"),
    priority: z.enum(["low", "medium", "high"]).optional()
      .describe("Filter tasks by priority level (optional)"),
  },
  async ({ status, priority }) => {
    try {
      const params = {};
      if (status) params.status = status;
      if (priority) params.priority = priority;

      const tasks = await makeApiRequest("GET", "/tasks", null, params);
      
      // Format response in a way that's useful for AI to parse
      const formattedTasks = tasks.tasks.map(task => ({
        id: task.id,
        title: task.task,
        category: task.category,
        priority: task.priority,
        status: task.status,
        created: task.create_time
      }));

      return {
        content: [
          {
            type: "text",
            text: `Found ${tasks.tasks.length} tasks${status ? ` with status '${status}'` : ''}${priority ? ` and priority '${priority}'` : ''}.`,
          },
          {
            type: "json",
            json: formattedTasks,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing tasks: ${error.message}`,
          },
        ],
      };
    }
  },
  {
    description: "Lists all tasks in the system, optionally filtered by status and/or priority",
    usage: [
      { description: "List all tasks", params: {} },
      { description: "List all high priority tasks", params: { priority: "high" } },
      { description: "List all completed tasks", params: { status: "done" } }
    ]
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
      .describe("Initial task status (defaults to 'not_started' if not specified)"),
  },
  async ({ task, category, priority, status }) => {
    try {
      const requestBody = {
        task,
        category,
      };

      if (priority) requestBody.priority = priority;
      if (status) requestBody.status = status;

      const newTask = await makeApiRequest("POST", "/tasks", requestBody);

      return {
        content: [
          {
            type: "text",
            text: `Task created successfully with ID: ${newTask.id}`,
          },
          {
            type: "json",
            json: {
              id: newTask.id,
              task: newTask.task,
              category: newTask.category,
              priority: newTask.priority,
              status: newTask.status,
              created: newTask.create_time
            },
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating task: ${error.message}`,
          },
        ],
      };
    }
  },
  {
    description: "Creates a new task with the specified details",
    usage: [
      { 
        description: "Create a basic task", 
        params: { 
          task: "Implement login page", 
          category: "Development" 
        } 
      },
      { 
        description: "Create a high priority task", 
        params: { 
          task: "Fix critical security bug", 
          category: "Security", 
          priority: "high" 
        } 
      }
    ]
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
      .describe("New task status (if you want to change it)"),
  },
  async ({ taskId, task, category, priority, status }) => {
    try {
      const requestBody = {};

      if (task) requestBody.task = task;
      if (category) requestBody.category = category;
      if (priority) requestBody.priority = priority;
      if (status) requestBody.status = status;

      if (Object.keys(requestBody).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No updates provided. Task remains unchanged.",
            },
          ],
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
            text: `Task ${taskId} updated successfully.`,
          },
          {
            type: "json",
            json: {
              id: updatedTask.id,
              task: updatedTask.task,
              category: updatedTask.category,
              priority: updatedTask.priority,
              status: updatedTask.status,
              created: updatedTask.create_time
            },
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating task: ${error.message}`,
          },
        ],
      };
    }
  },
  {
    description: "Updates an existing task with new values for one or more fields",
    usage: [
      { 
        description: "Mark a task as completed", 
        params: { 
          taskId: 5, 
          status: "done" 
        } 
      },
      { 
        description: "Change task priority", 
        params: { 
          taskId: 3, 
          priority: "high" 
        } 
      },
      { 
        description: "Rename a task", 
        params: { 
          taskId: 7, 
          task: "Implement OAuth login" 
        } 
      }
    ]
  }
);

// Tool: Delete Task
server.tool(
  "deleteTask",
  {
    taskId: z.number().int().positive("Task ID must be a positive integer")
      .describe("The unique ID of the task to delete"),
  },
  async ({ taskId }) => {
    try {
      const response = await makeApiRequest("DELETE", `/tasks/${taskId}`);

      return {
        content: [
          {
            type: "text",
            text: response.message || `Task ${taskId} deleted successfully.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting task: ${error.message}`,
          },
        ],
      };
    }
  },
  {
    description: "Permanently deletes a task from the system",
    usage: [
      { 
        description: "Delete a specific task", 
        params: { 
          taskId: 12
        } 
      }
    ]
  }
);

// Prompt: List all tasks with category analysis
server.prompt(
  "listAllTasks", 
  {},
  () => ({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Please list all tasks in my task management system. Group them by category and summarize the priorities for each category.",
          }
        ],
      },
    ],
  }),
  {
    description: "Lists all tasks grouped by category with priority summary",
    usage: "Use this prompt when you want to see all tasks organized by category with priority distribution"
  }
);

// Prompt: Create task with natural language
server.prompt(
  "createTaskNaturalLanguage",
  {
    description: z.string().min(10, "Task description must be at least 10 characters")
      .describe("A natural language description of the task to create"),
  },
  ({ description }) => ({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Please analyze this task description and create an appropriate task:

"${description}"

Extract the most suitable category, determine an appropriate priority level, and create the task with the right parameters.`,
          }
        ],
      },
    ],
  }),
  {
    description: "Creates a task from a natural language description by extracting key details",
    usage: "Use this when you have a detailed task description and want the AI to determine the best category and priority"
  }
);

// Prompt: Create new task with specific parameters
server.prompt(
  "createNewTask",
  {
    task: z.string().min(1, "Task description is required")
      .describe("The task description or title"),
    category: z.string().min(1, "Category is required")
      .describe("Task category"),
    priority: z.enum(["low", "medium", "high"]).optional()
      .describe("Task priority level"),
  },
  ({ task, category, priority }) => ({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Please create a new task in my task management system with the following details:

Task: ${task}
Category: ${category}
${priority ? `Priority: ${priority}` : ""}

Please confirm once the task is created and provide the task ID for reference.`,
          }
        ],
      },
    ],
  }),
  {
    description: "Creates a new task with specific title, category and optional priority",
    usage: "Use this when you have specific task details to create"
  }
);

// Prompt: Task progress report
server.prompt(
  "taskProgressReport",
  {
    status: z.enum(["not_started", "started", "done"]).optional()
      .describe("Filter by task status"),
  },
  ({ status }) => ({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Please provide a progress report on ${status ? `all ${status} tasks` : "all tasks"}.

Include:
1. How many tasks are in each status category
2. Which high priority tasks need attention
3. Any categories with a high concentration of incomplete tasks`,
          }
        ],
      },
    ],
  }),
  {
    description: "Generates a progress report on tasks with key statistics and insights",
    usage: "Use this when you need an overview of task progress and areas needing attention"
  }
);

// Set up stdin/stdout processing
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Process incoming lines from stdin
rl.on('line', async (line) => {
  if (!line.trim()) return;
  
  try {
    const request = JSON.parse(line);
    const response = await server.handleRequest(request);
    
    // Send response back to stdout
    console.log(JSON.stringify(response));
  } catch (error) {
    console.error('Error processing request:', error);
    console.log(JSON.stringify({
      id: 'error_' + Date.now(),
      error: `Failed to process request: ${error.message}`
    }));
  }
});

// Helper function to determine schema type for discovery
function getSchemaType(schema) {
  if (schema.enum) return "enum";
  if (schema instanceof z.ZodString) return "string";
  if (schema instanceof z.ZodNumber) return "number";
  if (schema instanceof z.ZodBoolean) return "boolean";
  if (schema instanceof z.ZodArray) return "array";
  if (schema instanceof z.ZodObject) return "object";
  return "unknown";
}

console.log("Task Manager MCP Server started. Ready to process messages.");