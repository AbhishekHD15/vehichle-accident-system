import { LogOut, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Navbar({ onMenu }) {
  const { user, logout } = useAuth()
  const nav = useNavigate()

  return (
    <header className="flex h-16 items-center justify-between border-b border-app-border bg-white px-4 md:px-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <button
        className="md:hidden text-app-text p-2 -ml-2 rounded-lg hover:bg-slate-100"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>
      <div className="hidden md:block" />
      <div className="flex items-center gap-4">
        <div className="text-right leading-tight">
          <div className="text-sm font-semibold text-app-text">{user.full_name}</div>
          <div className="text-xs text-app-muted">
            {user.role}
            {user.organization ? ` · ${user.organization}` : ''}
          </div>
        </div>
        <button
          className="btn-secondary !px-3 !py-1.5 text-xs font-medium"
          onClick={async () => {
            await logout()
            nav('/login')
          }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </header>
  )
}
