import { NavLink } from 'react-router-dom'
import { Bell, Car, FileText, LayoutDashboard, ShieldAlert, User as UserIcon, X, History } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const NAV = {
  OWNER: [['/owner', 'Dashboard', LayoutDashboard], ['/accidents', 'Accident history', History], ['/vehicles', 'My vehicles', Car], ['/claims', 'Claims', FileText], ['/notifications', 'Notifications', Bell]],
  FAMILY: [['/family', 'Emergency monitor', ShieldAlert], ['/accidents', 'Events', History], ['/notifications', 'Notifications', Bell]],
  INSURANCE: [['/insurance', 'Dashboard', LayoutDashboard], ['/accidents', 'Accidents', History], ['/claims', 'Claims', FileText], ['/notifications', 'Notifications', Bell]],
  ADMIN: [['/admin', 'Administration', LayoutDashboard], ['/accidents', 'Accidents', History], ['/vehicles', 'Vehicles', Car], ['/claims', 'Claims', FileText], ['/notifications', 'Notifications', Bell]],
}

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth()
  const items = [...(NAV[user.role] || []), ['/profile', 'Profile', UserIcon]]
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-navy-900 text-slate-200 transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between px-5 text-lg font-semibold text-white">
          <span className="flex items-center gap-2"><ShieldAlert size={22} className="text-blue-400" /> SafeDrive</span>
          <button className="lg:hidden" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>
        <nav className="space-y-1 px-3 py-2">
          {items.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} onClick={onClose} end
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-navy-700 text-white' : 'hover:bg-navy-800'}`}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
