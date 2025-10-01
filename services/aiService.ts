

// Add a global declaration for the `puter` object from the script tag
declare const puter: any;

import type { ProjectFile, FileOperation, TemplateType, StyleLibrary } from '../types';

const getStackDescription = (template: TemplateType, styleLibrary: StyleLibrary): string => {
    let stack = 'HTML, CSS, and JavaScript';
    if (styleLibrary === 'bootstrap') {
        stack += ' and Bootstrap';
    } else if (styleLibrary === 'tailwindcss') {
        stack += ' and TailwindCSS';
    }
    return stack;
};

export interface StreamChunk {
    type: 'thought' | 'explanation' | 'file' | 'error';
    content: string;
    path?: string;
}

/**
 * Calls the Puter AI with a streaming request and parses the structured response in real-time.
 * @returns An async generator yielding parsed chunks of data.
 */
export async function* streamAIAgentResponse(
    userGoal: string,
    files: ProjectFile[],
    template: TemplateType,
    styleLibrary: StyleLibrary,
    model: string,
): AsyncGenerator<StreamChunk> {
    
    const stackDescription = getStackDescription(template, styleLibrary);
    
    const fileContentsWithPaths = files.length > 0
        ? files.map(f => `File: \`${f.path}\`\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n---\n\n')
        : 'No files exist yet. You are starting from a blank slate.';

    const systemPrompt = `You are an expert autonomous front-end developer AI. Your task is to achieve the user's goal by generating a single, complete, structured response that includes your plan, an explanation, and all necessary file modifications. The user is Indonesian.

**PROJECT CONTEXT:**
*   **Tech Stack:** The project is built using **${stackDescription}**.
*   **Project Files & Content:** You have the full and complete content of all project files below.
${fileContentsWithPaths}

**VERY STRICT RESPONSE FORMAT:**
You MUST follow this exact format. Do not add any conversational text or introductions outside of this structure.

-- rencana --
Your step-by-step plan, in Indonesian. Each step on a new line.
-#

-- penjelasan --
A brief, user-facing explanation of the changes being made, in Indonesian.
-#

-- [full_file_path] --
The COMPLETE, new content for the file. This must be the entire file from start to finish. For deletions, the content must be the single word DELETE.
-#

(Repeat the file block for every file you need to create, update, or delete.)

**CORE PRINCIPLES:**
*   You already have the full content of all files. Do not ask to read them.
*   For file updates, you MUST provide the ENTIRE new file content.
*   If you are not changing a file, DO NOT include a block for it.
*   Write clean, production-quality code.`;

    const fullPrompt = `${systemPrompt}\n\n**USER REQUEST:**\n${userGoal}`;

    try {
        const responseStream = await puter.ai.chat(fullPrompt, {
            model: model,
            stream: true,
        });

        let buffer = '';
        let currentSection: 'rencana' | 'penjelasan' | 'file' | null = null;
        let currentFilePath: string | null = null;

        for await (const part of responseStream) {
            if (part?.text) {
                buffer += part.text;

                let changedInLoop = true;
                while (changedInLoop) {
                    changedInLoop = false;

                    if (currentSection === null) {
                        const match = buffer.match(/^--\s*([\s\S]+?)\s*--\n/);
                        if (match) {
                            const sectionName = match[1].trim();
                            if (sectionName === 'rencana' || sectionName === 'penjelasan') {
                                currentSection = sectionName;
                            } else {
                                currentSection = 'file';
                                currentFilePath = sectionName;
                            }
                            buffer = buffer.substring(match[0].length);
                            changedInLoop = true;
                        }
                    }

                    if (currentSection !== null) {
                        const endMatchIndex = buffer.indexOf('-#');
                        if (endMatchIndex !== -1) {
                            const content = buffer.substring(0, endMatchIndex).trim();
                            
                            if (currentSection === 'rencana') {
                                // Fix: 'yield' is not allowed in a 'forEach' callback. Replaced with a for...of loop.
                                const thoughts = content.split('\n').filter(t => t.trim());
                                for (const t of thoughts) {
                                    yield { type: 'thought', content: t.trim() };
                                }
                            } else if (currentSection === 'penjelasan') {
                                yield { type: 'explanation', content };
                            } else if (currentSection === 'file' && currentFilePath) {
                                yield { type: 'file', path: currentFilePath, content };
                            }

                            buffer = buffer.substring(endMatchIndex + 2).trimStart();
                            currentSection = null;
                            currentFilePath = null;
                            changedInLoop = true;
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error during AI stream:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        yield { type: 'error', content: `AI stream failed: ${errorMessage}` };
    }
}