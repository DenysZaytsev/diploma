import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../api/client';
import { User, Building2, Mail, Bell, Upload, Loader2 } from 'lucide-react';
import { translateRole } from '../utils/translations';

const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [notifications, setNotifications] = useState({
    onNewTask: user?.notifications?.onNewTask !== false,
    onStatusChange: user?.notifications?.onStatusChange !== false,
    onOverdue: user?.notifications?.onOverdue !== false,
    onComment: user?.notifications?.onComment !== false,
    onDelegation: user?.notifications?.onDelegation !== false,
  });

  if (!user) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('notifications', JSON.stringify(notifications));

    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const updatedUser = await API.upload<any>('/auth/profile', formData, 'PATCH');
      
      // Update context user data
      updateUser(updatedUser);
      setSuccessMsg('Аватар успішно оновлено!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Помилка завантаження аватара');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const updatedUser = await API.patch<any>('/auth/profile', {
        notifications: JSON.stringify(notifications)
      });
      updateUser(updatedUser);
      setSuccessMsg('Налаштування сповіщень збережено!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Помилка збереження налаштувань');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Профіль користувача</h1>
        <p className="text-slate-500 mt-1">Керування персональною інформацією та сповіщеннями</p>
      </div>

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl flex items-center gap-3 text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3 text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card / Avatar Upload */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
          <div className="relative group w-32 h-32 mb-6">
            <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-100 bg-slate-50 flex items-center justify-center">
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.fullName} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback if image fails to load
                    (e.target as HTMLImageElement).src = '';
                  }}
                />
              ) : (
                <User size={48} className="text-slate-400" />
              )}
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <div className="flex flex-col items-center gap-1">
                <Upload size={20} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Оновити</span>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploading} />
            </label>
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-full">
                <Loader2 className="animate-spin text-blue-600" size={28} />
              </div>
            )}
          </div>

          <h2 className="text-lg font-bold text-slate-900">{user.fullName}</h2>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">{translateRole(user.role)}</p>
          
          <div className="w-full border-t border-slate-100 my-6"></div>

          <div className="w-full space-y-4 text-left">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Mail size={16} className="text-slate-400" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Building2 size={16} className="text-slate-400" />
              <span>{user.department || 'Без відділу'}</span>
            </div>
          </div>
        </div>

        {/* Settings & Notifications */}
        <div className="md:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bell size={20} className="text-blue-600" />
              Налаштування сповіщень
            </h3>
            <p className="text-slate-500 text-sm mt-1">Оберіть канали та типи сповіщень, які ви бажаєте отримувати</p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="space-y-4">
              {[
                { 
                  id: 'onNewTask', 
                  title: 'Нові документи на виконання', 
                  desc: 'Отримувати сповіщення, коли документ надходить вам на погодження чи підпис.',
                  checked: notifications.onNewTask
                },
                { 
                  id: 'onStatusChange', 
                  title: 'Зміна статусів моїх документів', 
                  desc: 'Отримувати сповіщення, коли створені вами документи погоджено, підписано або відхилено.',
                  checked: notifications.onStatusChange
                },
                { 
                  id: 'onOverdue', 
                  title: 'Прострочені дедлайни', 
                  desc: 'Отримувати попередження, коли термін виконання документа добігає кінця.',
                  checked: notifications.onOverdue
                },
                {
                  id: 'onComment',
                  title: 'Нові коментарі до документів',
                  desc: 'Отримувати сповіщення, коли інші користувачі залишають коментарі у доступних вам документах.',
                  checked: notifications.onComment
                },
                {
                  id: 'onDelegation',
                  title: 'Нові мандати делегування',
                  desc: 'Отримувати сповіщення, коли інші користувачі делегують вам повноваження.',
                  checked: notifications.onDelegation
                }
              ].map((item) => (
                <div key={item.id} className="flex items-start gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100/50 transition-colors">
                  <input 
                    type="checkbox" 
                    id={item.id}
                    checked={item.checked}
                    onChange={(e) => setNotifications(prev => ({ ...prev, [item.id]: e.target.checked }))}
                    className="mt-1 h-4.5 w-4.5 text-blue-600 focus:ring-blue-500/20 border-slate-300 rounded"
                  />
                  <div>
                    <label htmlFor={item.id} className="text-sm font-bold text-slate-900 cursor-pointer">{item.title}</label>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
              >
                {savingSettings && <Loader2 className="animate-spin" size={16} />}
                Зберегти налаштування
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
