import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { Loader2, Shield } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface User {
  _id?: string;
  fullName: string;
  email: string;
  role: string;
  department?: string;
  departments?: string[];
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
    departments: [],
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
        department: user.department || '',
        departments: (user.departments && user.departments.length > 0) ? user.departments : (user.department ? [user.department] : [])
      });
    } else {
      setFormData({
        fullName: '',
        email: '',
        role: 'employee',
        department: '',
        departments: [],
        password: ''
      });
    }
    setError(null);
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.departments || formData.departments.length === 0) {
      setError('Оберіть хоча б один відділ для користувача');
      return;
    }
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
          
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-2">Відділи (можна обрати декілька)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
              {departments.map(d => {
                const isChecked = formData.departments?.includes(d) || false;
                return (
                  <label 
                    key={d} 
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all",
                      isChecked 
                        ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm" 
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isSelf && !amISuperAdmin}
                      onChange={(e) => {
                        const nextDepts = e.target.checked
                          ? [...(formData.departments || []), d]
                          : (formData.departments || []).filter(item => item !== d);
                        setFormData({ 
                          ...formData, 
                          departments: nextDepts,
                          department: nextDepts[0] || '' 
                        });
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>{d}</span>
                  </label>
                );
              })}
            </div>
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
