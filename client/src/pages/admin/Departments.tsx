import React, { useEffect, useState, useCallback } from 'react';
import { API } from '../../api/client';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit3,
  Search,
  Loader2,
  RotateCcw
} from 'lucide-react';
import DepartmentModal from '../../components/admin/DepartmentModal';
import ConfirmModal from '../../components/ConfirmModal';
import Pagination from '../../components/Pagination';

interface Department {
  _id: string;
  name: string;
  description: string;
}

const Departments: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    action: () => Promise<void> | void;
  }>({ isOpen: false, message: '', action: () => {} });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await API.get<Department[]>('/departments');
      setDepartments(data);
    } catch (e) {
      console.error('Failed to fetch departments', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const filteredDepts = departments.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredDepts.length / itemsPerPage);
  const paginatedDepts = filteredDepts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSave = async (deptData: { name: string; description: string }) => {
    if (editingDept) {
      await API.patch(`/departments/${editingDept._id}`, deptData);
    } else {
      await API.post('/departments', deptData);
    }
    await fetchDepartments();
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      message: `Ви впевнені, що хочете видалити відділ "${name}"?`,
      action: async () => {
        try {
          await API.delete(`/departments/${id}`);
          await fetchDepartments();
        } catch (e: any) {
          alert(e.message || 'Помилка видалення');
        }
      }
    });
  };

  const openAddModal = () => {
    setEditingDept(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Відділи</h1>
          <p className="text-slate-500 mt-1 font-medium">Організаційна структура компанії</p>
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all font-heading"
        >
          <Plus size={18} />
          Додати відділ
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Пошук відділів..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
          />
        </div>
        <button 
          onClick={() => {
            setSearchQuery('');
            setCurrentPage(1);
          }}
          className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center font-bold"
          title="Скинути пошук"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Назва відділу</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Опис</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                   <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                         <Loader2 className="animate-spin text-blue-600" size={24} />
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Завантаження...</p>
                      </div>
                   </td>
                </tr>
              ) : paginatedDepts.length === 0 ? (
                <tr>
                   <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-medium italic">Відділів не знайдено</td>
                </tr>
              ) : paginatedDepts.map((dept) => (
                <tr key={dept._id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                        <Building2 size={18} />
                      </div>
                      <span className="text-sm font-bold text-slate-900">{dept.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-500 max-w-md truncate md:whitespace-normal md:line-clamp-2">
                       {dept.description || '—'}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => openEditModal(dept)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                        title="Редагувати"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(dept._id, dept.name)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                        title="Видалити"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredDepts.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      <DepartmentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        department={editingDept}
      />

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.action}
        message={confirmModal.message}
      />
    </div>
  );
};

export default Departments;
