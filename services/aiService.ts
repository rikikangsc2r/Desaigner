
import type { Project, ChatMessage, ProjectFile, FileOperation, FileOperationType } from '../types';

const API_URL = 'https://nirkyy-testing.hf.space/api/generate';

/**
 * Custom error for when the AI returns a conversational response instead of file operations.
 */
export class AIConversationalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIConversationalError';
  }
}

/**
 * A generic function to call the AI API.
 */
const callAIAgent = async (prompt: string): Promise<string> => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Permintaan API gagal: ${response.status} ${errorText}`);
    }

    const answer = await response.text();

    if (!answer) {
        throw new Error('Respons API kosong');
    }
    
    // The API might wrap the response in markdown code blocks.
    // Let's remove them if they exist for robustness.
    return answer.replace(/```(json|text|txt)?/g, '').trim();

  } catch (error) {
    console.error(`Kesalahan saat memanggil AI:`, error);
    throw error;
  }
};

const buildFileContext = (existingFiles: ProjectFile[]): string => {
  if (existingFiles.length === 0) {
    return "Ini adalah proyek baru tanpa file yang ada.\n";
  }
  let context = "Ini adalah file proyek saat ini:\n\n";
  existingFiles.forEach(file => {
    context += `--- File: ${file.path} ---\n${file.content}\n\n`;
  });
  return context;
};

