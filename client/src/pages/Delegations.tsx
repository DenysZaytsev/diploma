import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../api/client';
import { 
  Shield, 
  Calendar, 
  Plus, 
  Trash2, 
  Loader2, 
  UserCheck
} from 'lucide-react';

interface Delegation {
  _id: string;
  delegator: { _id: string; fullName: string; email: string; department: string };
  delegate: { _id: string; fullName: string; email: string; department: string };
  department: string;
  role: string;
  dateFrom: string;
  dateTo: string;
  reason?: string;
  isActive: boolean;
}

const Delegations: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [delegateId, setDelegateId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reason, setReason] = useState('');

  const fetchDelegations = async () => {
    try {
      const data = await API.get<Delegation[]>('/delegations');
      setDelegations(data);
    } catch (err: any) {
      console.error('Failed to fetch delegations', err);
    }
  };

  const fetchColleagues = async () => {
    try {
      const allUsers = await API.get<any[]>('/users');
      let filtered = [];
      if (currentUser?.role === 'employee') {
        filtered = allUsers.filter(u => 
          u._id !== currentUser?._id && 
          u.role === 'employee' &&
          u.department === currentUser?.department
        );
      } else {
        filtered = allUsers.filter(u => 
          u._id !== currentUser?._id && 
          u.role === currentUser?.role
        );
      }
      setColleagues(filtered);
      if (filtered.length > 0) setDelegateId(filtered[0]._id);
    } catch (err: any) {
      console.error('Failed to fetch colleagues', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchDelegations(), fetchColleagues()]);
      setLoading(false);
    };
    init();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateId || !dateFrom || !dateTo) {
      setError('Заповніть обов\'язкові поля');
      return;
    }

    setSubmitLoading(true);
    setError(null);

    const fromDate = new Date(dateFrom + 'T00:00:00');
    const toDate = new Date(dateTo + 'T23:59:59');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (fromDate < today) {
      setError('Дата початку не може бути в минулому');
      setSubmitLoading(false);
      return;
    }

    if (toDate <= fromDate) {
      setError('Дата закінчення має бути після дати початку');
      setSubmitLoading(false);
      return;
    }

    try {
      await API.post('/delegations', {
        delegateId,
        dateFrom,
        dateTo,
        reason
      });
      setReason('');
      setDateFrom('');
      setDateTo('');
      await fetchDelegations();
    } catch (err: any) {
      setError(err.message || 'Не вдалося створити делегування');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (confirm('Ви впевнені, що хочете скасувати це делегування?')) {
      try {
        await API.delete(`/delegations/${id}`);
        await fetchDelegations();
      } catch (err: any) {
        alert(err.message || 'Не вдалося скасувати делегування');
      }
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="animate-spin text-blue-600" size={32} />
      <p className="text-slate-400 font-medium">Завантаження...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <Shield size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Тимчасове делегування повноважень</h1>
          <p className="text-slate-500 mt-1 font-medium">Передайте свої права на погодження або підписання документів колегам на час вашої відсутності</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Form */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-900">Створити мандат</h3>
            
            {error && (
              <div className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Оберіть делегата *</label>
                {colleagues.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">
                    {currentUser?.role === 'employee' 
                      ? 'Не знайдено працівників у вашому відділі для делегування' 
                      : 'Не знайдено колег з вашою роллю в компанії'}
                  </p>
                ) : (
                  <select
                    value={delegateId}
                    onChange={(e) => setDelegateId(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white text-slate-800"
                  >
                    {colleagues.map(u => (
                      <option key={u._id} value={u._id}>
                        {u.fullName} ({u.department || 'Без відділу'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Початок *</label>
                  <input 
                    type="date"
                    required
                    value={dateFrom}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Закінчення *</label>
                  <input 
                    type="date"
                    required
                    value={dateTo}
                    min={dateFrom || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Причина делегування</label>
                <textarea 
                  placeholder="Напр. Відрядження, Відпустка..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full h-24 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm resize-none text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={submitLoading || colleagues.length === 0}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
              >
                {submitLoading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                Створити
              </button>
            </form>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-900">Історія мандатів</h3>

            <div className="space-y-4">
              {delegations.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Мандатів на делегування не знайдено</p>
              ) : (
                delegations.map((d) => {
                  const isIncoming = d.delegate._id === currentUser?._id;
                  const isActive = d.isActive && new Date(d.dateFrom) <= new Date() && new Date(d.dateTo) >= new Date();
                  
                  return (
                    <div key={d._id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'
                          }`}>
                            {isActive ? 'Активне' : 'Неактивне'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isIncoming ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {isIncoming ? 'Отримане' : 'Передане'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-500">
                            <UserCheck size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {isIncoming ? `Від: ${d.delegator.fullName}` : `Делеговано: ${d.delegate.fullName}`}
                            </p>
                            <p className="text-xs text-slate-500">
                              Роль: {d.role === 'approver' ? 'Погоджувач' : 'Підписант'} • Відділ: {d.department}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            З {new Date(d.dateFrom).toLocaleDateString('uk-UA')} по {new Date(d.dateTo).toLocaleDateString('uk-UA')}
                          </span>
                          {d.reason && (
                            <span className="flex items-center gap-1 italic">
                              • Причина: {d.reason}
                            </span>
                          )}
                        </div>
                      </div>

                      {!isIncoming && d.isActive && (
                        <button
                          onClick={() => handleCancel(d._id)}
                          className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 self-start md:self-center"
                        >
                          <Trash2 size={14} />
                          Скасувать
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Delegations;
