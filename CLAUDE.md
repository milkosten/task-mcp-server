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
- API logs: `api_debug.log` and `api_error.log` contain transaction details

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
- **Docs**: JSDoc comments for public functions
- **Response**: Flexible data extraction for varied API responses

## Logging Guidelines
- **IMPORTANT**: Avoid `console.log` in the main server code - it interferes with stdio MCP communication
- Use file-based logging for debugging (api_debug.log, api_error.log)
- For HTTP server mode, console logs are acceptable
- Consider using debug mode flags to control verbose logging