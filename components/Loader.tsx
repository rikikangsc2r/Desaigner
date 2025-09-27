
import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="flex justify-center items-center p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slate-300"></div>
    </div>
  );
};

export const TypingIndicator: React.FC = () => {
    return (
        <div className="flex items-center space-x-1 p-2 bg-slate-700 rounded-lg self-start">
            <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></span>
        </div>
    );
};


export default Loader;
