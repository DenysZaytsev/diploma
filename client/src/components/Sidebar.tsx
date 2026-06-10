import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  PlusCircle, 
  Users, 
  Building2, 
  FileCode, 
  Settings, 
  Activity,
  ChevronLeft,
  ChevronRight,
  Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const serverUrl = window.location.port === '5173' ? 'http://localhost:5001' : '';
const getAvatarUrl = (avatar?: string) => {
  if (!avatar) return '';
  return avatar.startsWith('http') ? avatar : `${serverUrl}${avatar}`;
};

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const { user } = useAuth();

  if (!user) return null;

  const navItems = [
    { name: 'Дашборд', path: '/dashboard', icon: LayoutDashboard, roles: ['employee', 'approver', 'signatory', 'admin'] },
    { name: 'Журнал документів', path: '/registry', icon: FileText, roles: ['employee', 'approver', 'signatory'] },
    { name: 'Новий документ', path: '/new-document', icon: PlusCircle, roles: ['employee'] },
    { name: 'Делегування', path: '/delegations', icon: Shield, roles: ['employee', 'approver', 'signatory'] },
    { name: 'Користувачі', path: '/admin/users', icon: Users, roles: ['admin'] },
    { name: 'Відділи', path: '/admin/departments', icon: Building2, roles: ['admin'] },
    { name: 'Типи документів', path: '/admin/types', icon: FileCode, roles: ['admin'] },
    { name: 'Аудит системи', path: '/admin/audit', icon: Activity, roles: ['admin'] },
    { name: 'Налаштування', path: '/admin/settings', icon: Settings, roles: ['admin'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(user.role));

  return (
    <aside 
      className={cn(
        "bg-slate-900 text-white flex flex-col transition-all duration-300 relative z-40 group",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
        {!collapsed && (
          <h1 className="text-xl font-bold tracking-tight text-blue-400">Mini-EDMS</h1>
        )}
        {collapsed && (
           <div className="mx-auto bg-blue-500 w-8 h-8 rounded flex items-center justify-center font-bold">M</div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {filteredItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group/item",
              isActive 
                ? "bg-blue-600/10 text-blue-400 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.3)]" 
                : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <item.icon className={cn("flex-shrink-0 w-5 h-5", collapsed ? "mx-auto" : "mr-3")} />
            {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 bg-slate-800 border border-white/10 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="p-4 border-t border-white/10">
         {!collapsed && (
           <NavLink to="/profile" className="flex items-center gap-3 hover:bg-white/5 p-1.5 rounded-xl transition-all cursor-pointer">
             <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold border border-white/10 overflow-hidden">
               {user.avatar ? <img src={getAvatarUrl(user.avatar)} className="w-full h-full object-cover" /> : user.fullName.charAt(0)}
             </div>
             <div className="flex-1 overflow-hidden">
               <p className="text-sm font-medium truncate">{user.fullName}</p>
               <p className="text-xs text-slate-500 uppercase tracking-wider">{user.role}</p>
             </div>
           </NavLink>
         )}
         {collapsed && (
           <NavLink to="/profile" className="mx-auto w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold border border-white/10 hover:bg-white/5 transition-all cursor-pointer flex">
             {user.avatar ? <img src={getAvatarUrl(user.avatar)} className="w-full h-full object-cover rounded-full" /> : user.fullName.charAt(0)}
           </NavLink>
         )}
      </div>
    </aside>
  );
};

export default Sidebar;
