// Add a global declaration for the `puter` object from the script tag
declare const puter: any;

import type { ProjectFile, ChatMessage, FileOperation, TemplateType, StyleLibrary } from '../types';

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
 * A generic function to call the Puter.js AI API.
 */
const callAIAgent = async (conversationHistory: ChatMessage[], tools: any[], model: string): Promise<any> => {
  try {
    // Puter.js AI doesn't take a structured history, so we serialize it into a single prompt string.
    const prompt = conversationHistory.map(message => {
        let contentRepresentation = '';
        if (message.role === 'system' || message.role === 'user') {
            contentRepresentation = message.content || '';
        } else if (message.role === 'assistant') {
            if (message.tool_calls) {
                const toolCallSummary = message.tool_calls.map(t => ({ name: t.function.name, arguments: t.function.arguments }));
                contentRepresentation = `Assistant wants to call tools: ${JSON.stringify(toolCallSummary)}`;
            } else {
                contentRepresentation = message.content || '';
            }
        } else if (message.role === 'tool') {
            contentRepresentation = `Result for tool call ID ${message.tool_call_id}: ${message.content}`;
        }
        return `[${message.role.toUpperCase()}]\n${contentRepresentation}`;
    }).join('\n\n');
    
    // Call the Puter.js AI with the serialized prompt and tools
    const response = await puter.ai.chat(prompt, {
      model: model,
      tools: tools,
    });
    
    const message = response.message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      // The app's logic requires a unique ID for each tool call to map responses.
      // We'll add a unique ID to each tool call from the AI.
      message.tool_calls.forEach((tc: any) => {
        tc.id = `call_${Math.random().toString(36).substring(2, 9)}`;
        tc.type = 'function'; // Ensure type is present for compatibility
      });

      const functionCalls = message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: 'function_call',
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.tool_calls,
      };
      
      return { assistantMessage, functionCalls };

    } else if (message.content) {
      const assistantMessage: ChatMessage = { role: 'assistant', content: message.content };
      return { assistantMessage, conversationalText: message.content };

    } else {
      const assistantMessage: ChatMessage = { role: 'assistant', content: null };
      return { assistantMessage, functionCalls: [] };
    }

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
    model: string,
    onThought: (thought: string) => void, // Callback for UI updates
): Promise<{ explanation: string; operations: FileOperation[] }> => {
    
    const tools = [
        {
          type: "function",
          function: {
            name: "think",
            description: "Records your internal monologue or plan for the user to see. Use this to outline your steps before applying changes. This helps the user understand your process.",
            parameters: {
              type: "object",
              properties: {
                thought: {
                  type: "string",
                  description: "Your thought process or what you plan to do next, in Indonesian. E.g., 'Saya akan memperbarui index.html untuk menambahkan tombol baru.'"
                }
              },
              required: ["thought"]
            }
          }
        },
        {
          type: "function",
          function: {
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
          }
        }
    ];
    
    const stackDescription = getStackDescription(template, styleLibrary);
    
    const fileContentsWithPaths = files.length > 0
        ? files.map(f => `File: \`${f.path}\`\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n---\n\n')
        : 'No files exist yet. You are starting from a blank slate.';

    const systemPrompt = `You are an expert autonomous front-end developer AI. Your task is to achieve the user's goal by thinking and then immediately calling 'apply_project_changes' with the necessary code changes. The user is Indonesian, so your 'think' steps MUST be in Indonesian.

**PROJECT CONTEXT:**
*   **Tech Stack:** The project is built using **${stackDescription}**.
*   **Project Files & Content:** All project files and their complete contents are provided below. You have all the information you need.
${fileContentsWithPaths}

**YOUR WORKFLOW (VERY IMPORTANT & STRICT):**
1.  **Plan:** Use the 'think' tool to briefly state your implementation plan in Indonesian.
2.  **Execute:** In the SAME turn, immediately call 'apply_project_changes' with all the necessary code.

**CORE PRINCIPLES:**
*   **DO NOT ask to read files.** You already have the full content of all files.
*   **COMPLETE CODE:** When updating a file, you MUST provide the ENTIRE new file content from start to finish.
*   **PRODUCTION QUALITY:** Write clean, efficient, and responsive code.`;

    const conversationHistory: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Tujuan Pengguna: "${userGoal}"` }
    ];

    let loopCount = 0;
    while (true) {
        loopCount++;
        if (loopCount > 10) { // Safety break for simpler workflow
            throw new Error("AI agent exceeded maximum steps without finishing. Please try rephrasing your request.");
        }

        const responseJson = await callAIAgent(conversationHistory, tools, model);
        
        if (responseJson.assistantMessage) {
            conversationHistory.push(responseJson.assistantMessage as ChatMessage);
        }

        const functionCalls = responseJson.functionCalls;
        const conversationalText = responseJson.conversationalText;

        if (conversationalText) {
            throw new AIConversationalError(`The AI responded conversationally: ${conversationalText}`);
        }

        if (!functionCalls || !Array.isArray(functionCalls)) {
            console.error("AI response did not contain a valid function call array:", responseJson);
            throw new Error('AI returned an invalid response format.');
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

        const toolResponses = [];
        for (const call of functionCalls) {
            try {
                const args = JSON.parse(call.arguments);
                let result_content = '';

                if (call.name === 'think') {
                    if (args.thought) {
                        onThought(args.thought);
                        result_content = `Tool \`think\` was called. Thought was recorded: "${args.thought}"`;
                    }
                }
                
                if (result_content) {
                    toolResponses.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: result_content,
                    });
                }
            } catch (e) {
                console.warn(`Could not parse arguments for tool ${call.name}: ${call.arguments}`);
                 toolResponses.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: `Error: Failed to parse arguments for tool ${call.name}. Error: ${e instanceof Error ? e.message : String(e)}`,
                });
            }
        }
        if (toolResponses.length > 0) {
            conversationHistory.push(...toolResponses as any[]);
        }
    }
};