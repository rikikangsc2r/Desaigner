

import type { ProjectFile, ChatMessage, FileOperation, TemplateType, StyleLibrary } from '../types';

let openAIKey: string | null = null;

/**
 * Fetches and caches the OpenAI API key from the proxy service.
 */
const getOpenAIKey = async (): Promise<string> => {
    if (openAIKey) {
        return openAIKey;
    }
    try {
        const response = await fetch('https://purxy.vercel.app/api/openaikey');
        if (!response.ok) {
            throw new Error(`Failed to fetch API key with status: ${response.status}`);
        }
        const data = await response.json();
        if (data && data.success && data.extractedContent) {
            openAIKey = data.extractedContent;
            return openAIKey;
        } else {
            throw new Error('Invalid response from API key provider.');
        }
    } catch (error) {
        console.error('Error fetching OpenAI key:', error);
        throw new Error('Could not retrieve the necessary API key to contact the AI.');
    }
};


/**
 * Custom error for when the AI returns a conversational response instead of the expected format.
 */
export class AIConversationalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIConversationalError';
  }
}

/**
 * A generic function to call the new AI API.
 */
const callAIAgent = async (conversationHistory: ChatMessage[], tools: any[]): Promise<any> => {
  try {
    const apiKey = await getOpenAIKey();
    const API_URL = 'https://api.openai.com/v1/responses';

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5',
        input: conversationHistory,
        tools: tools,
        tool_choice: 'auto',
        stream: false,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Try to parse the error for a more specific message
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.message) {
            throw new Error(`API request failed: ${response.status} ${JSON.stringify(errorJson.error)}`);
        }
      } catch (e) {
        // Fallback to raw text if not valid JSON
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }
    }

    const jsonResponse = await response.json();

    if (!jsonResponse) {
        throw new Error('API response was empty.');
    }
    
    return jsonResponse;

  } catch (error) {
    console.error(`Error calling AI:`, error);
    throw error;
  }
};

// FIX: Refactored function to remove deprecated 'html' and 'vanilla' template types.
// This now provides a correct base description for all modern project templates.
const getStackDescription = (template: TemplateType, styleLibrary: StyleLibrary): string => {
    let stack = 'HTML, CSS, and JavaScript';
    if (styleLibrary === 'bootstrap') {
        stack += ' and Bootstrap';
    } else if (styleLibrary === 'tailwindcss') {
        stack += ' and TailwindCSS';
    }
    return stack;
};


