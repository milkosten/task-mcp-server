# CLAUDE.md - Task MCP Server Guidelines

## Commands
- Build/run: `npm start` (runs `node task-manager-mcp-server.js`)
- Test all: `npm test` (runs `node mcp-client-test.js` - creates and cleans test data)
- Test mock client: `node mcp-client-test-mock.js` (uses simulated responses, no API needed)
- Run standalone server: `node mcp-server-standalone.js`
- View test reports: Check `./test-reports/test-log.txt` for detailed results
- Run specific tests: Edit `mcp-client-test.js` and comment out unwanted test sections in the `runTests()` method (around line 317):
  - `await this.runDiscoveryTest()` - Tests server discovery
  - `await this.runResourceTests()` - Tests resources
  - `await this.runToolTests()` - Tests tools
  - `await this.runPromptTests()` - Tests prompts
- Lint/format: Not specified in codebase (consider adding ESLint/Prettier)

## Environment Setup
- Configure with `.env` file (copy from `.env.example`)
- Required variables: `TASK_MANAGER_API_KEY`, `TASK_MANAGER_API_BASE_URL`
- Developer setup: Run `npm install` to install required dependencies
- Node.js 18+ required (specified in package.json)

## Code Style
- **Project type**: ES Modules (not CommonJS)
- **Node version**: 18+ required
- **Imports**: ES module syntax (`import x from 'y'`)
- **Formatting**: 2-space indentation, trailing commas in multi-line objects
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Error handling**: Use try/catch with meaningful error messages, log details
- **Validation**: Use Zod for parameter/schema validation
- **Async code**: Prefer async/await over callbacks or Promise chains
- **Documentation**: Include JSDoc comments for all functions and classes
- **MCP protocol**: Follow MCP 1.6.1 specifications for all endpoints

## Project Structure
This repo implements a Model Context Protocol (MCP) server for task management with:
- **Core file**: `task-manager-mcp-server.js` - Main MCP server implementation
- **Resources**: Task lists (`tasks://list`) and individual tasks (`tasks://task/{taskId}`)
- **Tools**: CRUD operations (listTasks, createTask, updateTask, deleteTask)
- **Prompts**: Natural language task management (listAllTasks, createTaskNaturalLanguage)
- **Testing**: Test client in `mcp-client-test.js` with mock version for offline testing
- Uses MCP SDK v1.6.1 (github.com/modelcontextprotocol/typescript-sdk)

Current status: All endpoints functional when connected to a properly configured Task API
Communication: Server uses standard MCP JSON protocol over stdin/stdout streams

## Platform Compatibility
The server includes special handling for cross-platform compatibility:

### Windows-specific Accommodations
- **HTTP Headers**: Uses different headers on Windows for reliable API communication
  - Sets `Connection: close` to prevent connection reuse issues 
  - Uses `Cache-Control: no-cache` to bypass potential caching problems
  - Specifies explicit charset in Content-Type: `application/json; charset=utf-8`
- **Request Configuration**: 
  - Longer timeouts (20000ms vs 10000ms)
  - Disables automatic redirects and decompression
  - Custom transformation for proper JSON encoding
- **Response Handling**:
  - Flexible task data extraction to handle different response formats
  - More robust error handling with platform-specific details
  - Enhanced logging for Windows-specific troubleshooting

### Testing
- Run tests on both Windows and WSL/Linux to ensure cross-platform functionality
- Check log files (`api_debug.log` and `api_error.log`) for platform-specific issues
- Windows tests may require different environment configurations