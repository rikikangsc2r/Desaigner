import React, { useState, useCallback } from 'react';
import { XIcon } from './Icons';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, title, url }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [url]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center backdrop-blur-sm transition-opacity duration-300"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-lg m-4 ring-1 ring-slate-700 transition-transform transform scale-95 duration-300"
        style={{ transform: 'scale(1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-100">{title}</h2>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-700">
                <XIcon className="w-5 h-5" />
            </button>
        </div>
        <div className="text-slate-300 mb-6">
          <p>Your website is now live! Share this URL with anyone to show off your creation.</p>
        </div>

        <div className="flex items-center bg-slate-900 border border-slate-600 rounded-lg p-2 gap-2">
            <input 
                type="text" 
                readOnly 
                value={url} 
                className="bg-transparent text-slate-200 border-none focus:ring-0 w-full text-sm"
                onFocus={(e) => e.target.select()}
            />
            <button 
                onClick={handleCopy} 
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors w-24 flex-shrink-0 ${copied ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
        </div>
        
        <div className="flex justify-end gap-4 mt-8">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
