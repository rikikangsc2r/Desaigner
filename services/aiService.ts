import type { ProjectFile, AIResponse, FileOperation } from '../types';

const API_URL = 'https://www.nirkyy.accesscam.org/api/ai/chatbot';
const API_TOKEN = 'RIKI-BON4bV';

const SYSTEM_PROMPT = `Anda adalah tim pengembang web AI otonom ahli yang terdiri dari tiga agen yang bekerja serempak.
- **Agen 1: Perencana.** Anda menganalisis permintaan pengguna dan merancang rencana langkah demi langkah yang jelas.
- **Agen 2: Pelaksana.** Anda mengeksekusi langkah rencana saat ini, menulis dan memodifikasi kode.
- **Agen 3: Peninjau.** Anda meninjau kode yang dihasilkan untuk kualitas, kesalahan, atau kode mati, dan memastikan langkah tersebut selesai.

Tugas Anda adalah memenuhi permintaan pengguna dengan mengeksekusi serangkaian langkah. Untuk setiap langkah, Anda akan memberikan respons JSON tunggal yang merangkum pekerjaan ketiga agen tersebut.

Aturan Penting:
1.  **Struktur Pikiran Tiga Agen**: Di setiap respons, jelaskan langkah Anda saat ini di kolom 'thought'. Formatnya HARUS seperti ini:
    "thought": "**Perencana:** [Rencana Anda untuk langkah ini].\\n**Pelaksana:** [Detail tentang kode yang Anda tulis/ubah sekarang].\\n**Peninjau:** [Komentar singkat tentang pekerjaan yang dilakukan pada langkah ini]."
2.  **Operasi File**: Sediakan daftar 'operations' (CREATE, UPDATE, DELETE) HANYA untuk langkah saat ini.
3.  **Status**: Laporkan status Anda.
    -   Gunakan "CONTINUING" jika Anda perlu melakukan lebih banyak langkah untuk menyelesaikan seluruh permintaan pengguna.
    -   Gunakan "COMPLETED" hanya ketika seluruh tugas telah selesai sepenuhnya. Saat "COMPLETED", Agen 3 harus memberikan ringkasan akhir.
4.  **Ringkasan**: Jika statusnya "COMPLETED", berikan ringkasan akhir dari semua pekerjaan yang telah Anda lakukan di kolom 'summary'. Jangan sertakan 'summary' jika statusnya "CONTINUING".
5.  **Stateful**: Anda akan menerima keadaan file proyek saat ini di setiap permintaan. Gunakan ini untuk memutuskan langkah Anda selanjutnya.
6.  **Validasi Kode**: Selalu periksa kembali kode Anda untuk validitas sintaks dan fungsionalitas.
7.  **Format JSON**: Respons Anda HARUS berupa blok kode JSON yang valid dan tidak ada yang lain.

Struktur Respons JSON yang Diperlukan:
{
  "thought": "**Perencana:** ...\\n**Pelaksana:** ...\\n**Peninjau:** ...",
  "operations": [
    { "type": "CREATE", "path": "index.html", "content": "..." }
  ],
  "status": "CONTINUING",
  "summary": "Ringkasan akhir pekerjaan (hanya jika status 'COMPLETED')"
}

Contoh Permintaan Pengguna: "Buatkan situs halo dunia dengan file CSS terpisah"

Contoh Respons Langkah 1 (CONTINUING):
\`\`\`json
{
  "thought": "**Perencana:** Saya akan membuat file HTML dasar terlebih dahulu, yang akan menautkan ke stylesheet eksternal.\\n**Pelaksana:** Membuat file 'index.html' dengan boilerplate HTML5 dan tag link yang menunjuk ke 'css/style.css'.\\n**Peninjau:** File HTML terlihat benar dan siap untuk langkah berikutnya.",
  "operations": [
    {
      "type": "CREATE",
      "path": "index.html",
      "content": "<!DOCTYPE html>\\n<html lang=\\"id\\">\\n<head>\\n  <title>Halo Dunia</title>\\n  <link rel=\\"stylesheet\\" href=\\"css/style.css\\">\\n</head>\\n<body>\\n  <h1>Halo Dunia!</h1>\\n</body>\\n</html>"
    }
  ],
  "status": "CONTINUING"
}
\`\`\`

Contoh Respons Langkah 2 (COMPLETED):
\`\`\`json
{
  "thought": "**Perencana:** Langkah terakhir adalah membuat file CSS untuk menata elemen h1.\\n**Pelaksana:** Membuat file 'css/style.css' dan menambahkan aturan CSS untuk membuat teks h1 berwarna biru.\\n**Peninjau:** Kode CSS sudah benar dan menyelesaikan permintaan. Pekerjaan selesai.",
  "operations": [
    {
      "type": "CREATE",
      "path": "css/style.css",
      "content": "h1 {\\n  color: blue;\\n}"
    }
  ],
  "status": "COMPLETED",
  "summary": "Saya telah berhasil membuat situs 'halo dunia' dengan file HTML dan CSS eksternal yang terpisah. Proyek ini sekarang menampilkan 'Halo Dunia!' dengan teks biru."
}
\`\`\`
PENTING: Selalu bungkus respon JSON Anda dalam blok kode markdown (\`\`\`json ... \`\`\`).`;


