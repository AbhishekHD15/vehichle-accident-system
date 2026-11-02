import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
export const useAuth = () => useContext(AuthContext)
export const homePathFor = (role) =>
  ({ OWNER: '/owner', FAMILY: '/family', INSURANCE: '/insurance', ADMIN: '/admin' }[role] || '/login')
