import React, { useEffect, useState, useCallback } from 'react';
import { API } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, 
  Trash2, 
  Edit3,
  Search,
  Lock,
  Unlock,
  Key,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Download
} from 'lucide-react';
import UserModal from '../../components/admin/UserModal';
import type { User } from '../../components/admin/UserModal';
import PasswordModal from '../../components/admin/PasswordModal';
import Pagination from '../../components/Pagination';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Users: React.FC = () => {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Modals state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, deptsData] = await Promise.all([
        API.get<User[]>('/users'),
        API.get<{name: string}[]>('/departments')
      ]);
      setUsers(usersData);
      setDepartments(deptsData.map(d => d.name));
    } catch (e) {
      console.error('Failed to fetch users data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter ? u.role === roleFilter : true;
    const matchesDept = deptFilter ? u.department === deptFilter : true;
    return matchesSearch && matchesRole && matchesDept;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSaveUser = async (userData: Partial<User>) => {
    if (selectedUser?._id) {
      await API.patch(`/users/${selectedUser._id}`, userData);
    } else {
      await API.post('/users', userData);
    }
    await fetchData();
  };

  const handleUpdatePassword = async (password: string) => {
    if (selectedUser?._id) {
      await API.patch(`/users/${selectedUser._id}`, { password });
    }
  };

  const handleToggleBlock = async (user: User) => {
    const action = user.isBlocked ? 'розблокувати' : 'заблокувати';
    if (confirm(`Ви впевнені, що хочете ${action} користувача ${user.fullName}?`)) {
      await API.patch(`/users/${user._id}`, { isBlocked: !user.isBlocked });
      await fetchData();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Ви впевнені, що хочете видалити користувача "${name}"? Ця дія незворотня.`)) {
      try {
        await API.delete(`/users/${id}`);
        await fetchData();
      } catch (e: any) {
        alert(e.message || 'Помилка видалення');
      }
    }
  };

  const openAddModal = () => {
    setSelectedUser(null);
    setIsUserModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setSelectedUser(u);
    setIsUserModalOpen(true);
  };

  const openPwdModal = (u: User) => {
    setSelectedUser(u);
    setIsPwdModalOpen(true);
  };

  const roleLabels: Record<string, string> = {
    'employee': 'Працівник',
    'approver': 'Керівник',
    'signatory': 'Підписант',
    'admin': 'Адміністратор'
  };

  const roleColors: Record<string, string> = {
    'employee': 'bg-blue-50 text-blue-700 border-blue-100',
    'approver': 'bg-purple-50 text-purple-700 border-purple-100',
    'signatory': 'bg-green-50 text-green-700 border-green-100',
    'admin': 'bg-red-50 text-red-700 border-red-100'
  };

  const fullCurrentUser = users.find(u => u.email === authUser?.email) || authUser;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Користувачі</h1>
          <p className="text-slate-500 mt-1 font-medium">Керування обліковими записами та правами доступу</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (filteredUsers.length === 0) return;
              const headers = ['ПІБ', 'Email', 'Роль', 'Відділ', 'Статус'];
              const rows = filteredUsers.map(u => [
                u.fullName,
                u.email,
                roleLabels[u.role] || u.role,
                u.department || '',
                u.isBlocked ? 'Заблокований' : 'Активний'
              ]);
              const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.setAttribute('href', url);
              link.setAttribute('download', `users_export_${new Date().toISOString().slice(0,10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <Download size={18} />
            Експорт CSV
          </button>
          <button 
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
          >
            <Plus size={18} />
            Новий користувач
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Пошук за ім'ям або email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
          />
        </div>
        <select 
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
        >
          <option value="">Всі ролі</option>
          {Object.entries(roleLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>
        <select 
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
        >
          <option value="">Всі відділи</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button 
          onClick={() => {
            setSearchQuery('');
            setRoleFilter('');
            setDeptFilter('');
            setCurrentPage(1);
          }}
          className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center"
          title="Скинути фільтри"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Користувач</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Роль</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Відділ</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Статус</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                   <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                         <Loader2 className="animate-spin text-blue-600" size={24} />
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Завантаження...</p>
                      </div>
                   </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium italic">Користувачів не знайдено</td>
                </tr>
              ) : paginatedUsers.map((u) => {
                const isSelf = u.email === fullCurrentUser?.email;
                const amISuperAdmin = fullCurrentUser?.isSuperAdmin;
                const isSuperAdmin = u.isSuperAdmin;
                const isAdmin = u.role === 'admin';
                
                // Permission logic
                const canEdit = !isSuperAdmin || isSelf;
                const canManagePassword = amISuperAdmin || (isAdmin && !isSuperAdmin && u.role !== 'admin');
                const canDelete = !isSelf && !isSuperAdmin && !(isAdmin && !amISuperAdmin);
                const canBlock = canDelete;

                return (
                  <tr key={u._id} className={cn(
                    "hover:bg-slate-50 transition-colors group",
                    u.isBlocked && "bg-slate-50/50 grayscale-[0.5]"
                  )}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200 shadow-sm overflow-hidden ring-2 ring-white group-hover:ring-blue-100 transition-all">
                           {u.fullName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            {u.fullName}
                            {isSuperAdmin && <Shield size={12} className="text-indigo-600" />}
                            {isSelf && <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Це ви</span>}
                          </p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
                        isSuperAdmin ? "bg-indigo-600 text-white border-indigo-700 shadow-sm" : roleColors[u.role]
                      )}>
                        {isSuperAdmin ? 'Chief Admin' : roleLabels[u.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600 font-medium">{u.department || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-1.5">
                          {u.isBlocked ? (
                            <div className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight border border-red-100">
                               <XCircle size={12} />
                               Заблокований
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight border border-green-100">
                               <CheckCircle2 size={12} />
                               Активний
                            </div>
                          )}
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManagePassword && (
                          <button 
                            onClick={() => openPwdModal(u)}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg transition-all"
                            title="Змінити пароль"
                          >
                            <Key size={18} />
                          </button>
                        )}
                        {canBlock && (
                          <button 
                            onClick={() => handleToggleBlock(u)}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              u.isBlocked ? "text-green-500 hover:bg-green-50" : "text-amber-500 hover:bg-amber-50"
                            )}
                            title={u.isBlocked ? "Розблокувати" : "Заблокувати"}
                          >
                            {u.isBlocked ? <Unlock size={18} /> : <Lock size={18} />}
                          </button>
                        )}
                        {canEdit && (
                          <button 
                            onClick={() => openEditModal(u)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                            title="Редагувати"
                          >
                            <Edit3 size={18} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(u._id!, u.fullName)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                            title="Видалити"
                          >
                            <Trash2 size={18} />
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

        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredUsers.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      <UserModal 
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
        user={selectedUser}
        departments={departments}
        currentUser={fullCurrentUser || null}
      />

      <PasswordModal 
        isOpen={isPwdModalOpen}
        onClose={() => setIsPwdModalOpen(false)}
        onSave={handleUpdatePassword}
        userName={selectedUser?.fullName || ''}
      />
    </div>
  );
};

export default Users;
