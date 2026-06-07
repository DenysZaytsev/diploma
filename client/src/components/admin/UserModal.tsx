import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { Loader2, Shield } from 'lucide-react';

export interface User {
  _id?: string;
  fullName: string;
  email: string;
  role: string;
  department?: string;
  password?: string;
  isSuperAdmin?: boolean;
  isBlocked?: boolean;
}

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Partial<User>) => Promise<void>;
  user?: User | null;
  departments: string[];
  currentUser: User | null;
}

const UserModal: React.FC<UserModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  user,
  departments,
  currentUser
}) => {
  const [formData, setFormData] = useState<Partial<User>>({
    fullName: '',
    email: '',
    role: 'employee',
    department: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department || ''
      });
    } else {
      setFormData({
        fullName: '',
        email: '',
        role: 'employee',
        department: '',
        password: ''
      });
    }
    setError(null);
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Помилка збереження');
    } finally {
      setLoading(false);
    }
  };

  const isSelf = user?.email === currentUser?.email;
  const amISuperAdmin = currentUser?.isSuperAdmin;
  const isEditingSuperAdmin = user?.isSuperAdmin;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? 'Редагувати користувача' : 'Додати користувача'}
      size="lg"
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
            form="user-form"
            type="submit"
            disabled={loading || !formData.fullName || !formData.email}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Зберегти
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Повне ім'я *</label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Email (Логін) *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
            />
          </div>
        </div>

        {!user && (
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Пароль *</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Роль у системі *</label>
            {isEditingSuperAdmin ? (
               <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-sm font-bold">
                  <Shield size={16} />
                  Головний Адміністратор
               </div>
            ) : (
              <select
                required
                disabled={isSelf && !amISuperAdmin}
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium disabled:opacity-50"
              >
                <option value="employee">Працівник (Ініціатор)</option>
                <option value="approver">Керівник відділу</option>
                <option value="signatory">Підписант (Signatory)</option>
                {amISuperAdmin && <option value="admin">Адміністратор</option>}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Відділ</label>
            <select
              value={formData.department}
              disabled={isSelf && !amISuperAdmin}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium disabled:opacity-50"
            >
              <option value="">Не вказано</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
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

export default UserModal;
