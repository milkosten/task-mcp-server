# Integrating MCP Task Manager with Claude Cursor

This guide explains how to set up and use the MCP Task Manager with Claude Cursor.

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   # Create .env file from template (if available) or create a new one
   cp .env.example .env  # If example exists
   
   # Edit .env file to include:
   TASK_MANAGER_API_BASE_URL=your_api_url
   TASK_MANAGER_API_KEY=your_api_key
   # HTTP port setting (default is 3510)
   MCP_HTTP_PORT=3510
   ```

3. **Start the HTTP Server**
   ```bash
   # Using npm script
   npm run http
   
   # Or directly
   node mcp-http-server.js
   ```

4. **Verify Server is Running**
   You should see output confirming the server is running:
   ```
   MCP HTTP Server running at http://localhost:3510
   POST endpoint available at http://localhost:3510/mcp
   ```

## Configuring Claude Cursor

1. **Open Claude Cursor Settings**
   In your Cursor IDE, open settings for Claude integration.

2. **Add Custom Tool**
   - Tool Name: `task_manager`
   - Method: `POST`
   - URL: `http://localhost:3510/mcp`
   - Schema:
     ```json
     {
       "type": "object",
       "properties": {
         "type": {
           "type": "string",
           "enum": ["invoke", "resource", "prompt"],
           "description": "Type of MCP request"
         },
         "tool": {
           "type": "string",
           "description": "MCP tool to invoke (for invoke type)"
         },
         "parameters": {
           "type": "object",
           "description": "Parameters for the MCP tool or prompt"
         },
         "uri": {
           "type": "string",
           "description": "URI for resource requests"
         },
         "prompt": {
           "type": "string",
           "description": "Prompt name for prompt requests"
         },
         "id": {
           "type": "string",
           "description": "Request ID (generated automatically if not provided)"
         }
       },
       "required": ["type"]
     }
     ```

## Using the Task Manager in Claude Cursor

### List Tasks

```json
{
  "type": "invoke",
  "tool": "listTasks",
  "parameters": {}
}
```

### Create Task

```json
{
  "type": "invoke",
  "tool": "createTask",
  "parameters": {
    "task": "Implement login page",
    "category": "Development",
    "priority": "high",
    "status": "not_started"
  }
}
```

### Update Task

```json
{
  "type": "invoke",
  "tool": "updateTask",
  "parameters": {
    "taskId": 123,
    "status": "done"
  }
}
```

### Delete Task

```json
{
  "type": "invoke",
  "tool": "deleteTask",
  "parameters": {
    "taskId": 123
  }
}
```

## Troubleshooting

### Invalid Schema Errors
If you receive "invalid_union unionErrors invalid_literal" errors, ensure:
1. Your JSON request follows the exact format required by the MCP server
2. The "type" field is one of: "invoke", "resource", or "prompt"
3. The required fields for each type are provided

### Connection Errors
If you can't connect to the server:
1. Verify the HTTP server is running (`npm run http`)
2. Check if the port (default 3510) is available or set a different port
3. Ensure no firewall is blocking the connection

### API Errors
If the MCP server reports API errors:
1. Check your API credentials in the .env file
2. Verify the API endpoint is correct and accessible
3. Check api_error.log for detailed error information