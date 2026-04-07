import { useState, useEffect } from 'react'
import { insightsAPI } from '../api'
import { RefreshCw, FileSearch, Building2, Mail, MessageSquare, Clock, FileText } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

function formatDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function HRInsights() {
    const [resumes, setResumes] = useState([])
    const [jds, setJds] = useState([])
    const [offers, setOffers] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchAll = async () => {
        setLoading(true)
        try {
            const [rRes, jRes, oRes, sRes] = await Promise.all([
                insightsAPI.scannedResumes(),
                insightsAPI.jdRecords(),
                insightsAPI.offerRecords(),
                insightsAPI.stats()
            ])
            setResumes(rRes.data)
            setJds(jRes.data)
            setOffers(oRes.data)
            setStats(sRes.data)
        } catch {
            // silently fail
        } finally {
            setLoading(false)
        }
    }

    const getChartData = () => {
        const counts = {}
        for (let i = 4; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            counts[dateStr] = { date: dateStr, dateObj: d, Resumes: 0, JDs: 0, Offers: 0 }
        }

        const addDate = (iso, type) => {
            if (!iso) return
            const dateObj = new Date(iso)
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            if (counts[dateStr]) counts[dateStr][type]++
        }
        
        resumes.forEach(r => addDate(r.created_at, 'Resumes'))
        jds.forEach(j => addDate(j.created_at, 'JDs'))
        offers.forEach(o => addDate(o.created_at, 'Offers'))
        
        return Object.values(counts).sort((a, b) => a.dateObj - b.dateObj)
    }

    useEffect(() => { fetchAll() }, [])

    const chartData = getChartData()

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">HR Insights</h1>
                    <p className="text-sm text-gray-500 mt-1">Overview of your activity and generated documents.</p>
                </div>
                <button onClick={() => fetchAll()} className="btn-secondary text-xs">
                    <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
            </div>

            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="card text-center p-4">
                        <MessageSquare className="w-6 h-6 mx-auto text-primary-500 mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{stats.total_questions}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mt-1">Questions Asked</p>
                    </div>
                    <div className="card text-center p-4">
                        <FileText className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{stats.documents_used}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mt-1">HR Docs Used</p>
                    </div>
                    <div className="card text-center p-4">
                        <Clock className="w-6 h-6 mx-auto text-green-500 mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{stats.avg_response_time.seconds}s</p>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mt-1">Avg AI Speed</p>
                    </div>
                    <div className="card text-center p-4">
                        <Building2 className="w-6 h-6 mx-auto text-purple-500 mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{resumes.length + jds.length + offers.length}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mt-1">Activities</p>
                    </div>
                </div>
            )}

            {/* ROW 1: 3 Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {chartData.length > 0 && (
                    <>
                        <div className="card h-[320px] flex flex-col">
                            <h2 className="font-semibold text-gray-900 mb-4">Resume Scans</h2>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} allowDecimals={false} />
                                        <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                        <Area type="monotone" dataKey="Resumes" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="#DBEAFE" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="card h-[320px] flex flex-col">
                            <h2 className="font-semibold text-gray-900 mb-4">Generated JDs</h2>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} allowDecimals={false} />
                                        <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                        <Area type="monotone" dataKey="JDs" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="#D1FAE5" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="card h-[320px] flex flex-col">
                            <h2 className="font-semibold text-gray-900 mb-4">Offer Letters</h2>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} allowDecimals={false} />
                                        <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                        <Area type="monotone" dataKey="Offers" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="#EDE9FE" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ROW 2: 3 Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* ── Scanned Resumes ── */}
                <div className="card h-[380px] flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                        <FileSearch size={18} className="text-primary-600" />
                        <h2 className="font-semibold text-gray-900">Recent Resume Scans</h2>
                    </div>
                    {resumes.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4 text-center">No resume scans yet.</p>
                    ) : (
                        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                            <table className="w-full relative">
                                <thead className="border-b border-gray-100 sticky top-0 bg-white z-10">
                                    <tr>
                                        <th className="table-header w-1/4">Candidate</th>
                                        <th className="table-header w-1/4">Role</th>
                                        <th className="table-header">Top Score</th>
                                        <th className="table-header text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {resumes.slice(0, 10).map((r) => (
                                        <tr key={r.id} className="hover:bg-gray-50 transition">
                                            <td className="table-cell font-medium text-gray-900">{r.candidate_name}</td>
                                            <td className="table-cell text-gray-600">{r.role}</td>
                                            <td className="table-cell">
                                                <span className="inline-flex items-center justify-center bg-gray-100 text-gray-700 font-bold px-2 py-0.5 rounded text-xs">
                                                    {r.top_score}
                                                </span>
                                            </td>
                                            <td className="table-cell text-right text-gray-400 text-xs">{formatDate(r.created_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── Generated Job Descriptions ── */}
                <div className="card h-[380px] flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                        <Building2 size={18} className="text-primary-600" />
                        <h2 className="font-semibold text-gray-900">Generated JDs</h2>
                    </div>
                    {jds.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4 text-center">No JDs generated yet.</p>
                    ) : (
                        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                            <table className="w-full relative">
                                <thead className="border-b border-gray-100 sticky top-0 bg-white z-10">
                                    <tr>
                                        <th className="table-header text-left">Title</th>
                                        <th className="table-header text-left">Dept</th>
                                        <th className="table-header text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {jds.slice(0, 8).map((j) => (
                                        <tr key={j.id} className="hover:bg-gray-50 transition">
                                            <td className="table-cell font-medium text-gray-900 max-w-[150px] truncate" title={j.title}>{j.title}</td>
                                            <td className="table-cell text-gray-600 text-xs truncate max-w-[100px]">{j.department}</td>
                                            <td className="table-cell text-right text-gray-400 text-xs">{formatDate(j.created_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── Generated Offer Letters ── */}
                <div className="card h-[380px] flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                        <Mail size={18} className="text-primary-600" />
                        <h2 className="font-semibold text-gray-900">Offer Letters</h2>
                    </div>
                    {offers.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4 text-center">No offer letters generated yet.</p>
                    ) : (
                        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                            <table className="w-full relative">
                                <thead className="border-b border-gray-100 sticky top-0 bg-white z-10">
                                    <tr>
                                        <th className="table-header text-left">Candidate</th>
                                        <th className="table-header text-left">Position</th>
                                        <th className="table-header text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {offers.slice(0, 8).map((o) => (
                                        <tr key={o.id} className="hover:bg-gray-50 transition">
                                            <td className="table-cell font-medium text-gray-900 max-w-[120px] truncate" title={o.candidate_name}>{o.candidate_name}</td>
                                            <td className="table-cell text-gray-600 text-xs truncate max-w-[120px]" title={o.position}>{o.position}</td>
                                            <td className="table-cell text-right text-gray-400 text-xs">{formatDate(o.created_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
