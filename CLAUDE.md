# MCP Template TypeScript - Task Manager API

## Current Project State
The project is a Model Context Protocol (MCP) server implementation for a Task Manager API using TypeScript. It provides two server modes:
1. STDIO server (standard mode) - communicates via standard input/output
2. HTTP+SSE server (web mode) - provides a web-accessible interface with Server-Sent Events

### Key Features Implemented
- Task management operations (list, create, update, delete)
- Both STDIO and HTTP+SSE server interfaces
- File-based logging system
- Comprehensive test client
- Support for environment-based configuration
- Proper server shutdown in test mode

### Server Runtime Modes
- Standard STDIO server runs via `npm start` or `node dist/index.js`
- HTTP+SSE server runs via `npm run start:http` or `node dist/http-server.js`
- HTTP server configurable via TASK_MANAGER_HTTP_PORT environment variable
- Tests run cleanly with automatic server shutdown

## Commands
- Build: `npm run build` - Compiles TypeScript and makes binaries executable
- Watch: `npm run watch` - Runs TypeScript compiler in watch mode
- Run STDIO: `npm start` or `node dist/index.js` - Starts the standard MCP server
- Run HTTP: `npm run start:http` or `node dist/http-server.js` - Starts the HTTP MCP server
- Test: `npm test` - Runs the test client against the MCP server

## Environment Setup
Set these variables in a `.env` file:
- TASK_MANAGER_API_BASE_URL - URL for the Task API server
- TASK_MANAGER_API_KEY - API key for authentication
- TASK_MANAGER_HTTP_PORT - Port for the HTTP server (defaults to 3000 if not specified)

## Project Rules
- Never use mock data - always use the real external Task API
- Always use the official MCP SDK (@modelcontextprotocol/sdk)
- Follow MCP protocol standards for resources and tools
- Read cursor rules from .cursor/rules

## Code Style
- TypeScript with strict mode and explicit types
- ES modules (import/export) with Node16 module resolution
- 2-space indentation, single quotes for strings
- Use camelCase for variables/functions, PascalCase for classes/types
- Properly handle errors with async/await and try/catch blocks

## Recent Changes
- Added dynamic HTTP port configuration via .env file
- Fixed test client to properly shut down server processes after tests complete
- Improved error handling and logging throughout the codebase
- Enhanced test suite with detailed validation of API responses