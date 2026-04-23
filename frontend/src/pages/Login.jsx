import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { MessageSquare, Eye, EyeOff, Loader2 } from 'lucide-react'
import { loginWithMicrosoft as msRedirect, handleMicrosoftCallback } from '../lib/microsoftAuth'

export default function Login() {
    const { login, register, loginWithMicrosoft } = useAuth()
    const navigate = useNavigate()
    const [mode, setMode] = useState('login') // 'login' | 'register'
    const [showPw, setShowPw] = useState(false)
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({ email: '', password: '', full_name: '' })
    const callbackProcessed = useRef(false)

    // Handle Microsoft OAuth PKCE Callback
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const state = urlParams.get('state')

        if (code && state && !callbackProcessed.current) {
            callbackProcessed.current = true
            setLoading(true)
            const tid = toast.loading('Authenticating with Microsoft...')
            
            handleMicrosoftCallback(code, state)
                .then(tokens => loginWithMicrosoft(tokens.id_token))
                .then(() => {
                    toast.success('Signed in successfully', { id: tid })
                    // Remove code from URL
                    window.history.replaceState({}, document.title, window.location.pathname)
                    navigate('/')
                })
                .catch(err => {
                    toast.error(err.message || 'Microsoft login failed', { id: tid })
                    setLoading(false)
                    window.history.replaceState({}, document.title, window.location.pathname)
                })
        }
    }, [loginWithMicrosoft, navigate])

    const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

    const handleEmailSubmit = async (e) => {
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

    const handleMSClick = async () => {
        try {
            await msRedirect()
        } catch (err) {
            toast.error(err.message || 'Could not start Microsoft login')
        }
    }

    return (
        <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <div className="flex flex-col items-center justify-center gap-1">
                        <img src="/logo.png" alt="Logo" className="h-16 w-auto object-contain flex-shrink-0" />
                        <span className="text-sm font-bold text-gray-500 tracking-wider">Human Resources</span>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
                    <h1 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">
                        {mode === 'login' ? 'Welcome back' : 'Create your account'}
                    </h1>
                    <p className="text-sm text-gray-500 mb-6">
                        {mode === 'login'
                            ? 'Sign in to access your HR assistant'
                            : 'Set up your HR Assist account'}
                    </p>

                    {/* Microsoft SSO Button */}
                    <button 
                        onClick={handleMSClick}
                        disabled={loading}
                        type="button" 
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-sm text-gray-700 font-medium disabled:opacity-50 min-h-[44px]"
                    >
                        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 21 21">
                            <path fill="#f25022" d="M1 1h9v9H1z" />
                            <path fill="#7fba00" d="M11 1h9v9h-9z" />
                            <path fill="#00a4ef" d="M1 11h9v9H1z" />
                            <path fill="#ffb900" d="M11 11h9v9h-9z" />
                        </svg>
                        <span className="text-sm sm:text-base">Continue with Microsoft</span>
                    </button>

                    <div className="flex items-center my-6">
                        <div className="flex-grow border-t border-gray-100"></div>
                        <span className="px-3 text-xs text-gray-400 font-medium uppercase tracking-wider">or sign in with email</span>
                        <div className="flex-grow border-t border-gray-100"></div>
                    </div>

                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                        {mode === 'register' && (
                            <div>
                                <label htmlFor="full_name" className="label">Full Name</label>
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
                            <label htmlFor="email" className="label">Email address</label>
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
                            <label htmlFor="password" className="label">Password</label>
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
