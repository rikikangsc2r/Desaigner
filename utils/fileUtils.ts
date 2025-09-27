
import type { ProjectFile } from '../types';

declare const JSZip: any;

export const createPreviewContent = (files: ProjectFile[]): string => {
  const htmlFile = files.find(f => f.path.endsWith('.html'));
  if (!htmlFile) return '<html><body><h1>No HTML file found.</h1></body></html>';

  let content = htmlFile.content;

  // Inject CSS using a robust regex
  const cssFiles = files.filter(f => f.path.endsWith('.css'));
  cssFiles.forEach(cssFile => {
    const cssLinkRegex = new RegExp(`<link[^>]*href=["']${cssFile.path}["'][^>]*>`, "i");
    const cssTag = `<style>\n${cssFile.content}\n</style>`;
    content = content.replace(cssLinkRegex, cssTag);
  });

  // Inject JS/JSX using a robust regex
  const jsFiles = files.filter(f => f.path.endsWith('.js') || f.path.endsWith('.jsx'));
  jsFiles.forEach(jsFile => {
    const scriptRegex = new RegExp(`<script[^>]*src=["']${jsFile.path}["'][^>]*>\\s*<\\/script>`, "i");
    const scriptType = jsFile.path.endsWith('.jsx') ? 'text/babel' : 'text/javascript';
    const jsTag = `<script type="${scriptType}">\n${jsFile.content}\n<\/script>`;
    content = content.replace(scriptRegex, jsTag);
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
