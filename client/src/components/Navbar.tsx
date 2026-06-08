import React from 'react';
import { Bell, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, NavLink } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API } from '../api/client';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (user?._id) {
        // Initial fetch
        API.get<any[]>('/notifications?limit=10').then(data => setNotifications(data)).catch(() => {});

        const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:5001'
          : window.location.origin;
        const socket = io(socketUrl);
        socket.emit('register', user._id);

        socket.on('notification', (newNotif) => {
            setNotifications(prev => [newNotif, ...prev.slice(0, 9)]);
            // Optional: Audio cue or toast
        });

        return () => {
            socket.disconnect();
        };
    }
  }, [user?._id]);

  if (!user) return null;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-30">
      <div className="flex items-center flex-1">
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors relative"
          >
            <Bell size={20} />
            {notifications.some(n => !n.isRead) && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm shadow-red-500/50"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200">
               <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Сповіщення</h3>
                  <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={16} />
                  </button>
               </div>
               <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic text-sm">Немає нових сповіщень</div>
                  ) : notifications.map(n => (
                    <div 
                      key={n._id} 
                      onClick={() => {
                        // Mark as read in backend
                        API.patch(`/notifications/${n._id}/read`, {})
                          .then(() => {
                            // Update local state to show it is read
                            setNotifications(prev => prev.map(item => item._id === n._id ? { ...item, isRead: true } : item));
                          })
                          .catch(() => {});
                        
                        // Close notifications dropdown
                        setShowNotifications(false);
                        
                        // Redirect to the document details if documentId exists
                        if (n.documentId) {
                          navigate(`/document/${n.documentId}`);
                        }
                      }}
                      className={cn(
                        "p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer",
                        !n.isRead && "bg-blue-50/30"
                      )}
                    >
                       <p className="text-xs font-bold text-blue-600 uppercase tracking-tighter mb-1">{n.title}</p>
                       <p className={cn(
                          "text-sm leading-tight transition-all",
                          !n.isRead ? "text-slate-900 font-bold" : "text-slate-500 font-normal"
                        )}>
                          {n.message}
                       </p>
                       <p className="text-[10px] text-slate-400 mt-2">{new Date(n.createdAt).toLocaleString('uk-UA')}</p>
                    </div>
                  ))}
               </div>
               <div className="p-3 text-center border-t border-slate-100">
                  <button 
                    onClick={async () => {
                      try {
                        await API.post('/notifications/read-all', {});
                        setNotifications(prev => prev.map(item => ({ ...item, isRead: true })));
                      } catch (err) {
                        console.error('Failed to mark all as read', err);
                      }
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest"
                  >
                    Очистити все
                  </button>
               </div>
            </div>
          )}
        </div>
        
        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>

        <div className="flex items-center gap-3">
           <NavLink to="/profile" className="text-right hidden sm:block hover:underline cursor-pointer">
             <p className="text-sm font-semibold text-slate-900 leading-none">{user.fullName}</p>
             <p className="text-[11px] text-slate-500 font-medium uppercase mt-1 tracking-wider">{user.role}</p>
           </NavLink>
           <button 
             onClick={logout}
             className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
             title="Вийти"
           >
             <LogOut size={20} />
           </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
