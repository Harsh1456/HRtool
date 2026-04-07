import { useState, useEffect } from 'react'
import { offerAPI } from '../api'
import toast from 'react-hot-toast'
import { Mail, Download, Copy, Loader2, History, Edit2, Trash2 } from 'lucide-react'

// Strip any residual markdown symbols just in case
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
        <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '13px', lineHeight: '1.8', color: '#1a1a1a' }}>
            {lines.map((line, i) => {
                const trimmed = line.trim()
                if (!trimmed) return <div key={i} style={{ height: '8px' }} />

                // ALL CAPS section header (e.g. OFFER OF EMPLOYMENT)
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
                            marginTop: '16px',
                            marginBottom: '6px',
                        }}>{trimmed}</div>
                    )
                }

                // Numbered list item
                const numberedMatch = trimmed.match(/^(\d+\.\s+)(.*)/)
                if (numberedMatch) {
                    return (
                        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '3px', paddingLeft: '4px' }}>
                            <span style={{ color: '#2E7D32', fontWeight: '600', minWidth: '20px', fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>{numberedMatch[1]}</span>
                            <span style={{ fontSize: '13px' }}>{numberedMatch[2]}</span>
                        </div>
                    )
                }

                // Salutation or closing line (Dear ..., Sincerely, etc.)
                const isSalutation = /^(Dear\s|Sincerely|Regards|Yours|Best regards|Warm regards|Respectfully)/i.test(trimmed)
                if (isSalutation) {
                    return (
                        <p key={i} style={{ margin: '10px 0 4px 0', fontStyle: 'italic', fontSize: '13px' }}>{trimmed}</p>
                    )
                }

                // Regular paragraph
                return (
                    <p key={i} style={{ margin: '0 0 6px 0', fontSize: '13px', textAlign: 'justify' }}>{trimmed}</p>
                )
            })}
        </div>
    )
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}
const LOCATIONS = ['Chantilly, VA', 'Fredericksburg, VA', 'Gainesville, VA', 'Lynchburg, VA', 'Remington, VA', 'Salem, VA', 'Strasburg, VA']

