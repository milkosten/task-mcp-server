# Task Management API - MCP Integration Guide

This documentation explains how to integrate the Task Management API as a tool for AI assistants using the Model Context Protocol (MCP).

## Overview

The Task Management MCP Server provides a standardized interface for AI agents to manage tasks with operations for listing, creating, updating, and deleting tasks. This implementation follows MCP standards to make it easily discoverable and usable by AI assistants.

## Dependencies

This implementation requires the following dependencies:

```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.6.1",
  "axios": "^1.8.1",
  "dotenv": "^16.4.5",
  "uuid": "^9.0.1", 
  "zod": "^3.24.2"
}
```

## Integration Options

### 1. Direct MCP Connection

AI systems that support the Model Context Protocol can connect directly to this server. The server exposes:

- **Resources**: Collections of data (task lists and individual tasks)
- **Tools**: Functions to perform CRUD operations on tasks
- **Prompts**: Pre-built natural language interactions for common task operations

### 2. API Bridge Integration

For AI systems that don't natively support MCP, you can implement a bridge adapter:

```javascript
import { spawn } from 'child_process';

async function mcpTaskBridge(action, params) {
  // Connect to MCP server
  const mcpServerProcess = spawn('node', ['task-manager-mcp-server.js']);
  
  // Send action request
  const request = {
    type: 'invoke',
    tool: action,  // e.g., "listTasks", "createTask"
    parameters: params
  };
  
  mcpServerProcess.stdin.write(JSON.stringify(request) + '\n');
  
  // Handle response
  // [Implementation details omitted for brevity]
}
```

## Core Capabilities

### 1. Task Resources

The server provides two key resources:

- **tasks://list** - Collection of all tasks
- **tasks://task/{taskId}** - Individual task by ID

### 2. Task Management Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `listTasks` | List all tasks, with optional filtering | `status`, `priority` (both optional) |
| `createTask` | Create a new task | `task`, `category`, `priority`, `status` |
| `updateTask` | Update an existing task | `taskId`, `task`, `category`, `priority`, `status` |
| `deleteTask` | Delete a task | `taskId` |

### 3. Natural Language Prompts

| Prompt | Description | Parameters |
|--------|-------------|------------|
| `listAllTasks` | Lists tasks grouped by category | None |
| `createNewTask` | Create a task with specific parameters | `task`, `category`, `priority` |
| `createTaskNaturalLanguage` | Create a task from natural language | `description` |
| `taskProgressReport` | Generate a status report | `status` (optional) |

## Implementation Guide for AI Coding Agents

### Step 1: Discovery

When first interacting with the MCP server, perform a discovery request to learn its capabilities:

```javascript
// Example discovery request using the MCP SDK
import { McpClient } from '@modelcontextprotocol/sdk/client';

const client = new McpClient();
const capabilities = await client.discover();
console.log(capabilities.tools);  // List all available tools
```

Alternatively, with a direct approach:

```javascript
// Example discovery request
const discoveryRequest = {
  type: 'discover',
  id: 'discovery-1'
};

// Send to MCP server stdin
// The server will respond with detailed capability information
```

### Step 2: Resource Utilization

For browsing tasks or retrieving a specific task:

```javascript
// Example resource request with MCP SDK
const tasksList = await client.getResource('tasks://list');

// Or direct approach
const resourceRequest = {
  type: 'resource',
  uri: 'tasks://list',  // or 'tasks://task/123' for specific task
  id: 'resource-request-1'
};
```

### Step 3: Tool Invocation

For CRUD operations:

```javascript
// Example tool invocation with MCP SDK
const result = await client.invoke('createTask', {
  task: 'Implement authentication',
  category: 'Development',
  priority: 'high'
});

// Or direct approach
const createTaskRequest = {
  type: 'invoke',
  tool: 'createTask',
  parameters: {
    task: 'Implement authentication',
    category: 'Development',
    priority: 'high'
  },
  id: 'create-task-1'
};
```

### Step 4: Prompt Utilization

For higher-level interactions using natural language:

