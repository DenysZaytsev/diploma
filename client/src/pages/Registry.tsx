import React, { useEffect, useState, useCallback } from 'react';
import { API } from '../api/client';
import Modal from '../components/Modal';
import { 
  Search, 
  Download, 
  Plus,
  ChevronLeft, 
  ChevronRight,
  Calendar,
  RotateCcw,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { 
  translateStatus, 
  translateDirection 
} from '../utils/translations';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Document {
  _id: string;
  regNumber: string;
  title: string;
  type: string;
  status: string;
  department: string;
  counterparty: string;
  direction: string;
  dueDate?: string;
  createdAt: string;
  creator?: { _id: string; fullName: string };
  approver?: { fullName: string };
  signatory?: { fullName: string };
}

const Registry: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<{name: string, code: string}[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<null | { succeeded: string[]; failed: { id: string; reason: string }[] }>(null);
  const [isResultModalOpen, setResultModalOpen] = useState(false);
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleBulkSubmit = async () => {
    if (!confirm(`Надіслати на погодження ${selectedDocs.length} документів?`)) return;
    setBulkLoading(true);
    try {
      const result = await API.post('/documents/bulk', { documentIds: selectedDocs, action: 'submit' });
      // Expected result shape { succeeded: [], failed: [{id, reason}] }
      setBulkResult(result as { succeeded: string[]; failed: { id: string; reason: string; }[] });
      setResultModalOpen(true);
      setSelectedDocs([]);
      await fetchDocuments();
    } catch (e: any) {
      alert(e.message || 'Помилка масової подачі');
    } finally {
      setBulkLoading(false);
    }
  };

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeDelegators, setActiveDelegators] = useState<string[]>([]);

  useEffect(() => {
    const fetchDelegations = async () => {
      try {
        const data = await API.get<any[]>('/delegations');
        const now = new Date();
        const delegators = data
          .filter(d => d.isActive && d.delegate?._id === currentUser?._id && new Date(d.dateFrom) <= now && new Date(d.dateTo) >= now)
          .map(d => d.delegator?._id);
        setActiveDelegators(delegators);
      } catch (e) {
        console.error('Failed to fetch delegations', e);
      }
    };
    if (currentUser) {
      fetchDelegations();
    }
  }, [currentUser]);

  const sortedDocuments = React.useMemo(() => {
    const sorted = [...documents];
    if (!sortField) return sorted;

    sorted.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'regNumber':
          valA = a.regNumber || '';
          valB = b.regNumber || '';
          break;
        case 'title':
          valA = a.title || '';
          valB = b.title || '';
          break;
        case 'status':
          valA = a.status || '';
          valB = b.status || '';
          break;
        case 'ownership':
          const isOwnA = a.creator?._id === currentUser?._id;
          const isOwnB = b.creator?._id === currentUser?._id;
          valA = isOwnA ? 'own' : (a.creator?.fullName || '');
          valB = isOwnB ? 'own' : (b.creator?.fullName || '');
          break;
        case 'department':
          valA = a.department || '';
          valB = b.department || '';
          break;
        case 'dueDate':
          valA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          valB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        case 'createdAt':
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [documents, sortField, sortDirection, currentUser]);
  
  const navigate = useNavigate();

  const fetchFilters = useCallback(async () => {
    try {
      const [typeData] = await Promise.all([
        API.get<{name: string, code: string}[]>('/document-types'),
        API.get<{name: string}[]>('/departments')
      ]);
      setTypes(typeData);
    } catch (e) {
      console.error('Failed to fetch filter data', e);
    }
  }, []);

  const canManageDocuments = currentUser?.role === 'admin';

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const query = searchParams.toString();
      const data = await API.get<Document[]>(`/documents${query ? `?${query}` : ''}`);
      setDocuments(data);
    } catch (e) {
      console.error('Failed to fetch documents', e);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) newParams.set(key, value);
    else newParams.delete(key);
    setSearchParams(newParams);
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin' && !searchParams.has('myDocs')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('myDocs', 'true');
      setSearchParams(newParams);
    }
  }, [currentUser, searchParams, setSearchParams]);
  const resetFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const statusLabels: Record<string, string> = {
    'draft': 'Чернетка',
    'on_approval': 'На погодженні',
    'on_signing': 'На підписанні',
    'signed': 'Підписано',
    'rejected': 'Відхилено',
    'archived': 'В архіві'
  };

  const statusColors: Record<string, string> = {
    'draft': 'bg-slate-100 text-slate-600 border-slate-200',
    'on_approval': 'bg-amber-100 text-amber-700 border-amber-200',
    'on_signing': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'signed': 'bg-green-100 text-green-700 border-green-200',
    'rejected': 'bg-red-100 text-red-700 border-red-200',
    'archived': 'bg-slate-200 text-slate-500 border-slate-300'
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Журнал документів</h1>
          <p className="text-slate-500 mt-1">Керування та моніторинг всієї документації</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => {
              e.preventDefault();
              if (documents.length === 0) return;
              const headers = ['ID/Номер', 'Назва', 'Напрямок', 'Тип', 'Статус', 'Приналежність', 'Відділ', 'Контрагент', 'Дедлайн', 'Дата створення'];
              const rows = documents.map(doc => {
                const isOwn = !!(currentUser?._id && doc.creator?._id && doc.creator._id === currentUser._id);
                const isDelegated = !!(doc.creator?._id && activeDelegators.includes(doc.creator._id));
                const ownership = isOwn ? 'Власний' : isDelegated ? `Делеговано від ${doc.creator?.fullName || ''}` : `Загальний (${doc.creator?.fullName || ''})`;
                return [
                  doc.regNumber,
                  doc.title,
                  translateDirection(doc.direction),
                  types.find(t => t.code === doc.type)?.name || doc.type,
                  translateStatus(doc.status),
                  ownership,
                  doc.department,
                  doc.counterparty || '',
                  doc.dueDate ? new Date(doc.dueDate).toLocaleDateString('uk-UA') : '',
                  new Date(doc.createdAt).toLocaleDateString('uk-UA')
                ];
              });
              const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.setAttribute('href', url);
              link.setAttribute('download', `documents_export_${new Date().toISOString().slice(0,10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <Download size={18} />
            Експорт CSV
          </button>
          <Link 
            to="/new-document"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-xl text-sm font-semibold text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
          >
            <Plus size={18} />
            Створити
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Пошук за назвою або номером..." 
              value={searchParams.get('search') || ''}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
            />
          </div>
          
          <select 
            value={searchParams.get('type') || ''}
            onChange={(e) => updateFilter('type', e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
          >
            <option value="">Всі типи</option>
            {types.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>

          <select 
            value={searchParams.get('status') || ''}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
          >
            <option value="">Всі статуси</option>
            {Object.entries(statusLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>

          {currentUser?.role !== 'admin' && (
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/70 transition-all">
              <input 
                type="checkbox"
                checked={searchParams.get('myDocs') === 'true'}
                onChange={(e) => updateFilter('myDocs', e.target.checked ? 'true' : 'false')}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
              />
              Тільки мої та делеговані
            </label>
          )}

          <button 
            onClick={resetFilters}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center"
            title="Скинути фільтри"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Bulk Operations Panel */}
      {selectedDocs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-blue-800">Вибрано документів: {selectedDocs.length}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkSubmit}
              disabled={bulkLoading || selectedDocs.some(id => {
                const doc = documents.find(d => d._id === id);
                return !doc || !['draft', 'rejected'].includes(doc.status);
              })}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all"
            >
              Подати на погодження
            </button>
            <button
              onClick={async () => {
                if (confirm(`Ви впевнені, що хочете видалити ${selectedDocs.length} документів?`)) {
                  setBulkLoading(true);
                  try {
                    await API.post('/documents/bulk', { documentIds: selectedDocs, action: 'delete' });
                    setSelectedDocs([]);
                    await fetchDocuments();
                  } catch (e: any) {
                    alert(e.message || 'Помилка масового видалення');
                  } finally {
                    setBulkLoading(false);
                  }
                }
              }}
              disabled={bulkLoading || selectedDocs.some(id => {
                const doc = documents.find(d => d._id === id);
                return !doc || doc.status !== 'draft';
              })}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all"
            >
              Видалити
            </button>
            <button
              onClick={() => setSelectedDocs([])}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              Скасувати вибір
            </button>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={sortedDocuments.length > 0 && selectedDocs.length === sortedDocuments.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDocs(sortedDocuments.map(d => d._id));
                      } else {
                        setSelectedDocs([]);
                      }
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors select-none"
                  onClick={() => handleSort('regNumber')}
                >
                  <div className="flex items-center gap-1">
                    ID / Номер
                    {sortField === 'regNumber' ? (
                      sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-500" /> : <ArrowDown size={14} className="text-blue-500" />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors select-none"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-1">
                    Назва та Тип
                    {sortField === 'title' ? (
                      sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-500" /> : <ArrowDown size={14} className="text-blue-500" />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors select-none text-center whitespace-nowrap w-32 min-w-[120px]"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Статус
                    {sortField === 'status' ? (
                      sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-500" /> : <ArrowDown size={14} className="text-blue-500" />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors select-none"
                  onClick={() => handleSort('ownership')}
                >
                  <div className="flex items-center gap-1">
                    Приналежність
                    {sortField === 'ownership' ? (
                      sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-500" /> : <ArrowDown size={14} className="text-blue-500" />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors select-none"
                  onClick={() => handleSort('department')}
                >
                  <div className="flex items-center gap-1">
                    Відділ / Контрагент
                    {sortField === 'department' ? (
                      sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-500" /> : <ArrowDown size={14} className="text-blue-500" />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors select-none"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center gap-1">
                    Дедлайн
                    {sortField === 'dueDate' ? (
                      sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-500" /> : <ArrowDown size={14} className="text-blue-500" />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                 <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                       <div className="flex flex-col items-center gap-3">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          <p className="text-sm text-slate-400 font-medium tracking-wide">Завантаження документів...</p>
                       </div>
                    </td>
                 </tr>
              ) : sortedDocuments.length === 0 ? (
                 <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400">Документів не знайдено</td>
                 </tr>
              ) : sortedDocuments.map((doc) => {
                const isOwn = !!(currentUser?._id && doc.creator?._id && doc.creator._id === currentUser._id);
                const isDelegated = !!(doc.creator?._id && activeDelegators.includes(doc.creator._id));
                const isSelected = selectedDocs.includes(doc._id);
                return (
                <tr 
                  key={doc._id} 
                  className={cn(
                    "hover:bg-slate-50/80 transition-colors cursor-pointer group",
                    isSelected && "bg-blue-50/30"
                  )}
                  onClick={() => navigate(`/document/${doc._id}`)}
                >
                  <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDocs(prev => [...prev, doc._id]);
                        } else {
                          setSelectedDocs(prev => prev.filter(id => id !== doc._id));
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{doc.regNumber}</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">{new Date(doc.createdAt).toLocaleDateString('uk-UA')}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-semibold text-slate-800 line-clamp-1">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase tracking-wide border border-blue-100 italic">
                        {translateDirection(doc.direction)}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400 italic">
                        {types.find(t => t.code === doc.type)?.name || doc.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center w-32 min-w-[120px]">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase border whitespace-nowrap",
                      statusColors[doc.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                    )}>
                      {translateStatus(doc.status)}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    {isOwn ? (
                      <span className="px-2 py-1 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold rounded uppercase tracking-wide">
                        Власний
                      </span>
                    ) : isDelegated ? (
                      <div className="space-y-0.5">
                        <span className="px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wide">
                          Делеговано
                        </span>
                        <p className="text-xs text-slate-500 font-medium mt-1">{doc.creator?.fullName || 'Інший користувач'}</p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <span className="px-2 py-1 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold rounded uppercase tracking-wide">
                          Загальний
                        </span>
                        <p className="text-xs text-slate-500 font-medium mt-1">{doc.creator?.fullName || 'Інший користувач'}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-medium text-slate-700">{doc.department}</p>
                    <p className="text-xs text-slate-400 mt-1 italic">{doc.counterparty || '—'}</p>
                  </td>
                  <td className="px-6 py-5">
                     {doc.dueDate ? (
                       <div className={cn(
                         "flex items-center gap-2 text-sm font-medium",
                         new Date(doc.dueDate) < new Date() && doc.status !== 'signed' ? "text-red-500" : "text-slate-600"
                       )}>
                         <Calendar size={14} />
                         {new Date(doc.dueDate).toLocaleDateString('uk-UA')}
                       </div>
                     ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                       {canManageDocuments && (
                         <button 
                           onClick={(e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             if (confirm('Ви впевнені, що хочете видалити цей документ?')) {
                               API.delete(`/documents/${doc._id}`).then(() => fetchDocuments());
                             }
                           }}
                           className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                           title="Видалити документ"
                         >
                           <Trash2 size={16} />
                         </button>
                       )}
                     </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-200 flex items-center justify-between">
           <p className="text-xs font-medium text-slate-500 tracking-wide">
             Показано {documents.length} документів
           </p>
           <div className="flex items-center gap-2">
              <button disabled className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-300 disabled:opacity-50">
                <ChevronLeft size={16} />
              </button>
              <button disabled className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-300 disabled:opacity-50">
                <ChevronRight size={16} />
              </button>
           </div>
        </div>
      </div>
    {isResultModalOpen && bulkResult && (
        <Modal
          isOpen={isResultModalOpen}
          onClose={() => setResultModalOpen(false)}
          title="Результат подачі"
          size="md"
          footer={(
            <button
              onClick={() => setResultModalOpen(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Закрити
            </button>
          )}
        >
          <p>Успішно подано: {bulkResult.succeeded.length}</p>
          {bulkResult.failed.length > 0 && (
            <div className="mt-2">
              <p className="font-semibold">Не успішно:</p>
              <ul className="list-disc pl-5 space-y-1">
                {bulkResult.failed.map(f => (
                  <li key={f.id}>{f.id}: {f.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default Registry;