export default function OfferLetter() {
    const [form, setForm] = useState({
        candidate_name: '',
        position: '',
        department: '',
        start_date: '',
        salary: '',
        manager_name: '',
        location: 'Chantilly, VA',
        employment_type: 'Full-Time',
        benefits: 'Health insurance, dental, 401k, 20 days PTO',
        additional_notes: '',
    })
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState(false)

    // History
    const [history, setHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(true)
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({ candidate_name: '', position: '' })

    useEffect(() => {
        loadHistory()
    }, [])

    const loadHistory = async () => {
        try {
            const res = await offerAPI.list()
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
        setLoading(true)
        try {
            const res = await offerAPI.generate(form)
            setResult(res.data)
            toast.success('Offer letter generated!')
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
            const res = await offerAPI.exportDocx({ content: result.content, candidate_name: result.candidate_name, position: result.position })
            downloadBlob(res.data, `Offer_${result.candidate_name.replace(/ /g, '_')}.docx`)
            toast.success('DOCX downloaded!')
        } catch {
            toast.error('Export failed')
        } finally {
            setExporting(false)
        }
    }

    const loadHistoryItem = (item) => {
        setResult({
            id: item.id,
            content: item.content,
            candidate_name: item.candidate_name,
            position: item.position
        })
        setForm(item.form_data || {
            candidate_name: item.candidate_name,
            position: item.position,
            department: '',
            start_date: '',
            salary: '',
            manager_name: '',
            location: 'Chantilly, VA',
            employment_type: 'Full-Time',
            benefits: '',
            additional_notes: '',
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        toast.success('Loaded generated offer letter')
    }

    const handleDelete = async (id, e) => {
        e.stopPropagation()
        if (!window.confirm('Delete this Offer Letter record?')) return
        try {
            await offerAPI.delete(id)
            setHistory(history.filter(h => h.id !== id))
            if (result?.id === id) setResult(null)
            toast.success('Deleted offer letter')
        } catch {
            toast.error('Failed to delete')
        }
    }

    const startEdit = (item, e) => {
        e.stopPropagation()
        setEditingId(item.id)
        setEditForm({ candidate_name: item.candidate_name, position: item.position })
    }

    const saveEdit = async (id) => {
        try {
            await offerAPI.rename(id, editForm.candidate_name, editForm.position)
            setHistory(history.map(h => h.id === id ? { ...h, candidate_name: editForm.candidate_name, position: editForm.position } : h))
            if (result?.id === id) setResult({ ...result, candidate_name: editForm.candidate_name, position: editForm.position })
            setEditingId(null)
            toast.success('Renamed offer letter')
        } catch {
            toast.error('Failed to rename')
        }
    }

    return (
        <div className="max-w-[1400px] mx-auto flex flex-col gap-8">
            <div className="w-full">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Offer Letter</h1>
                    <p className="text-sm text-gray-500 mt-1">Generate professional offer letters for new hires.</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    {/* Form */}
                    <div className="card">
                        <form onSubmit={handleGenerate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Candidate Name *</label>
                                    <input type="text" required className="input" placeholder="Alice Johnson" value={form.candidate_name} onChange={update('candidate_name')} />
                                </div>
                                <div>
                                    <label className="label">Position *</label>
                                    <input type="text" required className="input" placeholder="Software Engineer" value={form.position} onChange={update('position')} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Department</label>
                                    <input type="text" className="input" placeholder="Engineering" value={form.department} onChange={update('department')} />
                                </div>
                                <div>
                                    <label className="label">Start Date</label>
                                    <input type="date" className="input" value={form.start_date} onChange={update('start_date')} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Compensation</label>
                                    <input type="text" className="input" placeholder="$80,000/year" value={form.salary} onChange={update('salary')} />
                                </div>
                                <div>
                                    <label className="label">Reports To</label>
                                    <input type="text" className="input" placeholder="Manager name" value={form.manager_name} onChange={update('manager_name')} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Location</label>
                                    <select className="input" value={form.location} onChange={update('location')}>
                                        {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Employment Type</label>
                                    <select className="input" value={form.employment_type} onChange={update('employment_type')}>
                                        <option>Full-Time</option>
                                        <option>Part-Time</option>
                                        <option>Contract</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="label">Benefits</label>
                                <input type="text" className="input" placeholder="List key benefits" value={form.benefits} onChange={update('benefits')} />
                            </div>

                            <div>
                                <label className="label">Additional Notes</label>
                                <textarea className="input min-h-[70px] resize-y" placeholder="Any special conditions or notes…" value={form.additional_notes} onChange={update('additional_notes')} />
                            </div>

                            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                                {loading ? 'Generating…' : 'Generate Offer Letter'}
                            </button>
                        </form>
                    </div>

                    {/* Preview */}
                    <div className="card flex flex-col min-h-[500px]">
                        {result ? (
                            <>
                                <h3 className="font-semibold text-gray-900 mb-3">
                                    Offer Letter — {result.candidate_name}
                                </h3>
                                <div className="flex-1 overflow-y-auto border border-gray-100 rounded-lg p-5 bg-white shadow-sm min-h-0">
                                    <PlainTextRenderer content={result.content} />
                                </div>
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
                                <Mail size={40} className="opacity-20 mb-3" />
                                <p>Fill in candidate details and click Generate</p>
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
                        <h2 className="font-semibold text-gray-900">Offer History</h2>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                        <table className="w-full table-fixed">
                            <thead className="border-b border-gray-100 bg-gray-50/50">
                                <tr>
                                    <th className="table-header w-[35%]">Candidate</th>
                                    <th className="table-header w-[35%]">Position</th>
                                    <th className="table-header w-[160px]">Date Generated</th>
                                    <th className="table-header w-[100px]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loadingHistory ? (
                                    <tr><td colSpan="4" className="text-center py-8 text-gray-500"><Loader2 size={20} className="animate-spin mx-auto" /></td></tr>
                                ) : history.length === 0 ? (
                                    <tr><td colSpan="4" className="text-sm text-gray-500 text-center italic py-8">No generated offer letters.</td></tr>
                                ) : (
                                    history.map((h) => (
                                        <tr key={h.id} className="hover:bg-gray-50 transition group cursor-pointer" onClick={() => loadHistoryItem(h)}>
                                            <td className="table-cell">
                                                {editingId === h.id ? (
                                                    <input
                                                        autoFocus
                                                        onClick={e => e.stopPropagation()}
                                                        value={editForm.candidate_name}
                                                        onChange={e => setEditForm(prev => ({ ...prev, candidate_name: e.target.value }))}
                                                        className="text-sm border border-gray-300 rounded px-2 py-0.5 outline-none w-full"
                                                        placeholder="Candidate"
                                                    />
                                                ) : (
                                                    <span className="text-sm font-medium text-gray-900 truncate block pr-2" title={h.candidate_name}>
                                                        {h.candidate_name}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="table-cell">
                                                {editingId === h.id ? (
                                                    <input
                                                        onClick={e => e.stopPropagation()}
                                                        value={editForm.position}
                                                        onChange={e => setEditForm(prev => ({ ...prev, position: e.target.value }))}
                                                        className="text-sm border border-gray-300 rounded px-2 py-0.5 outline-none w-full"
                                                        placeholder="Position"
                                                    />
                                                ) : (
                                                    <span className="text-sm text-primary-600 truncate block pr-2" title={h.position}>
                                                        {h.position}
                                                    </span>
                                                )}
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