const parseOperationsResponse = (response: any): FileOperation[] => {
    if (typeof response !== 'string') {
        const errorMsg = `Respons AI bukan string. Diterima tipe ${typeof response}.`;
        console.error(errorMsg, "Konten:", response);
        throw new Error(errorMsg);
    }

    try {
        // Clean up response: remove markdown code blocks if present and trim
        const txtResponse = response.replace(/```(txt|text|json)?/g, '').trim();

        if (!txtResponse) {
            return [];
        }

        // Heuristically check if the response is structured as expected. If not, it's a refusal or conversational reply.
        // Expanded the check to include operation types directly.
        const isStructuredResponse = /operation:|path:|reasoning:|CREATE|UPDATE|DELETE/i.test(txtResponse);
        if (!isStructuredResponse) {
            // This custom error will be caught in the UI to be displayed as a chat message.
            throw new AIConversationalError(txtResponse);
        }

        const operationBlocks = txtResponse.split(/^\s*--\s*$/m);
        const operations: FileOperation[] = [];

        operationBlocks.forEach((block, index) => {
            const trimmedBlock = block.trim();
            if (!trimmedBlock) return;

            try {
                const op: Partial<FileOperation> = {};

                // Find content first and split the block. This is the most reliable delimiter.
                let headerPart = trimmedBlock;
                const contentIndex = trimmedBlock.toLowerCase().lastIndexOf('\ncontent:');
                
                if (contentIndex !== -1) {
                    headerPart = trimmedBlock.substring(0, contentIndex).trim();
                    op.content = trimmedBlock.substring(contentIndex + '\ncontent:'.length).trim();
                } else {
                    const inlineContentIndex = trimmedBlock.toLowerCase().lastIndexOf(' content:');
                    if (inlineContentIndex > 0) { // Should not be at the very beginning
                        headerPart = trimmedBlock.substring(0, inlineContentIndex).trim();
                        op.content = trimmedBlock.substring(inlineContentIndex + ' content:'.length).trim();
                    }
                }
                
                // Normalize header part for easier parsing (replace newlines with spaces, add leading space for regex)
                const normalizedHeader = ` ${headerPart.replace(/[\n\r]/g, ' ').trim()}`;
                
                // 1. Extract Operation
                let match = normalizedHeader.match(/\soperation:\s*(CREATE|UPDATE|DELETE)/i);
                if (match) {
                    op.operation = match[1].toUpperCase() as FileOperationType;
                } else {
                    const firstWordMatch = normalizedHeader.match(/^\s*(CREATE|UPDATE|DELETE)\b/i);
                    if (firstWordMatch) {
                        op.operation = firstWordMatch[1].toUpperCase() as FileOperationType;
                    }
                }

                // 2. Extract Path
                match = normalizedHeader.match(/\spath:\s*(\S+)/i);
                if (match) {
                    op.path = match[1];
                }

                // 3. Extract Reasoning (make it robust against grabbing other keys)
                match = normalizedHeader.match(/\sreasoning:\s*(.*)/i);
                if (match) {
                    let reasoning = match[1].trim();
                    // The regex is greedy, so truncate the reasoning if it accidentally included other keys.
                    const otherKeys = ['operation:', 'path:', 'content:'];
                    let earliestIndex = reasoning.length;
                    otherKeys.forEach(key => {
                        const idx = reasoning.toLowerCase().indexOf(key);
                        if (idx !== -1 && idx < earliestIndex) {
                            earliestIndex = idx;
                        }
                    });
                    op.reasoning = reasoning.substring(0, earliestIndex).trim();
                }

                // Final checks
                if (op.operation === 'CREATE' || op.operation === 'UPDATE') {
                    // content is optional for updates (e.g. rename), but here it must be defined.
                    // If no content was found, default to empty string.
                    op.content = op.content ?? '';
                }

                if (!op.operation || !op.path || !op.reasoning) {
                    throw new Error(`Operasi tidak lengkap pada blok ${index}. Wajib ada 'operation', 'path', dan 'reasoning'. Blok: "${block}"`);
                }

                operations.push(op as FileOperation);

            } catch (e) {
                if (e instanceof AIConversationalError) throw e;
                console.error("Gagal mengurai blok operasi AI:", e, "Blok Asli:", block);
                // Re-throw with more context
                throw new Error(`Gagal mengurai respons teks AI: ${(e as Error).message}`);
            }
        });

        return operations;

    } catch (e) {
        // Re-throw our custom error directly so it's not wrapped in another error message.
        if (e instanceof AIConversationalError) {
            throw e;
        }
        console.error("Gagal mengurai respons teks AI:", e, "Teks Asli:", response);
        throw new Error(`Gagal mengurai respons teks AI: ${(e as Error).message}`);
    }
};

export const generateFileOperations = async (
    userRequest: string,
    files: ProjectFile[],
    projectIdentifier: string // No longer used by the new API, but kept for signature compatibility
): Promise<FileOperation[]> => {
    const systemPrompt = `Anda adalah seorang AI pengembang web otonom yang ahli. Tugas Anda adalah membantu pengguna membangun dan memodifikasi situs web standar HTML, CSS, dan JavaScript.

Anda akan diberi permintaan pengguna dan keadaan lengkap file proyek.
Berdasarkan informasi ini, Anda harus menentukan operasi file yang diperlukan (CREATE, UPDATE, DELETE) untuk memenuhi permintaan tersebut.

Anda HARUS merespons HANYA dalam format teks biasa (plain text) yang terstruktur. Jangan sertakan teks lain, penjelasan, atau format markdown di luar format yang ditentukan.

Setiap operasi file harus dipisahkan oleh baris yang hanya berisi "--".

Struktur untuk setiap operasi adalah sebagai berikut:
operation: [CREATE|UPDATE|DELETE]
path: [path/to/file.ext]
reasoning: [Penjelasan singkat satu kalimat mengapa operasi ini diperlukan.]
content:
[...konten file lengkap di sini...]

ATURAN PENTING:
1.  **HANYA Teks Terstruktur**: Seluruh respons Anda harus berupa teks biasa yang mengikuti format yang ditentukan.
2.  **Pemisah**: Gunakan baris yang hanya berisi "--" untuk memisahkan setiap operasi file. Jangan letakkan "--" di akhir operasi terakhir.
3.  **Konten Lengkap**: Untuk CREATE dan UPDATE, letakkan konten file *seluruhnya* setelah baris "content:". Jangan berikan diff atau kode parsial. Untuk DELETE, abaikan baris "content:" dan kontennya.
4.  **Format Ketat**: Setiap baris kunci (operation, path, reasoning, content) harus diikuti oleh titik dua dan spasi, lalu nilainya. Baris "content:" harus diikuti oleh baris baru, lalu konten file yang sebenarnya.
5.  **Sederhana**: Tetap gunakan HTML, CSS, dan JS standar. Jangan gunakan kerangka kerja yang kompleks kecuali diminta secara eksplisit.
6.  **Efisien**: Gabungkan perubahan ke dalam satu operasi jika memungkinkan.
7.  **Konteks adalah Kunci**: Analisis file yang ada untuk memahami struktur proyek dan buat modifikasi yang cerdas. Jika sebuah file sudah ada, operasinya harus "UPDATE", bukan "CREATE".
8.  **Path File**: Gunakan struktur file yang datar dan sederhana kecuali struktur direktori diminta secara eksplisit (mis., 'styles/main.css').`;

    const promptContext = `
${buildFileContext(files)}
Permintaan Pengguna: "${userRequest}"

Berdasarkan semua informasi di atas, silakan hasilkan blok teks dari operasi file untuk memenuhi permintaan pengguna.
`;
    
    const fullPrompt = `${systemPrompt}\n\n${promptContext}`;
    
    const response = await callAIAgent(fullPrompt);
    return parseOperationsResponse(response);
};
