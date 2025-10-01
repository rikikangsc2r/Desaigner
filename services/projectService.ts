import type { Project, ProjectFile } from '../types';

declare const puter: any;

const BASE_PATH = '~/AppData/Autonomous AI Web Builder';

// Ensure the base directory exists
const ensureBaseDir = async () => {
    try {
        await puter.fs.stat(BASE_PATH);
    } catch (e) {
        // If it doesn't exist, create it
        await puter.fs.mkdir(BASE_PATH, { createMissingParents: true });
    }
};

const getProjectPath = (id: string) => `${BASE_PATH}/${id}`;
const getProjectMetaPath = (id: string) => `${getProjectPath(id)}/project.json`;
const getProjectFilesPath = (id: string) => `${getProjectPath(id)}/src`;

/**
 * Fetches all projects from Puter FS.
 */
export const getProjects = async (): Promise<Project[]> => {
    await ensureBaseDir();
    const projectDirs = await puter.fs.readdir(BASE_PATH);
    const projects: Project[] = [];

    for (const dir of projectDirs) {
        if (dir.is_dir) {
            try {
                const metaPath = getProjectMetaPath(dir.name);
                const metaBlob = await puter.fs.read(metaPath);
                const metaContent = await metaBlob.text();
                const projectMeta = JSON.parse(metaContent);
                projects.push(projectMeta);
            } catch (e) {
                console.error(`Could not read project metadata for ${dir.name}:`, e);
            }
        }
    }
    return projects;
};

/**
 * Fetches a single project by its ID from Puter FS.
 */
export const getProject = async (id: string): Promise<Project | null> => {
    await ensureBaseDir();
    try {
        const metaPath = getProjectMetaPath(id);
        const metaBlob = await puter.fs.read(metaPath);
        const project = JSON.parse(await metaBlob.text());

        const filesPath = getProjectFilesPath(id);
        const projectFiles: ProjectFile[] = [];

        const readDirRecursive = async (currentPath: string) => {
            try {
                const items = await puter.fs.readdir(currentPath);
                for (const item of items) {
                    if (item.is_dir) {
                        await readDirRecursive(item.path);
                    } else {
                        const fileBlob = await puter.fs.read(item.path);
                        const content = await fileBlob.text();
                        const relativePath = item.path.substring(filesPath.length + 1);
                        projectFiles.push({ path: relativePath, content });
                    }
                }
            } catch(e) {
                if (e.code === 'subject_does_not_exist') {
                     console.log(`Directory not found, skipping: ${currentPath}`);
                } else {
                    throw e;
                }
            }
        }
        
        await readDirRecursive(filesPath);
        project.files = projectFiles;
        return project;

    } catch (e) {
        console.error(`Error fetching project ${id}:`, e);
        return null;
    }
};

/**
 * Saves a new project or updates an existing one in Puter FS.
 */
export const saveProject = async (project: Project): Promise<void> => {
    await ensureBaseDir();
    const filesPath = getProjectFilesPath(project.id);

    // Separate files from the rest of the project metadata to store in project.json
    const { files, ...meta } = project;
    
    // Write metadata
    const metaPath = getProjectMetaPath(project.id);
    await puter.fs.write(metaPath, JSON.stringify(meta, null, 2), { createMissingParents: true });
    
    // Clean the src directory before writing new files to ensure perfect sync
    try {
        await puter.fs.delete(filesPath, { recursive: true });
    } catch(e) {
        // It's okay if it doesn't exist. We check for the specific code.
        if (e.code !== 'subject_does_not_exist') {
            console.error('An unexpected error occurred while cleaning the project directory. The operation will proceed, but there might be leftover files.', e);
        }
    }
    await puter.fs.mkdir(filesPath, { createMissingParents: true });

    // Write all project files
    for (const file of files) {
        const filePath = `${filesPath}/${file.path}`;
        await puter.fs.write(filePath, file.content, { createMissingParents: true });
    }
};

/**
 * Deletes a project by its ID from Puter FS.
 */
export const deleteProject = async (id: string): Promise<void> => {
    await ensureBaseDir();
    const projectPath = getProjectPath(id);
    try {
        await puter.fs.delete(projectPath, { recursive: true });
    } catch (e) {
        console.error(`Failed to delete project ${id}:`, e);
        throw new Error(`Failed to delete project: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
};