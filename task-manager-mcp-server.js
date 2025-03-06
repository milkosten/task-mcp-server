#!/usr/bin/env node
/**
 * Task Manager MCP Server - Using the official MCP SDK
 * 
 * This implementation uses the official Model Context Protocol SDK
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ResourceSchema,
  ToolSchema,
  PromptSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

// Load environment variables
dotenv.config();

// Setup logging to avoid stdout corruption
const logDebug = (message) => {
  fs.appendFileSync("api_debug.log", `${new Date().toISOString()} - ${message}\n`);
};

const logError = (message) => {
  fs.appendFileSync("api_error.log", `${new Date().toISOString()} - ${message}\n`);
};

// API configuration
const API_BASE_URL = process.env.TASK_MANAGER_API_BASE_URL || 
  "https://task-master-pro-mikaelwestoo.replit.app/api";
const API_KEY = process.env.TASK_MANAGER_API_KEY;

if (!API_KEY) {
  logError("API_KEY not found in environment variables!");
}

// Helper function to make authenticated API requests
async function makeApiRequest(method, endpoint, data = null, params = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  
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
    logDebug(`Request details: Method=${method}, URL=${url}, Params=${JSON.stringify(params)}, Data=${JSON.stringify(data)}`);

    // Configure axios request options
    const requestConfig = {
      method,
      url,
      headers,
      data,
      params,
      maxRedirects: 0,
      timeout: 20000,
      validateStatus: (status) => status < 500 // Don't reject if status code is less than 500
    };
    
    // Ensure proper data encoding for all requests
    if (data) {
      requestConfig.data = JSON.stringify(data);
    }
    
    const response = await axios(requestConfig);
    
    // Check for HTTP error status codes
    if (response.status >= 400 && response.status < 500) {
      logError(`HTTP error ${response.status} from API: ${JSON.stringify(response.data)}`);
      throw new Error(`API Error (${response.status}): ${JSON.stringify(response.data)}`);
    }
    
    return response.data;
  } catch (error) {
    logError(`API Error: ${error.message}`);
    
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

// Create a new MCP server
const server = new Server({
  name: "Task Management API Server",
  version: "1.0.0",
  description: "Task Management API that provides CRUD operations for tasks with categories, priorities, and statuses"
});

// Define schema for Task
const TaskSchema = z.object({
  id: z.number().int().positive().describe("Unique task identifier"),
  task: z.string().describe("The task description/title"),
  category: z.string().describe("Task category (e.g., 'Development', 'Documentation')"),
  priority: z.enum(["low", "medium", "high"]).describe("Task priority level"),
  status: z.enum(["not_started", "started", "done"]).describe("Current task status"),
  create_time: z.string().describe("Task creation timestamp in ISO format"),
});

// Define schema for Task List
const TaskListSchema = z.object({
  tasks: z.array(TaskSchema).describe("List of tasks"),
});

// Register tools

// Tool: List Tasks
server.registerTool({
  name: "listTasks",
  description: "Lists all tasks in the system, optionally filtered by status and/or priority",
  parameters: z.object({
    status: z.enum(["not_started", "started", "done"]).optional()
      .describe("Filter tasks by status (optional)"),
    priority: z.enum(["low", "medium", "high"]).optional()
      .describe("Filter tasks by priority level (optional)"),
  }),
  handler: async ({ status, priority }) => {
    try {
      const params = {};
      if (status) params.status = status;
      if (priority) params.priority = priority;

      const tasksResponse = await makeApiRequest("GET", "/tasks", null, params);
      
      // More flexible validation for tasks data structure
      let tasks = [];
      
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
            tasks = tasksProp.value;
            logDebug(`Found tasks array in property: ${tasksProp.key}`);
          } else {
            logError(`No tasks array found in response: ${JSON.stringify(tasksResponse)}`);
          }
        }
      }
      
      // If we still couldn't find tasks, log error and return empty array
      if (tasks.length === 0) {
        logError(`Invalid or empty tasks data structure: ${JSON.stringify(tasksResponse)}`);
      }
      
      // Format response in a way that's useful for AI to parse
      const formattedTasks = tasks.map(task => ({
        id: task.id,
        task: task.task || "No description", // Added fallback for missing task description
        category: task.category,
        priority: task.priority || "medium", // Fallback for missing priority
        status: task.status || "not_started", // Fallback for missing status
        createTime: task.create_time || task.created_at || task.createTime || new Date().toISOString()
      }));
      
      logDebug(`DEBUG listTasks response: ${JSON.stringify(formattedTasks)}`);

      return {
        content: [
          {
            type: "text",
            text: `Found ${tasks.length} tasks${status ? ` with status '${status}'` : ''}${priority ? ` and priority '${priority}'` : ''}.`,
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
  }
});

// Tool: Create Task
server.registerTool({
  name: "createTask",
  description: "Creates a new task with the specified details",
  parameters: z.object({
    task: z.string().min(1, "Task description is required")
      .describe("The task description or title"),
    category: z.string().min(1, "Category is required")
      .describe("Task category (e.g., 'Development', 'Documentation')"),
    priority: z.enum(["low", "medium", "high"]).optional()
      .describe("Task priority level (defaults to 'medium' if not specified)"),
    status: z.enum(["not_started", "started", "done"]).optional()
      .describe("Initial task status (defaults to 'not_started' if not specified)"),
  }),
  handler: async ({ task, category, priority, status }) => {
    try {
      const requestBody = {
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
            text: `Task created successfully with ID: ${newTask.id}`,
          },
          {
            type: "json",
            json: {
              id: newTask.id,
              task: newTask.task || task,
              category: newTask.category || category,
              priority: newTask.priority || priority || "medium",
              status: newTask.status || status || "not_started",
              create_time: newTask.create_time || new Date().toISOString()
            },
          },
        ],
      };
    } catch (error) {
      logError(`Error in createTask: ${error.message}`);
      
      return {
        content: [
          {
            type: "text",
            text: `Error creating task: ${error.message}`,
          }
        ],
      };
    }
  }
});

// Tool: Update Task
server.registerTool({
  name: "updateTask",
  description: "Updates an existing task with new values for one or more fields",
  parameters: z.object({
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
  }),
  handler: async ({ taskId, task, category, priority, status }) => {
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
  }
});

// Tool: Delete Task
server.registerTool({
  name: "deleteTask",
  description: "Permanently deletes a task from the system",
  parameters: z.object({
    taskId: z.number().int().positive("Task ID must be a positive integer")
      .describe("The unique ID of the task to delete"),
  }),
  handler: async ({ taskId }) => {
    try {
      const response = await makeApiRequest("DELETE", `/tasks/${taskId}`);
      
      logDebug(`Deleted task ID ${taskId}`);

      return {
        content: [
          {
            type: "text",
            text: response.message || `Task ${taskId} deleted successfully.`,
          },
        ],
      };
    } catch (error) {
      logError(`Error in deleteTask: ${error.message}`);
      
      return {
        content: [
          {
            type: "text",
            text: `Error deleting task: ${error.message}`,
          },
        ],
      };
    }
  }
});

// Register resources

// Resource: Tasks list
server.registerResource({
  name: "tasks",
  description: "Retrieves a list of all tasks in the system with their details",
  uriPattern: "tasks://list",
  handler: async (uri, params) => {
    try {
      const tasks = await makeApiRequest("GET", "/tasks");
      
      // Validate the tasks structure
      if (!tasks || !tasks.tasks || !Array.isArray(tasks.tasks)) {
        logError(`Invalid tasks data structure: ${JSON.stringify(tasks)}`);
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
        contents: tasks.tasks.map((task) => ({
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
    } catch (error) {
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
});

// Resource: Individual task
server.registerResource({
  name: "task",
  description: "Retrieves details of a specific task by its ID",
  uriPattern: "tasks://task/{taskId}",
  handler: async (uri, params) => {
    try {
      // Try direct task endpoint first
      let task;
      try {
        const taskResult = await makeApiRequest("GET", `/tasks/${params.taskId}`);
        if (taskResult && (taskResult.id || taskResult.task)) {
          task = taskResult;
        }
      } catch (directError) {
        logDebug(`Direct task fetch failed, using task list fallback: ${directError.message}`);
        // Fallback to getting all tasks and filtering
        const tasks = await makeApiRequest("GET", "/tasks");
        task = tasks.tasks.find((t) => t.id === Number(params.taskId) || t.id === params.taskId);
      }
      
      if (!task) {
        return {
          contents: [{
            uri: uri,
            text: `Task with ID ${params.taskId} not found`,
            metadata: { error: "Task not found" }
          }]
        };
      }

      // Format task for easy display
      return {
        contents: [
          {
            uri: uri,
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
          uri: uri,
          text: `Error retrieving task ${params.taskId}: ${error.message}`,
          metadata: { error: error.message }
        }]
      };
    }
  }
});

// Register prompts

// Prompt: List all tasks with category analysis
server.registerPrompt({
  name: "listAllTasks",
  description: "Lists all tasks grouped by category with priority summary",
  parameters: z.object({}),
  handler: () => ({
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
  })
});

// Prompt: Create task with natural language
server.registerPrompt({
  name: "createTaskNaturalLanguage",
  description: "Creates a task from a natural language description by extracting key details",
  parameters: z.object({
    description: z.string().min(10, "Task description must be at least 10 characters")
      .describe("A natural language description of the task to create"),
  }),
  handler: ({ description }) => ({
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
  })
});

// Prompt: Create new task with specific parameters
server.registerPrompt({
  name: "createNewTask",
  description: "Creates a new task with specific title, category and optional priority",
  parameters: z.object({
    task: z.string().min(1, "Task description is required")
      .describe("The task description or title"),
    category: z.string().min(1, "Category is required")
      .describe("Task category"),
    priority: z.enum(["low", "medium", "high"]).optional()
      .describe("Task priority level"),
  }),
  handler: ({ task, category, priority }) => ({
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
  })
});

// Prompt: Task progress report
server.registerPrompt({
  name: "taskProgressReport",
  description: "Generates a progress report on tasks with key statistics and insights",
  parameters: z.object({
    status: z.enum(["not_started", "started", "done"]).optional()
      .describe("Filter by task status"),
  }),
  handler: ({ status }) => ({
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
  })
});

// Create and start the server with stdio transport
const transport = new StdioServerTransport();
server.listen(transport);

logDebug("Task Manager MCP Server started. Ready to process messages.");