import { useState, useEffect, useRef } from 'react'
import { documentsAPI } from '../api'
import toast from 'react-hot-toast'
import { Upload, Trash2, FileText, Loader2, File, Edit2 } from 'lucide-react'

function formatBytes(bytes) {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function Documents() {
    const [docs, setDocs] = useState([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [deleting, setDeleting] = useState(null)
    const [editingId, setEditingId] = useState(null)
    const [editName, setEditName] = useState('')
    const fileRef = useRef()

    const fetchDocs = async () => {
        try {
            const res = await documentsAPI.list()
            setDocs(res.data)
        } catch {
            toast.error('Failed to load documents')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchDocs() }, [])

    const handleUpload = async (file) => {
        if (!file) return
        setUploading(true)
        const tid = toast.loading(`Uploading ${file.name}…`)
        try {
            await documentsAPI.upload(file)
            toast.success('Document indexed successfully!', { id: tid })
            fetchDocs()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Upload failed', { id: tid })
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (id, filename) => {
        if (!confirm(`Delete "${filename}"? This will remove all its indexed chunks.`)) return
        setDeleting(id)
        try {
            await documentsAPI.delete(id)
            toast.success('Document deleted')
            setDocs((prev) => prev.filter((d) => d.id !== id))
        } catch {
            toast.error('Delete failed')
        } finally {
            setDeleting(null)
        }
    }

    const startEdit = (doc) => {
        setEditingId(doc.id)
        setEditName(doc.filename)
    }

    const saveEdit = async (id) => {
        if (!editName.trim()) {
            setEditingId(null)
            return
        }
        try {
            await documentsAPI.rename(id, editName)
            setDocs((prev) => prev.map((d) => d.id === id ? { ...d, filename: editName } : d))
            toast.success('Document renamed')
            setEditingId(null)
        } catch {
            toast.error('Failed to rename')
        }
    }

    return (
        <div className="w-full relative">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage uploaded HR policy documents available for RAG search.</p>
                </div>
                <div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,.docx,.doc"
                        className="hidden"
                        onChange={(e) => handleUpload(e.target.files[0])}
                    />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-primary">
                        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        Upload Document
                    </button>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div className="py-12 flex justify-center">
                        <Loader2 size={24} className="animate-spin text-primary-600" />
                    </div>
                ) : docs.length === 0 ? (
                    <div className="py-12 text-center">
                        <FileText size={40} className="mx-auto text-gray-200 mb-3" />
                        <p className="text-sm text-gray-500">No documents uploaded yet.</p>
                        <p className="text-xs text-gray-400 mt-1">Upload PDF or DOCX files to start using Ask HR Docs.</p>
                        <button onClick={() => fileRef.current?.click()} className="btn-primary mt-4 mx-auto">
                            <Upload size={15} /> Upload your first document
                        </button>
                    </div>
                ) : (
                    <table className="w-full table-fixed">
                        <thead className="border-b border-gray-100">
                            <tr>
                                <th className="table-header w-[60%]">Document</th>
                                <th className="table-header w-[120px]">Size</th>
                                <th className="table-header w-[120px]">Pages</th>
                                <th className="table-header w-[160px]">Uploaded</th>
                                <th className="table-header w-[90px]"></th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-50">
                            {docs.map((doc) => (
                                <tr key={doc.id} className="hover:bg-gray-50 transition">
                                    <td className="table-cell">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <File size={14} className="text-primary-700" />
                                            </div>

                                            {editingId === doc.id ? (
                                                <div className="flex items-center gap-2 w-full">
                                                    <input
                                                        autoFocus
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(doc.id)}
                                                        className="text-sm border border-gray-300 rounded px-2 py-0.5 outline-none flex-1"
                                                    />
                                                    <button onClick={() => saveEdit(doc.id)} className="text-xs bg-primary-600 text-white px-2 py-1 rounded">Save</button>
                                                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                                                </div>
                                            ) : (
                                                <span
                                                    className="text-sm font-medium text-gray-800 truncate"
                                                    title={doc.filename}
                                                >
                                                    {doc.filename}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="table-cell text-gray-500 text-xs">
                                        {formatBytes(doc.file_size)}
                                    </td>

                                    <td className="table-cell text-gray-500 text-xs">
                                        {doc.page_count ?? '—'}
                                    </td>

                                    <td className="table-cell text-gray-500 text-xs">
                                        {formatDate(doc.uploaded_at)}
                                    </td>

                                    <td className="table-cell text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {editingId !== doc.id && (
                                                <button
                                                    onClick={() => startEdit(doc)}
                                                    className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-md hover:bg-gray-100"
                                                    title="Rename"
                                                >
                                                    <Edit2 size={15} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(doc.id, doc.filename)}
                                                disabled={deleting === doc.id}
                                                className="text-red-400 hover:text-red-600 transition p-1.5 rounded-md hover:bg-red-50"
                                                title="Delete"
                                            >
                                                {deleting === doc.id ? (
                                                    <Loader2 size={15} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={15} />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
