import { LogOut, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Navbar({ onMenu }) {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4">
      <button className="lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu size={22} /></button>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-4">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium">{user.full_name}</div>
          <div className="text-xs text-slate-500">{user.role}{user.organization ? ` · ${user.organization}` : ''}</div>
        </div>
        <button className="btn-secondary !px-3" onClick={async () => { await logout(); nav('/login') }}><LogOut size={16} /> Sign out</button>
      </div>
    </header>
  )
}
