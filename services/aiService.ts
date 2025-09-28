import type { ProjectFile, ChatMessage, FileOperation, BlueprintFile, TemplateType, StyleLibrary } from '../types';

const API_URL = 'https://nirkyy-testing.hf.space/api/generate';

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

const getStackDescription = (template: TemplateType, styleLibrary: StyleLibrary): string => {
    let stack = '';
    switch (template) {
        case 'html': stack = 'Single-file HTML'; break;
        case 'vanilla': stack = 'HTML, CSS, and JavaScript'; break;
        case 'react-jsx': stack = 'React with JSX'; break;
        case 'react-tsx': stack = 'React with TypeScript (TSX)'; break;
    }
    if (styleLibrary === 'bootstrap') {
        stack += ' and Bootstrap';
    } else if (styleLibrary === 'tailwindcss') {
        stack += ' and TailwindCSS';
    }
    return stack;
};


const parseJsonResponse = <T>(response: string): T => {
    try {
        // Remove markdown code blocks and trim whitespace
        let jsonString = response.replace(/```(json|text)?/g, '').trim();

        // Find the start of the JSON array. Handles cases where the AI adds conversational text before the JSON.
        const startIndex = jsonString.indexOf('[');
        if (startIndex === -1) {
            // If no array is found, assume the entire response is a conversational message.
            throw new AIConversationalError(jsonString);
        }

        // We'll work with the string from the first '[' onwards.
        let potentialJson = jsonString.substring(startIndex);

        // First, try to parse by finding the closing bracket, which handles well-formed JSON with trailing text.
        const lastBracketIndex = potentialJson.lastIndexOf(']');
        if (lastBracketIndex > -1) {
            const completeJson = potentialJson.substring(0, lastBracketIndex + 1);
            try {
                return JSON.parse(completeJson) as T;
            } catch (e) {
                console.warn("Parsing complete JSON failed, attempting truncation recovery.", e);
                // If it fails, proceed to the truncation recovery logic.
            }
        }
        
        // Truncation recovery logic:
        // Find the last '}' which likely indicates the end of the last complete object.
        const lastBraceIndex = potentialJson.lastIndexOf('}');
        if (lastBraceIndex > -1) {
            // Assume the object it belongs to is complete and close the array.
            const truncatedJson = potentialJson.substring(0, lastBraceIndex + 1) + ']';
            return JSON.parse(truncatedJson) as T;
        }

        // If we reach here, we couldn't parse it normally and couldn't find a fallback.
        throw new Error("Struktur JSON tidak valid: tidak ada objek atau array yang dapat diurai.");

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
    files: ProjectFile[],
    template: TemplateType,
    styleLibrary: StyleLibrary,
): Promise<BlueprintFile[]> => {
    const stackDescription = getStackDescription(template, styleLibrary);
    const systemPrompt = `Anda adalah AI perencana senior (Blueprint Agent) dengan spesialisasi dalam arsitektur front-end dan desain UI/UX kelas dunia. Tugas Anda adalah mengubah permintaan pengguna menjadi rencana (blueprint) operasi file yang terstruktur dengan baik dan siap untuk produksi. Jangan tulis kodenya.

**KONTEKS PROYEK:**
*   **Tumpukan Teknologi:** Proyek ini dibangun menggunakan **${stackDescription}**. Pastikan semua rencana file sesuai dengan tumpukan teknologi ini.

**PRINSIP PANDUAN UTAMA:**
1.  **Kualitas Kode Produksi:** Selalu prioritaskan kode yang bersih, modular, dapat dipelihara, dan berperforma tinggi. Gunakan praktik terbaik modern. Pikirkan tentang skalabilitas jangka panjang.
2.  **UI/UX yang Matang & Profesional:** Desain antarmuka yang tidak hanya fungsional tetapi juga indah secara estetika, responsif di semua perangkat, dapat diakses (accessibility-first), dan intuitif untuk pengguna akhir.
3.  **Struktur File yang Logis:** Atur file dengan cara yang terstruktur dan masuk akal untuk produksi. Pisahkan komponen, logika, gaya, dan aset. Misalnya, gunakan direktori seperti \`src/components/\`, \`src/styles/\`, \`src/utils/\`.

**ATURAN OUTPUT PENTING:**
1.  **HANYA JSON:** Seluruh output Anda HARUS berupa array JSON yang valid. Jangan tambahkan teks atau penjelasan lain di luar JSON.
2.  **FORMAT OBJEK:** Setiap objek dalam array harus memiliki properti berikut:
    *   \`path\` (string): Path lengkap ke file (misalnya, 'src/components/Button.js'). Gunakan struktur direktori yang baik.
    *   \`operation\` (string): Jenis operasi. HARUS salah satu dari 'CREATE', 'UPDATE', atau 'DELETE'.
    *   \`description\` (string): Penjelasan SINGKAT tentang tujuan file atau ringkasan perubahan, dengan mempertimbangkan prinsip panduan di atas.

**Contoh Respons JSON:**
[
  {
    "path": "index.html",
    "operation": "UPDATE",
    "description": "Memperbarui struktur utama HTML untuk mendukung layout aplikasi modern."
  },
  {
    "path": "src/styles/main.css",
    "operation": "CREATE",
    "description": "Membuat file CSS utama untuk variabel global, reset, dan gaya dasar."
  },
  {
    "path": "src/components/Header.js",
    "operation": "CREATE",
    "description": "Membuat komponen Header yang dapat digunakan kembali untuk navigasi."
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

/**
 * Parses the AI's text response containing file blocks into a structured array.
 */
const parseFileContentResponse = (response: string): { path: string, content: string }[] => {
    const operations: { path: string, content: string }[] = [];
    const fileBlockRegex = /-- START OF (.*?) --\r?\n([\s\S]*?)\r?\n-- END --/g;
    
    let match;
    while ((match = fileBlockRegex.exec(response)) !== null) {
        const path = match[1].trim();
        const content = match[2].trim(); 
        if (path) { // Allow empty content
            operations.push({ path, content });
        }
    }

    if (operations.length === 0 && response.trim() !== "") {
      // Throw an error if the AI responded but not in the expected format.
      throw new AIConversationalError(`The AI's response could not be parsed. Please check the format. Raw response: \n\n${response}`);
    }

    return operations;
};

export const generateCodeFromBlueprint = async (
    userGoal: string,
    blueprint: BlueprintFile[],
    files: ProjectFile[],
    template: TemplateType,
    styleLibrary: StyleLibrary,
): Promise<FileOperation[]> => {
    
    // Separate blueprint operations: coding agent handles CREATE/UPDATE, DELETEs are handled directly.
    const opsToCode = blueprint.filter(b => b.operation === 'CREATE' || b.operation === 'UPDATE');
    const deleteOps: FileOperation[] = blueprint
        .filter(b => b.operation === 'DELETE')
        .map(b => ({
            operation: 'DELETE',
            path: b.path,
            reasoning: b.description // Use blueprint description as reasoning
        }));

    // If there are no files to create or update, return only the delete operations.
    if (opsToCode.length === 0) {
        return deleteOps;
    }
    
    const stackDescription = getStackDescription(template, styleLibrary);
    const systemPrompt = `Anda adalah AI pembuat kode ahli (Coding Agent) yang berfokus pada kualitas produksi. Berdasarkan permintaan pengguna dan RENCANA yang diberikan, tulis KONTEN LENGKAP untuk semua file yang perlu dibuat atau diubah.

**KONTEKS PROYEK PENTING:**
*   **Tumpukan Teknologi:** Proyek ini dibangun menggunakan **${stackDescription}**. Semua kode yang Anda tulis HARUS sesuai dengan tumpukan teknologi ini. Misalnya, jika menggunakan TailwindCSS, gunakan kelas utilitasnya. Jika menggunakan React, tulis komponen fungsional dengan Hooks.

**ATURAN OUTPUT PENTING:**
1.  **HANYA TULIS KODE:** Jangan tambahkan penjelasan atau teks percakapan apa pun.
2.  **FORMAT WAJIB:** Anda HARUS menyajikan setiap file dalam format berikut. Pastikan untuk menyertakan penanda awal dan akhir:
    
    -- START OF [path/lengkap/ke/file.ekstensi] --
    [Konten file lengkap di sini...]
    -- END --

    Ulangi blok ini untuk setiap file yang perlu Anda tulis.

**PRINSIP KODE UTAMA:**
1.  **Kualitas Produksi:** Tulis kode yang bersih, efisien, dan mudah dibaca.
2.  **UI/UX Modern:** Jika menulis kode UI (HTML/CSS/JS), pastikan hasilnya responsif, dapat diakses, dan secara visual menarik.
3.  **Lengkap & Fungsional:** Kode yang Anda tulis harus lengkap dan siap pakai. Jangan gunakan placeholder.

**Contoh Respons:**
-- START OF index.html --
<!DOCTYPE html>
<html lang="en">
<body>
    <h1>Hello World</h1>
</body>
</html>
-- END --
-- START OF style.css --
body { font-family: sans-serif; }
-- END --
`;

    const promptContext = `
${buildFileContext(files)}
Tujuan Pengguna: "${userGoal}"

Rencana (Blueprint) untuk diikuti (hanya buat/perbarui file-file ini):
${JSON.stringify(opsToCode, null, 2)}

Sekarang, hasilkan konten lengkap untuk file-file dalam format yang ditentukan. Patuhi tumpukan teknologi proyek!
`;

    const fullPrompt = `${systemPrompt}\n\n${promptContext}`;

    const response = await callAIAgent(fullPrompt);
    
    const parsedFileContents = parseFileContentResponse(response);
    const parsedFileMap = new Map(parsedFileContents.map(p => [p.path, p.content]));
    
    const codeOps: FileOperation[] = [];

    // Only create operations for files that were both in the blueprint and generated by the AI.
    opsToCode.forEach(blueprintFile => {
        if (parsedFileMap.has(blueprintFile.path)) {
            codeOps.push({
                operation: blueprintFile.operation as 'CREATE' | 'UPDATE',
                path: blueprintFile.path,
                content: parsedFileMap.get(blueprintFile.path),
                reasoning: blueprintFile.description
            });
        } else {
            console.warn(`AI did not generate content for the planned file: ${blueprintFile.path}. Skipping operation.`);
        }
    });
    
    // Combine the generated code operations with the deletion operations.
    return [...codeOps, ...deleteOps];
}