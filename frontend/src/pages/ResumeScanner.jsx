import { useState, useRef, useEffect } from 'react'
import { resumeAPI } from '../api'
import toast from 'react-hot-toast'
import { Upload, Search, X, Loader2, FileText, CheckCircle2, AlertCircle, History, Trash2, Edit2 } from 'lucide-react'
import rolesData from '../data/roles.json'

const LEVEL_COLORS = {
    Senior: 'bg-blue-100 text-blue-700',
    Mid: 'bg-green-100 text-green-700',
    Entry: 'bg-yellow-100 text-yellow-700',
    'Not Suitable': 'bg-red-100 text-red-600',
}

function RankBadge({ rank }) {
    const colors = ['bg-primary-700', 'bg-primary-600', 'bg-primary-500']
    const bg = colors[rank - 1] || 'bg-gray-400'
    return (
        <div className={`w-7 h-7 rounded-lg ${bg} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}>
            {rank}
        </div>
    )
}

export default function ResumeScanner() {
    const [jdText, setJdText] = useState('')
    const [candidateName, setCandidateName] = useState('')
    const [role, setRole] = useState('')
    const [files, setFiles] = useState([])
    const [results, setResults] = useState(null)
    const [loading, setLoading] = useState(false)
    const [history, setHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(true)
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({ candidate_name: '', role: '' })
    const fileRef = useRef()

    useEffect(() => {
        loadHistory()
    }, [])

    const loadHistory = async () => {
        try {
            const res = await resumeAPI.list()
            setHistory(res.data)
        } catch (err) {
            toast.error('Failed to load history')
        } finally {
            setLoadingHistory(false)
        }
    }

    const addFiles = (newFiles) => {
        setFiles((prev) => {
            const existing = new Set(prev.map((f) => f.name))
            return [...prev, ...Array.from(newFiles).filter((f) => !existing.has(f.name))]
        })
    }

    const removeFile = (name) => setFiles((prev) => prev.filter((f) => f.name !== name))

    const handleScan = async () => {
        if (!jdText.trim()) { toast.error('Paste a job description first'); return }
        if (files.length === 0) { toast.error('Select at least one resume file'); return }
        setLoading(true)
        try {
            const res = await resumeAPI.scan(jdText, files, candidateName, role)
            setResults(res.data.results)
            toast.success(`Ranked ${res.data.results.length} resume(s)`)
            setJdText('')
            setCandidateName('')
            setRole('')
            setFiles([])
            loadHistory()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Scan failed')
        } finally {
            setLoading(false)
        }
    }

    const viewHistoryItem = (item) => {
        setJdText(item.jd_text || '')
        setCandidateName(item.candidate_name || '')
        setRole(item.role || '')
        setResults(item.results || [])
        window.scrollTo({ top: 0, behavior: 'smooth' })
        toast.success(`Loaded scan: ${item.candidate_name || 'Unknown'}`)
    }

    const handleDelete = async (id, e) => {
        e.stopPropagation()
        if (!window.confirm('Delete this scan record?')) return
        try {
            await resumeAPI.delete(id)
            setHistory((prev) => prev.filter((h) => h.id !== id))
            toast.success('Record deleted')
        } catch {
            toast.error('Failed to delete record')
        }
    }

    const startEdit = (item, e) => {
        e.stopPropagation()
        setEditingId(item.id)
        setEditForm({ candidate_name: item.candidate_name || '', role: item.role || '' })
    }

    const saveEdit = async (id) => {
        try {
            await resumeAPI.rename(id, editForm.candidate_name, editForm.role)
            setHistory((prev) => prev.map((h) => h.id === id ? { ...h, candidate_name: editForm.candidate_name, role: editForm.role } : h))
            setEditingId(null)
            toast.success('Record updated')
        } catch (err) {
            toast.error('Failed to update record')
        }
    }

    return (
        <div className="w-[98%] max-w-[1600px] mx-auto flex flex-col gap-6">
            <div className="mb-4 sm:mb-6 px-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-2">Resume Scanner</h1>
                <p className="text-sm sm:text-base text-gray-600 max-w-2xl">
                    Upload candidate resumes and provide a Job Description. Our AI will analyze, score, and rank the candidates based on real requirements.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
                {/* Left Column: Input Form */}
                <div className="lg:col-span-5 flex flex-col">
                    <div className="card flex flex-col shadow-sm border border-gray-100 h-full p-4 sm:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label htmlFor="candidate_name" className="label">Candidate Name <span className="font-normal text-gray-400">(Optional)</span></label>
                                <input
                                    id="candidate_name"
                                    name="candidate_name"
                                    type="text"
                                    className="input"
                                    placeholder="e.g. John Doe"
                                    value={candidateName}
                                    onChange={(e) => setCandidateName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="role_select" className="label mb-1">Role <span className="font-normal text-gray-400">(Optional)</span></label>
                                <select
                                    id="role_select"
                                    name="role_select"
                                    className="input cursor-pointer"
                                    value={role}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        setRole(val)
                                        const selected = rolesData.find(r => r.title === val)
                                        if (selected) {
                                            setJdText(selected.description)
                                            toast.success('Loaded JD for ' + selected.title)
                                        }
                                    }}
                                >
                                    <option value="">Select...</option>
                                    {[...rolesData].sort((a, b) => a.title.localeCompare(b.title)).map(r => (
                                        <option key={r.title} value={r.title}>{r.title}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mb-5 flex-1 flex flex-col">
                            <label htmlFor="jd_text" className="label flex justify-between">
                                Job Description
                                <span className="font-normal text-xs text-primary-600 bg-primary-50 px-2 rounded flex items-center h-5">Required</span>
                            </label>
                            <textarea
                                id="jd_text"
                                name="jd_text"
                                className="input min-h-[300px] resize-y flex-1 bg-gray-50/30 focus:bg-white border-dashed focus:border-solid hover:border-gray-400 transition-colors"
                                placeholder="Paste the detailed Job Description here. The deeper the context, the more accurate the AI ranking will be..."
                                value={jdText}
                                onChange={(e) => setJdText(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                            <label htmlFor="resume_files" className="sr-only">Upload Resumes</label>
                            <input
                                id="resume_files"
                                name="resume_files"
                                ref={fileRef}
                                type="file"
                                multiple
                                accept=".pdf,.docx,.doc"
                                className="hidden"
                                onChange={(e) => addFiles(e.target.files)}
                            />
                            <button onClick={() => fileRef.current?.click()} className="btn-secondary">
                                <Upload size={15} /> Select PDFs/DOCXs
                            </button>
                            <button
                                onClick={handleScan}
                                disabled={loading}
                                className="btn-primary"
                            >
                                {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                                Scan Resumes
                            </button>

                            {files.map((f) => (
                                <div key={f.name} className="flex items-center gap-1.5 bg-primary-50 px-2.5 py-1 rounded-full text-xs text-primary-700">
                                    <FileText size={11} />
                                    <span className="max-w-[120px] truncate">{f.name}</span>
                                    <button onClick={() => removeFile(f.name)} className="text-primary-500 hover:text-primary-700">
                                        <X size={11} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Results Section */}
                <div className="lg:col-span-7 flex flex-col h-full">
                    {/* Results or Empty State */}
                    {results && results.length > 0 ? (
                        <div className="card flex-1 shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4">
                                <h2 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                                    <Search size={20} className="text-primary-600" /> Analysis Results
                                </h2>
                                <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                                    <CheckCircle2 size={14} /> Scan Complete
                                </span>
                            </div>

                            {/* Summary banner */}
                            <div className="bg-primary-50/50 rounded-lg p-3.5 mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm border border-primary-100/50 shadow-sm">
                                <div className="flex flex-col"><span className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-0.5">Scanned</span><span className="text-gray-900 font-bold text-base">{results.length} Resumes</span></div>
                                <div className="hidden sm:block h-8 w-px bg-primary-200"></div>
                                <div className="flex flex-col"><span className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-0.5">Top Match</span><span className="font-bold text-primary-700 text-base">{results[0]?.filename || 'N/A'}</span></div>
                            </div>

                            <div className="overflow-x-auto flex-1 rounded-lg border border-gray-100/50">
                                <table className="w-full">
                                    <thead className="border-b border-gray-100">
                                        <tr>
                                            {['Rank', 'Resume', 'Score', 'Recommended Level', 'AI Detection', 'Strengths', 'Gaps'].map((h) => (
                                                <th key={h} className="table-header">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {results.map((r) => (
                                            <tr key={r.rank} className="hover:bg-gray-50 transition">
                                                <td className="table-cell">
                                                    <RankBadge rank={r.rank} />
                                                </td>
                                                <td className="table-cell">
                                                    <div className="flex items-center gap-1.5">
                                                        <FileText size={13} className="text-primary-600 flex-shrink-0" />
                                                        <span className="text-xs font-medium max-w-[130px] truncate">{r.filename}</span>
                                                    </div>
                                                </td>
                                                <td className="table-cell">
                                                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700">
                                                        {r.score}
                                                    </span>
                                                </td>
                                                <td className="table-cell">
                                                    <span className={`badge ${LEVEL_COLORS[r.recommended_level] || 'bg-gray-100 text-gray-600'}`}>
                                                        {r.recommended_level}
                                                    </span>
                                                </td>
                                                <td className="table-cell">
                                                    {r.ai_detection ? (
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded w-max ${r.ai_detection.score >= 60 ? 'bg-red-100 text-red-700' : r.ai_detection.score >= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                                                {r.ai_detection.score}% - {r.ai_detection.label}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 font-medium">N/A</span>
                                                    )}
                                                </td>
                                                <td className="table-cell max-w-[180px]">
                                                    <ul className="space-y-1">
                                                        {(r.strengths || []).map((s, i) => (
                                                            <li key={i} className="flex items-start gap-1 text-xs text-gray-600">
                                                                <CheckCircle2 size={11} className="text-green-500 mt-0.5 flex-shrink-0" />
                                                                {s}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </td>
                                                <td className="table-cell max-w-[180px]">
                                                    <ul className="space-y-1">
                                                        {(r.gaps || []).map((g, i) => (
                                                            <li key={i} className="flex items-start gap-1 text-xs text-gray-600">
                                                                <AlertCircle size={11} className="text-red-400 mt-0.5 flex-shrink-0" />
                                                                {g}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="card flex-1 flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-gray-200 bg-gray-50/50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] min-h-[500px]">
                            <div className="w-20 h-20 bg-white shadow-xl shadow-primary-500/10 rounded-2xl flex items-center justify-center mb-6 text-primary-600 border border-primary-100 transform transition hover:scale-105 duration-300">
                                <FileText size={36} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">Ready to Analyze</h3>
                            <p className="text-gray-500 max-w-sm mb-10 leading-relaxed text-[15px]">
                                Fill out the job details on the left, paste the JD, and upload applicant CVs. Our smart engine will evaluate and rank them instantly.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-lg mx-auto">
                                <div className="bg-white p-5 rounded-2xl border border-gray-200 text-left shadow-sm hover:border-primary-300 hover:shadow-md transition-all duration-300">
                                    <div className="flex items-center gap-2.5 text-[15px] font-semibold text-gray-900 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center"><CheckCircle2 size={18} /></div>
                                        Smart Ranking
                                    </div>
                                    <p className="text-[13px] text-gray-500 leading-snug">Automatically sorts candidates by skills and match.</p>
                                </div>
                                <div className="bg-white p-5 rounded-2xl border border-gray-200 text-left shadow-sm hover:border-primary-300 hover:shadow-md transition-all duration-300">
                                    <div className="flex items-center gap-2.5 text-[15px] font-semibold text-gray-900 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center"><AlertCircle size={18} /></div>
                                        Gap Analysis
                                    </div>
                                    <p className="text-[13px] text-gray-500 leading-snug">Highlights missing skills to streamline your process.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* History Section - Full Width Below */}
            <div className="w-full">
                <div className="card flex flex-col min-h-[300px] mb-8 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                        <History size={18} className="text-gray-400" />
                        <h2 className="font-semibold text-gray-900">Scan History</h2>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                        <table className="w-full">
                            <thead className="border-b border-gray-100 bg-gray-50/50">
                                <tr>
                                    <th className="table-header w-1/3 sm:w-[25%]">Candidate</th>
                                    <th className="table-header hidden sm:table-cell sm:w-[25%]">Role</th>
                                    <th className="table-header w-1/4 sm:w-[120px]">Score</th>
                                    <th className="table-header w-1/4 sm:w-[160px]">Date</th>
                                    <th className="table-header w-[80px] sm:w-[90px]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loadingHistory ? (
                                    <tr><td colSpan="5" className="text-center py-8 text-gray-500"><Loader2 size={20} className="animate-spin mx-auto" /></td></tr>
                                ) : history.length === 0 ? (
                                    <tr><td colSpan="5" className="text-sm text-gray-500 text-center italic py-8">No past scans.</td></tr>
                                ) : (
                                    history.map((h) => (
                                        <tr key={h.id} className="hover:bg-gray-50 transition group cursor-pointer" onClick={() => viewHistoryItem(h)}>
                                            <td className="table-cell">
                                                {editingId === h.id ? (
                                                    <input
                                                        id="edit_candidate_name"
                                                        name="edit_candidate_name"
                                                        autoFocus
                                                        onClick={e => e.stopPropagation()}
                                                        value={editForm.candidate_name}
                                                        onChange={e => setEditForm(prev => ({ ...prev, candidate_name: e.target.value }))}
                                                        className="text-sm border border-gray-300 rounded px-2 py-0.5 outline-none w-full"
                                                        placeholder="Candidate"
                                                    />
                                                ) : (
                                                    <span className="text-sm font-medium text-gray-900 truncate block pr-2" title={h.candidate_name || 'Unknown'}>
                                                        {h.candidate_name || 'Unknown'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="table-cell hidden sm:table-cell">
                                                {editingId === h.id ? (
                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            id="edit_role"
                                                            name="edit_role"
                                                            value={editForm.role}
                                                            onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                                                            className="text-sm border border-gray-300 rounded px-2 py-0.5 outline-none w-full"
                                                            placeholder="Role"
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-primary-600 truncate block pr-2" title={h.role || 'Unspecified'}>
                                                        {h.role || 'Unspecified'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="table-cell">
                                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-gray-100 text-xs font-semibold text-gray-700">
                                                    {h.top_score}
                                                </span>
                                            </td>
                                            <td className="table-cell text-gray-500 whitespace-nowrap text-xs">
                                                {new Date(h.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="table-cell text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                                                    {editingId === h.id ? (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); saveEdit(h.id); }} className="text-xs bg-primary-600 text-white px-2 py-1 rounded">Save</button>
                                                            <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="text-xs text-gray-500 hover:text-gray-700 px-1">Cancel</button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={(e) => startEdit(h, e)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100" title="Edit">
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button onClick={(e) => handleDelete(h.id, e)} className="p-1.5 text-red-300 hover:text-red-600 rounded-md hover:bg-red-50" title="Delete">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
