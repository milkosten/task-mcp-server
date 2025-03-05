# MCP Task Management API

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) ![](https://img.shields.io/badge/MCP-Enabled-blue?style=flat-square)

A Model Context Protocol (MCP) implementation for task management, designed to be used as a tool by AI assistants and chatbots.

## Overview

This project provides a complete MCP server that wraps a Task Management API, allowing AI models to:

- List, create, update, and delete tasks
- Filter tasks by status and priority
- Process natural language task descriptions
- Generate task reports and insights

The server follows the MCP standard, making it easy for AI models to discover capabilities and interact with the task management system.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env file with your API key and configuration

# Start the MCP server
npm start

# Run tests
npm test
```

## Integration with AI Chat Models

### Option 1: Direct MCP Communication

AI systems that support MCP protocols can connect directly to the server.

### Option 2: Tool Implementation for AI Models

To implement the Task API as a tool for AI models like Claude or GPT:

1. **Create a Tool Definition**:

```javascript
const taskApiTool = {
  name: "task_manager",
  description: "Manage tasks including creating, updating, listing, and deleting tasks",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "create", "update", "delete"],
        description: "The action to perform"
      },
      taskId: {
        type: "number",
        description: "Task ID for update/delete operations"
      },
      task: {
        type: "string",
        description: "Task description for create/update operations"
      },
      category: {
        type: "string",
        description: "Task category for create/update operations"
      },
      priority: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Task priority level"
      },
      status: {
        type: "string",
        enum: ["not_started", "started", "done"],
        description: "Task status"
      }
    },
    required: ["action"]
  }
};
```

2. **Create Tool Handler Function**:

```javascript
import { spawn } from 'child_process';
import { promisify } from 'util';

async function handleTaskManagerTool(params) {
  const { action, ...taskParams } = params;
  
  // Map action to MCP tool
  let mcpTool;
  switch(action) {
    case 'list': mcpTool = 'listTasks'; break;
    case 'create': mcpTool = 'createTask'; break;
    case 'update': mcpTool = 'updateTask'; break;
    case 'delete': mcpTool = 'deleteTask'; break;
    default: throw new Error(`Unknown action: ${action}`);
  }
  
  // Create MCP request
  const mcpRequest = {
    type: 'invoke',
    tool: mcpTool,
    parameters: taskParams,
    id: Date.now().toString()
  };
  
  // Execute MCP request
  const serverProcess = spawn('node', ['task-manager-mcp-server.js']);
  serverProcess.stdin.write(JSON.stringify(mcpRequest) + '\n');
  
  // Wait for response and return results
  // Implementation details...
}
```

3. **Register Tool with AI Model API**:

Implementation varies by AI provider. Here's an example using Claude:

```javascript
const response = await client.messages.create({
  model: "claude-3-opus-20240229",
  max_tokens: 1000,
  system: `You are an assistant with access to a task management system. 
  When users ask about creating, viewing, updating, or deleting tasks, use the task_manager tool.
  
  Task properties:
  - task: The description of what needs to be done
  - category: The category the task belongs to (e.g., "Development", "Marketing")
  - priority: How important the task is ("low", "medium", "high")
  - status: Current state of the task ("not_started", "started", "done")
  
  For creating tasks, you MUST use the task_manager tool with action="create".
  For listing tasks, you MUST use the task_manager tool with action="list".
  For updating tasks, you MUST use the task_manager tool with action="update".
  For deleting tasks, you MUST use the task_manager tool with action="delete".
  
  When creating or updating tasks:
  1. Always extract the task description, category, and priority from the user's request
  2. If the user doesn't specify a category, ask them for one
  3. If the user doesn't specify a priority, default to "medium"
  4. Provide a clear confirmation after the operation succeeds`,
  messages: [
    { role: "user", content: "Create a task to implement user authentication for the website. It's high priority." }
  ],
  tools: [taskApiTool]
});
```

### Sample System Instructions for AI Models

#### Basic Task Management

```
You have access to a task management system through the task_manager tool. 
Use this tool whenever users want to:
- Create new tasks
- List existing tasks
- Update task details (description, category, priority, status)
- Delete tasks

ALWAYS use the task_manager tool for these operations rather than simulating them.

When users ask to create a task:
1. Extract the task details (description, category, priority, status)
2. Use the tool with action="create" and the extracted parameters
3. Confirm the task was created successfully and mention the task ID

When users ask to list tasks:
1. Determine if they want to filter by status or priority
2. Use the tool with action="list" and any filter parameters
3. Present the results in a clear, organized format

When users ask to update a task:
1. Determine which task to update (by ID)
2. Extract the fields to update
3. Use the tool with action="update", the task ID, and the fields to update
4. Confirm the update was successful

When users ask to delete a task:
1. Confirm they want to delete the task
2. Use the tool with action="delete" and the task ID
3. Confirm the deletion was successful
```

#### Advanced Task Management

```
You have access to a task management system through the task_manager tool.

IMPORTANT GUIDELINES:
1. ALWAYS use the task_manager tool for task operations - never pretend to create or modify tasks.
2. Extract detailed information from user requests to make the tasks specific and actionable.
3. When task details are ambiguous, ask clarifying questions before using the tool.
4. After each operation, provide a clear confirmation including relevant details.
5. For listing operations, organize the information in a helpful way based on what the user is looking for.

TASK CREATION PROTOCOL:
When users want to create a task, follow these steps:
1. Extract the core task description, category, and priority from their request
2. If any essential details are missing, ask for clarification
3. Use action="create" with the parameters
4. Confirm creation with task ID and summary

TASK LISTING PROTOCOL:
When users ask about existing tasks:
1. Determine if they want specific filtering (status, priority, category)
2. Use action="list" with appropriate filters
3. Present the results in the most relevant format:
   - If few tasks, show full details
   - If many tasks, group by category or status
   - If looking for specific priority, highlight important fields
   - Include task IDs so they can be referenced for updates

TASK UPDATE PROTOCOL:
For task updates:
1. Verify the task ID to update
2. Extract only the fields that should change
3. Use action="update" with taskId and changed fields only
4. Confirm the specific changes made

TASK DELETION PROTOCOL:
For task deletion:
1. Always confirm deletion intent if not explicitly clear
2. Use action="delete" with the task ID
3. Acknowledge the deletion and mention what was deleted

Remember that tasks have these properties: task (description), category, priority ("low", "medium", "high"), and status ("not_started", "started", "done").
```

## Architecture

The MCP Task API implementation consists of:

1. **MCP Server (`task-manager-mcp-server.js`)**: Implements the Model Context Protocol interface
2. **Task API Client**: Communicates with the external Task API service
3. **Resources**: Exposes task collections and individual tasks
4. **Tools**: Provides task CRUD operations
5. **Prompts**: Natural language interactions for common operations
6. **Test Client**: Verifies correct operation of the MCP server

## Documentation

- [MCP-TASKAPI-DOCUMENTATION.md](./MCP-TASKAPI-DOCUMENTATION.md) - Comprehensive integration guide
- [README-TESTING.md](./README-TESTING.md) - Testing procedures and information

## Dependencies

```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.6.1",
  "axios": "^1.8.1",
  "dotenv": "^16.4.5",
  "uuid": "^9.0.1",
  "zod": "^3.24.2"
}
```

## License

[MIT](LICENSE.md)