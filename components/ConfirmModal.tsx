import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, children, confirmText = 'Confirm' }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4 ring-1 ring-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-slate-100 mb-4">{title}</h2>
        <div className="text-slate-300 mb-6">
          {children}
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-md transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
