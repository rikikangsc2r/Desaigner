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
        case 'portfolio':
            return getPortfolioTemplate(projectName, styleLibrary);
        case 'blog':
            return getBlogTemplate(projectName, styleLibrary);
        case 'landing-page':
            return getLandingPageTemplate(projectName, styleLibrary);
        case 'blank':
        default:
            return getBlankTemplate(projectName, styleLibrary);
    }
};

const getBlankTemplate = (projectName: string, styleLibrary: StyleLibrary): ProjectFile[] => [
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

const getPortfolioTemplate = (projectName: string, styleLibrary: StyleLibrary): ProjectFile[] => [
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
    <header>
        <nav>
            <h1>My Portfolio</h1>
            <ul>
                <li><a href="#about">About</a></li>
                <li><a href="#projects">Projects</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    </header>

    <main>
        <section id="hero">
            <h2>Welcome! I'm a Web Developer.</h2>
            <p>I build beautiful and responsive websites.</p>
        </section>

        <section id="about">
            <h3>About Me</h3>
            <p>A brief bio about your skills and passions goes here.</p>
        </section>

        <section id="projects">
            <h3>My Projects</h3>
            <div class="project-grid">
                <div class="project-card">Project 1</div>
                <div class="project-card">Project 2</div>
                <div class="project-card">Project 3</div>
            </div>
        </section>

        <section id="contact">
            <h3>Contact Me</h3>
            <p>Email: your.email@example.com</p>
        </section>
    </main>

    <footer>
        <p>&copy; ${new Date().getFullYear()} ${projectName}</p>
    </footer>

${styleLibrary === 'bootstrap' ? getBootstrapScript() : ''}
    <script src="script.js"></script>
</body>
</html>`
    },
    {
        path: 'style.css',
        content: `body { font-family: sans-serif; margin: 0; background: #f0f0f0; color: #333; }
header { background: #333; color: white; padding: 1rem; }
nav { display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto; }
nav ul { list-style: none; display: flex; gap: 1rem; }
nav a { color: white; text-decoration: none; }
main { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
section { margin-bottom: 2rem; padding: 2rem; background: white; border-radius: 8px; }
.project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
.project-card { background: #e0e0e0; padding: 1rem; border-radius: 4px; text-align: center; }
footer { text-align: center; padding: 1rem; background: #333; color: white; }`
    },
    {
        path: 'script.js',
        content: `console.log("Portfolio project initialized: ${projectName}");`
    }
];

const getBlogTemplate = (projectName: string, styleLibrary: StyleLibrary): ProjectFile[] => [
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
    <header>
        <h1>My Awesome Blog</h1>
    </header>

    <div class="container">
        <main>
            <article class="post-preview">
                <h2>First Blog Post</h2>
                <p class="post-meta">Published on ${new Date().toLocaleDateString()}</p>
                <p>This is an excerpt of the first blog post...</p>
                <a href="#">Read More</a>
            </article>
            <article class="post-preview">
                <h2>Second Blog Post</h2>
                <p class="post-meta">Published on ${new Date().toLocaleDateString()}</p>
                <p>This is an excerpt of the second blog post...</p>
                <a href="#">Read More</a>
            </article>
        </main>
        <aside>
            <h3>About</h3>
            <p>A little section about the author or the blog's purpose.</p>
        </aside>
    </div>

    <footer>
        <p>&copy; ${new Date().getFullYear()} ${projectName}</p>
    </footer>

${styleLibrary === 'bootstrap' ? getBootstrapScript() : ''}
    <script src="script.js"></script>
</body>
</html>`
    },
    {
        path: 'style.css',
        content: `body { font-family: serif; margin: 0; background: #f9f9f9; color: #444; }
header { text-align: center; padding: 2rem; background: #fff; border-bottom: 1px solid #eee; }
.container { display: flex; max-width: 1000px; margin: 2rem auto; gap: 2rem; }
main { flex: 3; }
aside { flex: 1; }
.post-preview { background: #fff; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #eee; }
.post-meta { font-size: 0.9rem; color: #888; }
footer { text-align: center; padding: 2rem; margin-top: 2rem; background: #fff; border-top: 1px solid #eee; }`
    },
    {
        path: 'script.js',
        content: `console.log("Blog project initialized: ${projectName}");`
    }
];

const getLandingPageTemplate = (projectName: string, styleLibrary: StyleLibrary): ProjectFile[] => [
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
    <header>
        <nav>
            <span class="logo">ProductBrand</span>
        </nav>
    </header>

    <main>
        <section id="hero">
            <h1>The Best Product You'll Ever Find</h1>
            <p>Discover how our product can change your life. It's amazing, innovative, and available now.</p>
            <button class="cta-button">Buy Now!</button>
        </section>

        <section id="features">
            <h3>Key Features</h3>
            <div class="features-grid">
                <div class="feature-item">Feature One</div>
                <div class="feature-item">Feature Two</div>
                <div class="feature-item">Feature Three</div>
            </div>
        </section>
    </main>

    <footer>
        <p>&copy; ${new Date().getFullYear()} ProductBrand</p>
    </footer>

${styleLibrary === 'bootstrap' ? getBootstrapScript() : ''}
    <script src="script.js"></script>
</body>
</html>`
    },
    {
        path: 'style.css',
        content: `body { font-family: sans-serif; margin: 0; }
nav { padding: 1rem; background: #fff; border-bottom: 1px solid #ddd; }
.logo { font-weight: bold; font-size: 1.5rem; }
#hero { text-align: center; padding: 4rem 1rem; background: #f0f8ff; }
.cta-button { background: #007bff; color: white; border: none; padding: 0.8rem 1.6rem; font-size: 1rem; border-radius: 5px; cursor: pointer; }
#features { padding: 2rem 1rem; max-width: 1000px; margin: 0 auto; }
.features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center; margin-top: 1rem; }
.feature-item { background: #f4f4f4; padding: 1rem; }
footer { text-align: center; padding: 1rem; background: #333; color: white; }`
    },
    {
        path: 'script.js',
        content: `console.log("Landing page project initialized: ${projectName}");`
    }
];