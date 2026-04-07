import { useState, useEffect } from 'react'
import { jdAPI, documentsAPI } from '../api'
import toast from 'react-hot-toast'
import { Upload, Download, Copy, Loader2, FileText, MapPin, Briefcase, User, Building2, History, Edit2, Trash2 } from 'lucide-react'

// Strips any residual markdown characters just in case
function stripMarkdown(text) {
    return text
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/^[-*]\s+/gm, '')
        .trim()
}

function PlainTextRenderer({ content }) {
    const cleaned = stripMarkdown(content)
    const lines = cleaned.split('\n')

    return (
        <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '13px', lineHeight: '1.7', color: '#1a1a1a' }}>
            {lines.map((line, i) => {
                const trimmed = line.trim()
                if (!trimmed) return <div key={i} style={{ height: '10px' }} />

                // ALL CAPS section header (e.g. ROLE SUMMARY, KEY RESPONSIBILITIES)
                const isHeader = /^[A-Z][A-Z\s]{3,}$/.test(trimmed)
                if (isHeader) {
                    return (
                        <div key={i} style={{
                            fontFamily: 'Arial, sans-serif',
                            fontSize: '12px',
                            fontWeight: '700',
                            letterSpacing: '0.08em',
                            color: '#2E7D32',
                            textTransform: 'uppercase',
                            borderBottom: '1.5px solid #c8e6c9',
                            paddingBottom: '2px',
                            marginTop: '14px',
                            marginBottom: '5px',
                        }}>{trimmed}</div>
                    )
                }

                // Numbered list item (1. 2. 3. etc.)
                const numberedMatch = trimmed.match(/^(\d+\.\s+)(.*)/)
                if (numberedMatch) {
                    return (
                        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '2px', paddingLeft: '4px' }}>
                            <span style={{ color: '#2E7D32', fontWeight: '600', minWidth: '20px', fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>{numberedMatch[1]}</span>
                            <span style={{ fontSize: '13px' }}>{numberedMatch[2]}</span>
                        </div>
                    )
                }

                // Regular paragraph
                return (
                    <p key={i} style={{ margin: '0 0 4px 0', fontSize: '13px' }}>{trimmed}</p>
                )
            })}
        </div>
    )
}

const EMPLOYMENT_TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Remote']
const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'Human Resources', 'Finance', 'Operations', 'Product', 'Legal', 'Design', 'Customer Success']
const LOCATIONS = ['Chantilly, VA', 'Fredericksburg, VA', 'Gainesville, VA', 'Lynchburg, VA', 'Remington, VA', 'Salem, VA', 'Strasburg, VA']

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

