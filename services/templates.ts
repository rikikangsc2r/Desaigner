import type { ProjectFile, StyleLibrary, TemplateType } from '../types';

const getStyleCDN = (styleLibrary: StyleLibrary): string => {
    switch (styleLibrary) {
        case 'bootstrap':
            return `    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">`;
        case 'tailwindcss':
            return `    <script src="https://cdn.tailwindcss.com"></script>`;
        default:
            return '';
    }
}

const getBootstrapScript = (): string => {
    return `    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>`
}

export const getTemplateFiles = (template: TemplateType, projectName: string, styleLibrary: StyleLibrary): ProjectFile[] => {
    switch (template) {
        case 'html':
            return getHtmlTemplate(projectName, styleLibrary);
        case 'vanilla':
            return getVanillaTemplate(projectName, styleLibrary);
        default:
            return [];
    }
};

const getHtmlTemplate = (projectName: string, styleLibrary: StyleLibrary): ProjectFile[] => [
    {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
${getStyleCDN(styleLibrary)}
</head>
<body class="${styleLibrary === 'bootstrap' ? 'p-5' : ''}">
    <h1 class="${styleLibrary === 'tailwindcss' ? 'text-3xl font-bold' : ''}">Hello, World!</h1>
    <p>Welcome to your new project: ${projectName}</p>
${styleLibrary === 'bootstrap' ? getBootstrapScript() : ''}
</body>
</html>`
    }
];

const getVanillaTemplate = (projectName: string, styleLibrary: StyleLibrary): ProjectFile[] => [
    {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
${getStyleCDN(styleLibrary)}
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Hello, World!</h1>
    <p>Welcome to your new project: ${projectName}</p>
${styleLibrary === 'bootstrap' ? getBootstrapScript() : ''}
    <script src="script.js"></script>
</body>
</html>`
    },
    {
        path: 'style.css',
        content: `body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: #f4f4f9;
    color: #333;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
    text-align: center;
}`
    },
    {
        path: 'script.js',
        content: `console.log("Welcome to ${projectName}!");

// You can start writing your JavaScript here.`
    }
];
