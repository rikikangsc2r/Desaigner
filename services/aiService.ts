import type { Project, ChatMessage, ProjectFile, FileOperation, FileOperationType } from '../types';

const API_URL = 'https://www.nirkyy.accesscam.org/api/ai/chatbot';
const API_TOKEN = 'RIKI-BON4bV';

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
const callAIAgent = async (
  prompt: string,
  systemPrompt: string,
  agentIdentifier: string
): Promise<any> => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: agentIdentifier,
        prompt: prompt,
        system: systemPrompt,
        web: false,
        cleardb: false,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Permintaan API gagal: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    if (!result.success || !result.data || !result.data.answer) {
      throw new Error('Struktur respons API tidak valid');
    }

    return result.data.answer;
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
        const isStructuredResponse = /operation:|path:|reasoning:/i.test(txtResponse);
        if (!isStructuredResponse) {
            // This custom error will be caught in the UI to be displayed as a chat message.
            throw new AIConversationalError(txtResponse);
        }

        const operationBlocks = txtResponse.split(/^\s*--\s*$/m);
        const operations: FileOperation[] = [];

        operationBlocks.forEach((block, index) => {
            const trimmedBlock = block.trim();
            if (!trimmedBlock) return;

            const lines = trimmedBlock.split('\n');
            const op: Partial<FileOperation> & { contentLines?: string[] } = {};
            let isContentSection = false;
            
            for (const line of lines) {
                if (isContentSection) {
                    if (!op.contentLines) op.contentLines = [];
                    op.contentLines.push(line);
                    continue;
                }
                
                // Regex to handle "key: value" and "content:"
                const match = line.match(/^([a-zA-Z]+):\s?(.*)$/);
                if (match) {
                    const key = match[1].toLowerCase();
                    const value = match[2];

                    switch (key) {
                        case 'operation':
                            if (['CREATE', 'UPDATE', 'DELETE'].includes(value)) {
                                op.operation = value as FileOperationType;
                            } else {
                                throw new Error(`Jenis operasi tidak valid pada blok ${index}: ${value}`);
                            }
                            break;
                        case 'path':
                            op.path = value;
                            break;
                        case 'reasoning':
                            op.reasoning = value;
                            break;
                        case 'content':
                            isContentSection = true;
                            break;
                        default:
                          // Ignore unknown keys for forward compatibility
                          break;
                    }
                }
            }

            if (op.operation === 'CREATE' || op.operation === 'UPDATE') {
                op.content = (op.contentLines || []).join('\n');
            }

            if (!op.operation || !op.path || !op.reasoning) {
                throw new Error(`Operasi tidak lengkap pada blok ${index}. Wajib ada 'operation', 'path', dan 'reasoning'. Blok: "${trimmedBlock}"`);
            }
            
            delete op.contentLines;
            operations.push(op as FileOperation);
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
    projectIdentifier: string
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

    const prompt = `
${buildFileContext(files)}
Permintaan Pengguna: "${userRequest}"

Berdasarkan semua informasi di atas, silakan hasilkan blok teks dari operasi file untuk memenuhi permintaan pengguna.
`;
    const response = await callAIAgent(prompt, systemPrompt, `${projectIdentifier}-ArchitectAgent`);
    return parseOperationsResponse(response);
};
