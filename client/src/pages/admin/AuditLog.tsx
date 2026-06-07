import React, { useEffect, useState, useCallback } from 'react';
import { API } from '../../api/client';
import { 
  History, 
  Trash2,
  Search,
  Loader2,
  FileSpreadsheet,
  ArrowUpDown
} from 'lucide-react';
import Pagination from '../../components/Pagination';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AuditEntry {
  _id: string;
  adminName: string;
  adminEmail: string;
  action: string;
  targetEmail: string;
  details: string;
  createdAt: string;
}

const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = `?sortOrder=${sortOrder}`;
      if (searchQuery) query += `&search=${encodeURIComponent(searchQuery)}`;
      if (actionFilter) query += `&action=${encodeURIComponent(actionFilter)}`;
      if (dateFrom) query += `&dateFrom=${encodeURIComponent(dateFrom)}`;
      if (dateTo) query += `&dateTo=${encodeURIComponent(dateTo)}`;

      const data = await API.get<AuditEntry[]>(`/users/system/audit${query}`);
      setLogs(data);
    } catch (e) {
      console.error('Failed to fetch audit logs', e);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, actionFilter, sortOrder, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const paginatedLogs = logs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    if (logs.length === 0) return;
    
    const headers = ['Дата', 'Адміністратор', 'Email', 'Дія', 'Ціль', 'Деталі'];
    const rows = logs.map(log => [
      new Date(log.createdAt).toLocaleString('uk-UA').replace(/,/g, ''),
      log.adminName,
      log.adminEmail,
      log.action,
      log.targetEmail || '',
      log.details || ''
    ]);
    
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_export_${new Date().getTime()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearRequest = async () => {
    if (confirm('Ви впевнені, що хочете очистити аудит лог? Буде надіслано запит на підтвердження.')) {
      try {
        await API.post('/users/system/audit/clear-request', {});
        alert('Запит надіслано! Перевірте електронну пошту для підтвердження.');
      } catch (e: any) {
        alert(e.message || 'Помилка надсилання запиту');
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Аудит системи</h1>
          <p className="text-slate-500 mt-1 font-medium">Журнал дій адміністраторів</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={handleExport}
             className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
           >
             <FileSpreadsheet size={18} className="text-green-600" />
             Експорт CSV
           </button>
           <button 
             onClick={handleClearRequest}
             className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-xl text-sm font-bold text-red-600 hover:bg-red-100 transition-all shadow-sm"
           >
             <Trash2 size={18} />
             Очистити лог
           </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Пошук за адміністратором або деталями..." 
                value={searchQuery}
                onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
              />
           </div>
           <select 
             value={actionFilter}
             onChange={(e) => setActionFilter(e.target.value)}
             className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
           >
             <option value="">Всі дії</option>
             <option value="Створення">Створення</option>
             <option value="Редагування">Редагування</option>
             <option value="Видалення">Видалення</option>
             <option value="Блокування">Блокування</option>
             <option value="Розблокування">Розблокування</option>
           </select>
           <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 group focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all">
              <ArrowUpDown className="text-slate-400 w-4 h-4" />
              <select 
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="flex-1 bg-transparent border-none text-sm py-2 px-2 focus:ring-0 font-medium"
              >
                <option value="desc">Спочатку нові</option>
                <option value="asc">Спочатку старі</option>
              </select>
           </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-50">
           <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Період:</span>
              <input 
                type="date" 
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700" 
              />
              <span className="text-slate-300">—</span>
              <input 
                type="date" 
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700" 
              />
           </div>
           <button 
             onClick={fetchLogs}
             className="px-4 py-1.5 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg hover:bg-slate-800 transition-all"
           >
             Застосувати фільтри
           </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Дата та час</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Адміністратор</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Дія</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Ціль</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Деталі</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                   <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                         <Loader2 className="animate-spin text-blue-600" size={24} />
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Пошук у логах...</p>
                      </div>
                   </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400 italic">
                         <History size={32} strokeWidth={1} />
                         <p className="text-sm">Записів аудиту не знайдено за вказаними параметрами</p>
                      </div>
                   </td>
                </tr>
              ) : paginatedLogs.map((log) => (
                <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tighter">
                    {new Date(log.createdAt).toLocaleString('uk-UA')}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{log.adminName}</p>
                    <p className="text-[10px] text-slate-500">{log.adminEmail}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      log.action === 'Створення' ? "bg-green-50 text-green-700 border-green-100" :
                      log.action === 'Видалення' ? "bg-red-50 text-red-700 border-red-100" :
                      "bg-blue-50 text-blue-700 border-blue-100"
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-600 font-medium">{log.targetEmail || '—'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-500 max-w-sm font-medium">
                       {log.details || '—'}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={logs.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};

export default AuditLog;
