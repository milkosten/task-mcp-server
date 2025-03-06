# CLAUDE.md - Task MCP Server Guidelines

## Commands
- Build/run: `npm start` (starts the MCP server)
- HTTP server: `npm run http` (runs HTTP wrapper for Cursor integration)
- Test all: `npm test` (runs all tests and cleans test data)
- Single test: Comment unwanted sections in mcp-client-test.js:
  ```javascript
  async runTests() {
    await this.runDiscoveryTest();  // Server discovery
    // await this.runResourceTests(); // Resources 
    // await this.runToolTests();     // Tools
    // await this.runPromptTests();   // Prompts
  }
  ```
- Test logs: Check `./test-reports/test-log.txt` for detailed output

## Environment Setup
- Configure: Create `.env` file with required variables:
  ```
  TASK_MANAGER_API_BASE_URL=your_api_url
  TASK_MANAGER_API_KEY=your_api_key
  MCP_HTTP_PORT=3510
  ```
- Install: `npm install` (requires Node.js 18+)

## Code Style Guidelines
- **Modules**: ES Modules with `import/export` (type: "module" in package.json)
- **Format**: 2-space indent, trailing commas, semicolons required
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Types**: Use Zod schemas for validation and type safety
- **Errors**: Try/catch with detailed error messages and logging
- **Async**: Prefer async/await over Promise chains
- **API**: Axios with consistent headers and error handling
- **Protocol**: MCP 1.6.1 specification (@modelcontextprotocol/sdk)
- **Logging**: File-based logging (api_debug.log, api_error.log) instead of console.log in server code

## Architecture
- **Server**: Main MCP server (task-manager-mcp-server.js) implementing MCP interface
- **HTTP Wrapper**: HTTP server for Cursor integration (mcp-http-server.js)
- **Tools**: Task CRUD operations implemented as MCP tools
- **Resources**: Task collection and individual task resources
- **IMPORTANT**: Avoid `console.log` in server code - interferes with stdio MCP communication