import type { ProjectFile } from '../types';

declare const JSZip: any;

/**
 * Creates a single HTML string for previewing in an iframe's srcdoc.
 * It inlines all local CSS and JS files directly into the HTML.
 * @param files The project files.
 * @returns A single HTML string ready for preview.
 */
export const createPreviewHtml = (files: ProjectFile[]): string => {
    const htmlFile = files.find(f => f.path.toLowerCase() === 'index.html');
    if (!htmlFile) {
        return '<html><body><h1>No index.html file found.</h1></body></html>';
    }

    let content = htmlFile.content;
    const fileMap = new Map(files.map(f => [f.path.replace(/^\.\//, ''), f]));

    // Inline stylesheets
    content = content.replace(/<link[^>]+?href="([^"]+)"[^>]*>/g, (match, path) => {
        // Only replace local, non-http, stylesheet links
        if (path.startsWith('http') || path.startsWith('//') || !match.includes('rel="stylesheet"')) {
            return match;
        }
        const cleanPath = path.replace(/^\.\//, '');
        const cssFile = fileMap.get(cleanPath);
        if (cssFile) {
            return `<style>\n${cssFile.content}\n</style>`;
        }
        console.warn(`Could not find CSS file to inline: ${path}`);
        return match;
    });

    // Inline scripts
    content = content.replace(/<script[^>]+?src="([^"]+)"[^>]*>\s*<\/script>/g, (match, path) => {
        // Only replace local, non-http scripts
        if (path.startsWith('http') || path.startsWith('//')) {
            return match;
        }
        const cleanPath = path.replace(/^\.\//, '');
        const jsFile = fileMap.get(cleanPath);
        if (jsFile) {
            // Reconstruct the script tag without src, preserving other attributes
            const tagWithAttrs = match.substring(0, match.indexOf('>') + 1).replace(/src="[^"]+"/, '');
            return `${tagWithAttrs}\n${jsFile.content}\n</script>`;
        }
        console.warn(`Could not find JS file to inline: ${path}`);
        return match;
    });
    
    return content;
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