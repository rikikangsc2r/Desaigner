import type { Project } from '../types';

const JSON_BLOB_API_BASE = 'https://jsonblob.com/api/jsonBlob';
const JSON_BLOB_ID_KEY = 'ai_web_builder_jsonblob_id';

// A module-level variable to hold the promise. This ensures the async operation is executed only once per session unless invalidated.
let jsonBlobIdPromise: Promise<string> | null = null;

/**
 * Gets the unique JSON Blob ID for the user.
 * If it doesn't exist, it creates a new blob and stores the ID in localStorage.
 */
const getBlobId = (): Promise<string> => {
    if (jsonBlobIdPromise) {
        return jsonBlobIdPromise;
    }

    // Start the async operation and store the promise
    jsonBlobIdPromise = (async () => {
        const storedId = localStorage.getItem(JSON_BLOB_ID_KEY);
        if (storedId) {
            return storedId;
        }

        try {
            const response = await fetch(JSON_BLOB_API_BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify([]), // Initialize with an empty project list
            });

            if (!response.ok) {
                throw new Error(`Failed to create JSON blob: ${response.statusText}`);
            }

            const locationHeader = response.headers.get('Location');
            if (!locationHeader) {
                throw new Error('Location header not found in response');
            }
            
            // The location header is the full URL, e.g., https://jsonblob.com/api/jsonBlob/SOME_ID
            // We extract just the ID to avoid potential issues with the full URL.
            const newId = locationHeader.split('/').pop();
            if (!newId) {
                throw new Error('Could not extract blob ID from Location header');
            }
            
            localStorage.setItem(JSON_BLOB_ID_KEY, newId);
            return newId;
        } catch (error) {
            console.error("Failed to initialize JSON Blob storage", error);
            // If it fails, nullify the promise so the next call can retry.
            jsonBlobIdPromise = null; 
            throw error;
        }
    })();
    
    return jsonBlobIdPromise;
}

/**
 * Invalidates the current JSON blob ID, forcing a new one to be created on the next call.
 */
const invalidateJsonBlobId = () => {
    localStorage.removeItem(JSON_BLOB_ID_KEY);
    jsonBlobIdPromise = null;
};


/**
 * Fetches all projects from the JSON Blob.
 * If the blob ID is invalid (404), it creates a new one and returns an empty list.
 */
export const getProjects = async (): Promise<Project[]> => {
  try {
    const blobId = await getBlobId();
    const url = `${JSON_BLOB_API_BASE}/${blobId}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
        if (response.status === 404 || response.status === 410) { // 410 Gone
            console.warn(`JSON Blob with ID ${blobId} not found. Creating a new one.`);
            invalidateJsonBlobId();
            await getBlobId(); // This will create and save a new ID.
            return []; // The new blob is empty.
        }
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const projects = await response.json();
    // Ensure the response is an array, otherwise return an empty array.
    return Array.isArray(projects) ? projects : [];
  } catch (error) {
    console.error("Failed to get projects from JSON Blob", error);
    // Handle cases where fetch itself fails (e.g., network error, invalid ID in storage)
    // by resetting the blob to recover the application's state.
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn("Fetch failed, possibly due to an invalid blob ID. Resetting...");
      invalidateJsonBlobId();
      await getBlobId();
      return [];
    }
    return []; // Return empty array on other failures
  }
};

/**
 * Fetches a single project by its ID.
 */
export const getProject = async (id: string): Promise<Project | null> => {
  const projects = await getProjects();
  return projects.find(p => p.id === id) || null;
};

/**
 * A private helper to overwrite the entire project list in the JSON Blob.
 * If the blob ID is invalid (404), it creates a new one and retries the update.
 */
const updateAllProjects = async (projects: Project[]): Promise<void> => {
    try {
        let blobId = await getBlobId();
        let url = `${JSON_BLOB_API_BASE}/${blobId}`;
        let response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projects),
        });

        if (!response.ok) {
            if (response.status === 404 || response.status === 410) { // 410 Gone
                console.warn(`JSON Blob with ID ${blobId} not found. Creating a new one and retrying update.`);
                invalidateJsonBlobId();
                const newBlobId = await getBlobId();
                const newUrl = `${JSON_BLOB_API_BASE}/${newBlobId}`;
                
                response = await fetch(newUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(projects),
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to update projects on new blob: ${response.statusText}`);
                }
            } else {
                throw new Error(`Failed to update projects: ${response.statusText}`);
            }
        }
    } catch (error) {
        console.error("Failed to update projects in JSON Blob", error);
        throw error;
    }
};

/**
 * Saves a new project or updates an existing one.
 */
export const saveProject = async (project: Project): Promise<void> => {
  const projects = await getProjects();
  const existingIndex = projects.findIndex(p => p.id === project.id);
  if (existingIndex > -1) {
    projects[existingIndex] = project;
  } else {
    projects.push(project);
  }
  await updateAllProjects(projects);
};

/**
 * Deletes a project by its ID.
 */
export const deleteProject = async (id: string): Promise<void> => {
  let projects = await getProjects();
  projects = projects.filter(p => p.id !== id);
  await updateAllProjects(projects);
};