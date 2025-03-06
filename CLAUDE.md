# CLAUDE.md - Task MCP Server Guidelines

## Commands
- Build/run: `npm start` (runs `node task-manager-mcp-server.js`)
- Test all: `npm test` (runs `node mcp-client-test.js` - creates and cleans test data)
- Test mock client: `node mcp-client-test-mock.js` (uses simulated responses, no API needed)
- Run standalone server: `node mcp-server-standalone.js`
- View test reports: Check `./test-reports/test-log.txt` for detailed results
- Run specific tests: 
  ```javascript
  // Edit mcp-client-test.js and comment out unwanted test sections in runTests() method:
  async runTests() {
    await this.runDiscoveryTest();  // Tests server discovery
    // await this.runResourceTests(); // Tests resources 
    // await this.runToolTests();     // Tests tools
    // await this.runPromptTests();   // Tests prompts
  }
  ```
- Debug: Check `api_debug.log` and `api_error.log` for API transactions

## Environment Setup
- Configure with `.env` file (copy from `.env.template`)
- Required variables: `API_BASE_URL`, `API_KEY`
- Developer setup: Run `npm install` to install dependencies
- Node.js 18+ required (specified in package.json)

## Code Style
- **Project type**: ES Modules with `"type": "module"` in package.json
- **Imports**: ES module syntax (`import x from 'y'`)
- **Formatting**: 2-space indentation, trailing commas in multi-line objects/arrays
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Error handling**: Use try/catch with specific error messages and platform-aware logging
- **Validation**: Use Zod for schema validation and data parsing
- **Async**: Prefer async/await over Promise chains
- **Documentation**: JSDoc comments for public functions and parameters
- **HTTP client**: Axios with platform-specific configurations for Windows compatibility
- **MCP protocol**: Follow MCP 1.6.1 specifications for all endpoints

## Cross-Platform Compatibility
- **Windows headers**: Use `Connection: close`, `Cache-Control: no-cache`, explicit charset
- **Request config**: Longer timeouts (20000ms) on Windows, custom JSON encoding
- **Response handling**: Flexible data extraction for different platform responses
- **Testing**: Run tests on both Windows and WSL/Linux environments
- **Logging**: Enhanced platform-specific troubleshooting in log files