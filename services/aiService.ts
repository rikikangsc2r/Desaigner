import type { ProjectFile, ChatMessage, FileOperation, BlueprintFile } from '../types';

const API_URL = 'https://nirkyy-testing.hf.space/api/generate';

/**
 * Custom error for when the AI returns a conversational response instead of the expected JSON.
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
    
    return answer.trim();

  } catch (error) {
    console.error(`Kesalahan saat memanggil AI:`, error);
    throw error;
  }
};

const buildFileContext = (files: ProjectFile[]): string => {
  if (files.length === 0) {
    return "Proyek ini saat ini kosong. Tidak ada file yang ada.\n";
  }
  let context = "Ini adalah file-file yang ada dalam proyek saat ini:\n\n";
  files.forEach(file => {
    context += `--- File: ${file.path} ---\n${file.content}\n\n`;
  });
  return context;
};

const parseJsonResponse = <T>(response: string): T => {
    try {
        // Remove markdown code blocks and trim whitespace
        let jsonString = response.replace(/```(json|text)?/g, '').trim();
        
        // Fix for AI sometimes over-escaping quotes (e.g., \\" instead of \")
        jsonString = jsonString.replace(/\\"/g, '\\"');

        // Find the start of the JSON array. Handles cases where the AI adds conversational text before the JSON.
        const startIndex = jsonString.indexOf('[');
        if (startIndex === -1) {
            // If no array is found, assume the entire response is a conversational message.
            throw new AIConversationalError(jsonString);
        }

        // Find the matching closing bracket for the array. This handles cases with trailing text.
        const lastIndex = jsonString.lastIndexOf(']');
        if (lastIndex === -1 || lastIndex < startIndex) {
             throw new Error("Struktur JSON tidak valid: kurung tutup array tidak ditemukan atau tidak pada tempatnya.");
        }
        
        // Extract only the part of the string that is likely to be valid JSON.
        const potentialJson = jsonString.substring(startIndex, lastIndex + 1);

        return JSON.parse(potentialJson) as T;
    } catch (e) {
        if (e instanceof AIConversationalError) {
            throw e; // Re-throw conversational errors as they are expected behavior.
        }
        // For actual parsing errors, provide a more user-friendly message.
        console.error("Gagal mengurai respons JSON dari AI:", e, "Teks Asli:", response);
        throw new AIConversationalError(`Maaf, saya mengalami masalah saat memformat respons saya. Coba sederhanakan permintaan Anda atau coba lagi.`);
    }
}


export const generateBlueprint = async (
    userGoal: string,
    files: ProjectFile[]
): Promise<BlueprintFile[]> => {
    const systemPrompt = `Anda adalah AI perencana senior (Blueprint Agent). Berdasarkan permintaan pengguna dan file yang ada, buatlah rencana (blueprint) operasi file yang diperlukan. Jangan tulis kodenya. Cukup jelaskan apa yang akan dilakukan pada setiap file.

**ATURAN PENTING:**
1.  **HANYA JSON:** Seluruh output Anda HARUS berupa array JSON yang valid. Jangan tambahkan teks atau penjelasan lain di luar JSON.
2.  **FORMAT OBJEK:** Setiap objek dalam array harus memiliki properti berikut:
    *   \`path\` (string): Path lengkap ke file (misalnya, 'src/components/Button.js').
    *   \`operation\` (string): Jenis operasi. HARUS salah satu dari 'CREATE', 'UPDATE', atau 'DELETE'.
    *   \`description\` (string): Penjelasan SANGAT SINGKAT tentang tujuan file atau ringkasan perubahan.

**Contoh Respons JSON:**
[
  {
    "path": "index.html",
    "operation": "UPDATE",
    "description": "Menambahkan elemen kanvas untuk grafik dan menautkan file script baru."
  },
  {
    "path": "chart.js",
    "operation": "CREATE",
    "description": "File JavaScript baru untuk logika rendering grafik."
  }
]`;

    const promptContext = `
${buildFileContext(files)}
Tujuan Pengguna: "${userGoal}"

Berdasarkan semua informasi di atas, hasilkan array JSON dari rencana Anda.
`;
    
    const fullPrompt = `${systemPrompt}\n\n${promptContext}`;
    
    const response = await callAIAgent(fullPrompt);
    return parseJsonResponse<BlueprintFile[]>(response);
};


export const generateCodeFromBlueprint = async (
    userGoal: string,
    blueprint: BlueprintFile[],
    files: ProjectFile[]
): Promise<FileOperation[]> => {
    const systemPrompt = `Anda adalah AI pembuat kode ahli (Coding Agent). Berdasarkan permintaan pengguna dan RENCANA yang diberikan, tulis KONTEN LENGKAP untuk semua file yang perlu dibuat atau diubah.

**ATURAN PENTING:**
1.  **HANYA JSON:** Seluruh output Anda HARUS berupa array JSON yang valid dari objek FileOperation.
2.  **KONTEN LENGKAP:** Untuk operasi 'CREATE' dan 'UPDATE', properti \`content\` HARUS berisi konten file LENGKAP, bukan hanya perubahannya.
3.  **ESCAPE KARAKTER:** Di dalam string \`content\`, semua karakter baris baru HARUS di-escape sebagai \`\\n\`, dan semua karakter kutip ganda (") HARUS di-escape sebagai \`\\"\`.
4.  **FORMAT OBJEK:** Setiap objek dalam array HARUS memiliki properti:
    *   \`path\` (string): Path lengkap ke file.
    *   \`operation\` (string): 'CREATE', 'UPDATE', atau 'DELETE'.
    *   \`content\` (string, opsional): Konten file lengkap. Diperlukan untuk 'CREATE' dan 'UPDATE'.
    *   \`reasoning\` (string): Alasan singkat untuk perubahan ini.

**Contoh Respons JSON:**
[
  {
    "path": "index.html",
    "operation": "UPDATE",
    "content": "<!DOCTYPE html>\\n<html>\\n<head>...</head>\\n<body>\\n...\\n<canvas id=\\"myChart\\"></canvas>\\n<script src=\\"chart.js\\"></script>\\n</body>\\n</html>",
    "reasoning": "Menambahkan elemen canvas dan menautkan file script baru sesuai rencana."
  },
  {
    "path": "chart.js",
    "operation": "CREATE",
    "content": "console.log('Chart logic goes here');\\n// ...kode lengkap...",
    "reasoning": "Membuat file baru untuk logika grafik seperti yang diminta dalam blueprint."
  }
]`;

    const promptContext = `
${buildFileContext(files)}
Tujuan Pengguna: "${userGoal}"

Rencana (Blueprint) untuk diikuti:
${JSON.stringify(blueprint, null, 2)}

Sekarang, hasilkan array JSON dari operasi file dengan konten kode lengkap.
`;

    const fullPrompt = `${systemPrompt}\n\n${promptContext}`;

    const response = await callAIAgent(fullPrompt);
    return parseJsonResponse<FileOperation[]>(response);
}