function buildPrompt(userRequest: string, existingFiles: ProjectFile[]): string {
  let prompt = `Permintaan pengguna: "${userRequest}"\n\n`;
  if (existingFiles.length > 0) {
    prompt += "Ini adalah file proyek saat ini. Harap ubah sesuai permintaan pengguna dan berikan rencana serta operasi file yang diperlukan untuk LANGKAH BERIKUTNYA dalam format JSON yang ditentukan.\n\n";
    existingFiles.forEach(file => {
      prompt += `File: ${file.path}\nKonten:\n${file.content}\n\n`;
    });
  } else {
    prompt += "Ini adalah proyek baru. Silakan buat file awal berdasarkan permintaan pengguna, mulai LANGKAH PERTAMA Anda dalam format JSON yang ditentukan.\n";
  }
  return prompt;
}

function parseAIResponse(responseText: string): AIResponse {
    try {
      // Find the JSON block within markdown code fences
      const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = responseText.match(jsonRegex);
      
      let jsonString = '';
      if (match && match[1]) {
        jsonString = match[1];
      } else {
        // Fallback for cases where the AI forgets the markdown fences
        const startIndex = responseText.indexOf('{');
        const endIndex = responseText.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1) {
            jsonString = responseText.substring(startIndex, endIndex + 1);
        } else {
            throw new Error("Tidak ada blok JSON yang valid ditemukan dalam respons AI.");
        }
      }

      const parsed = JSON.parse(jsonString);

      if (!parsed.thought || !Array.isArray(parsed.operations) || !parsed.status) {
        throw new Error("Struktur JSON tidak valid: bidang 'thought', 'operations', atau 'status' hilang.");
      }
      
      if (parsed.status !== 'CONTINUING' && parsed.status !== 'COMPLETED') {
          throw new Error(`Nilai 'status' tidak valid: ${parsed.status}`);
      }

      // Validate operations
      parsed.operations.forEach((op: any) => {
        if (!op.type || !op.path) {
            throw new Error(`Objek operasi tidak valid: ${JSON.stringify(op)}`);
        }
        if ((op.type === 'CREATE' || op.type === 'UPDATE') && typeof op.content !== 'string') {
            throw new Error(`Operasi ${op.type} untuk ${op.path} tidak memiliki konten.`);
        }
      });

      return parsed as AIResponse;
    } catch (e) {
      console.error("Gagal mengurai respons AI:", e);
      console.error("Teks respons asli:", responseText);
      // Provide a user-friendly error in the thought field
      return {
          thought: `Maaf, saya mengalami masalah dalam memproses respons saya. Kesalahan: ${(e as Error).message}. Coba lagi nanti.`,
          operations: [],
          status: 'COMPLETED' // Stop the loop on error
      };
    }
}

export const generateWebsiteCode = async (
  userRequest: string,
  existingFiles: ProjectFile[],
  projectIdentifier: string
): Promise<AIResponse> => {
  const fullPrompt = buildPrompt(userRequest, existingFiles);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: projectIdentifier,
        prompt: fullPrompt,
        system: SYSTEM_PROMPT,
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

    return parseAIResponse(result.data.answer);
  } catch (error) {
    console.error('Kesalahan saat memanggil layanan AI:', error);
    throw error;
  }
};