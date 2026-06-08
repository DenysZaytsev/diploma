import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  Shield, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Download,
  Eye,
  History,
  Loader2,
  Trash2,
  X,
  Plus,
  Upload,
  Edit
} from 'lucide-react';
import { 
  translateStatus, 
  translateDirection, 
  translateAuditAction,
  translateRole,
  translateConfidentiality
} from '../utils/translations';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AuditLog {
  _id: string;
  action: string;
  user: { fullName: string; role: string };
  createdAt: string;
  comment?: string;
}

interface DocumentDetails {
  _id: string;
  regNumber: string;
  title: string;
  description: string;
  type: string;
  status: string;
  department: string;
  counterparty: string;
  direction: string;
  dueDate?: string;
  createdAt: string;
  filePath: string;
  creator: { _id: string; fullName: string; role: string };
  approver?: { _id: string; fullName: string; role: string };
  signatory?: { _id: string; fullName: string; role: string };
  versions: any[];
  confidentiality: string;
  files?: Array<{ _id: string; originalName: string; mimeType: string; size: number; path: string; version?: number }>;
  fileVersions?: Array<{
    _id: string;
    fileId: string;
    originalName: string;
    mimeType: string;
    size: number;
    path: string;
    version: number;
    uploadedAt: string;
    uploadedBy: { _id: string; fullName: string };
    replacedAt: string;
  }>;
  relatedDocuments?: Array<{ _id: string; title: string; regNumber: string; status: string }>;
}

const DocumentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [doc, setDoc] = useState<DocumentDetails | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'audit'>('details');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<{ _id: string; originalName: string; mimeType: string; path: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [commentText, setCommentText] = useState('');

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [availableDocs, setAvailableDocs] = useState<any[]>([]);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkFilterType, setLinkFilterType] = useState('');
  const [fetchingAvailable, setFetchingAvailable] = useState(false);

  const fetchAvailableDocuments = async () => {
    setFetchingAvailable(true);
    try {
      const docsList = await API.get<any[]>('/documents');
      // Filter out current document, already related documents, and restrict to signed/archived documents
      const filtered = docsList.filter(d => 
        d._id !== id && 
        !doc?.relatedDocuments?.some(rd => rd._id === d._id) &&
        ['signed', 'archived'].includes(d.status)
      );
      setAvailableDocs(filtered);
    } catch (err: any) {
      console.error('Failed to fetch documents for linking', err);
    } finally {
      setFetchingAvailable(false);
    }
  };

  const handleStartEdit = () => {
    if (doc) {
      setEditTitle(doc.title);
      setEditDescription(doc.description || '');
      setIsEditing(true);
    }
  };

  const [types, setTypes] = useState<{name: string, code: string}[]>([]);
  const [isDelegate, setIsDelegate] = useState(false);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const [docData, auditData, typeData, delegationData] = await Promise.all([
        API.get<DocumentDetails>(`/documents/${id}`),
        API.get<AuditLog[]>(`/documents/${id}/audit`),
        API.get<{name: string, code: string}[]>('/document-types'),
        API.get<any[]>('/delegations')
      ]);
      setDoc(docData);
      setAudit(auditData);
      setTypes(typeData);

      // Check if current user is active employee delegate of the creator
      const now = new Date();
      const hasActiveDelegation = delegationData.some(d => 
        d.delegate?._id === currentUser?._id &&
        d.delegator?._id === docData.creator?._id &&
        d.role === 'employee' &&
        d.isActive &&
        new Date(d.dateFrom) <= now &&
        new Date(d.dateTo) >= now
      );
      setIsDelegate(hasActiveDelegation);

    } catch (e) {
      console.error('Failed to fetch document details', e);
    } finally {
      setLoading(false);
    }
  }, [id, currentUser]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);



  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="animate-spin text-blue-600" size={32} />
      <p className="text-slate-400 font-medium">Завантаження документа...</p>
    </div>
  );

  if (!doc) return (
    <div className="text-center py-20">
      <p className="text-red-500 font-bold">Документ не знайдено</p>
      <button onClick={() => navigate('/registry')} className="mt-4 text-blue-600 font-semibold hover:underline">Повернутися до журналу</button>
    </div>
  );

  const canViewFiles = currentUser?.role !== 'admin';
  const canDelete = currentUser?.role === 'admin' || (currentUser?.role === 'employee' && doc.status === 'draft');

  const statusColors: Record<string, string> = {
    'draft': 'bg-slate-100 text-slate-600 border-slate-200',
    'on_approval': 'bg-amber-100 text-amber-700 border-amber-200',
    'on_signing': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'signed': 'bg-green-100 text-green-700 border-green-200',
    'rejected': 'bg-red-100 text-red-700 border-red-200',
    'archived': 'bg-slate-200 text-slate-500 border-slate-300'
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="space-y-4 border-b border-slate-200 pb-4">
        {/* Top Navigation Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
              title="Назад"
            >
              <ArrowLeft size={20} />
            </button>
            {/* Tab Navigation */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={cn(
                  "px-4 py-2 border-b-2 font-bold text-sm transition-all -mb-4",
                  activeTab === 'details'
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                Документ
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={cn(
                  "px-4 py-2 border-b-2 font-bold text-sm transition-all -mb-4",
                  activeTab === 'audit'
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                Журнал аудиту
              </button>
            </div>
          </div>
          {['signed', 'archived'].includes(doc.status) && (
            <button
              onClick={() => {
                const passport = {
                  id: doc._id,
                  regNumber: doc.regNumber,
                  title: doc.title,
                  description: doc.description,
                  type: types.find(t => t.code === doc.type)?.name || doc.type,
                  status: translateStatus(doc.status),
                  confidentiality: translateConfidentiality(doc.confidentiality),
                  direction: translateDirection(doc.direction),
                  department: doc.department,
                  counterparty: doc.counterparty,
                  dueDate: doc.dueDate,
                  createdAt: doc.createdAt,
                  creator: doc.creator?.fullName,
                  approver: doc.approver?.fullName,
                  signatory: doc.signatory?.fullName,
                  files: doc.files?.map(f => ({
                    name: f.originalName,
                    size: f.size,
                    version: f.version || 1
                  }))
                };
                const jsonContent = JSON.stringify(passport, null, 2);
                const blob = new Blob([jsonContent], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `passport_${doc.regNumber}.json`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all"
            >
              <Download size={16} />
              Експорт паспорта (JSON)
            </button>
          )}
        </div>

        {/* Title and Badge Row */}
        <div className="pt-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 tracking-wider bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">{doc.regNumber}</span>
            <span className={cn(
              "px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border",
              statusColors[doc.status]
            )}>
              {translateStatus(doc.status)}
            </span>
          </div>
          {isEditing ? (
            <input 
              type="text" 
              className="w-full text-2xl font-extrabold text-slate-900 mt-2 px-3 py-1.5 border border-blue-500 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" 
              value={editTitle} 
              onChange={(e) => setEditTitle(e.target.value)} 
            />
          ) : (
            <h1 className="text-2xl font-extrabold text-slate-900 mt-2">{doc.title}</h1>
          )}
        </div>
      </div>

      {/* Action Bar (only visible if actions are available) */}
      {(isEditing || 
        (doc.status === 'draft' && (doc.creator._id === currentUser?._id || isDelegate || currentUser?.role === 'admin')) ||
        (doc.status === 'rejected' && (doc.creator._id === currentUser?._id || isDelegate || currentUser?.role === 'admin')) ||
        (doc.status === 'on_approval' && (currentUser?.role === 'approver' || currentUser?.role === 'admin')) ||
        (doc.status === 'on_signing' && (currentUser?.role === 'signatory' || currentUser?.role === 'admin'))
      ) && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">Доступні дії:</span>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Edit mode controls */}
             {isEditing && (
               <div className="flex items-center gap-2">
                 <button 
                   onClick={async () => {
                     setActionLoading('save');
                     try {
                       await API.patch(`/documents/${doc._id}`, {
                         title: editTitle,
                         description: editDescription
                       });
                       setIsEditing(false);
                       await fetchDetails();
                     } catch (err: any) {
                       alert(err.message || 'Помилка збереження змін');
                     } finally {
                       setActionLoading(null);
                     }
                   }}
                   disabled={!editTitle.trim() || !!actionLoading}
                   className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-600/20 transition-all"
                 >
                   Зберегти
                 </button>
                 <button 
                   onClick={() => setIsEditing(false)}
                   disabled={!!actionLoading}
                   className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
                 >
                   Скасувати
                 </button>
               </div>
             )}

             {/* Draft & Rejected Actions */}
             {!isEditing && ['draft', 'rejected'].includes(doc.status) && (doc.creator._id === currentUser?._id || isDelegate || currentUser?.role === 'admin') && (
               <>
                 <button 
                   onClick={handleStartEdit}
                   className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-sm font-bold transition-all border border-blue-100 flex items-center gap-2"
                   title="Редагувати опис та назву"
                 >
                   <Edit size={16} />
                   Редагувати
                 </button>
                 <button 
                   onClick={async () => {
                     setActionLoading('submit');
                     try {
                       await API.post(`/documents/${doc._id}/submit`, {});
                       await fetchDetails();
                     } catch (err: any) {
                       alert(err.message || 'Помилка подачі на погодження');
                     } finally {
                       setActionLoading(null);
                     }
                   }}
                   disabled={!!actionLoading}
                   className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                 >
                   {actionLoading === 'submit' ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                   Відправити на погодження
                 </button>
                 {canDelete && (
                   <button 
                     onClick={() => {
                       if (confirm('Ви впевнені, що хочете видалити цей документ?')) {
                         API.delete(`/documents/${doc._id}`)
                           .then(() => navigate('/registry'))
                           .catch(err => alert(err.message));
                       }
                     }}
                     className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                     title="Видалити документ"
                   >
                     <Trash2 size={20} />
                   </button>
                 )}
               </>
             )}

             {/* Approval Actions */}
             {!isEditing && doc.status === 'on_approval' && (currentUser?.role === 'approver') && (
               <>
                 <button 
                   onClick={() => {
                     setRejectReason('');
                     setRejectError(null);
                     setIsRejectModalOpen(true);
                   }}
                   disabled={!!actionLoading}
                   className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                 >
                   {actionLoading === 'rejected' ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                   Відхилити
                 </button>
                 <button 
                   onClick={() => {
                     setActionLoading('approve');
                     API.post(`/documents/${id}/approve`, {})
                       .then(() => fetchDetails())
                       .catch(err => alert(err.message))
                       .finally(() => setActionLoading(null));
                   }}
                   disabled={!!actionLoading}
                   className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
                 >
                   {actionLoading === 'approve' ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                   Погодити
                 </button>
               </>
             )}

             {/* Signing Actions */}
             {!isEditing && doc.status === 'on_signing' && (currentUser?.role === 'signatory') && (
               <>
                 <button 
                   onClick={() => {
                     setRejectReason('');
                     setRejectError(null);
                     setIsRejectModalOpen(true);
                   }}
                   disabled={!!actionLoading}
                   className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                 >
                   {actionLoading === 'rejected' ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                   Відхилити
                 </button>
                 <button 
                   onClick={() => {
                     setActionLoading('signed');
                     API.post(`/documents/${id}/sign`, {})
                       .then(() => fetchDetails())
                       .catch(err => alert(err.message))
                       .finally(() => setActionLoading(null));
                   }}
                   disabled={!!actionLoading}
                   className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-xl text-sm font-bold shadow-lg shadow-green-600/20 transition-all flex items-center gap-2"
                 >
                   {actionLoading === 'signed' ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                   Підписати
                 </button>
               </>
             )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {activeTab === 'details' && (
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
                  {[
                    { label: 'Тип документа', value: types.find(t => t.code === doc.type)?.name || doc.type, icon: FileText },
                    { label: 'Напрямок', value: translateDirection(doc.direction), icon: Shield },
                    { label: 'Гриф доступу', value: translateConfidentiality(doc.confidentiality), icon: Shield },
                    { label: 'Дата реєстрації', value: new Date(doc.createdAt).toLocaleDateString('uk-UA'), icon: Clock },
                    { label: 'Дедлайн', value: doc.dueDate ? new Date(doc.dueDate).toLocaleDateString('uk-UA') : 'Не вказано', icon: Calendar, warn: !!doc.dueDate && new Date(doc.dueDate) < new Date() }
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                        <item.icon size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
                      </div>
                      <p className={cn("text-sm font-bold", item.warn ? "text-red-500" : "text-slate-900")}>{item.value}</p>
                    </div>
                  ))}
                </div>

              <div className="pt-8 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Опис документа</h3>
                  {isEditing ? (
                    <textarea 
                      className="w-full h-32 px-4 py-3 border border-blue-500 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none resize-none text-slate-800" 
                      value={editDescription} 
                      onChange={(e) => setEditDescription(e.target.value)} 
                    />
                  ) : (
                    <p className="text-slate-700 leading-relaxed">{doc.description || 'Опис відсутній'}</p>
                  )}
              </div>

                <div className="pt-8 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Файли та вкладення</h3>
                    {['draft', 'rejected'].includes(doc.status) && (doc.creator._id === currentUser?._id || isDelegate || currentUser?.role === 'admin') && (
                      <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all border border-blue-100">
                        <Plus size={14} />
                        Додати файли
                        <input 
                          type="file" 
                          multiple 
                          className="hidden" 
                          onChange={async (e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              const formData = new FormData();
                              for (let i = 0; i < e.target.files.length; i++) {
                                formData.append('files', e.target.files[i]);
                              }
                              try {
                                setActionLoading('upload');
                                await API.upload(`/documents/${doc._id}/files`, formData);
                                await fetchDetails();
                              } catch (err: any) {
                                alert(err.message || 'Помилка завантаження файлів');
                              } finally {
                                setActionLoading(null);
                              }
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <div className="space-y-4">
                    {(!doc.files || doc.files.length === 0) ? (
                      <p className="text-sm text-slate-400 italic">Файли не додано</p>
                    ) : (
                      doc.files.map((f) => (
                        <div key={f._id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 group">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="p-3 bg-white rounded-xl border border-slate-200 group-hover:border-blue-200 group-hover:bg-blue-50 transition-all">
                                    <FileText className="text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-[400px]">{f.originalName}</p>
                                    <p className="text-xs text-slate-500">Версія {f.version || 1} • {(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {canViewFiles && (
                                  <>
                                    <button 
                                      onClick={() => setSelectedPreviewFile(f)}
                                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all"
                                      title="Переглянути"
                                    >
                                      <Eye size={18} />
                                    </button>
                                    <a 
                                      href={`http://localhost:5001/api/documents/${doc._id}/files/${f.path.split('/').pop()}/download?token=${localStorage.getItem('token')}`}
                                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all"
                                      title="Скачати"
                                    >
                                      <Download size={18} />
                                    </a>
                                    {['draft', 'rejected'].includes(doc.status) && (doc.creator._id === currentUser?._id || isDelegate || currentUser?.role === 'admin') && (
                                      <>
                                        <label className="cursor-pointer p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all flex items-center justify-center" title="Завантажити нову версію">
                                          <Upload size={18} />
                                          <input 
                                            type="file" 
                                            className="hidden" 
                                            onChange={async (e) => {
                                              if (e.target.files && e.target.files.length > 0) {
                                                const formData = new FormData();
                                                formData.append('files', e.target.files[0]);
                                                try {
                                                  setActionLoading('replace');
                                                  await API.upload(`/documents/${doc._id}/files/${f._id}`, formData, 'PUT');
                                                  await fetchDetails();
                                                } catch (err: any) {
                                                  alert(err.message || 'Помилка завантаження нової версії');
                                                } finally {
                                                  setActionLoading(null);
                                                }
                                              }
                                            }}
                                          />
                                        </label>
                                        <button 
                                          onClick={async () => {
                                            if (confirm(`Ви впевнені, що хочете видалити файл "${f.originalName}"?`)) {
                                              try {
                                                await API.delete(`/documents/${doc._id}/files/${f._id}`);
                                                await fetchDetails();
                                              } catch (e: any) {
                                                alert(e.message || 'Не вдалося видалити файл');
                                              }
                                            }
                                          }}
                                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl transition-all"
                                          title="Видалити файл"
                                        >
                                          <Trash2 size={18} />
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Historical versions */}
                            {doc.fileVersions && doc.fileVersions.filter(fv => fv.fileId === f._id).length > 0 && (
                              <div className="mt-1 pt-2 border-t border-slate-100 space-y-1.5 pl-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Історія версій:</p>
                                <div className="space-y-1">
                                  {doc.fileVersions.filter(fv => fv.fileId === f._id).map((fv) => (
                                    <div key={fv._id} className="flex items-center justify-between text-xs text-slate-500 bg-white/50 px-3 py-1.5 rounded-lg border border-slate-100">
                                      <span className="font-medium">Версія {fv.version} (від {fv.uploadedBy?.fullName || 'Система'})</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono">{(fv.size / 1024 / 1024).toFixed(2)} MB</span>
                                        {canViewFiles && (
                                          <a 
                                            href={`http://localhost:5001/api/documents/${doc._id}/files/${fv.path.split('/').pop()}/download?token=${localStorage.getItem('token')}`}
                                            className="text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1 font-semibold text-[11px]"
                                          >
                                            <Download size={12} />
                                            Скачати v{fv.version}
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Пов'язані документи */}
                <div className="pt-8 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Пов'язані документи</h3>
                      {['draft', 'rejected'].includes(doc.status) && (doc.creator._id === currentUser?._id || isDelegate || currentUser?.role === 'admin') && (
                        <button 
                          onClick={() => {
                            setIsLinkModalOpen(true);
                            fetchAvailableDocuments();
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all border border-blue-100"
                        >
                          <Plus size={14} />
                          Додати зв'язок
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(!doc.relatedDocuments || doc.relatedDocuments.length === 0) ? (
                        <p className="text-sm text-slate-400 italic col-span-2">Пов'язаних документів не знайдено</p>
                      ) : (
                        doc.relatedDocuments.map((rd) => (
                          <div key={rd._id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between group">
                            <div className="flex items-center gap-3 min-w-0">
                                <FileText className="text-slate-400 shrink-0" size={16} />
                                <div className="min-w-0">
                                <p 
                                    onClick={() => navigate(`/document/${rd._id}`)}
                                    className="text-sm font-bold text-slate-800 hover:text-blue-600 cursor-pointer transition-colors truncate"
                                >
                                    {rd.regNumber} — {rd.title}
                                </p>
                                <div className="mt-1">
                                    <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded uppercase font-bold text-slate-600 tracking-wider">
                                    {translateStatus(rd.status)}
                                    </span>
                                </div>
                                </div>
                            </div>
                            
                            {['draft', 'rejected'].includes(doc.status) && (doc.creator._id === currentUser?._id || isDelegate || currentUser?.role === 'admin') && (
                                <button 
                                onClick={async () => {
                                    if (confirm(`Ви впевнені, що хочете розірвати зв'язок з документом "${rd.regNumber}"?`)) {
                                    try {
                                        setActionLoading('unlink');
                                        await API.delete(`/documents/${doc._id}/related/${rd._id}`);
                                        await fetchDetails();
                                    } catch (err: any) {
                                        alert(err.message || 'Не вдалося розірвати зв\'язок');
                                    } finally {
                                        setActionLoading(null);
                                    }
                                    }
                                }}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl transition-all shrink-0"
                                title="Розірвати зв'язок"
                                >
                                <Trash2 size={16} />
                                </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* Sidebar Info */}
        <div className={cn(
          activeTab === 'details' 
            ? "space-y-8" 
            : "lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"
        )}>
           {/* Workflow */}
           <div className={cn(
             "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm",
             activeTab === 'audit' && "lg:col-span-1"
           )}>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Shield size={16} />
                Виконання
              </h3>
              <div className="space-y-6">
                 {[
                   { label: 'Створив', user: doc.creator },
                   { label: 'Погоджує', user: doc.approver },
                   { label: 'Підписує', user: doc.signatory }
                 ].map((item, i) => (
                   <div key={i} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200">
                         {item.user ? item.user.fullName.charAt(0) : '?'}
                      </div>
                      <div>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">{item.label}</p>
                         <p className="text-sm font-bold text-slate-900">{item.user?.fullName || 'Не призначено'}</p>
                         {item.user && <p className="text-[10px] text-slate-500 uppercase">{translateRole(item.user.role)}</p>}
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           {/* Timeline */}
           <div className={cn(
              "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col",
              activeTab === 'audit' && "lg:col-span-2"
           )}>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <History size={16} />
                Історія подій
              </h3>

              {/* Comment Input */}
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!commentText.trim()) return;
                  try {
                    setActionLoading('comment');
                    await API.post(`/documents/${doc._id}/comments`, { comment: commentText });
                    setCommentText('');
                    await fetchDetails();
                  } catch (err: any) {
                    alert(err.message || 'Не вдалося додати коментар');
                  } finally {
                    setActionLoading(null);
                  }
                }}
                className="mb-6 flex gap-2"
              >
                <input 
                  type="text"
                  placeholder="Напишіть коментар..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  disabled={actionLoading === 'comment'}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white text-slate-800"
                />
                <button
                  type="submit"
                  disabled={actionLoading === 'comment'}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-bold transition-all shrink-0 flex items-center justify-center min-w-[90px]"
                >
                  {actionLoading === 'comment' ? <Loader2 className="animate-spin" size={14} /> : 'Надіслати'}
                </button>
              </form>

              <div className={cn("space-y-6 flex-1 overflow-y-auto pr-2", activeTab === 'audit' ? "max-h-[600px]" : "max-h-[300px]")}>
                  {audit.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Історія відсутня</p>
                  ) : (
                    audit.map((log) => (
                      <div key={log._id} className="flex gap-3 relative pb-6 last:pb-0">
                        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-slate-100 last:hidden" />
                        <div className="relative z-10 w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                          {log.user ? log.user.fullName.charAt(0) : '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-600 mt-1">
                            {translateAuditAction(log.action)}
                          </p>
                          {log.comment && (
                            <p className="text-xs text-slate-500 mt-1.5 bg-slate-50 border border-slate-100 rounded-lg p-2 italic leading-relaxed">
                              {log.comment}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(log.createdAt).toLocaleString('uk-UA')}
                          </p>
                        </div>
                     </div>
                   ))
                 )}
              </div>
            </div>
        </div>
      </div>
      {selectedPreviewFile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <FileText className="text-blue-600" size={20} />
                <span className="font-bold text-slate-800 truncate max-w-xs md:max-w-lg">{selectedPreviewFile.originalName}</span>
              </div>
              <button 
                onClick={() => setSelectedPreviewFile(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                title="Закрити"
              >
                <X size={20} />
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-hidden relative">
              {(() => {
                const url = `http://localhost:5001${selectedPreviewFile.path}`;
                const ext = selectedPreviewFile.path.split('.').pop()?.toLowerCase() || '';
                const isPdf = ext === 'pdf' || selectedPreviewFile.mimeType.includes('pdf');
                const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) || selectedPreviewFile.mimeType.includes('image');
                const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
                const isTxt = ['txt', 'csv', 'md'].includes(ext) || selectedPreviewFile.mimeType.includes('text');

                if (isPdf) {
                  return (
                    <iframe 
                      src={url} 
                      className="w-full h-full border-0" 
                      title={selectedPreviewFile.originalName}
                    />
                  );
                } else if (isImage) {
                  return (
                    <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                      <img 
                        src={url} 
                        alt={selectedPreviewFile.originalName} 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                      />
                    </div>
                  );
                } else if (isOffice) {
                  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                  if (isLocal) {
                    return (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-4 bg-white">
                        <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 border border-blue-100">
                          <FileText size={48} className="mx-auto" />
                        </div>
                        <div className="space-y-2 max-w-md">
                          <h4 className="font-bold text-slate-800 text-lg">Локальний перегляд Office документів</h4>
                          <p className="text-sm text-slate-500 leading-relaxed">
                            Оскільки додаток запущено локально (на **localhost**), зовнішній сервіс перегляду Microsoft Office Online Viewer не може отримати прямий доступ до вашого файлу для його рендерингу.
                          </p>
                          <p className="text-xs text-slate-400 italic">
                            У реальному розгортанні (production) на публічному домені цей файл буде успішно відображено безпосередньо у цьому вікні.
                          </p>
                        </div>
                        <a 
                          href={`http://localhost:5001/api/documents/${doc._id}/files/${selectedPreviewFile.path.split('/').pop()}/download?token=${localStorage.getItem('token')}`}
                          className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
                        >
                          <Download size={16} />
                          Завантажити та відкрити локально
                        </a>
                      </div>
                    );
                  }
                  return (
                    <iframe 
                      src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
                      className="w-full h-full border-0 bg-white"
                      title={selectedPreviewFile.originalName}
                    />
                  );
                } else if (isTxt) {
                  return (
                    <iframe 
                      src={url} 
                      className="w-full h-full border-0 bg-white" 
                      title={selectedPreviewFile.originalName}
                    />
                  );
                } else {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-4 bg-white">
                      <div className="p-4 bg-amber-50 rounded-2xl text-amber-600 border border-amber-100">
                        <FileText size={48} className="mx-auto" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-800 text-lg">Попередній перегляд недоступний</h4>
                        <p className="text-sm text-slate-500 max-w-sm">Файли цього формату ({ext.toUpperCase()}) не підтримують онлайн-перегляд в браузері. Будь ласка, завантажте файл на свій пристрій.</p>
                      </div>
                       <a 
                        href={`http://localhost:5001/api/documents/${doc._id}/files/${selectedPreviewFile.path.split('/').pop()}/download?token=${localStorage.getItem('token')}`}
                        className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
                      >
                        <Download size={16} />
                        Завантажити документ
                      </a>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        </div>
       )}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[75vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <Plus className="text-blue-600" size={20} />
                <span className="font-bold text-slate-800">Додати пов'язаний документ</span>
              </div>
              <button 
                onClick={() => setIsLinkModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                title="Закрити"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Filters */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3">
              <input 
                type="text"
                placeholder="Пошук за назвою або реєстраційним номером..."
                value={linkSearchQuery}
                onChange={(e) => setLinkSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
              />
              <select
                value={linkFilterType}
                onChange={(e) => setLinkFilterType(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white"
              >
                <option value="">Усі типи</option>
                {types.map(t => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-4">
              {fetchingAvailable ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                  <Loader2 className="animate-spin text-blue-600" size={24} />
                  <p className="text-sm">Завантаження документів...</p>
                </div>
              ) : (() => {
                const filtered = availableDocs.filter(d => {
                  const matchesSearch = d.title.toLowerCase().includes(linkSearchQuery.toLowerCase()) || 
                                       d.regNumber.toLowerCase().includes(linkSearchQuery.toLowerCase());
                  const matchesType = !linkFilterType || d.type === linkFilterType;
                  return matchesSearch && matchesType;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <FileText size={48} className="stroke-1 mb-2 text-slate-300" />
                      <p className="text-sm">Документів не знайдено</p>
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <th className="pb-3 pl-4">Рег. Номер</th>
                        <th className="pb-3">Назва</th>
                        <th className="pb-3">Тип</th>
                        <th className="pb-3">Статус</th>
                        <th className="pb-3 pr-4 text-right">Дія</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filtered.map(d => (
                        <tr key={d._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 pl-4 font-bold text-slate-700">{d.regNumber}</td>
                          <td className="py-3 font-semibold text-slate-900 truncate max-w-xs">{d.title}</td>
                          <td className="py-3 text-slate-500">{types.find(t => t.code === d.type)?.name || d.type}</td>
                          <td className="py-3">
                            <span className={cn("px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider", statusColors[d.status] || "bg-slate-100 text-slate-600")}>
                              {translateStatus(d.status)}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <button
                              onClick={async () => {
                                try {
                                  setActionLoading('link');
                                  await API.post(`/documents/${doc._id}/related`, { relatedId: d._id });
                                  await fetchDetails();
                                  setAvailableDocs(prev => prev.filter(item => item._id !== d._id));
                                } catch (err: any) {
                                  alert(err.message || 'Помилка зв\'язування документів');
                                } finally {
                                  setActionLoading(null);
                                }
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all"
                            >
                              Вибрати
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Відхилити документ"
        size="md"
        footer={
          <>
            <button
              onClick={() => setIsRejectModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-bold transition-all"
            >
              Скасувати
            </button>
            <button
              onClick={async () => {
                if (!rejectReason.trim()) {
                  setRejectError('Вкажіть причину відхилення');
                  return;
                }
                if (rejectReason.trim().length < 3) {
                  setRejectError('Причина відхилення занадто коротка (мінімум 3 символи)');
                  return;
                }
                try {
                  setActionLoading('rejected');
                  setIsRejectModalOpen(false);
                  await API.post(`/documents/${id}/reject`, { comment: rejectReason.trim() });
                  await fetchDetails();
                } catch (err: any) {
                  alert(err.message || 'Помилка при відхиленні документа');
                } finally {
                  setActionLoading(null);
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-600/20 transition-all"
            >
              Відхилити
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Причина відхилення <span className="text-red-500">*</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => {
              setRejectReason(e.target.value);
              if (e.target.value.trim()) setRejectError(null);
            }}
            placeholder="Вкажіть, будь ласка, причину, чому документ відхилено..."
            className={cn(
              "w-full h-32 px-4 py-3 border rounded-xl focus:ring-2 outline-none resize-none text-slate-800 text-sm transition-all",
              rejectError 
                ? "border-red-300 focus:ring-red-500/20 focus:border-red-500" 
                : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
            )}
          />
          {rejectError && (
            <p className="text-xs text-red-500 font-semibold">{rejectError}</p>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default DocumentDetails;
