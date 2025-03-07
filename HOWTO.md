# How to Use the MCP Task Manager API

This guide will walk you through installing, configuring, testing, and running the Model Context Protocol (MCP) Task Manager API.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Running the Server](#running-the-server)
5. [Testing](#testing)
6. [Using the Client](#using-the-client)
7. [API Reference](#api-reference)
8. [Troubleshooting](#troubleshooting)

## Overview

This package implements a Model Context Protocol (MCP) server that wraps an external Task Manager API. It provides resources and tools for managing tasks through the MCP standard, allowing AI assistants to interact with your task management system.

Key features:
- List, create, update, and delete tasks
- Filter tasks by status and priority
- Natural language task creation
- Task progress reporting

## Installation

### Prerequisites

- Node.js 16 or higher
- npm or pnpm

### Steps

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd mcp-template-ts
   ```

2. Install dependencies:
   ```bash
   npm install
   # or with pnpm
   pnpm install
   ```

3. Build the project:
   ```bash
   npm run build
   # or
   pnpm run build
   ```

## Configuration

Create a `.env` file in the project root with the following variables:

```
TASK_MANAGER_API_BASE_URL=https://your-task-api-url.com/api
TASK_MANAGER_API_KEY=your_api_key
```

Configuration notes:
- `TASK_MANAGER_API_BASE_URL` - The URL for your Task API server (default: "https://task-master-pro-mikaelwestoo.replit.app/api")
- `TASK_MANAGER_API_KEY` - Your API key for authentication (required)

## Running the Server

Run the MCP server to make it available to clients:

```bash
node dist/index.js
```

The server will start and listen for MCP commands on stdin/stdout.

To keep the server running in watch mode during development:

```bash
npm run watch
```

## Testing

Run the automated tests to verify the server is working correctly:

```bash
npm test
```

This will:
1. Start an MCP server instance
2. Connect a test client
3. Test all available tools (list, create, update, delete tasks)
4. Check resource availability
5. Report test results

The test client uses the MCP SDK to communicate with the server, simulating how an AI assistant would interact with it.

## Using the Client

You can build your own client or use the provided example client:

1. Build the client (if you've modified it):
   ```bash
   npm run build
   ```

2. Run the client:
   ```bash
   node dist/client.js
   ```

### Client Integration

To integrate with your own application, use the MCP SDK client:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Create a client transport
const transport = new StdioClientTransport({
  command: "node",
  args: ["./dist/index.js"]
});

// Initialize client
const client = new Client(
  {
    name: "your-client-name",
    version: "1.0.0"
  },
  {
    capabilities: {
      prompts: {},
      resources: {},
      tools: {}
    }
  }
);

// Connect to the server
await client.connect(transport);

// Use the client
const tasks = await client.callTool({
  name: "listTasks",
  arguments: {}
});

console.log(tasks.content[0].text);
```

## API Reference

### Tools

#### listTasks
Lists all tasks, optionally filtered by status or priority.

Parameters:
- `status` (optional): "not_started", "started", or "done"
- `priority` (optional): "low", "medium", or "high"

#### createTask
Creates a new task.

Parameters:
- `task` (required): Task description/title
- `category` (required): Task category
- `priority` (optional): "low", "medium", or "high"
- `status` (optional): "not_started", "started", or "done"

#### updateTask
Updates an existing task.

Parameters:
- `taskId` (required): ID of the task to update
- `task` (optional): New task description
- `category` (optional): New task category
- `priority` (optional): New task priority
- `status` (optional): New task status

#### deleteTask
Deletes a task.

Parameters:
- `taskId` (required): ID of the task to delete

### Prompts

#### listAllTasks
Lists all tasks grouped by category with priority summaries.

#### createTaskNaturalLanguage
Creates a task from a natural language description.

Parameters:
- `description`: Natural language description of the task

#### createNewTask
Creates a task with specific parameters.

Parameters:
- `task`: Task description
- `category`: Task category
- `priority` (optional): Task priority

#### taskProgressReport
Generates a progress report on tasks.

Parameters:
- `status` (optional): Filter by task status

### Resources

- `tasks://list`: List of all tasks
- `tasks://task/{taskId}`: Details of a specific task

## Troubleshooting

### Common Issues

1. **API Key Authentication Failed**
   - Ensure you've set the correct API key in the `.env` file
   - Check if the API key has the necessary permissions

2. **Cannot Connect to Task API**
   - Verify the API base URL is correct in your `.env` file
   - Check your network connection
   - Look for error details in the api_error.log file

3. **TypeScript Build Errors**
   - Run `npm install` to ensure all dependencies are installed
   - Check that you're using Node.js 16+

4. **Test Client Errors**
   - Check that the server is running on the expected path
   - Verify the MCP SDK version is compatible with your code

For more detailed debugging, check the logs in:
- `api_debug.log`: Detailed API request logging
- `api_error.log`: API error details