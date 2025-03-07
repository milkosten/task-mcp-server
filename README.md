# Task API Server - MCP TypeScript Implementation

A Model Context Protocol (MCP) implementation for Task Management API written in TypeScript. This project serves as both a reference implementation and a functional task management server.

## Overview

This MCP server connects to an external Task API service and provides a standardized interface for task management. It supports two runtime modes:

1. **STDIO Mode**: Standard input/output communication for CLI-based applications and AI agents
2. **HTTP+SSE Mode**: Web-accessible server with Server-Sent Events for browser and HTTP-based clients

The server offers a complete set of task management operations, extensive validation, and robust error handling.

## Features

- **Task Management Operations**:
  - List existing tasks with filtering capabilities
  - Create new tasks with customizable properties
  - Update task details (description, status, category, priority)
  - Delete tasks when completed or no longer needed

- **Dual Interface Modes**:
  - STDIO protocol support for command-line and AI agent integration
  - HTTP+SSE protocol with web interface for browser-based access

- **MCP Protocol Implementation**:
  - Complete implementation of the Model Context Protocol
  - Resources for task data structures
  - Tools for task operations
  - Error handling and informative messages

- **Quality Assurance**:
  - Comprehensive test client for validation
  - Automatic server shutdown after tests complete
  - Detailed validation of API responses

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or pnpm package manager

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/mcp-template-ts.git
   cd mcp-template-ts
   ```

2. Install dependencies:
   ```
   npm install
   ```
   or using pnpm:
   ```
   pnpm install
   ```

3. Create an `.env` file with your Task API credentials:
   ```
   TASK_MANAGER_API_BASE_URL=https://your-task-api-url.com/api
   TASK_MANAGER_API_KEY=your_api_key_here
   TASK_MANAGER_HTTP_PORT=3000
   ```

4. Build the project:
   ```
   npm run build
   ```

### Running the Server

#### STDIO Mode (for CLI/AI integration)

```
npm start
```
or
```
node dist/index.js
```

#### HTTP Mode (for web access)

```
npm run start:http
```
or
```
node dist/http-server.js
```

By default, the HTTP server runs on port 3000. You can change this by setting the `TASK_MANAGER_HTTP_PORT` environment variable.

### Testing

Run the comprehensive test suite to verify functionality:

```
npm test
```

This will:
1. Build the project
2. Start a server instance
3. Connect a test client to the server
4. Run through all task operations
5. Verify correct responses
6. Automatically shut down the server

## Using the MCP Client

### STDIO Client

To connect to the STDIO server from your application:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from 'path';

// Create transport
const transport = new StdioClientTransport({
  command: 'node',
  args: [path.resolve('path/to/dist/index.js')]
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

// Connect to server
await client.connect(transport);

// Example: List all tasks
const listTasksResult = await client.callTool({
  name: "listTasks",
  arguments: {}
});

// Example: Create a new task
const createTaskResult = await client.callTool({
  name: "createTask",
  arguments: {
    task: "Complete project documentation",
    category: "Documentation",
    priority: "high"
  }
});

// Clean up when done
await client.close();
```

### HTTP Client

To connect to the HTTP server from a browser:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Task Manager</title>
  <script type="module">
    import { Client } from 'https://cdn.jsdelivr.net/npm/@modelcontextprotocol/sdk/dist/esm/client/index.js';
    import { SSEClientTransport } from 'https://cdn.jsdelivr.net/npm/@modelcontextprotocol/sdk/dist/esm/client/sse.js';

    document.addEventListener('DOMContentLoaded', async () => {
      // Create transport
      const transport = new SSEClientTransport('http://localhost:3000/mcp');
      
      // Initialize client
      const client = new Client(
        {
          name: "browser-client",
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

      // Connect to server
      await client.connect(transport);
      
      // Now you can use client.callTool() for tasks
    });
  </script>
</head>
<body>
  <h1>Task Manager</h1>
  <!-- Your interface elements here -->
</body>
</html>
```

## Available Tools

### listTasks

Lists all available tasks.

```typescript
const result = await client.callTool({
  name: "listTasks",
  arguments: {
    // Optional filters
    status: "pending", // Filter by status
    category: "Work",  // Filter by category
    priority: "high"   // Filter by priority
  }
});
```

### createTask

Creates a new task.

```typescript
const result = await client.callTool({
  name: "createTask",
  arguments: {
    task: "Complete the project report",  // Required: task description
    category: "Work",                     // Optional: task category
    priority: "high"                      // Optional: low, medium, high
  }
});
```

### updateTask

Updates an existing task.

```typescript
const result = await client.callTool({
  name: "updateTask",
  arguments: {
    taskId: 123,                       // Required: ID of task to update
    task: "Updated task description",  // Optional: new description
    status: "done",                    // Optional: pending, started, done
    category: "Personal",              // Optional: new category
    priority: "medium"                 // Optional: low, medium, high
  }
});
```

### deleteTask

Deletes a task.

```typescript
const result = await client.callTool({
  name: "deleteTask",
  arguments: {
    taskId: 123  // Required: ID of task to delete
  }
});
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| TASK_MANAGER_API_BASE_URL | URL for the external Task API | None (Required) |
| TASK_MANAGER_API_KEY | API key for authentication | None (Required) |
| TASK_MANAGER_HTTP_PORT | Port for the HTTP server | 3000 |
| PORT | Alternative port name (takes precedence) | None |

## Project Structure

```
mcp-template-ts/
├── dist/               # Compiled JavaScript files
├── src/                # TypeScript source files
│   ├── index.ts        # STDIO server entry point
│   ├── http-server.ts  # HTTP+SSE server entry point
│   ├── test-client.ts  # Test client implementation
├── .env                # Environment variables
├── package.json        # Project dependencies
├── tsconfig.json       # TypeScript configuration
└── README.md           # Project documentation
```

## Development

1. Start the TypeScript compiler in watch mode:
   ```
   npm run watch
   ```

2. Run tests to verify changes:
   ```
   npm test
   ```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- This project uses the [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk) for MCP protocol implementation
- Built for integration with AI tooling and web applications