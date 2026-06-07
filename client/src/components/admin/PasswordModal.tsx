import React, { useState } from 'react';
import Modal from '../Modal';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (password: string) => Promise<void>;
  userName: string;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  userName 
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Паролі не співпадають');
      return;
    }
    if (password.length < 6) {
      setError('Пароль має бути не менше 6 символів');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSave(password);
      setPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Помилка зміни пароля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Зміна пароля користувача"
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
            form="password-form"
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400 rounded-xl text-sm font-bold shadow-lg shadow-slate-900/20 transition-all flex items-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Оновити пароль
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
           <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
              <ShieldCheck size={20} />
           </div>
           <div>
              <p className="text-sm font-bold text-slate-900">Зміна доступу для {userName}</p>
              <p className="text-xs text-slate-500 mt-1">Новий пароль набуде чинності негайно. Рекомендуємо використовувати надійну комбінацію символів.</p>
           </div>
        </div>

        <form id="password-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Новий пароль</label>
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Підтвердіть пароль</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl border border-red-100 text-xs font-bold italic">
               <AlertCircle size={14} />
               <span>{error}</span>
            </div>
          )}
        </form>
      </div>
    </Modal>
  );
};

export default PasswordModal;
