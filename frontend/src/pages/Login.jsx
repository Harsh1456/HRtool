import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { MessageSquare, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function Login() {
    const { login, register } = useAuth()
    const navigate = useNavigate()
    const [mode, setMode] = useState('login') // 'login' | 'register'
    const [showPw, setShowPw] = useState(false)
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({ email: '', password: '', full_name: '' })

    const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (mode === 'register' && !form.email.toLowerCase().endsWith('@superiorpaving.net')) {
            toast.error('Only @superiorpaving.net emails are allowed to register.')
            return
        }
        setLoading(true)
        try {
            if (mode === 'login') {
                await login(form.email, form.password)
                navigate('/')
            } else {
                await register({ email: form.email, password: form.password, full_name: form.full_name })
                toast.success('Account created! Please log in.')
                setMode('login')
            }
        } catch (err) {
            const msg = err.response?.data?.detail || 'Something went wrong. Please try again.'
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Logo" className="h-16 w-auto object-contain flex-shrink-0" />
                        <span className="text-xl font-medium text-gray-500">HR</span>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <h1 className="text-xl font-semibold text-gray-900 mb-1">
                        {mode === 'login' ? 'Welcome back' : 'Create your account'}
                    </h1>
                    <p className="text-sm text-gray-500 mb-6">
                        {mode === 'login'
                            ? 'Sign in to access your HR assistant'
                            : 'Set up your HR Assist account'}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'register' && (
                            <div>
                                <label className="label">Full Name</label>
                                <input
                                    type="text"
                                    name="full_name"
                                    id="full_name"
                                    required
                                    className="input"
                                    placeholder="Jane Smith"
                                    value={form.full_name}
                                    onChange={update('full_name')}
                                />
                            </div>
                        )}

                        <div>
                            <label className="label">Email address</label>
                            <input
                                type="email"
                                name="email"
                                id="email"
                                required
                                className="input"
                                placeholder="john@superiorpaving.net"
                                value={form.email}
                                onChange={update('email')}
                            />
                        </div>

                        <div>
                            <label className="label">Password</label>
                            <div className="relative">
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    name="password"
                                    id="password"
                                    required
                                    className="input pr-10"
                                    placeholder="••••••••"
                                    minLength={6}
                                    value={form.password}
                                    onChange={update('password')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full justify-center py-3 text-base mt-2"
                        >
                            {loading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : mode === 'login' ? (
                                'Sign In'
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-500">
                        {mode === 'login' ? (
                            <>
                                Don&apos;t have an account?{' '}
                                <button
                                    onClick={() => setMode('register')}
                                    className="text-primary-700 font-medium hover:underline"
                                >
                                    Sign up
                                </button>
                            </>
                        ) : (
                            <>
                                Already have an account?{' '}
                                <button
                                    onClick={() => setMode('login')}
                                    className="text-primary-700 font-medium hover:underline"
                                >
                                    Sign in
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <p className="text-center text-xs text-gray-400 mt-6">
                    Secure HR AI — Powered by GPT-4o + RAG
                </p>
            </div>
        </div>
    )
}
