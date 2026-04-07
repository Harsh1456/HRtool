import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const stored = localStorage.getItem('hr_user')
            return stored ? JSON.parse(stored) : null
        } catch {
            return null
        }
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const token = localStorage.getItem('hr_token')
        if (token) {
            authAPI.me()
                .then((res) => {
                    setUser(res.data)
                    localStorage.setItem('hr_user', JSON.stringify(res.data))
                })
                .catch(() => {
                    localStorage.removeItem('hr_token')
                    localStorage.removeItem('hr_user')
                    setUser(null)
                })
                .finally(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [])

    const login = async (email, password) => {
        const res = await authAPI.login(email, password)
        const { access_token, user: userData } = res.data
        localStorage.setItem('hr_token', access_token)
        localStorage.setItem('hr_user', JSON.stringify(userData))
        setUser(userData)
        return userData
    }

    const register = async (data) => {
        const res = await authAPI.register(data)
        return res.data
    }

    const logout = () => {
        localStorage.removeItem('hr_token')
        localStorage.removeItem('hr_user')
        setUser(null)
        window.location.href = '/login'
    }

    const updateUser = (updated) => {
        setUser(updated)
        localStorage.setItem('hr_user', JSON.stringify(updated))
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
    return ctx
}
