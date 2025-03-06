#!/usr/bin/env node
/**
 * MCP Task API Server - Standalone Version
 * 
 * This version uses our custom MCP SDK implementation
 * instead of relying on an external package.
 */

import {
  McpServer,
  ResourceTemplate,
  StdioServerTransport
} from './lib/mcp-sdk.js';
import { z } from 'zod';
import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Create an MCP server with detailed description for AI discoverability
const server = new McpServer({
  name: "Task Management API Server",
  version: "1.0.0",
  description: "Task Management API that provides CRUD operations for tasks with categories, priorities, and statuses",
  publisher: "TaskMaster API",
});

// Base URL for the Task API from environment variables
const API_BASE_URL = process.env.TASK_MANAGER_API_BASE_URL || "https://task-master-pro-mikaelwestoo.replit.app/api";

// API Key from environment variables
const API_KEY = process.env.TASK_MANAGER_API_KEY;

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

// Helper function to make authenticated API requests
async function makeApiRequest(method, endpoint, data = null, params = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Validate that API_KEY is defined
  if (!API_KEY) {
    throw new Error("TASK_MANAGER_API_KEY environment variable is not defined. Please check your .env file.");
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

// Resource: Tasks list - with improved description and error handling
server.resource(
  "tasks",
  new ResourceTemplate("tasks://list", { 
    list: { },
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

// Resource: Individual task - using direct API endpoint
server.resource(
  "task",
  new ResourceTemplate("tasks://task/{taskId}", { 
    list: { },
    description: "Retrieves details of a specific task by its ID"
  }),
  async (uri, { taskId }) => {
    try {
      // Get the specific task directly
      const tasks = await makeApiRequest("GET", "/tasks");
      const task = tasks.tasks.find((t) => t.id === Number(taskId));
      
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
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error retrieving task ${taskId}: ${error.message}`,
          metadata: { error: error.message }
        }]
      };
    }
  },
);

// Tool: List Tasks - with comprehensive description and examples
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

// Tool: Create Task - with improved validation and error handling
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

// Tool: Update Task - with improved parameter descriptions and validation
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

// Tool: Delete Task - with clear description and error handling
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

// Enhanced prompt templates with better descriptions and examples

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

// Create and configure the transport
const transport = new StdioServerTransport();

// Add discovery handler to respond to discovery requests from MCP manager
transport.addMessageHandler(async (message) => {
  // Handle discovery request
  if (message && message.type === 'discover') {
    console.log('Received discovery request:', message.id);
    
    // Get all tools and resources from the server with enhanced descriptions
    const tools = Array.from(server.toolHandlers.entries()).map(([name, handler]) => {
      const toolInfo = server.toolInfo.get(name) || {};
      return {
        name,
        description: toolInfo.description || `Tool: ${name}`,
        parameters: Object.entries(handler.parameters || {}).map(([paramName, schema]) => ({
          name: paramName,
          description: schema.description || paramName,
          type: getSchemaType(schema),
          required: !schema.isOptional,
        })),
        usage: toolInfo.usage || []
      };
    });
    
    const resources = Array.from(server.resourceHandlers.entries()).map(([name, handler]) => {
      const template = server.resourceTemplates.get(name);
      return {
        name,
        description: template?.options?.description || `Resource: ${name}`,
        uriTemplate: template?.template || "",
        parameters: template?.parameters || []
      };
    });
    
    const prompts = Array.from(server.promptHandlers.entries()).map(([name, handler]) => {
      const promptInfo = server.promptInfo.get(name) || {};
      return {
        name,
        description: promptInfo.description || `Prompt: ${name}`,
        parameters: Object.entries(handler.parameters || {}).map(([paramName, schema]) => ({
          name: paramName,
          description: schema.description || paramName,
          type: getSchemaType(schema),
          required: !schema.isOptional,
        })),
        usage: promptInfo.usage || ""
      };
    });
    
    // Send back the enhanced discovery response
    const response = {
      id: message.id,
      type: 'discover_response',
      name: server.name,
      version: server.version,
      description: server.description,
      tools,
      resources,
      prompts,
      examples: [
        {
          description: "List all tasks in the system",
          tool: "listTasks",
          parameters: {}
        },
        {
          description: "Create a high priority development task",
          tool: "createTask",
          parameters: {
            task: "Implement authentication middleware",
            category: "Development",
            priority: "high"
          }
        },
        {
          description: "Mark a task as complete",
          tool: "updateTask",
          parameters: {
            taskId: 5,
            status: "done"
          }
        }
      ]
    };
    
    console.log('Sending discovery response:', JSON.stringify(response));
    return response;
  }
  
  // If not a discovery request, let the default handler process it
  return null;
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

// Start receiving messages on stdin and sending messages on stdout
await server.connect(transport);
console.log("MCP Task API Server started. Ready to process messages.");