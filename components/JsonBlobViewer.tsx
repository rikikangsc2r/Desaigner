import React, { useState, useEffect } from 'react';

interface JsonBlobViewerProps {
    blobId: string;
}

const JsonBlobViewer: React.FC<JsonBlobViewerProps> = ({ blobId }) => {
    const [htmlContent, setHtmlContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Could not fetch content from JSONBlob: ${res.statusText}`);
                }
                return res.json();
            })
            .then(data => {
                if (data && data.html && typeof data.html === 'string') {
                    setHtmlContent(data.html);
                } else {
                    setError('Invalid content format found at the URL.');
                }
            })
            .catch(err => {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
                setError(`Failed to load content: ${errorMessage}`);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [blobId]);
    
    if (isLoading) {
        return (
            <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-950">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
                <p className="mt-4 text-slate-300 text-lg">Loading Content...</p>
            </div>
        );
    }
    
    if (error || !htmlContent) {
         return (
            <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-950 p-4">
                <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
                <p className="text-red-300 text-center">{error || 'Content could not be loaded.'}</p>
            </div>
        );
    }

    return (
        <iframe
            srcDoc={htmlContent}
            title={`Public preview ${blobId}`}
            className="w-full h-screen border-none bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms"
        />
    );
};
export default JsonBlobViewer;