export default function JDBuilder() {
    const [form, setForm] = useState({
        job_title: '',
        location: 'Chantilly, VA',
        department: '',
        employment_type: 'Full-Time',
        salary_min: '',
        salary_max: '',
        reports_to: '',
        notes: '',
        current_jd: '',
    })
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState(false)

    // History
    const [history, setHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(true)
    const [editingId, setEditingId] = useState(null)
    const [editTitle, setEditTitle] = useState('')

    const handleFileUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        const tid = toast.loading('Extracting text...')
        try {
            const res = await documentsAPI.extractText(file)
            setForm(f => ({ ...f, current_jd: res.data.text }))
            toast.success('Text extracted', { id: tid })
        } catch (err) {
            toast.error('Failed to extract text', { id: tid })
        }
        e.target.value = ''
    }

    useEffect(() => {
        loadHistory()
    }, [])

    const loadHistory = async () => {
        try {
            const res = await jdAPI.list()
            setHistory(res.data)
        } catch {
            toast.error('Failed to load history')
        } finally {
            setLoadingHistory(false)
        }
    }

    const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

    const handleGenerate = async (e) => {
        e.preventDefault()
        if (!form.job_title.trim()) {
            toast.error('Job title is required')
            return
        }
        setLoading(true)
        try {
            const res = await jdAPI.generate(form)
            setResult(res.data)
            toast.success('Job description generated!')
            loadHistory()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Generation failed')
        } finally {
            setLoading(false)
        }
    }

    const handleExport = async () => {
        if (!result) return
        setExporting(true)
        try {
            const res = await jdAPI.exportDocx({
                content: result.content,
                job_title: result.job_title || result.title,
                location: form.location,
                department: form.department,
                employment_type: form.employment_type,
            })
            downloadBlob(res.data, `${(result.job_title || result.title).replace(/ /g, '_')}_JD.docx`)
            toast.success('DOCX downloaded!')
        } catch {
            toast.error('Export failed')
        } finally {
            setExporting(false)
        }
    }

    const loadHistoryItem = (item) => {
        setResult(item)
        setForm(item.form_data || {
            job_title: item.title,
            location: '',
            department: item.department,
            employment_type: '',
            salary_min: '',
            salary_max: '',
            reports_to: '',
            notes: '',
            current_jd: item.form_data?.current_jd || '',
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        toast.success('Loaded generated JD')
    }

    const handleDelete = async (id, e) => {
        e.stopPropagation()
        if (!window.confirm('Delete this JD record?')) return
        try {
            await jdAPI.delete(id)
            setHistory(history.filter(h => h.id !== id))
            if (result?.id === id) setResult(null)
            toast.success('Deleted JD')
        } catch {
            toast.error('Failed to delete')
        }
    }

    const startEdit = (item, e) => {
        e.stopPropagation()
        setEditingId(item.id)
        setEditTitle(item.title)
    }

    const saveEdit = async (id) => {
        try {
            await jdAPI.rename(id, editTitle)
            setHistory(history.map(h => h.id === id ? { ...h, title: editTitle } : h))
            if (result?.id === id) setResult({ ...result, title: editTitle, job_title: editTitle })
            setEditingId(null)
            toast.success('Renamed JD')
        } catch {
            toast.error('Failed to rename')
        }
    }

    return (
        <div className="max-w-[1400px] mx-auto flex flex-col gap-8">
            <div className="w-full">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">JD Builder</h1>
                        <p className="text-sm text-gray-500 mt-1">Create job descriptions quickly based on a job role and a few key requirements.</p>
                        <p className="text-xs text-gray-400">Powered by retrieval-augmented generation (RAG).</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    {/* ── Left: Input form ── */}
                    <div className="card">
                        <h2 className="font-semibold text-gray-900 mb-4">Input</h2>
                        <form onSubmit={handleGenerate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Job Title *</label>
                                    <input type="text" className="input" placeholder="Project Manager" value={form.job_title} onChange={update('job_title')} required />
                                </div>
                                <div>
                                    <label className="label">Location</label>
                                    <select className="input" value={form.location} onChange={update('location')}>
                                        {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="label">Department</label>
                                <select className="input" value={form.department} onChange={update('department')}>
                                    <option value="">Select department…</option>
                                    {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Employment Type</label>
                                    <select className="input" value={form.employment_type} onChange={update('employment_type')}>
                                        {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Salary Range</label>
                                    <div className="flex items-center gap-2">
                                        <input type="text" className="input" placeholder="$ Min" value={form.salary_min} onChange={update('salary_min')} />
                                        <span className="text-gray-400 text-sm">–</span>
                                        <input type="text" className="input" placeholder="$ Max" value={form.salary_max} onChange={update('salary_max')} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="label">Reports To</label>
                                <input type="text" className="input" placeholder="e.g. John Smith" value={form.reports_to} onChange={update('reports_to')} />
                            </div>

                            <div>
                                <label className="label">Notes from HR <span className="text-gray-400 font-normal">(optional)</span></label>
                                <textarea className="input min-h-[90px] resize-y" placeholder="Key responsibilities, must-haves, company culture notes…" value={form.notes} onChange={update('notes')} />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="label mb-0">Current JD <span className="text-gray-400 font-normal">(optional)</span></label>
                                    <label className="cursor-pointer text-xs flex items-center gap-1 text-primary-600 hover:text-primary-700">
                                        <Upload size={13} />
                                        Upload File
                                        <input type="file" className="hidden" accept=".pdf,.docx,.doc" onChange={handleFileUpload} />
                                    </label>
                                </div>
                                <textarea className="input min-h-[90px] resize-y" placeholder="Paste an existing JD here to enhance it..." value={form.current_jd} onChange={update('current_jd')} />
                            </div>

                            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                                {loading ? 'Generating…' : 'Generate JD'}
                            </button>
                        </form>
                    </div>

                    {/* ── Right: Preview ── */}
                    <div className="card flex flex-col">
                        {result ? (
                            <>
                                {/* Job card preview */}
                                <div className="border border-gray-100 rounded-xl p-4 mb-4 bg-gray-50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-8 h-8 bg-primary-700 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Building2 size={14} className="text-white" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900 text-sm">{result.title || result.job_title}</div>
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-xs text-gray-500">
                                        {form.location && <div className="flex items-center gap-1"><MapPin size={11} /> {form.location}</div>}
                                        {form.department && <div className="flex items-center gap-1"><Briefcase size={11} /> {form.department}</div>}
                                        {form.employment_type && <div className="flex items-center gap-1"><User size={11} /> {form.employment_type}</div>}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto min-h-0 border border-gray-100 rounded-lg p-4 bg-white shadow-sm">
                                    <PlainTextRenderer content={result.content} />
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 mt-4">
                                    <button onClick={() => { navigator.clipboard.writeText(result.content); toast.success('Copied!') }} className="btn-secondary flex-1 justify-center">
                                        <Copy size={14} /> Copy
                                    </button>
                                    <button onClick={handleExport} disabled={exporting} className="btn-primary flex-1 justify-center">
                                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                        Export DOCX
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm">
                                <FileText size={40} className="opacity-20 mb-3" />
                                <p>Fill in the form and click <strong>Generate JD</strong></p>
                                <p className="text-xs mt-1">The job description will appear here as a live preview.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* History Section */}
            <div className="w-full">
                <div className="card flex flex-col max-h-[600px] mb-8">
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                        <History size={18} className="text-gray-400" />
                        <h2 className="font-semibold text-gray-900">JD History</h2>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                        <table className="w-full table-fixed">
                            <thead className="border-b border-gray-100 bg-gray-50/50">
                                <tr>
                                    <th className="table-header w-[40%]">Job Title</th>
                                    <th className="table-header w-[30%]">Department</th>
                                    <th className="table-header w-[160px]">Date Generated</th>
                                    <th className="table-header w-[100px]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loadingHistory ? (
                                    <tr><td colSpan="4" className="text-center py-8 text-gray-500"><Loader2 size={20} className="animate-spin mx-auto" /></td></tr>
                                ) : history.length === 0 ? (
                                    <tr><td colSpan="4" className="text-sm text-gray-500 text-center italic py-8">No generated JDs.</td></tr>
                                ) : (
                                    history.map((h) => (
                                        <tr key={h.id} className="hover:bg-gray-50 transition group cursor-pointer" onClick={() => loadHistoryItem(h)}>
                                            <td className="table-cell">
                                                {editingId === h.id ? (
                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            autoFocus
                                                            value={editTitle}
                                                            onChange={e => setEditTitle(e.target.value)}
                                                            className="text-sm border border-gray-300 rounded px-2 py-0.5 outline-none flex-1"
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-sm font-medium text-gray-900 truncate block pr-2" title={h.title}>
                                                        {h.title}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="table-cell text-primary-600 truncate pr-2" title={h.department || '—'}>
                                                {h.department || '—'}
                                            </td>
                                            <td className="table-cell text-gray-500">
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
