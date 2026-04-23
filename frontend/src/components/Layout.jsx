import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    MessageSquare, FileText, Mail, UserCheck, BarChart2,
    Folder, Settings, Search, ChevronDown, LogOut, User as UserIcon, HomeIcon
} from 'lucide-react'

const navItems = [
    { to: '/', icon: HomeIcon, label: 'Dashboard' },
    { to: '/insights', icon: BarChart2, label: 'Insights' },
    { to: '/ask', icon: MessageSquare, label: 'Ask HRDocs' },
    { to: '/jd', icon: FileText, label: 'JD Builder' },
    { to: '/offer', icon: Mail, label: 'Offer Letter' },
    { to: '/resume', icon: UserCheck, label: 'Resume' },
    { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const initials = user?.full_name 
        ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) 
        : 'HR'
    const firstName = user?.full_name 
        ? user.full_name.split(' ')[0] 
        : (user?.email?.split('@')[0] || 'User')

    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [showTopMenu, setShowTopMenu] = useState(false)
    const [showBottomMenu, setShowBottomMenu] = useState(false)

    // A generic dropdown menu used for both profile buttons
    const ProfileMenu = ({ onLogout, onSettings }) => (
        <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 overflow-hidden transform origin-bottom-right">
            <div className="px-4 py-2 border-b border-gray-50 mb-1">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
                onClick={onSettings}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
                <UserIcon size={14} /> My Profile
            </button>
            <button
                onClick={onLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
                <LogOut size={14} /> Log Out
            </button>
        </div>
    )

    const TopProfileMenu = ({ onLogout, onSettings }) => (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 overflow-hidden transform origin-top-right">
            <div className="px-4 py-2 border-b border-gray-50 mb-1">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
                onClick={onSettings}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
                <UserIcon size={14} /> My Profile
            </button>
            <button
                onClick={onLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
                <LogOut size={14} /> Log Out
            </button>
        </div>
    )


    return (
        <div className="flex h-screen overflow-hidden bg-[#f4f6f8]">
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/40 z-[45] lg:hidden backdrop-blur-sm animate-in fade-in duration-300"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* ── Sidebar ──────────────────────────────────────────────── */}
            <aside
                className={`flex-shrink-0 bg-white border-r border-gray-100 flex flex-col transition-all duration-300 z-50 ease-in-out 
                    fixed inset-y-0 left-0 transform lg:static lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} 
                    ${isSidebarExpanded ? 'w-64' : 'w-16 lg:w-16'} ${isMobileMenuOpen ? 'w-64' : ''}`}
                onMouseEnter={() => !isMobileMenuOpen && setIsSidebarExpanded(true)}
                onMouseLeave={() => {
                    if (!isMobileMenuOpen) {
                        setIsSidebarExpanded(false)
                        setShowBottomMenu(false)
                    }
                }}
            >
                {/* Logo & Mobile Close */}
                <div
                    className={`py-5 border-b border-gray-100 flex items-center justify-between transition-opacity ${isSidebarExpanded || isMobileMenuOpen ? 'px-5' : 'px-0 justify-center'}`}
                >
                    <div className="flex flex-col items-center justify-center gap-1 cursor-pointer" onClick={() => { navigate('/'); setIsMobileMenuOpen(false); }}>
                        <img 
                            src={(isSidebarExpanded || isMobileMenuOpen) ? "/logo.png" : "/favicon.png"} 
                            alt="Logo" 
                            className={`w-auto object-contain flex-shrink-0 transition-all duration-300 ${isSidebarExpanded || isMobileMenuOpen ? 'h-10' : 'h-8'}`} 
                        />
                        {(isSidebarExpanded || isMobileMenuOpen) && (
                            <span className="text-[11px] font-bold text-gray-500 whitespace-nowrap animate-fade-in tracking-wider">Human Resources</span>
                        )}
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
                    {navItems.map(({ to, icon: Icon, label, badge }) => (
                        <NavLink
                            key={to}
                            to={to}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={({ isActive }) =>
                                `flex items-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium text-sm transition-colors duration-100 cursor-pointer ${isActive ? 'bg-primary-50 text-primary-700 hover:bg-primary-50 hover:text-primary-700' : ''
                                } ${(isSidebarExpanded || isMobileMenuOpen) ? 'px-3 py-2.5 gap-3' : 'justify-center py-3'}`
                            }
                            title={!(isSidebarExpanded || isMobileMenuOpen) ? label : undefined}
                        >
                            <Icon size={(isSidebarExpanded || isMobileMenuOpen) ? 17 : 20} className="flex-shrink-0" />
                            {(isSidebarExpanded || isMobileMenuOpen) && (
                                <>
                                    <span className="flex-1 whitespace-nowrap animate-fade-in">{label}</span>
                                    {badge && (
                                        <span className="text-[10px] text-gray-400 font-normal whitespace-nowrap">({badge})</span>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* User - Bottom Left */}
                <div className={`px-4 py-4 border-t border-gray-100 relative ${(isSidebarExpanded || isMobileMenuOpen) ? '' : 'flex justify-center px-0'}`}>
                    <button
                        onClick={() => (isSidebarExpanded || isMobileMenuOpen) && setShowBottomMenu(!showBottomMenu)}
                        className={`flex items-center gap-3 w-full text-left rounded-lg transition-colors ${(isSidebarExpanded || isMobileMenuOpen) ? 'hover:bg-gray-50 p-2 -mx-2' : ''}`}
                        title={!(isSidebarExpanded || isMobileMenuOpen) ? "Expand to see profile" : undefined}
                    >
                        <div className="w-9 h-9 rounded-full bg-primary-700 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            {initials}
                        </div>
                        {(isSidebarExpanded || isMobileMenuOpen) && (
                            <div className="min-w-0 flex-1 flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{user?.full_name}</p>
                                    <p className="text-xs text-gray-500 truncate">HR</p>
                                </div>
                                <ChevronDown size={14} className="text-gray-400" />
                            </div>
                        )}
                    </button>

                    {showBottomMenu && (isSidebarExpanded || isMobileMenuOpen) && (
                        <ProfileMenu
                            onLogout={logout}
                            onSettings={() => { setShowBottomMenu(false); navigate('/settings'); setIsMobileMenuOpen(false); }}
                        />
                    )}
                </div>
            </aside>

            {/* ── Main area ────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
                {/* Top bar */}
                <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-[var(--header-height)] flex items-center gap-4 flex-shrink-0 relative z-20">
                    <button 
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="lg:hidden p-1.5 -ml-1 text-gray-500 hover:bg-gray-100 rounded-lg touch-target"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    <div className="flex-1 relative max-w-xl hidden lg:block">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <label htmlFor="global_search" className="sr-only">Search</label>
                        <input
                            id="global_search"
                            name="global_search"
                            type="text"
                            placeholder="Search..."
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>

                    <div className="flex lg:hidden items-center gap-2">
                        <img src="/favicon.png" alt="Logo" className="w-6 h-6 object-contain" />
                        <span className="text-sm font-bold text-gray-900">HR Assist</span>
                    </div>
                    <div className="ml-auto relative z-50">
                        <button
                            onClick={() => setShowTopMenu(!showTopMenu)}
                            onBlur={() => setTimeout(() => setShowTopMenu(false), 200)}
                            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-50 transition border border-transparent focus:ring-2 focus:ring-primary-100"
                        >
                            <div className="w-7 h-7 rounded-full bg-primary-700 text-white flex items-center justify-center font-semibold text-xs text-center flex-shrink-0">
                                {initials}
                            </div>
                            <span className="text-sm font-medium text-gray-700 hidden sm:block">
                                {firstName}
                            </span>
                            <ChevronDown size={14} className="text-gray-400" />
                        </button>
                        {showTopMenu && (
                            <TopProfileMenu
                                onLogout={logout}
                                onSettings={() => { setShowTopMenu(false); navigate('/settings'); }}
                            />
                        )}
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
