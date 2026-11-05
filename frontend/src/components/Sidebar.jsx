import { NavLink } from 'react-router-dom'
import { Bell, Car, FileText, LayoutDashboard, ShieldAlert, User as UserIcon, X, History } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import Logo from './Logo'

const NAV = {
  OWNER: [
    ['/owner', 'Dashboard', LayoutDashboard],
    ['/accidents', 'Accident history', History],
    ['/vehicles', 'My vehicles', Car],
    ['/claims', 'Claims', FileText],
    ['/notifications', 'Notifications', Bell],
  ],
  FAMILY: [
    ['/family', 'Emergency monitor', ShieldAlert],
    ['/accidents', 'Events', History],
    ['/notifications', 'Notifications', Bell],
  ],
  INSURANCE: [
    ['/insurance', 'Dashboard', LayoutDashboard],
    ['/accidents', 'Accidents', History],
    ['/claims', 'Claims', FileText],
    ['/notifications', 'Notifications', Bell],
  ],
  ADMIN: [
    ['/admin', 'Administration', LayoutDashboard],
    ['/accidents', 'Accidents', History],
    ['/vehicles', 'Vehicles', Car],
    ['/claims', 'Claims', FileText],
    ['/notifications', 'Notifications', Bell],
  ],
}

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth()
  const items = [...(NAV[user.role] || []), ['/profile', 'Profile', UserIcon]]

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-sidebar-bg text-sidebar-text transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5 text-lg font-semibold text-white border-b border-white/5">
          <span className="flex items-center gap-2.5">
            <Logo size={24} className="text-white" />
            <span className="tracking-tight text-white font-bold">CrashSense</span>
          </span>
          <button
            className="md:hidden text-sidebar-text hover:text-white p-1 rounded-md"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {items.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-sidebar-active text-white border-l-[3px] border-sidebar-accent font-medium shadow-sm'
                    : 'border-l-[3px] border-transparent hover:bg-sidebar-hover hover:text-white'
                }`
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
