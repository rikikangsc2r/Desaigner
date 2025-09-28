import type { ProjectFile } from '../types';

declare const JSZip: any;

const getMimeType = (path: string): string => {
    if (path.endsWith('.html')) return 'text/html';
    if (path.endsWith('.css')) return 'text/css';
    if (path.endsWith('.js') || path.endsWith('.jsx') || path.endsWith('.tsx')) return 'application/javascript';
    if (path.endsWith('.json')) return 'application/json';
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
    if (path.endsWith('.svg')) return 'image/svg+xml';
    return 'text/plain';
};

/**
 * Creates a sandboxed preview environment using Blob URLs.
 * This is more robust than srcDoc as it simulates a file system,
 * allowing scripts (including modules) to be loaded correctly.
 * @param files The project files.
 * @returns An object containing the URL for the main preview page and an array of all generated blob URLs for cleanup.
 */
export const createPreviewUrl = (files: ProjectFile[]): { previewUrl: string, blobUrls: string[] } => {
    const htmlFile = files.find(f => f.path.toLowerCase() === 'index.html');
    if (!htmlFile) {
        const errorHtml = '<html><body><h1>No index.html file found.</h1></body></html>';
        const blob = new Blob([errorHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        return { previewUrl: url, blobUrls: [url] };
    }

    const fileMap = new Map<string, string>();
    const blobUrls: string[] = [];

    // Create blobs for all files except for the main index.html file
    files.forEach(file => {
        if (file.path.toLowerCase() !== 'index.html') {
            const blob = new Blob([file.content], { type: getMimeType(file.path) });
            const url = URL.createObjectURL(blob);
            const relativePath = file.path.startsWith('/') ? file.path.substring(1) : file.path;
            fileMap.set(relativePath, url);
            blobUrls.push(url);
        }
    });

    let content = htmlFile.content;

    // Replace all relative paths in `src` and `href` attributes with blob URLs
    content = content.replace(/(src|href)\s*=\s*["'](?!https?:\/\/|data:|blob:)(.*?)["']/g, (match, attr, path) => {
        const cleanPath = path.startsWith('./') ? path.substring(2) : path;
        if (fileMap.has(cleanPath)) {
            return `${attr}="${fileMap.get(cleanPath)}"`;
        }
        console.warn(`Could not find a file to match path in preview: ${path}`);
        return match;
    });
    
    // Create the main blob for the modified index.html
    const mainBlob = new Blob([content], { type: 'text/html' });
    const previewUrl = URL.createObjectURL(mainBlob);
    
    // Add the main page's URL to the list for cleanup
    blobUrls.push(previewUrl);

    return { previewUrl, blobUrls };
};


export const createProjectZip = async (files: ProjectFile[]): Promise<Blob> => {
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library is not loaded.');
    }
  const zip = new JSZip();
  files.forEach(file => {
    zip.file(file.path, file.content);
  });
  return zip.generateAsync({ type: 'blob' });
};