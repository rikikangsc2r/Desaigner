import type { Project, ChatMessage, ProjectFile, FileOperation } from '../types';

const API_URL = 'https://www.nirkyy.accesscam.org/api/ai/chatbot';
const API_TOKEN = 'RIKI-BON4bV';

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

const buildChatHistoryContext = (chatHistory: ChatMessage[]): string => {
    if (chatHistory.length <= 1) { // only the new user prompt
        return "";
    }
    // Get the last 6 messages, excluding the most recent user message which is part of the main prompt
    const relevantHistory = chatHistory.slice(-7, -1);
    if (relevantHistory.length === 0) {
        return "";
    }
    let context = "Berikut adalah riwayat obrolan singkat untuk konteks:\n\n";
    relevantHistory.forEach(msg => {
        context += `${msg.role === 'user' ? 'Pengguna' : 'AI'}: ${msg.content}\n`;
    });
    context += "\n";
    return context;
}

/**
 * Finds the matching closing bracket for an opening bracket at a given index.
 * Handles nested brackets and ignores brackets within string literals.
 */
const findMatchingBracket = (str: string, start: number): number => {
    if (str[start] !== '[') return -1;
    
    let depth = 1;
    let inString = false;
    
    for (let i = start + 1; i < str.length; i++) {
        const char = str[i];
        
        if (char === '"' && str[i-1] !== '\\') {
            inString = !inString;
        }
        
        if (!inString) {
            if (char === '[') {
                depth++;
            } else if (char === ']') {
                depth--;
            }
        }
        
        if (depth === 0) {
            return i;
        }
    }
    
    return -1; // Not found
};

const parseOperationsResponse = (response: any): FileOperation[] => {
    let operations: any;

    if (typeof response === 'string') {
        try {
            let jsonString = response;
            
            const startIndex = jsonString.indexOf('[');
            if (startIndex === -1) {
                throw new Error("Tidak ada larik JSON yang ditemukan dalam respons string AI.");
            }
            
            const endIndex = findMatchingBracket(jsonString, startIndex);
            if (endIndex === -1) {
                const lastIndex = jsonString.lastIndexOf(']');
                if (lastIndex > startIndex) {
                     jsonString = jsonString.substring(startIndex, lastIndex + 1);
                } else {
                    throw new Error("Tidak dapat menemukan larik JSON yang lengkap (kurung tidak cocok).");
                }
            } else {
                 jsonString = jsonString.substring(startIndex, endIndex + 1);
            }

            operations = JSON.parse(jsonString);

        } catch (e) {
            console.error("Gagal mengurai respons string AI:", e, "Teks Asli:", response);
            throw new Error(`Gagal mengurai respons string AI: ${(e as Error).message}`);
        }
    } else if (Array.isArray(response)) {
        operations = response;
    } else {
        const errorMsg = `Respons AI bukan string atau larik yang valid. Diterima tipe ${typeof response}.`;
        console.error(errorMsg, "Konten:", response);
        throw new Error(errorMsg);
    }

    if (!Array.isArray(operations)) {
        throw new Error("Data yang diurai bukan sebuah larik.");
    }

    operations.forEach((op: any, index: number) => {
        if (!op.operation || !op.path || !op.reasoning) {
            throw new Error(`Operasi pada indeks ${index} kehilangan bidang yang diperlukan (operation, path, reasoning).`);
        }
        if (!['CREATE', 'UPDATE', 'DELETE'].includes(op.operation)) {
            throw new Error(`Operasi pada indeks ${index} memiliki 'operation' yang tidak valid: ${op.operation}`);
        }
        if ((op.operation === 'CREATE' || op.operation === 'UPDATE') && typeof op.content !== 'string') {
             throw new Error(`Operasi ${op.operation} pada indeks ${index} ('${op.path}') memerlukan bidang 'content' string.`);
        }
    });

    return operations as FileOperation[];
};

export const generateFileOperations = async (
    userRequest: string,
    chatHistory: ChatMessage[],
    files: ProjectFile[],
    projectIdentifier: string
): Promise<FileOperation[]> => {
    const systemPrompt = `Anda adalah seorang AI pengembang web otonom yang ahli. Tugas Anda adalah membantu pengguna membangun dan memodifikasi situs web standar HTML, CSS, dan JavaScript.

Anda akan diberi permintaan pengguna, riwayat obrolan saat ini, dan keadaan lengkap file proyek.
Berdasarkan informasi ini, Anda harus menentukan operasi file yang diperlukan (CREATE, UPDATE, DELETE) untuk memenuhi permintaan tersebut.

Anda HARUS merespons HANYA dengan satu larik JSON dari objek operasi file. Jangan sertakan teks lain, penjelasan, atau format markdown di luar larik JSON.

Larik JSON harus mengikuti struktur ini:
[
  {
    "operation": "CREATE" | "UPDATE" | "DELETE",
    "path": "path/ke/file.ext",
    "content": "...",
    "reasoning": "Penjelasan singkat satu kalimat mengapa operasi ini diperlukan."
  }
]

ATURAN PENTING:
1.  **HANYA JSON**: Seluruh respons Anda harus berupa larik JSON yang valid.
2.  **Konten Lengkap**: Untuk CREATE dan UPDATE, berikan konten file *seluruhnya*. Jangan berikan diff atau kode parsial. Abaikan 'content' untuk DELETE.
3.  **Sederhana**: Tetap gunakan HTML, CSS, dan JS standar. Jangan gunakan kerangka kerja yang kompleks kecuali diminta secara eksplisit.
4.  **Efisien**: Gabungkan perubahan ke dalam satu operasi jika memungkinkan. Misalnya, jika membuat file HTML baru, sertakan semua konten awalnya dalam satu operasi "CREATE".
5.  **Konteks adalah Kunci**: Analisis file yang ada untuk memahami struktur proyek dan buat modifikasi yang cerdas. Jika sebuah file sudah ada, operasinya harus "UPDATE", bukan "CREATE".
6.  **Path File**: Gunakan struktur file yang datar dan sederhana kecuali struktur direktori diminta secara eksplisit (mis., 'styles/main.css').
7.  **Escaping**: Pastikan semua konten dalam JSON di-escape dengan benar, terutama tanda kutip dan baris baru di dalam bidang "content".`;

    const prompt = `
${buildChatHistoryContext(chatHistory)}
${buildFileContext(files)}
Permintaan Pengguna: "${userRequest}"

Berdasarkan semua informasi di atas, silakan hasilkan larik JSON operasi file untuk memenuhi permintaan pengguna.
`;
    const response = await callAIAgent(prompt, systemPrompt, `${projectIdentifier}-ArchitectAgent`);
    return parseOperationsResponse(response);
};