import type { Project } from '../types';

const DB_NAME = 'AIWebBuilderDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            console.error('Database error:', (event.target as IDBOpenDBRequest).error);
            dbPromise = null; // Allow retry on next call
            reject('Error opening database');
        };
    });

    return dbPromise;
};

/**
 * Fetches all projects from IndexedDB.
 */
export const getProjects = async (): Promise<Project[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('Error fetching projects:', request.error);
            reject('Error fetching projects');
        };
    });
};

/**
 * Fetches a single project by its ID from IndexedDB.
 */
export const getProject = async (id: string): Promise<Project | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            console.error('Error fetching project:', request.error);
            reject('Error fetching project');
        };
    });
};

/**
 * Saves a new project or updates an existing one in IndexedDB.
 */
export const saveProject = async (project: Project): Promise<void> => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(project);

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            console.error('Error saving project:', transaction.error);
            reject('Error saving project');
        };
    });
};

/**
 * Deletes a project by its ID from IndexedDB.
 */
export const deleteProject = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(id);

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            console.error('Error deleting project:', transaction.error);
            reject('Error deleting project');
        };
    });
};
