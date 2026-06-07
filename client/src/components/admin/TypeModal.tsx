import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { Loader2 } from 'lucide-react';

interface DocumentType {
  _id?: string;
  name: string;
  description: string;
}

interface TypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (type: DocumentType) => Promise<void>;
  typeObj?: DocumentType | null;
}

const TypeModal: React.FC<TypeModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  typeObj 
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeObj) {
      setName(typeObj.name);
      setDescription(typeObj.description || '');
    } else {
      setName('');
      setDescription('');
    }
    setError(null);
  }, [typeObj, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSave({ name, description });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Помилка збереження');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={typeObj ? 'Редагувати тип документа' : 'Додати новий тип'}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl text-sm font-bold transition-all"
          >
            Скасувати
          </button>
          <button
            form="type-form"
            type="submit"
            disabled={loading || !name}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Зберегти
          </button>
        </>
      }
    >
      <form id="type-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Назва типу *</label>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Напр. Наказ, Договір..."
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Опис</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Короткий опис або правила використання..."
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
          />
        </div>
        {error && (
          <p className="text-sm font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100 italic">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
};

export default TypeModal;
