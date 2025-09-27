import type { Project, ChatMessage, ProjectFile, FileOperation, FileOperationType } from '../types';

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

const parseOperationsResponse = (response: any): FileOperation[] => {
    if (typeof response !== 'string') {
        const errorMsg = `Respons AI bukan string. Diterima tipe ${typeof response}.`;
        console.error(errorMsg, "Konten:", response);
        throw new Error(errorMsg);
    }

    try {
        // Clean up response: remove markdown code blocks if present and trim
        const xmlString = response.replace(/```(xml)?/g, '').trim();

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        
        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) {
            throw new Error(`Gagal mengurai XML: ${parserError.textContent}`);
        }

        const operationNodes = xmlDoc.querySelectorAll("operation");
        const operations: FileOperation[] = [];

        operationNodes.forEach((node, index) => {
            const operationType = node.getAttribute("type") as FileOperationType;
            const pathNode = node.querySelector("path");
            const contentNode = node.querySelector("content");
            const reasoningNode = node.querySelector("reasoning");

            if (!operationType || !pathNode?.textContent || !reasoningNode?.textContent) {
                throw new Error(`Operasi pada indeks ${index} kehilangan atribut atau tag yang diperlukan (type, path, reasoning).`);
            }
            
            if (!['CREATE', 'UPDATE', 'DELETE'].includes(operationType)) {
                throw new Error(`Operasi pada indeks ${index} memiliki 'type' yang tidak valid: ${operationType}`);
            }

            const op: FileOperation = {
                operation: operationType,
                path: pathNode.textContent.trim(),
                reasoning: reasoningNode.textContent.trim(),
            };
            
            if (operationType === 'CREATE' || operationType === 'UPDATE') {
                // content can be empty string, so check for null/undefined
                if (contentNode?.textContent == null) {
                     throw new Error(`Operasi ${operationType} pada indeks ${index} ('${op.path}') memerlukan tag 'content'.`);
                }
                op.content = contentNode.textContent; // CDATA content is parsed as text
            }
            
            operations.push(op);
        });

        if (operationNodes.length === 0 && xmlDoc.documentElement.tagName !== 'operations') {
             throw new Error("Dokumen XML tidak valid atau kosong.");
        }
        
        return operations;

    } catch (e) {
        console.error("Gagal mengurai respons XML AI:", e, "Teks Asli:", response);
        throw new Error(`Gagal mengurai respons XML AI: ${(e as Error).message}`);
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

Anda HARUS merespons HANYA dengan satu blok XML yang valid yang berisi semua operasi file. Jangan sertakan teks lain, penjelasan, atau format markdown di luar blok XML.

Blok XML harus mengikuti struktur ini:
<operations>
  <operation type="CREATE|UPDATE|DELETE">
    <path>path/to/file.ext</path>
    <content><![CDATA[...]]></content>
    <reasoning>Penjelasan singkat satu kalimat mengapa operasi ini diperlukan.</reasoning>
  </operation>
  ...
</operations>

ATURAN PENTING:
1.  **HANYA XML**: Seluruh respons Anda harus berupa blok XML yang valid dan tunggal, dimulai dengan <operations>.
2.  **Konten Lengkap**: Untuk CREATE dan UPDATE, berikan konten file *seluruhnya* di dalam blok <![CDATA[...]]>. Jangan berikan diff atau kode parsial. Abaikan tag <content> untuk DELETE.
3.  **Sederhana**: Tetap gunakan HTML, CSS, dan JS standar. Jangan gunakan kerangka kerja yang kompleks kecuali diminta secara eksplisit.
4.  **Efisien**: Gabungkan perubahan ke dalam satu operasi jika memungkinkan. Misalnya, jika membuat file HTML baru, sertakan semua konten awalnya dalam satu operasi "CREATE".
5.  **Konteks adalah Kunci**: Analisis file yang ada untuk memahami struktur proyek dan buat modifikasi yang cerdas. Jika sebuah file sudah ada, operasinya harus "UPDATE", bukan "CREATE".
6.  **Path File**: Gunakan struktur file yang datar dan sederhana kecuali struktur direktori diminta secara eksplisit (mis., 'styles/main.css').
7.  **CDATA**: Selalu bungkus konten file dalam CDATA untuk mencegah masalah penguraian XML.`;

    const prompt = `
${buildFileContext(files)}
Permintaan Pengguna: "${userRequest}"

Berdasarkan semua informasi di atas, silakan hasilkan blok XML dari operasi file untuk memenuhi permintaan pengguna.
`;
    const response = await callAIAgent(prompt, systemPrompt, `${projectIdentifier}-ArchitectAgent`);
    return parseOperationsResponse(response);
};
