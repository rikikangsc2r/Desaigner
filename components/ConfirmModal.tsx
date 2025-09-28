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
      className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center backdrop-blur-sm transition-opacity duration-300"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md m-4 ring-1 ring-slate-700 transition-transform transform scale-95 duration-300"
        style={{ transform: 'scale(1)' }} // Trigger transition on mount
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-slate-100 mb-4">{title}</h2>
        <div className="text-slate-300 mb-8">
          {children}
        </div>
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;