import React, { useEffect, useState } from 'react';
import { API } from '../api/client';
import { 
  FileText, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Inbox, 
  Send, 
  History,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Stats {
  totalDocs: number;
  inProgressDocs: number;
  incomingDocs: number;
  outgoingDocs: number;
  internalDocs: number;
  statusDraft: number;
  statusOnApproval: number;
  statusOnSigning: number;
  statusSigned: number;
  statusRejected: number;
  statusArchived: number;
  overdueDocs: number;
  avgApprovalTime: number | null;
  rejectionRate: number | null;
  recentActivity: any[];
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await API.get<Stats>('/stats');
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  if (!stats) return <div>Помилка завантаження статистики</div>;

  const statCards = [
    { label: 'Всього документів', value: stats.totalDocs, icon: FileText, color: 'text-slate-900', bg: 'bg-white', link: '/registry?myDocs=true' },
    { label: 'В роботі', value: stats.inProgressDocs, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50/50', link: '/registry?myDocs=true&inProgress=true' },
    { label: 'Прострочені', value: stats.overdueDocs, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', link: '/registry?myDocs=true&overdue=true', hide: stats.overdueDocs === 0 },
    { label: 'Підписано', value: stats.statusSigned, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50/50', link: '/registry?myDocs=true&status=signed' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Дашборд</h1>
        <p className="text-slate-500 mt-1">Огляд активності та ключові показники системи</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => !card.hide && (
          <Link 
            key={idx} 
            to={card.link}
            className={`${card.bg} p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${card.bg.replace('/50', '')} border border-slate-100`}>
                <card.icon className={card.color} size={24} />
              </div>
              <ArrowRight className="text-slate-300 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" size={20} />
            </div>
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Direction Stats */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 font-heading">Напрямки документів</h3>
            <div className="grid grid-cols-3 gap-4">
               {[
                 { label: 'Вхідні', value: stats.incomingDocs, icon: Inbox, color: 'text-blue-600', bg: 'bg-blue-50' },
                 { label: 'Вихідні', value: stats.outgoingDocs, icon: Send, color: 'text-orange-600', bg: 'bg-orange-50' },
                 { label: 'Внутрішні', value: stats.internalDocs, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' }
               ].map((dir, i) => (
                 <div key={i} className={`${dir.bg} p-4 rounded-xl border border-transparent hover:border-slate-200 transition-colors`}>
                    <dir.icon size={20} className={`${dir.color} mb-2`} />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{dir.label}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{dir.value}</p>
                 </div>
               ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Secondary Statuses */}
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Додаткові статуси</h3>
                <div className="space-y-3">
                   {[
                     { label: 'Чернетки', value: stats.statusDraft, color: 'bg-slate-100 text-slate-600', status: 'draft' },
                     { label: 'На погодженні', value: stats.statusOnApproval, color: 'bg-amber-100 text-amber-700', status: 'on_approval' },
                     { label: 'На підписанні', value: stats.statusOnSigning, color: 'bg-indigo-100 text-indigo-700', status: 'on_signing' },
                     { label: 'Відхилено', value: stats.statusRejected, color: 'bg-red-100 text-red-700', status: 'rejected' }
                   ].map((s, i) => (
                     <Link 
                       key={i} 
                       to={`/registry?myDocs=true&status=${s.status}`}
                       className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors"
                     >
                        <span className="text-sm font-medium text-slate-700">{s.label}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.color}`}>{s.value}</span>
                     </Link>
                   ))}
                </div>
             </div>

             {/* Analytics */}
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Аналітика</h3>
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <TrendingUp size={16} />
                        <span className="text-sm font-medium">Сер. час погодження</span>
                      </div>
                      <p className="text-2xl font-bold text-indigo-600">{stats.avgApprovalTime ?? '—'} <span className="text-sm font-normal text-slate-400">год</span></p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <XCircle size={16} />
                        <span className="text-sm font-medium">Рівень відхилення</span>
                      </div>
                      <p className={`text-2xl font-bold ${stats.rejectionRate && stats.rejectionRate > 30 ? 'text-red-600' : 'text-slate-900'}`}>{stats.rejectionRate ?? '—'} <span className="text-sm font-normal text-slate-400">%</span></p>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History size={20} className="text-blue-600" />
              Остання активність
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[600px]">
            {stats.recentActivity.map((activity, i) => (
              <div key={i} className="relative pl-6 border-l-2 border-slate-100 pb-1 last:pb-0">
                <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-white border-2 border-blue-500"></div>
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-bold text-slate-900">{activity.user?.fullName || 'Система'}</p>
                  <span className="text-[10px] font-medium text-slate-400 uppercase">{new Date(activity.createdAt).toLocaleDateString('uk-UA')}</span>
                </div>
                <p className="text-sm text-slate-600">
                   {activity.action === 'status_change' 
                     ? (
                       <>
                         Змінено статус на <strong className="font-bold text-slate-900">{
                           activity.toStatus === 'draft' ? 'Чернетка' :
                           activity.toStatus === 'on_approval' ? 'На погодженні' :
                           activity.toStatus === 'on_signing' ? 'На підписанні' :
                           activity.toStatus === 'signed' ? 'Підписано' :
                           activity.toStatus === 'rejected' ? 'Відхилено' :
                           activity.toStatus === 'archived' ? 'В архіві' : activity.toStatus || ''
                         }</strong>
                       </>
                     )
                     : activity.action === 'create' ? <strong className="font-bold text-slate-900">Створено документ</strong>
                     : activity.action === 'update' ? <strong className="font-bold text-slate-900">Оновлено документ</strong>
                     : activity.action === 'comment' ? <strong className="font-bold text-slate-900">Додано коментар</strong>
                     : activity.action === 'file_upload' ? <strong className="font-bold text-slate-900">Завантажено файли</strong>
                     : activity.action === 'file_delete' ? <strong className="font-bold text-slate-900">Вилучено файл</strong>
                     : <strong className="font-bold text-slate-900">{activity.action}</strong>
                   }
                </p>
                {activity.document && (
                  <Link 
                    to={`/document/${activity.document._id}`}
                    className="mt-2 inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Документ #{activity.document.regNumber}
                    <ArrowRight size={12} className="ml-1" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
