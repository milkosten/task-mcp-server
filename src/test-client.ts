#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from 'path';
import { spawn } from 'child_process';

async function runTests() {
  console.log('Starting MCP Task Manager API Tests');
  
  // Start server in a child process
  const serverProcess = spawn('node', [path.resolve('./dist/index.js')], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Log server output for debugging
  serverProcess.stderr.on('data', (data) => {
    console.error(`Server stderr: ${data.toString().trim()}`);
  });
  
  // Declare transport outside try block so it's accessible in finally block
  let transport;
  let client;
  
  try {
    // Wait for server to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    console.log('Server should be running now. Setting up MCP client...');
    
    // Create MCP client transport using the command and args
    // This will spawn a new server process instead of using our existing one
    transport = new StdioClientTransport({
      command: 'node',
      args: [path.resolve('./dist/index.js')]
    });
    
    // Initialize the MCP client
    client = new Client(
      {
        name: "task-api-test-client",
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
    console.log('Client connected to server');
    
    // Get server capabilities
    console.log('\nRetrieving server capabilities...');
    const serverInfo = client.getServerVersion();
    const capabilities = client.getServerCapabilities();
    
    if (serverInfo) {
      console.log('Server info:');
      console.log(`Server name: ${serverInfo.name}`);
      console.log(`Server version: ${serverInfo.version}`);
      console.log('✅ Server info retrieved successfully');
    } else {
      console.log('❌ Failed to retrieve server info');
    }
    
    if (capabilities) {
      console.log('Server capabilities:');
      console.log(`Available tools: ${capabilities.tools ? 'Yes' : 'No'}`);
      console.log(`Available resources: ${capabilities.resources ? 'Yes' : 'No'}`);
      console.log('✅ Server capabilities retrieved successfully');
    } else {
      console.log('❌ Failed to retrieve server capabilities');
    }
    
    // Test the listTasks tool
    console.log('\nTesting listTasks tool...');
    try {
      const listTasksResult = await client.callTool({
        name: "listTasks",
        arguments: {}
      });
      
      console.log('List tasks response received:');
      if (Array.isArray(listTasksResult.content) && listTasksResult.content.length > 0) {
        const firstContent = listTasksResult.content[0];
        if (firstContent && 'text' in firstContent) {
          console.log(firstContent.text);
          console.log('✅ List tasks test passed');
        } else {
          console.log('❌ List tasks test failed - unexpected content format');
        }
      } else {
        console.log('❌ List tasks test failed - empty content');
      }
    } catch (error: any) {
      console.log(`❌ List tasks test failed with error: ${error.message}`);
    }
    
    // Test creating a task
    console.log('\nTesting createTask tool...');
    let createdTaskId: number | undefined;
    
    try {
      const createTaskResult = await client.callTool({
        name: "createTask",
        arguments: {
          task: `Test task ${new Date().toISOString()}`,
          category: "Test",
          priority: "medium"
        }
      });
      
      console.log('Create task response received:');
      if (Array.isArray(createTaskResult.content) && createTaskResult.content.length > 0) {
        const firstContent = createTaskResult.content[0];
        if (firstContent && 'text' in firstContent) {
          console.log(firstContent.text);
          
          // Extract task ID if successful
          const idMatch = firstContent.text.match(/ID: (\d+)/);
          if (idMatch && idMatch[1]) {
            createdTaskId = parseInt(idMatch[1], 10);
            console.log(`✅ Create task test passed. Created task ID: ${createdTaskId}`);
          } else {
            console.log('❌ Create task test failed - could not extract task ID');
          }
        } else {
          console.log('❌ Create task test failed - unexpected content format');
        }
      } else {
        console.log('❌ Create task test failed - empty content');
      }
    } catch (error: any) {
      console.log(`❌ Create task test failed with error: ${error.message}`);
    }
    
    // If we successfully created a task, test updating it with various field combinations
    if (createdTaskId) {
      // Test 1: Update task description
      console.log('\nTesting updateTask - description change...');
      try {
        const newDescription = `Updated description ${new Date().toISOString()}`;
        const updateDescResult = await client.callTool({
          name: "updateTask",
          arguments: {
            taskId: createdTaskId,
            task: newDescription
          }
        });
        
        console.log('Update description response received:');
        if (Array.isArray(updateDescResult.content) && updateDescResult.content.length > 0) {
          const firstContent = updateDescResult.content[0];
          if (firstContent && 'text' in firstContent) {
            console.log(firstContent.text);
            
            if (firstContent.text.includes('updated successfully')) {
              console.log('✅ Update description test passed');
            } else {
              console.log('❌ Update description test failed - response does not indicate success');
            }
          } else {
            console.log('❌ Update description test failed - unexpected content format');
          }
        } else {
          console.log('❌ Update description test failed - empty content');
        }
      } catch (error: any) {
        console.log(`❌ Update description test failed with error: ${error.message}`);
      }

      // Test 2: Update task status
      console.log('\nTesting updateTask - status change...');
      try {
        const updateStatusResult = await client.callTool({
          name: "updateTask",
          arguments: {
            taskId: createdTaskId,
            status: "started"
          }
        });
        
        console.log('Update status response received:');
        if (Array.isArray(updateStatusResult.content) && updateStatusResult.content.length > 0) {
          const firstContent = updateStatusResult.content[0];
          if (firstContent && 'text' in firstContent) {
            console.log(firstContent.text);
            
            if (firstContent.text.includes('updated successfully')) {
              console.log('✅ Update status test passed');
            } else {
              console.log('❌ Update status test failed - response does not indicate success');
            }
            
            // Verify the status was actually updated in the response
            if (updateStatusResult.content.length > 1) {
              const secondContent = updateStatusResult.content[1];
              if (secondContent && 'text' in secondContent) {
                const responseJson = JSON.parse(secondContent.text);
                if (responseJson.status === "started") {
                  console.log('✅ Status verification passed - status is "started"');
                } else {
                  console.log(`❌ Status verification failed - expected "started" but got "${responseJson.status}"`);
                }
              }
            }
          } else {
            console.log('❌ Update status test failed - unexpected content format');
          }
        } else {
          console.log('❌ Update status test failed - empty content');
        }
      } catch (error: any) {
        console.log(`❌ Update status test failed with error: ${error.message}`);
      }

      // Test 3: Update task category
      console.log('\nTesting updateTask - category change...');
      try {
        const newCategory = `Category-${Date.now().toString().slice(-5)}`;
        const updateCategoryResult = await client.callTool({
          name: "updateTask",
          arguments: {
            taskId: createdTaskId,
            category: newCategory
          }
        });
        
        console.log('Update category response received:');
        if (Array.isArray(updateCategoryResult.content) && updateCategoryResult.content.length > 0) {
          const firstContent = updateCategoryResult.content[0];
          if (firstContent && 'text' in firstContent) {
            console.log(firstContent.text);
            
            if (firstContent.text.includes('updated successfully')) {
              console.log('✅ Update category test passed');
            } else {
              console.log('❌ Update category test failed - response does not indicate success');
            }
            
            // Verify the category was actually updated in the response
            if (updateCategoryResult.content.length > 1) {
              const secondContent = updateCategoryResult.content[1];
              if (secondContent && 'text' in secondContent) {
                const responseJson = JSON.parse(secondContent.text);
                if (responseJson.category === newCategory) {
                  console.log(`✅ Category verification passed - category is "${newCategory}"`);
                } else {
                  console.log(`❌ Category verification failed - expected "${newCategory}" but got "${responseJson.category}"`);
                }
              }
            }
          } else {
            console.log('❌ Update category test failed - unexpected content format');
          }
        } else {
          console.log('❌ Update category test failed - empty content');
        }
      } catch (error: any) {
        console.log(`❌ Update category test failed with error: ${error.message}`);
      }

      // Test 4: Update task priority
      console.log('\nTesting updateTask - priority change...');
      try {
        const updatePriorityResult = await client.callTool({
          name: "updateTask",
          arguments: {
            taskId: createdTaskId,
            priority: "high"
          }
        });
        
        console.log('Update priority response received:');
        if (Array.isArray(updatePriorityResult.content) && updatePriorityResult.content.length > 0) {
          const firstContent = updatePriorityResult.content[0];
          if (firstContent && 'text' in firstContent) {
            console.log(firstContent.text);
            
            if (firstContent.text.includes('updated successfully')) {
              console.log('✅ Update priority test passed');
            } else {
              console.log('❌ Update priority test failed - response does not indicate success');
            }
            
            // Verify the priority was actually updated in the response
            if (updatePriorityResult.content.length > 1) {
              const secondContent = updatePriorityResult.content[1];
              if (secondContent && 'text' in secondContent) {
                const responseJson = JSON.parse(secondContent.text);
                if (responseJson.priority === "high") {
                  console.log('✅ Priority verification passed - priority is "high"');
                } else {
                  console.log(`❌ Priority verification failed - expected "high" but got "${responseJson.priority}"`);
                }
              }
            }
          } else {
            console.log('❌ Update priority test failed - unexpected content format');
          }
        } else {
          console.log('❌ Update priority test failed - empty content');
        }
      } catch (error: any) {
        console.log(`❌ Update priority test failed with error: ${error.message}`);
      }

      // Test 5: Update multiple fields at once
      console.log('\nTesting updateTask - multiple fields at once...');
      try {
        const finalDesc = `Final description ${new Date().toISOString()}`;
        const finalCategory = `Final-Category-${Date.now().toString().slice(-5)}`;
        
        const updateMultipleResult = await client.callTool({
          name: "updateTask",
          arguments: {
            taskId: createdTaskId,
            task: finalDesc,
            category: finalCategory,
            priority: "medium",
            status: "done"
          }
        });
        
        console.log('Update multiple fields response received:');
        if (Array.isArray(updateMultipleResult.content) && updateMultipleResult.content.length > 0) {
          const firstContent = updateMultipleResult.content[0];
          if (firstContent && 'text' in firstContent) {
            console.log(firstContent.text);
            
            if (firstContent.text.includes('updated successfully')) {
              console.log('✅ Update multiple fields test passed');
            } else {
              console.log('❌ Update multiple fields test failed - response does not indicate success');
            }
            
            // Verify all fields were actually updated in the response
            if (updateMultipleResult.content.length > 1) {
              const secondContent = updateMultipleResult.content[1];
              if (secondContent && 'text' in secondContent) {
                const responseJson = JSON.parse(secondContent.text);
                let verificationsPassed = true;
                
                if (responseJson.task !== finalDesc) {
                  console.log(`❌ Description verification failed - expected "${finalDesc}" but got "${responseJson.task}"`);
                  verificationsPassed = false;
                }
                
                if (responseJson.category !== finalCategory) {
                  console.log(`❌ Category verification failed - expected "${finalCategory}" but got "${responseJson.category}"`);
                  verificationsPassed = false;
                }
                
                if (responseJson.priority !== "medium") {
                  console.log(`❌ Priority verification failed - expected "medium" but got "${responseJson.priority}"`);
                  verificationsPassed = false;
                }
                
                if (responseJson.status !== "done") {
                  console.log(`❌ Status verification failed - expected "done" but got "${responseJson.status}"`);
                  verificationsPassed = false;
                }
                
                if (verificationsPassed) {
                  console.log('✅ All field verifications passed');
                }
              }
            }
          } else {
            console.log('❌ Update multiple fields test failed - unexpected content format');
          }
        } else {
          console.log('❌ Update multiple fields test failed - empty content');
        }
      } catch (error: any) {
        console.log(`❌ Update multiple fields test failed with error: ${error.message}`);
      }
      
      // Finally, test deleting the task
      console.log('\nTesting deleteTask tool...');
      try {
        const deleteTaskResult = await client.callTool({
          name: "deleteTask",
          arguments: {
            taskId: createdTaskId
          }
        });
        
        console.log('Delete task response received:');
        if (Array.isArray(deleteTaskResult.content) && deleteTaskResult.content.length > 0) {
          const firstContent = deleteTaskResult.content[0];
          if (firstContent && 'text' in firstContent) {
            console.log(firstContent.text);
            
            if (firstContent.text.includes('deleted successfully') || 
                firstContent.text.includes('successfully deleted')) {
              console.log('✅ Delete task test passed');
            } else {
              console.log('❌ Delete task test failed - response does not indicate success');
            }
          } else {
            console.log('❌ Delete task test failed - unexpected content format');
          }
        } else {
          console.log('❌ Delete task test failed - empty content');
        }
      } catch (error: any) {
        console.log(`❌ Delete task test failed with error: ${error.message}`);
      }
    }
    
    // Test accessing resources
    console.log('\nTesting resources...');
    try {
      const resourcesList = await client.listResources();
      
      if (resourcesList && 'resources' in resourcesList) {
        const resources = resourcesList.resources;
        console.log(`Available resources: ${resources.map(r => r.name).join(', ')}`);
        
        if (resources.length > 0) {
          console.log('✅ List resources test passed');
          
          // Try to read a resource if any are available
          const resourceURI = `tasks://${resources[0].name}`;
          try {
            const resourceResult = await client.readResource({ uri: resourceURI });
            
            if (resourceResult && 'contents' in resourceResult) {
              console.log(`Resource ${resources[0].name} retrieved successfully`);
              console.log('✅ Read resource test passed');
            } else {
              console.log('❌ Read resource test failed - unexpected result format');
            }
          } catch (error: any) {
            console.log(`❌ Read resource test failed with error: ${error.message}`);
          }
        } else {
          console.log('ℹ️ No resources available to test');
        }
      } else {
        console.log('❌ List resources test failed - unexpected result format');
      }
    } catch (error: any) {
      console.log(`❌ List resources test failed with error: ${error.message}`);
    }
    
    console.log('\nTests completed');
    
  } catch (error: any) {
    console.error('Test execution error:', error);
  } finally {
    // Clean up - kill the server process
    console.log('Terminating test server');
    serverProcess.kill();
    
    // Make sure to close the client which will terminate the second server process
    if (client) {
      try {
        await client.close();
        console.log('Test client closed');
      } catch (closeError) {
        console.error('Error closing client:', closeError);
      }
    }
    
    // Force exit after a short delay to ensure all processes are terminated
    setTimeout(() => {
      console.log('Exiting test process');
      process.exit(0);
    }, 500);
  }
}

// Run the tests
runTests().catch(console.error);