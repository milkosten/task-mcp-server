# Task Manager MCP API Testing Documentation

This document explains how to test the Model Context Protocol (MCP) Task Manager API Server using the included test client.

## Overview

The test suite verifies that the Task Manager MCP API Server correctly implements the Model Context Protocol, providing proper task management capabilities through the standard MCP interfaces for resources, tools, and prompts.

## Testing Components

The testing system consists of:

1. **MCP Server** (`task-manager-mcp-server.js`) - The server being tested
2. **MCP Test Client** (`mcp-client-test.js`) - A comprehensive test client that validates all server functionality using the official MCP SDK

## Dependencies

The testing tools require the following dependencies:

```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.6.1",
  "axios": "^1.8.1",
  "dotenv": "^16.4.5",
  "uuid": "^9.0.1",
  "zod": "^3.24.2"
}
```

## Running Tests

### Prerequisites

Before running tests, make sure you have:

1. Node.js 18 or higher installed
2. Installed dependencies: `npm install`

### Running the Test Suite

To run the comprehensive test suite:

```bash
npm test
```

or directly:

```bash
node mcp-client-test.js
```

This will:
1. Launch the Task Manager MCP server in a child process
2. Run comprehensive tests against all server capabilities
3. Generate detailed test reports and logs

## Test Coverage

The test suite verifies:

### 1. Discovery

- Server properly exposes capabilities
- All required tools and resources are available

### 2. Resources

- `tasks://list` - Tasks list resource returns all tasks
- `tasks://task/{id}` - Individual task resource returns correct task data

### 3. Tools 

- `listTasks` - List all tasks with optional filtering
- `createTask` - Create a new task with specified properties
- `updateTask` - Update an existing task
- `deleteTask` - Delete a task

### 4. Prompts

- `listAllTasks` - List tasks with category organization
- `createTaskNaturalLanguage` - Create task from natural language
- `taskProgressReport` - Generate task progress report

### 5. Error Handling

- Server returns appropriate error responses

## Test Results

The test results are saved in two formats:

1. **Test Log** - Plain text log of all test executions
   - Located at: `./test-reports/test-log.txt`
   - Contains timestamp, test name, status, and message

2. **Test Report** - JSON structured report
   - Located at: `./test-reports/test-report-[timestamp].json`
   - Contains test summary and detailed results

## Interpreting Results

A successful test run will show:
- Green checkmarks (✅) for all tests
- 100% success rate in the summary
- Detailed information about each test in the log files

## Troubleshooting

If tests fail:

1. Check the test log for specific error messages
2. Verify the Task Manager MCP server is properly implemented
3. Ensure the Task API endpoint is accessible
4. Check that the API key is valid
5. Verify that all required dependencies are installed

## Custom Testing

You can modify the test client to add additional tests or focus on specific aspects:

- Add new test cases to `runTests()` method
- Modify test parameters to check edge cases
- Add specific error tests to verify error handling

The test client uses the official `@modelcontextprotocol/sdk` library to communicate with the MCP server, ensuring compatibility with the protocol specification. This allows for reliable testing that matches how real clients would interact with the server.

## Integration with CI/CD

To integrate with CI/CD pipelines:

1. Run tests with `npm test`
2. Use the exit code to determine test success/failure in CI systems
3. Archive test reports as build artifacts

---

For more information about the Task Manager MCP API, refer to the main documentation file (MCP-TASKAPI-DOCUMENTATION.md).