import type { ProjectFile } from '../types';

export type TemplateType = 'vanilla' | 'react';

export const getTemplateFiles = (template: TemplateType, projectName: string): ProjectFile[] => {
    switch (template) {
        case 'vanilla':
            return getVanillaTemplate(projectName);
        case 'react':
            return getReactTemplate(projectName);
        default:
            return [];
    }
};

const getVanillaTemplate = (projectName: string): ProjectFile[] => [
    {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Hello, World!</h1>
    <p>Welcome to your new project: ${projectName}</p>

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

const getReactTemplate = (projectName: string): ProjectFile[] => [
    {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - React</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="root"></div>
    
    <!-- Load React. -->
    <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    
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
            <p>Welcome to your new project: ${projectName}</p>
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
