import React from 'react';
import { Settings, ShieldAlert } from 'lucide-react';

interface AdminPageProps {
  title: string;
  description: string;
}

const AdminPage: React.FC<AdminPageProps> = ({ title, description }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-slate-500 mt-1">{description}</p>
      </div>

      <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
         <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
            <Settings size={32} />
         </div>
         <h3 className="text-xl font-bold text-slate-900 mb-2">Модуль в розробці</h3>
         <p className="text-slate-500 max-w-sm mb-8">
           Ми працюємо над міграцією адміністративних функцій на новий інтерфейс "Pro Max". 
           Наразі користуйтеся класичною панеллю для керування {title.toLowerCase()}.
         </p>
         <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-700 text-sm">
            <ShieldAlert size={18} />
            <span>Необхідні права адміністратора</span>
         </div>
      </div>
    </div>
  );
};

export default AdminPage;
