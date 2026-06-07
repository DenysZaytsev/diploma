import React, { useEffect, useState } from 'react';
import { API } from '../../api/client';
import { 
  Settings as SettingsIcon, 
  Mail, 
  ShieldCheck, 
  Save, 
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SystemSettings {
  maxUploadFiles: number;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    maxUploadFiles: 10
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await API.get<SystemSettings>('/settings');
        setSettings(data);
      } catch (e) {
        console.error('Failed to fetch settings', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await API.patch('/settings', settings);
      setMessage({ type: 'success', text: 'Налаштування успішно збережено' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Помилка збереження' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    try {
      const res = await API.post<{ message: string }>('/settings/test-email', settings);
      alert(res.message);
    } catch (err: any) {
      alert(err.message || 'Помилка перевірки SMTP');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <Loader2 className="animate-spin text-blue-600" size={32} />
      <p className="text-slate-400 font-medium">Завантаження системних параметрів...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
          <SettingsIcon size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Налаштування системи</h1>
          <p className="text-slate-500 mt-1 font-medium">Конфігурація глобальних параметрів Mini-EDMS</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Core Settings */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
           <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
             <Database size={16} />
             Системні обмеження
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                 <label className="block text-sm font-bold text-slate-700 mb-2">Макс. кількість файлів (завантаження)</label>
                 <input 
                   type="number"
                   value={settings.maxUploadFiles}
                   onChange={(e) => setSettings({ ...settings, maxUploadFiles: parseInt(e.target.value) })}
                   className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium" 
                 />
                 <p className="text-xs text-slate-400 mt-2">Максимальна кількість вкладень для одного документа.</p>
              </div>
           </div>
        </div>

        {/* SMTP Settings */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
           <div className="flex items-center justify-between gap-4 mb-2">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Mail size={16} />
                SMTP Конфігурація (Email)
              </h3>
              <button 
                type="button"
                onClick={handleTestEmail}
                disabled={testing}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Тест з'єднання
              </button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                 <label className="block text-sm font-bold text-slate-700 mb-1">SMTP Host</label>
                 <input 
                   type="text"
                   value={settings.smtpHost || ''}
                   onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                   placeholder="smtp.example.com"
                   className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium" 
                 />
              </div>
              <div>
                 <label className="block text-sm font-bold text-slate-700 mb-1">SMTP Port</label>
                 <input 
                   type="text"
                   value={settings.smtpPort || ''}
                   onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                   placeholder="465 або 587"
                   className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium" 
                 />
              </div>
              <div>
                 <label className="block text-sm font-bold text-slate-700 mb-1">Користувач (Username)</label>
                 <input 
                   type="text"
                   value={settings.smtpUser || ''}
                   onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                   className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium" 
                 />
              </div>
              <div>
                 <label className="block text-sm font-bold text-slate-700 mb-1">Пароль (SMTP Token)</label>
                 <input 
                   type="password"
                   value={settings.smtpPass || ''}
                   onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                   className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium" 
                 />
              </div>
              <div>
                 <label className="block text-sm font-bold text-slate-700 mb-1">Від (Display Name / From Email)</label>
                 <input 
                   type="text"
                   value={settings.smtpFrom || ''}
                   onChange={(e) => setSettings({ ...settings, smtpFrom: e.target.value })}
                   placeholder='Mini-EDMS <no-reply@company.com>'
                   className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium" 
                 />
                 <p className="text-[10px] text-slate-400 mt-1 italic">Приклад: "Система &lt;edms@work.ua&gt;" або просто "edms@work.ua"</p>
              </div>
           </div>
        </div>

        {/* Global Protection */}
        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex items-start gap-4">
           <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm border border-amber-100">
              <ShieldCheck size={20} />
           </div>
           <div>
              <p className="text-sm font-bold text-amber-900 uppercase tracking-tight">Рівень доступу: Root Admin</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">Зміна цих параметрів впливає на всіх користувачів системи Mini-EDMS. Будь ласка, будьте обережні при редагуванні SMTP налаштувань.</p>
           </div>
        </div>

        {message && (
          <div className={cn(
            "p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2",
            message.type === 'success' ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
          )}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="text-sm font-bold">{message.text}</span>
          </div>
        )}

        <div className="flex justify-end">
           <button 
             type="submit"
             disabled={saving}
             className="flex items-center gap-2 px-8 py-3 bg-blue-600 rounded-2xl text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all scale-100 active:scale-95 disabled:bg-blue-400"
           >
             {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
             Зберегти налаштування
           </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
