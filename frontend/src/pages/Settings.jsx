import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../api'
import toast from 'react-hot-toast'
import { User, Lock, Save, Loader2, Shield, Bell, ShieldCheck, Mail } from 'lucide-react'

export default function Settings() {
    const { user, updateUser } = useAuth()

    const [profile, setProfile] = useState({ full_name: user?.full_name || '' })
    const [savingProfile, setSavingProfile] = useState(false)

    const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
    const [savingPw, setSavingPw] = useState(false)

    const handleProfileSave = async (e) => {
        e.preventDefault()
        setSavingProfile(true)
        try {
            const res = await authAPI.updateProfile({ full_name: profile.full_name })
            updateUser(res.data)
            toast.success('Profile updated!')
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Update failed')
        } finally {
            setSavingProfile(false)
        }
    }

    const handlePasswordChange = async (e) => {
        e.preventDefault()
        if (pwForm.new_password !== pwForm.confirm_password) {
            toast.error('New passwords do not match')
            return
        }
        if (pwForm.new_password.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }
        setSavingPw(true)
        try {
            await authAPI.changePassword({
                current_password: pwForm.current_password,
                new_password: pwForm.new_password,
            })
            toast.success('Password changed successfully!')
            setPwForm({ current_password: '', new_password: '', confirm_password: '' })
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Password change failed')
        } finally {
            setSavingPw(false)
        }
    }

    return (
        <div className="max-w-6xl mx-auto w-full">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Settings</h1>
                <p className="text-base text-gray-600">Manage your account preferences, security settings, and notifications.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="flex flex-col gap-6">
                    {/* Profile section */}
                    <div className="card shadow-sm border border-gray-100 flex-1">
                        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                                <User size={18} className="text-primary-700" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Profile Details</h2>
                                <p className="text-xs text-gray-500">Update your personal information</p>
                            </div>
                        </div>

                        <form onSubmit={handleProfileSave} className="space-y-5">
                            <div>
                                <label className="label">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    className="input bg-gray-50/50 focus:bg-white"
                                    value={profile.full_name}
                                    onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="label">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail size={16} className="text-gray-400" />
                                    </div>
                                    <input type="email" disabled value={user?.email || ''} className="input pl-10 bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200" />
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1"><Shield size={12} /> Primary email cannot be changed directly.</p>
                            </div>
                            <div>
                                <label className="label">Account Role</label>
                                <div className="flex items-center gap-2 p-3 bg-primary-50/50 border border-primary-100 rounded-lg">
                                    <Shield size={16} className="text-primary-600" />
                                    <span className="text-sm font-semibold text-primary-900 capitalize">{user?.role?.replace('_', ' ')}</span>
                                </div>
                            </div>
                            <div className="pt-2">
                                <button type="submit" disabled={savingProfile} className="btn-primary w-full sm:w-auto">
                                    {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Save Profile Changes
                                </button>
                            </div>
                        </form>
                    </div>


                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-6">
                    {/* Password section */}
                    <div className="card shadow-sm border border-gray-100 flex-1">
                        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                                <Lock size={18} className="text-primary-700" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Change Password</h2>
                                <p className="text-xs text-gray-500">Ensure your account is secure</p>
                            </div>
                        </div>

                        <form onSubmit={handlePasswordChange} className="space-y-5">
                            <div>
                                <label className="label">Current Password</label>
                                <input
                                    type="password"
                                    required
                                    className="input bg-gray-50/50 focus:bg-white"
                                    placeholder="••••••••"
                                    value={pwForm.current_password}
                                    onChange={(e) => setPwForm((p) => ({ ...p, current_password: e.target.value }))}
                                />
                            </div>
                            <div className="h-px w-full bg-gray-100 my-2"></div>
                            <div>
                                <label className="label">New Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="input bg-gray-50/50 focus:bg-white"
                                    placeholder="Min 6 characters"
                                    value={pwForm.new_password}
                                    onChange={(e) => setPwForm((p) => ({ ...p, new_password: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="label">Confirm New Password</label>
                                <input
                                    type="password"
                                    required
                                    className="input bg-gray-50/50 focus:bg-white"
                                    placeholder="••••••••"
                                    value={pwForm.confirm_password}
                                    onChange={(e) => setPwForm((p) => ({ ...p, confirm_password: e.target.value }))}
                                />
                            </div>
                            <div className="pt-2">
                                <button type="submit" disabled={savingPw} className="btn-primary w-full sm:w-auto">
                                    {savingPw ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                                    Update Password
                                </button>
                            </div>
                        </form>
                    </div>


                </div>
            </div>
        </div>
    )
}
