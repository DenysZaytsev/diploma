import React from 'react';
import Modal from './Modal';
import { AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Підтвердження дії',
  message,
  confirmText = 'ОК',
  cancelText = 'Відмінити',
  type = 'danger'
}) => {
  const getColors = () => {
    switch (type) {
      case 'danger': return 'bg-red-600 hover:bg-red-700 focus:ring-red-500/20';
      case 'warning': return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/20';
      case 'info': return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/20';
      default: return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/20';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertCircle className="text-red-500 w-6 h-6" />;
      case 'warning': return <AlertCircle className="text-amber-500 w-6 h-6" />;
      case 'info': return <AlertCircle className="text-blue-500 w-6 h-6" />;
      default: return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-bold transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-white rounded-xl text-sm font-bold shadow-lg transition-all focus:outline-none focus:ring-4 ${getColors()}`}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-4 py-2">
        <div className="shrink-0 p-2 bg-slate-50 rounded-full">
          {getIcon()}
        </div>
        <p className="text-sm font-medium text-slate-700 leading-relaxed pt-2">
          {message}
        </p>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