```javascript
// Example prompt request with MCP SDK
const response = await client.prompt('taskProgressReport', {
  status: 'not_started'
});

// Or direct approach
const promptRequest = {
  type: 'prompt',
  prompt: 'taskProgressReport',
  parameters: {
    status: 'not_started'
  },
  id: 'progress-report-1'
};
```

## Task Schema

Tasks have the following properties:

- **id**: Unique identifier (number)
- **task**: Description/title (string)
- **category**: Task category (string)
- **priority**: "low", "medium", or "high" (enum)
- **status**: "not_started", "started", or "done" (enum)
- **create_time**: Creation timestamp (ISO format string)

## Integration Examples

### Example 1: List High Priority Tasks

```javascript
// Request
const request = {
  type: 'invoke',
  tool: 'listTasks',
  parameters: {
    priority: 'high'
  },
  id: 'list-high-priority-1'
};

// Expected response contains:
// - Text summary: "Found X tasks with priority 'high'"
// - JSON data with all high priority tasks
```

### Example 2: Create Task from Natural Language

```javascript
// Request
const request = {
  type: 'prompt',
  prompt: 'createTaskNaturalLanguage',
  parameters: {
    description: 'We need to fix the authentication bug in the login form by Friday. This is critical for security.'
  },
  id: 'natural-language-create-1'
};

// The LLM will analyze the description and extract:
// - task: "Fix authentication bug in login form"
// - category: "Security"
// - priority: "high"
// - with appropriate deadline handling
```

### Example 3: Task Status Update

```javascript
// Request
const request = {
  type: 'invoke',
  tool: 'updateTask',
  parameters: {
    taskId: 5,
    status: 'done'
  },
  id: 'mark-complete-1'
};

// Expected response confirms the update and returns the updated task
```

## Error Handling

The server provides structured error responses:

```javascript
// Example error response
{
  "id": "create-task-1",
  "type": "invoke_response",
  "content": [
    {
      "type": "text",
      "text": "Error creating task: Category is required"
    }
  ]
}
```

## Best Practices for AI Integration

1. **Start with Discovery**: Always perform discovery first to understand available capabilities
2. **Use Natural Language for Complex Tasks**: Leverage the natural language prompts for complex operations
3. **Handle Errors Gracefully**: Parse error messages and provide helpful guidance to users
4. **Provide Examples**: When teaching users about the task system, use the predefined examples
5. **Use Structured Data**: When creating or updating tasks, use the structured tool invocation rather than free-form prompts
6. **Filter Appropriately**: Use status and priority filters to deliver focused results
7. **Parse JSON Responses**: Extract and use the structured JSON data for consistent handling

## Example AI Assistant Implementation

Here's how an AI assistant might handle a user request to create a task:

```
User: "I need to create a task to implement user authentication, it's a high priority development task"

AI Assistant:
[internally]
- Recognizes this is a task creation request
- Maps to the createTask tool
- Extracts parameters:
  - task: "implement user authentication"
  - category: "development" 
  - priority: "high"

[tool invocation]
Sends MCP request to createTask with the extracted parameters

[after receiving successful response]
"I've created your high priority development task 'implement user authentication' with ID 123. You can view it in your task list or update its status when needed."
```

## Debugging

The server logs all requests and responses to:
- `api_debug.log` - Successful API transactions
- `api_error.log` - API errors and exceptions

## Security Considerations

The server now uses environment variables for sensitive credentials:
1. API credentials are stored in a `.env` file that is excluded from version control
2. The dotenv package loads these variables at runtime
3. Additional security measures to consider:
   - Implement proper authentication for AI agents
   - Consider access control for different operations
   - Use more secure authentication mechanisms for production

## Running and Testing

See the [README-TESTING.md](./README-TESTING.md) file for details on how to run and test the MCP server. The test client uses the official `@modelcontextprotocol/sdk` library to ensure proper MCP protocol compatibility.

---

By following this guide, AI coding agents can easily integrate with the Task Management API, providing users with a natural way to manage their tasks through conversation.