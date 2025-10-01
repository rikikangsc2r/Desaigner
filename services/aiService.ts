
// Add a global declaration for the `puter` object from the script tag
declare const puter: any;

import type { ProjectFile, TemplateType, StyleLibrary, ChatMessage } from '../types';

const getStackDescription = (template: TemplateType, styleLibrary: StyleLibrary): string => {
    let stack = 'HTML, CSS, and JavaScript';
    if (styleLibrary === 'bootstrap') {
        stack += ' and Bootstrap';
    } else if (styleLibrary === 'tailwindcss') {
        stack += ' and TailwindCSS';
    }
    return stack;
};

const tools = [
    {
        type: "function",
        function: {
            name: "think",
            description: "Records a thought or step in the reasoning process. Use this to outline your plan. Do not repeat thoughts; if the plan is solid, proceed to write.",
            parameters: {
                type: "object",
                properties: {
                    thought: {
                        type: "string",
                        description: "The thought or reasoning step to record."
                    }
                },
                required: ["thought"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "write",
            description: "Creates a new file or completely overwrites an existing file with new content.",
            parameters: {
                type: "object",
                properties: {
                    path: {
                        type: "string",
                        description: "The full path of the file to write to."
                    },
                    content: {
                        type: "string",
                        description: "The complete new content of the file."
                    }
                },
                required: ["path", "content"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "finish",
            description: "Call this function when the task is complete and all files have been written.",
            parameters: {
                type: "object",
                properties: {
                    summary: {
                        type: "string",
                        description: "A brief summary of the changes made and how they accomplish the user's goal."
                    }
                },
                required: ["summary"]
            }
        }
    }
];


/**
 * Runs the AI agent workflow using a multi-step tool-calling loop.
 * @param userGoal The user's request.
 * @param files The current project files.
 * @param template The project's template type.
 * @param styleLibrary The project's style library.
 * @param model The AI model to use.
 * @param existingHistory The existing chat history.
 * @param onThink Callback for when the AI uses the 'think' tool.
 * @param onWrite Callback for when the AI uses the 'write' tool.
 * @param onFinish Callback for when the AI uses the 'finish' tool.
 * @param onError Callback for handling errors.
 */
export const runAIAgentLoop = async (
    userGoal: string,
    files: ProjectFile[],
    template: TemplateType,
    styleLibrary: StyleLibrary,
    model: string,
    existingHistory: ChatMessage[],
    onThink: (thought: string) => void,
    onWrite: (path: string, content: string) => Promise<string>,
    onFinish: (summary: string) => void,
    onError: (error: Error) => void,
): Promise<void> => {
    
    const stackDescription = getStackDescription(template, styleLibrary);
    
    const filesContent = files.length > 0
        ? files.map(f => `\`\`\`${f.path}\n${f.content}\n\`\`\``).join('\n\n')
        : 'No files exist yet. You must create the first file.';

    const systemPrompt = `You are an expert autonomous front-end developer AI. Your task is to achieve the user's goal by thinking step-by-step and then using tools to modify project files.

**PROJECT CONTEXT:**
*   **Tech Stack:** The project is built using **${stackDescription}**.
*   **Project Files:**
${filesContent}

**INSTRUCTIONS:**
1.  **Think First**: Analyze the user's request and the current files. Use the \`think\` tool to outline your plan, what you need to do, and why. Break down the problem.
2.  **Don't Repeat Thoughts**: Do not repeat the same thought or plan. If your plan is solid, move on to execution.
3.  **Execute with Tools**: Use the \`write\` tool to create or update files. You can call \`write\` multiple times.
4.  **Finish**: Once you have completed all necessary file modifications and the user's goal is achieved, you MUST call the \`finish\` tool with a summary of what you have done. This is the final step.

**IMPORTANT:**
You must use these tools to interact with the file system. Do not respond with code or file content directly in a message. Your workflow must be: think -> write (one or more times) -> finish.`;
    
    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...existingHistory,
        { role: 'user', content: userGoal }
    ];

    let maxTurns = 15; // Safety break to prevent infinite loops

    while (maxTurns > 0) {
        maxTurns--;
        try {
            // Note: puter.ai.chat expects an array of {role, content} but our ChatMessage has more fields.
            // We'll map it to the expected format for the API call.
            const apiMessages = messages.map(({ role, content, tool_calls }) => ({ role, content, tool_calls }));

            const response = await puter.ai.chat(apiMessages, {
                model: model,
                tools: tools,
            });

            const responseMessage = response.message;
            if (!responseMessage.role) responseMessage.role = 'assistant';
            
            messages.push(responseMessage);

            if (responseMessage.tool_calls) {
                const toolCall = responseMessage.tool_calls[0];
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);

                let toolResultContent: string;

                if (functionName === 'think') {
                    onThink(args.thought);
                    toolResultContent = 'Thought logged.';
                } else if (functionName === 'write') {
                    toolResultContent = await onWrite(args.path, args.content);
                } else if (functionName === 'finish') {
                    onFinish(args.summary);
                    return; // End of loop
                } else {
                    toolResultContent = `Unknown tool called: ${functionName}`;
                }

                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResultContent,
                });
            } else {
                // AI responded with text instead of a tool call. This is against instructions.
                // We'll treat this as the final answer and finish.
                onFinish(responseMessage.content || "AI finished with a message instead of using the 'finish' tool.");
                return;
            }

        } catch (error) {
            console.error("Error in AI agent loop:", error);
            const err = error instanceof Error ? error : new Error('An unknown AI error occurred.');
            onError(err);
            return; // Stop the loop on error
        }
    }
    
    if (maxTurns <= 0) {
        onError(new Error("AI agent reached the maximum number of turns without finishing."));
    }
};