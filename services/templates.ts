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
        case 'react-jsx':
            return getReactJsxTemplate(projectName, styleLibrary);
        case 'react-tsx':
            return getReactTsxTemplate(projectName, styleLibrary);
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

const getReactJsxTemplate = (projectName: string, styleLibrary: StyleLibrary): ProjectFile[] => [
    {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - React</title>
${getStyleCDN(styleLibrary)}
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="root"></div>
    
    <!-- Load React. -->
    <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    
${styleLibrary === 'bootstrap' ? getBootstrapScript() : ''}
    <!-- Load our React component. -->
    <script type="text/babel" src="app.jsx"></script>
</body>
</html>`
    },
    {
        path: 'app.jsx',
        content: `'use strict';

const App = () => {
    const [count, setCount] = React.useState(0);

    return (
        <div>
            <h1>Hello from React!</h1>
            <p>Welcome to your new project: {projectName}</p>
            <p>You clicked {count} times</p>
            <button onClick={() => setCount(count + 1)}>
                Click me
            </button>
        </div>
    );
}

const domContainer = document.querySelector('#root');
const root = ReactDOM.createRoot(domContainer);
root.render(<App />);`
    },
    {
        path: 'style.css',
        content: `body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: #282c34;
    color: white;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
    text-align: center;
}

button {
    font-size: 1rem;
    padding: 0.5em 1em;
    margin-top: 1em;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    background-color: #61dafb;
}`
    }
];

const getReactTsxTemplate = (projectName: string, styleLibrary: StyleLibrary): ProjectFile[] => [
    {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - React/TSX</title>
${getStyleCDN(styleLibrary)}
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="root"></div>

    <!-- React and Babel for in-browser transpilation -->
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    
${styleLibrary === 'bootstrap' ? getBootstrapScript() : ''}
    <!-- Main app script -->
    <script type="text/babel" data-type="module" src="app.tsx"></script>
</body>
</html>`
    },
    {
        path: 'app.tsx',
        content: `import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

const App: React.FC = () => {
    const [count, setCount] = useState<number>(0);

    return (
        <div>
            <h1>Hello from React with TypeScript!</h1>
            <p>Welcome to your new project: ${projectName}</p>
            <p>You clicked {count} times</p>
            <button onClick={() => setCount(count + 1)}>
                Click me
            </button>
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(<App />);
}
`
    },
    {
        path: 'style.css',
        content: `body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: #282c34;
    color: white;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
    text-align: center;
}

button {
    font-size: 1rem;
    padding: 0.5em 1em;
    margin-top: 1em;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    background-color: #007acc;
    color: white;
}`
    }
];