export const runAIAgentWorkflow = async (
    userGoal: string,
    files: ProjectFile[],
    template: TemplateType,
    styleLibrary: StyleLibrary,
    onThought: (thought: string) => void, // Callback for UI updates
): Promise<{ explanation: string; operations: FileOperation[] }> => {
    
    const fileMap = new Map(files.map(f => [f.path, f.content]));

    const tools = [
        {
          type: "function",
          name: "think",
          description: "Records your internal monologue or plan for the user to see. Use this to outline your steps before reading files or applying changes. This helps the user understand your process.",
          parameters: {
            type: "object",
            properties: {
              thought: {
                type: "string",
                description: "Your thought process or what you plan to do next, in Indonesian. E.g., 'Baik, saya perlu melihat file index.html untuk memahami strukturnya.'"
              }
            },
            required: ["thought"]
          }
        },
        {
          type: "function",
          name: "read_file",
          description: "Reads the full content of one or more files from the project to understand their contents. Provide a list of all paths you need to inspect.",
          parameters: {
            type: "object",
            properties: {
              paths: {
                type: "array",
                description: "An array of full file paths to read.",
                items: {
                    type: "string"
                }
              }
            },
            required: ["paths"]
          }
        },
        {
          type: "function",
          name: "apply_project_changes",
          description: "FINISHES the task. This is the final step. Call this function only when you have all the information and are ready to provide the complete code changes. It applies a set of file operations (CREATE, UPDATE, DELETE) to the project.",
          parameters: {
            type: "object",
            properties: {
              explanation: {
                type: "string",
                description: "A brief, user-facing explanation of the changes being made. E.g., 'Okay, I'll update the index.html file to add a new button and style it in style.css.'"
              },
              operations: {
                type: "array",
                description: "A list of file operations to perform. For updates, provide the COMPLETE new file content.",
                items: {
                  type: "object",
                  properties: {
                    operation: { type: "string", description: "The type of operation.", enum: ["CREATE", "UPDATE", "DELETE"] },
                    path: { type: "string", description: "The full path of the file to operate on." },
                    content: { type: "string", description: "The full new content of the file. Required for CREATE and UPDATE. For DELETE, provide an empty string." }
                  },
                  required: ["operation", "path", "content"],
                  additionalProperties: false
                }
              }
            },
            required: ["explanation", "operations"],
            additionalProperties: false
          },
          strict: true
        }
    ];
    
    const stackDescription = getStackDescription(template, styleLibrary);
    const fileList = files.length > 0 ? files.map(f => `\`${f.path}\``).join('\n') : 'No files exist yet.';
    
    const systemPrompt = `You are an expert autonomous front-end developer AI. Your task is to achieve the user's goal by thinking, reading files, and then finally calling 'apply_project_changes' with the necessary code changes. The user is Indonesian, so your 'think' steps MUST be in Indonesian.

**PROJECT CONTEXT:**
*   **Tech Stack:** The project is built using **${stackDescription}**.
*   **Available Files:**\n${fileList}

**YOUR WORKFLOW (LOOP):**
1.  **Think:** Use the 'think' tool to outline your plan in Indonesian. E.g., "Baik, saya akan membaca file index.html dan style.css."
2.  **Read:** Use the 'read_file' tool with a list of file paths to inspect multiple files at once. You do NOT have the file contents initially.
3.  **Analyze:** After you read a file, its content will be provided to you in a system message. You MUST analyze this content in your next step to decide what to do. DO NOT read the same file again unless absolutely necessary.
4.  **Repeat:** Continue thinking and reading until you have all necessary information.
5.  **Apply Changes:** Once you are ready to write the code, call 'apply_project_changes'. This is your FINAL action and will stop the loop.

**CORE PRINCIPLES:**
*   **COMPLETE CODE:** When updating a file, you MUST provide the ENTIRE file content from start to finish.
*   **PRODUCTION QUALITY:** Write clean, efficient, and responsive code.`;

    const conversationHistory: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Tujuan Pengguna: "${userGoal}"` }
    ];

    let loopCount = 0;
    while (true) {
        loopCount++;
        if (loopCount > 20) { // Safety break to prevent accidental infinite loops
            throw new Error("AI agent exceeded maximum steps without finishing. Please try rephrasing your request.");
        }

        const responseJson = await callAIAgent(conversationHistory, tools);
        
        const assistantResponse = responseJson.output;
        if (!assistantResponse || !Array.isArray(assistantResponse)) {
            const conversationalText = responseJson.text?.content;
             if (conversationalText) {
                throw new AIConversationalError(`The AI responded conversationally: ${conversationalText}`);
            }
            console.error("AI response did not contain a valid output array:", responseJson);
            throw new Error('AI returned an invalid response format.');
        }

        const functionCalls = assistantResponse.filter((o: any) => o.type === 'function_call');

        if (functionCalls.length > 0) {
            const toolCallSummary = functionCalls.map((call: any) => {
                return `Calling tool \`${call.name}\` with arguments: ${call.arguments}`;
            }).join('\n');
            
            conversationHistory.push({
                role: 'assistant',
                content: toolCallSummary,
            });
        }
        
        const finalCall = functionCalls.find((c: any) => c.name === 'apply_project_changes');
        if (finalCall) {
            try {
                const args = JSON.parse(finalCall.arguments);
                if (!args.explanation || !Array.isArray(args.operations)) {
                    throw new Error('AI returned malformed arguments for file operations.');
                }
                return args as { explanation: string; operations: FileOperation[] };
            } catch (e) {
                console.error("Failed to parse apply_project_changes arguments:", finalCall.arguments, e);
                throw new Error("AI returned invalid data structure for file changes.");
            }
        }

        if (functionCalls.length === 0) {
            const conversationalText = assistantResponse.find((o: any) => o.type === 'text')?.content;
            if (conversationalText) {
                throw new AIConversationalError(`The AI responded conversationally instead of using a tool: ${conversationalText}`);
            }
        }

        for (const call of functionCalls) {
            try {
                const args = JSON.parse(call.arguments);
                let result_content = '';

                if (call.name === 'think') {
                    if (args.thought) {
                        onThought(args.thought);
                        result_content = `Tool \`think\` was called. Thought was recorded: "${args.thought}"`;
                    }
                } else if (call.name === 'read_file') {
                    const paths = args.paths;
                    if (Array.isArray(paths) && paths.length > 0) {
                        onThought(`Membaca file: \`${paths.join('`, `')}\``);
                        const contents = paths.map(path => {
                            if (fileMap.has(path)) {
                                return `Content of \`${path}\`:\n---\n${fileMap.get(path)}`;
                            } else {
                                onThought(`Mencoba membaca file yang tidak ada: \`${path}\``);
                                return `Error: File not found: \`${path}\``;
                            }
                        });
                        result_content = `Tool \`read_file\` was called. Here are the contents:\n\n${contents.join('\n\n')}`;
                    } else {
                         result_content = `Error: Tool \`read_file\` was called without a valid 'paths' array.`;
                    }
                }
                
                if (result_content) {
                    conversationHistory.push({ role: 'system', content: result_content });
                }
            } catch (e) {
                console.warn(`Could not parse arguments for tool ${call.name}: ${call.arguments}`);
            }
        }
    }
};