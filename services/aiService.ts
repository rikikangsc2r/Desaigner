import type { ProjectFile, ChatMessage, FileOperation, TemplateType, StyleLibrary } from '../types';

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

/**
 * Parses the AI's unified response into an explanation and file contents.
 */
const parseUnifiedResponse = (response: string): { explanation: string, generatedFiles: { path: string, content: string }[] } => {
    const explanationRegex = /-- penjelasan --\r?\n([\s\S]*?)\r?\n--#/;
    const fileBlockRegex = /-- (.*?) --\r?\n([\s\S]*?)\r?\n--#/g;
    
    const explanationMatch = response.match(explanationRegex);
    // Fallback explanation if the block is missing but files are present
    const explanation = explanationMatch ? explanationMatch[1].trim() : "Selesai! Saya telah memperbarui file proyek.";

    const generatedFiles: { path: string, content: string }[] = [];
    
    let fileSection = response;
    
    // If an explanation block exists, start parsing for files *after* it to avoid confusion.
    if (explanationMatch) {
      const endOfExplanationIndex = response.indexOf('--#', explanationMatch.index);
      if (endOfExplanationIndex !== -1) {
        fileSection = response.substring(endOfExplanationIndex + 3);
      }
    }
    
    let match;
    while ((match = fileBlockRegex.exec(fileSection)) !== null) {
        const path = match[1].trim();
        const content = match[2].trim(); 
        if (path) {
            generatedFiles.push({ path, content });
        }
    }

    // If no explanation was found AND no files were parsed, it's likely a conversational response.
    if (!explanationMatch && generatedFiles.length === 0 && response.trim() !== "") {
      throw new AIConversationalError(`Maaf, saya tidak dapat memproses permintaan itu dalam format yang benar. Respons saya:\n\n${response}`);
    }
    
    return { explanation, generatedFiles };
};


export const runAIAgentWorkflow = async (
    userGoal: string,
    files: ProjectFile[],
    template: TemplateType,
    styleLibrary: StyleLibrary,
): Promise<{ explanation: string; operations: FileOperation[] }> => {
    
    const stackDescription = getStackDescription(template, styleLibrary);
    const systemPrompt = `Anda adalah AI pengembang front-end otonom yang ahli. Tugas Anda adalah menganalisis permintaan pengguna, merencanakan perubahan yang diperlukan, dan menulis kode berkualitas produksi dalam satu langkah.

**KONTEKS PROYEK:**
*   **Tumpukan Teknologi:** Proyek ini dibangun menggunakan **${stackDescription}**. Semua kode yang Anda tulis HARUS sesuai dengan tumpukan ini.

**PROSES WAJIB:**
1.  **Analisis & Rencana:** Pikirkan secara internal tentang permintaan pengguna dan file yang ada. Tentukan cara terbaik dan paling sederhana untuk mencapai tujuan.
2.  **Tulis Penjelasan:** Ringkas rencana Anda menjadi penjelasan singkat untuk pengguna.
3.  **Tulis Kode:** Hasilkan konten LENGKAP untuk semua file yang perlu dibuat atau diubah. Jika suatu file tidak memerlukan perubahan, JANGAN sertakan dalam output.

**ATURAN OUTPUT YANG SANGAT KETAT:**
Anda HARUS mengikuti format ini dengan tepat. Jangan tambahkan teks atau percakapan lain.

-- penjelasan --
Di sini Anda akan menulis ringkasan singkat tentang perubahan yang akan Anda lakukan. Misalnya: "Baik, saya akan memperbarui file index.html untuk menambahkan tombol baru dan menatanya di style.css."
--#

-- path/to/file1.html --
<!DOCTYPE html>
... konten lengkap file 1 ...
--#

-- path/to/file2.css --
... konten lengkap file 2 ...
--#

**PRINSIP UTAMA:**
1.  **PERUBAHAN MINIMAL:** Selalu prioritaskan untuk memodifikasi file yang ada. Jangan membuat file baru atau memecah file yang ada kecuali benar-benar diperlukan.
2.  **KODE LENGKAP:** Anda HARUS menulis konten file secara LENGKAP dari awal hingga akhir. Jangan gunakan placeholder atau komentar seperti "// tambahkan kode di sini".
3.  **KUALITAS PRODUKSI:** Tulis kode yang bersih, efisien, responsif, dan mudah dibaca.
4.  **HANYA FILE YANG DIUBAH:** Hanya sertakan blok file untuk file yang Anda buat atau ubah.`;

    const promptContext = `
${buildFileContext(files)}
Tujuan Pengguna: "${userGoal}"

Berdasarkan semua informasi di atas, hasilkan respons Anda dalam format yang ditentukan.
`;

    const fullPrompt = `${systemPrompt}\n\n${promptContext}`;
    
    const responseText = await callAIAgent(fullPrompt);
    
    const { explanation, generatedFiles } = parseUnifiedResponse(responseText);

    const operations: FileOperation[] = [];
    const existingFilePaths = new Set(files.map(f => f.path));

    for (const file of generatedFiles) {
        operations.push({
            operation: existingFilePaths.has(file.path) ? 'UPDATE' : 'CREATE',
            path: file.path,
            content: file.content,
            reasoning: explanation,
        });
    }

    // This simplified model doesn't handle deletions. This is a limitation.
    // A future improvement could be to have the AI output a 'DELETE' operation in a special block.

    return { explanation, operations };
};