import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  FilePlus, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Users,
  Calendar
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NewDocument: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [types, setTypes] = useState<{name: string, code: string}[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const { user: currentUser } = useAuth();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: '',
    direction: 'internal',
    counterparty: '',
    dueDate: '',
    approverId: '',
    signatoryId: '',
    confidentiality: 'internal',
    department: ''
  });
  
  const [file, setFile] = useState<File | null>(null);

  const userDepts = currentUser?.departments && currentUser.departments.length > 0
    ? currentUser.departments
    : (currentUser?.department ? [currentUser.department] : []);

  const approvers = allUsers.filter(u => 
    u.role === 'approver' && (u.departments?.includes(formData.department) || u.department === formData.department)
  );
  const signatories = allUsers.filter(u => 
    u.role === 'signatory' && (u.departments?.includes(formData.department) || u.department === formData.department)
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [typeData, userData] = await Promise.all([
          API.get<{name: string, code: string}[]>('/document-types'),
          API.get<any[]>('/users')
        ]);
        setTypes(typeData);
        setAllUsers(userData);
        
        const initialDept = userDepts[0] || '';
        
        setFormData(prev => ({ 
          ...prev, 
          type: typeData[0]?.code || '',
          department: initialDept
        }));
      } catch (e) {
        console.error('Failed to fetch initial data', e);
      }
    };
    fetchData();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value);
      });
      if (file) data.append('files', file);

      await API.upload('/documents', data);
      navigate('/registry');
    } catch (err: any) {
      setError(err.message || 'Помилка реєстрації документа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <FilePlus size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Реєстрація документа</h1>
          <p className="text-slate-500 mt-1 font-medium">Створіть новий документ та запустіть процес погодження</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Назва документа *</label>
                  <input
                    type="text"
                    required
                    placeholder="Напр. Заява на відпустку"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                  />
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Тип документа *</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundPosition: 'right 1rem center',
                      backgroundSize: '1.5em 1.5em',
                      backgroundRepeat: 'no-repeat',
                      paddingRight: '2.5rem'
                    }}
                  >
                    {types.length === 0 ? (
                      <option value="">Завантаження типів...</option>
                    ) : (
                      types.map(t => <option key={t.code} value={t.code}>{t.name}</option>)
                    )}
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Відділ реєстрації *</label>
                  <select
                    required
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value, approverId: '', signatoryId: '' })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundPosition: 'right 1rem center',
                      backgroundSize: '1.5em 1.5em',
                      backgroundRepeat: 'no-repeat',
                      paddingRight: '2.5rem'
                    }}
                  >
                    {userDepts.map((d: string) => <option key={d} value={d}>{d}</option>)}
                  </select>
               </div>
            </div>

            <div>
               <label className="block text-sm font-bold text-slate-700 mb-2">Опис або Примітка</label>
               <textarea
                 rows={4}
                 placeholder="Коротко опишіть суть документа..."
                 value={formData.description}
                 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                 className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
               />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Напрямок</label>
                  <div className="grid grid-cols-3 gap-2">
                     {['incoming', 'outgoing', 'internal'].map(dir => (
                        <button
                          key={dir}
                          type="button"
                          onClick={() => setFormData({ ...formData, direction: dir })}
                          className={cn(
                            "py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all",
                            formData.direction === dir 
                              ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20" 
                              : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                          )}
                        >
                          {dir === 'incoming' ? 'Вхідний' : dir === 'outgoing' ? 'Вихідний' : 'Внутр.'}
                        </button>
                     ))}
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Контрагент / Відправник</label>
                  <input
                    type="text"
                    placeholder="Напр. ТОВ АБВГД"
                    value={formData.counterparty}
                    onChange={(e) => setFormData({ ...formData, counterparty: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
                  />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Гриф конфіденційності *</label>
                  <select
                    required
                    value={formData.confidentiality}
                    onChange={(e) => setFormData({ ...formData, confidentiality: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundPosition: 'right 1rem center',
                      backgroundSize: '1.5em 1.5em',
                      backgroundRepeat: 'no-repeat',
                      paddingRight: '2.5rem'
                    }}
                  >
                    <option value="public">Публічний (Public)</option>
                    <option value="internal">Внутрішній (Internal)</option>
                    <option value="confidential">Конфіденційно (Confidential)</option>
                    <option value="secret">Таємно (Secret)</option>
                  </select>
               </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
               <Upload size={16} />
               Файл документа
             </h3>
             <div className={cn(
               "border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer group",
               file ? "border-green-200 bg-green-50/30" : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
             )}>
                <input 
                  type="file" 
                  id="file-upload" 
                  className="hidden" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                       <CheckCircle2 className="text-green-500" size={40} />
                       <p className="text-sm font-bold text-slate-900">{file.name}</p>
                       <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                       <button 
                         type="button" 
                         onClick={(e) => { e.preventDefault(); setFile(null); }}
                         className="mt-2 text-xs font-bold text-red-500 hover:underline"
                       >
                         Видалити файл
                       </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                       <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:bg-white transition-all">
                          <Upload size={24} />
                       </div>
                       <div>
                          <p className="text-sm font-bold text-slate-900">Натисніть для вибору файлу</p>
                          <p className="text-xs text-slate-400 mt-1">PDF, Word або зображення (Макс. 10MB)</p>
                       </div>
                    </div>
                  )}
                </label>
             </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Users size={16} />
                Процес погодження
              </h3>
              
              <div className="space-y-6">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Погоджуюча особа *</label>
                    <select
                      required
                      value={formData.approverId}
                      onChange={(e) => setFormData({ ...formData, approverId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
                    >
                      <option value="">Оберіть зі списку</option>
                      {approvers.map(u => <option key={u._id} value={u._id}>{u.fullName}</option>)}
                    </select>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Підписант *</label>
                    <select
                      required
                      value={formData.signatoryId}
                      onChange={(e) => setFormData({ ...formData, signatoryId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
                    >
                      <option value="">Оберіть зі списку</option>
                      {signatories.map(u => <option key={u._id} value={u._id}>{u.fullName}</option>)}
                    </select>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                       <Calendar size={12} />
                       Термін виконання
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
                    />
                 </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-4 space-y-3">
                 <button
                   type="submit"
                   disabled={loading}
                   className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                 >
                   {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                   Зареєструвати
                 </button>
                 <button
                   type="button"
                   onClick={() => navigate('/registry')}
                   className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
                 >
                   Скасувати
                 </button>
              </div>
           </div>
        </div>
      </form>
    </div>
  );
};

export default NewDocument;
