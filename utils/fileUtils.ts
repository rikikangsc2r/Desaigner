
import type { ProjectFile } from '../types';

declare const JSZip: any;

export const createPreviewContent = (files: ProjectFile[]): string => {
  const htmlFile = files.find(f => f.path.endsWith('.html'));
  if (!htmlFile) return '<html><body><h1>No HTML file found.</h1></body></html>';

  let content = htmlFile.content;

  // Inject CSS
  const cssFiles = files.filter(f => f.path.endsWith('.css'));
  cssFiles.forEach(cssFile => {
    const cssLink = `<link rel="stylesheet" href="${cssFile.path}">`;
    const cssTag = `<style>\n${cssFile.content}\n</style>`;
    content = content.replace(cssLink, cssTag);
  });

  // Inject JS
  const jsFiles = files.filter(f => f.path.endsWith('.js'));
  jsFiles.forEach(jsFile => {
    const jsScript = `<script src="${jsFile.path}"></script>`;
    const jsTag = `<script>\n${jsFile.content}\n</script>`;
    // Handle both defer and normal script tags
    const jsScriptDefer = `<script src="${jsFile.path}" defer></script>`;
    content = content.replace(jsScript, jsTag).replace(jsScriptDefer, jsTag);
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
