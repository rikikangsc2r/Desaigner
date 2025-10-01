// Add a global declaration for the `puter` object from the script tag
declare const puter: any;

import type { ProjectFile, TemplateType, StyleLibrary } from '../types';

const getStackDescription = (template: TemplateType, styleLibrary: StyleLibrary): string => {
    let stack = 'HTML, CSS, and JavaScript';
    if (styleLibrary === 'bootstrap') {
        stack += ' and Bootstrap';
    } else if (styleLibrary === 'tailwindcss') {
        stack += ' and TailwindCSS';
    }
    return stack;
};

/**
 * Runs the AI agent workflow in a single, streaming API call.
 * @param userGoal The user's request.
 * @param files The current project files.
 * @param template The project's template type.
 * @param styleLibrary The project's style library.
 * @param model The AI model to use.
 * @param onChunk Callback for each streamed text chunk.
 * @param onError Callback for handling errors.
 */
export const streamAIAgentWorkflow = async (
    userGoal: string,
    files: ProjectFile[],
    template: TemplateType,
    styleLibrary: StyleLibrary,
    model: string,
    onChunk: (textChunk: string) => void,
    onError: (error: Error) => void,
): Promise<void> => {
    
    const stackDescription = getStackDescription(template, styleLibrary);
    
    const filesContent = files.length > 0
        ? files.map(f => `\`\`\`${f.path}\n${f.content}\n\`\`\``).join('\n\n')
        : 'No files exist yet. You must create the first file.';

    const systemPrompt = `You are an expert autonomous front-end developer AI. Your task is to achieve the user's goal by modifying the provided project files.

**PROJECT CONTEXT:**
*   **Tech Stack:** The project is built using **${stackDescription}**.
*   **Project Files:**
${filesContent}

**INSTRUCTIONS:**
1.  Analyze the user's goal and the provided file contents.
2.  Determine the necessary file modifications (CREATE, UPDATE, DELETE).
3.  You MUST respond with a single, valid JSON object and nothing else. Do not add any conversational text, markdown formatting, or comments before or after the JSON object. Your entire response must be parseable as JSON.
4.  The JSON object must have two top-level keys:
    *   \`"explanation"\`: A user-facing string explaining the changes you are about to make.
    *   \`"operations"\`: An array of file operation objects.
5.  Each operation object must have the following structure:
    *   \`"operation"\`: A string, one of "CREATE", "UPDATE", or "DELETE".
    *   \`"path"\`: A string representing the full file path.
    *   \`"content"\`: The full new content of the file for "CREATE" and "UPDATE". For "DELETE", this should be an empty string.

**EXAMPLE JSON RESPONSE:**
{
  "explanation": "I will add a new button to the HTML and style it in the CSS.",
  "operations": [
    {
      "operation": "UPDATE",
      "path": "index.html",
      "content": "<!DOCTYPE html>... restante del contenido ..."
    },
    {
      "operation": "CREATE",
      "path": "new-script.js",
      "content": "console.log('Hello!');"
    }
  ]
}
`;
    
    const fullPrompt = `${systemPrompt}\n\n**USER GOAL:**\n"${userGoal}"`;

    try {
        const responseStream = await puter.ai.chat(fullPrompt, {
            model: model,
            stream: true,
        });

        for await (const part of responseStream) {
            if (part?.text) {
                onChunk(part.text);
            }
        }
    } catch (error) {
        console.error("Error streaming AI response:", error);
        onError(error instanceof Error ? error : new Error('An unknown AI error occurred.'));
    }
};
