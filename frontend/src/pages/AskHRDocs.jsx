import { useState, useEffect, useRef } from 'react'
import { chatAPI, documentsAPI } from '../api'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import {
    Upload, Send, FileText, ChevronDown, ChevronUp, Bot, Loader2,
    File, Plus, MessageSquare, Trash2, Edit2, MoreVertical, X, XCircle, FilePlus, Folder, History, Search
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────

const SUGGESTIONS_BANK = [
    "What is our work from home policy?",
    "How many vacation days do I get?",
    "How do I request time off?",
    "What are the core working hours?",
    "When are performance reviews?",
    "How does the promotion process work?",
    "What health insurance plans are available?",
    "How do I submit an expense report?",
    "What is the company holiday schedule?",
    "Are there any professional development budgets?"
]

// ── Components ───────────────────────────────────────────────────────────────

function CitationItem({ source, onViewerOpen }) {
    return (
        <button
            type="button"
            onClick={() => onViewerOpen(source)}
            className="flex items-start gap-3 py-2 px-2 -mx-2 text-left hover:bg-gray-100 rounded transition w-full"
        >
            <FileText size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">{source.filename}</span>
                {source.page_number && (
                    <span className="text-gray-500"> — Page {source.page_number}</span>
                )}
            </div>
        </button>
    )
}

function PdfViewerModal({ docSource, onClose }) {
    const [pdfUrl, setPdfUrl] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!docSource) return
        setLoading(true)
        documentsAPI.view(docSource.document_id, docSource.page_number)
            .then(res => {
                const url = URL.createObjectURL(res.data)
                setPdfUrl(url)
            })
            .catch(() => {
                toast.error('Failed to load PDF preview')
            })
            .finally(() => setLoading(false))

        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl)
        }
    }, [docSource])

    if (!docSource) return null

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex flex-col p-4 sm:p-8">
            <div className="flex justify-end mb-4">
                <button onClick={onClose} className="p-2 bg-white rounded-full text-gray-800 hover:bg-gray-200 transition shadow-lg">
                    <X size={20} />
                </button>
            </div>
            <div className="flex-1 bg-white rounded-xl shadow-2xl overflow-hidden flex items-center justify-center">
                {loading ? <Loader2 className="animate-spin text-primary-500 w-8 h-8" /> :
                    pdfUrl ? <iframe src={pdfUrl} className="w-full h-full border-none" /> :
                        <p className="text-gray-500">Failed to load preview</p>}
            </div>
        </div>
    )
}

function ManagePdfsModal({ isOpen, onClose }) {
    const [documents, setDocuments] = useState([])
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileRef = useRef()

    const loadDocuments = async () => {
        setLoading(true)
        try {
            const res = await documentsAPI.list()
            setDocuments(res.data)
        } catch (err) {
            toast.error('Failed to load documents')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) loadDocuments()
    }, [isOpen])

    const handleUpload = async (file) => {
        if (!file) return
        setUploading(true)
        const tid = toast.loading(`Uploading ${file.name}…`)
        try {
            const res = await documentsAPI.upload(file)
            toast.success(`Uploaded! ${res.data.chunks_created} chunks indexed.`, { id: tid })
            loadDocuments()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Upload failed', { id: tid })
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this document?')) return
        const tid = toast.loading('Deleting...')
        try {
            await documentsAPI.delete(id)
            toast.success('Document deleted', { id: tid })
            loadDocuments()
        } catch (err) {
            toast.error('Failed to delete document', { id: tid })
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <FilePlus size={18} className="text-primary-600" />
                        Manage HR Documents
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm text-gray-500">
                            Shared knowledge base — documents uploaded here are searchable by every user's chatbot.
                        </p>
                        <label htmlFor="modal_doc_upload" className="sr-only">Upload HR Document</label>
                        <input
                            id="modal_doc_upload"
                            name="modal_doc_upload"
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.docx,.doc"
                            className="hidden"
                            onChange={(e) => handleUpload(e.target.files[0])}
                        />
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="btn-primary py-1.5 px-4 text-sm"
                        >
                            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                            Upload File
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
                    ) : documents.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                            <FileText size={32} className="mx-auto text-gray-300 mb-3" />
                            <p className="text-sm font-medium text-gray-900">No documents uploaded yet</p>
                            <p className="text-xs text-gray-500 mt-1">Upload your first employee handbook or policy</p>
                        </div>
                    ) : (
                        <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                            {documents.map((doc) => (
                                <div key={doc.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                            <FileText size={14} className="text-blue-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(doc.uploaded_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(doc.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition"
                                        title="Delete document"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AskHRDocs() {
    const navigate = useNavigate()
    const [sessions, setSessions] = useState([])
    const [activeSession, setActiveSession] = useState(null)
    const [messages, setMessages] = useState([])
    const [question, setQuestion] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef(null)
    const [viewingSource, setViewingSource] = useState(null)

    // Session list actions
    const [editingSessionId, setEditingSessionId] = useState(null)
    const [editTitle, setEditTitle] = useState('')
    const [isHistoryVisible, setIsHistoryVisible] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [filteredSuggestions, setFilteredSuggestions] = useState([])

    useEffect(() => {
        if (!question.trim()) {
            setFilteredSuggestions([])
            setShowSuggestions(false)
            return
        }
        const lowerQ = question.toLowerCase()
        const matches = SUGGESTIONS_BANK.filter(s => s.toLowerCase().includes(lowerQ))
        setFilteredSuggestions(matches.slice(0, 5))
        setShowSuggestions(matches.length > 0)
    }, [question])

    useEffect(() => {
        loadSessions()
    }, [])

    useEffect(() => {
        if (activeSession) {
            loadMessages(activeSession.id)
        } else {
            setMessages([])
        }
    }, [activeSession])

    useEffect(() => {
        // Scroll to bottom on new message
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const loadSessions = async () => {
        try {
            const res = await chatAPI.listSessions()
            setSessions(res.data)
        } catch (err) {
            toast.error('Failed to load chat history')
        }
    }

    const loadMessages = async (sessionId) => {
        try {
            const res = await chatAPI.getMessages(sessionId)
            setMessages(res.data)
        } catch (err) {
            toast.error('Failed to load messages')
        }
    }

    const startNewChat = () => {
        setActiveSession(null)
        setMessages([])
    }

    const handleDeleteSession = async (id, e) => {
        e.stopPropagation()
        if (!window.confirm('Delete this chat?')) return
        try {
            await chatAPI.deleteSession(id)
            setSessions(sessions.filter((s) => s.id !== id))
            if (activeSession?.id === id) startNewChat()
        } catch (err) {
            toast.error('Failed to delete chat')
        }
    }

    const handleRenameStart = (session, e) => {
        e.stopPropagation()
        setEditingSessionId(session.id)
        setEditTitle(session.title)
    }

    const handleRenameSave = async (id) => {
        if (!editTitle.trim()) {
            setEditingSessionId(null)
            return
        }
        try {
            await chatAPI.renameSession(id, editTitle)
            setSessions(sessions.map((s) => (s.id === id ? { ...s, title: editTitle } : s)))
            setEditingSessionId(null)
        } catch (err) {
            toast.error('Failed to rename')
        }
    }

    const handleAsk = async () => {
        if (!question.trim() || loading) return

        const userMsg = { role: 'user', content: question.trim() }
        setMessages((prev) => [...prev, userMsg])
        setQuestion('')
        setLoading(true)

        try {
            const res = await chatAPI.ask(userMsg.content, activeSession?.id)

            // If it was a new chat, we'd get a session_id back. Let's select it and optionally refresh list
            if (!activeSession) {
                const newSession = { id: res.data.session_id, title: userMsg.content.slice(0, 80) }
                setSessions([newSession, ...sessions])
                setActiveSession(newSession)
            }

            const botMsg = {
                role: 'assistant',
                content: res.data.answer,
                sources: res.data.sources
            }
            setMessages((prev) => [...prev, botMsg])
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to get answer. Make sure documents are uploaded.')
            setMessages((prev) => prev.slice(0, -1)) // Remove the user message on fail
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex h-full -m-4 sm:-m-6 bg-[#f4f6f8] relative overflow-hidden">
            {/* ── Chat History Sidebar ────────────────────────────────────────────── */}
            <aside className={`
                fixed inset-y-0 left-0 z-40 w-72 bg-gray-50 border-r border-gray-200 flex flex-col pt-6 flex-shrink-0 transition-all duration-300 ease-in-out
                lg:static lg:h-auto lg:translate-x-0
                ${isHistoryVisible
                    ? 'translate-x-0 opacity-100'
                    : '-translate-x-full lg:w-0 lg:opacity-0 lg:overflow-hidden lg:border-none'
                }
            `}>
                <div className="px-4 mb-4">
                    <button
                        onClick={startNewChat}
                        className="w-full flex items-center justify-between px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm"
                    >
                        <span className="flex items-center gap-2">
                            <Plus size={16} className="text-gray-400" />
                            New Chat
                        </span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-4">
                    <p className="px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4">
                        Recent Chats
                    </p>
                    {sessions.length === 0 && (
                        <p className="text-xs text-gray-500 px-2 italic">No chats yet</p>
                    )}
                    {sessions.map((session) => (
                        <div
                            key={session.id}
                            onClick={() => { setActiveSession(session); setIsHistoryVisible(false); }}
                            className={`group relative flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors ${activeSession?.id === session.id
                                ? 'bg-primary-50 text-primary-800'
                                : 'text-gray-700 hover:bg-gray-200/50'
                                }`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden flex-1 mr-4">
                                <MessageSquare size={14} className="flex-shrink-0 opacity-50" />
                                {editingSessionId === session.id ? (
                                    <>
                                        <label htmlFor="rename_session" className="sr-only">Rename Chat Session</label>
                                        <input
                                            id="rename_session"
                                            name="rename_session"
                                            autoFocus
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            onBlur={() => handleRenameSave(session.id)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleRenameSave(session.id)}
                                            className="flex-1 bg-white border border-primary-300 rounded px-1 py-0.5 text-sm outline-none w-full"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </>
                                ) : (
                                    <span className="truncate">{session.title}</span>
                                )}
                            </div>

                            {/* Action buttons (always visible on desktop hover) */}
                            {editingSessionId !== session.id && (
                                <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => handleRenameStart(session, e)}
                                        className="p-1 text-gray-400 hover:text-gray-800 transition"
                                    >
                                        <Edit2 size={13} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDeleteSession(session.id, e)}
                                        className="p-1 text-gray-400 hover:text-red-500 transition"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </aside>

            {/* Mobile Overlay */}
            {isHistoryVisible && (
                <div
                    className="fixed inset-0 bg-black/20 z-30 lg:hidden backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                    onClick={() => setIsHistoryVisible(false)}
                />
            )}

            {/* ── Main Chat Area ─────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col bg-white">
                {/* Header */}
                <div className="h-14 border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 bg-white sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsHistoryVisible(!isHistoryVisible)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg touch-target transition-colors"
                            title={isHistoryVisible ? "Hide History" : "Show History"}
                        >
                            <History size={20} className={isHistoryVisible ? 'text-primary-700' : ''} />
                        </button>
                        <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate max-w-[150px] sm:max-w-none">
                            {activeSession ? activeSession.title : 'New Chat'}
                        </h2>
                    </div>
                    <button
                        onClick={() => navigate('/documents')}
                        className="flex items-center gap-2 text-xs sm:text-sm font-medium text-primary-600 bg-primary-50 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-primary-100 transition whitespace-nowrap"
                    >
                        <Folder size={14} className="sm:size-4" /> Docs <span className="hidden xs:inline">Manage PDFs</span>
                    </button>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto opacity-60">
                            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-4 text-primary-600">
                                <Bot size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">SPC HR AI Assistant</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                Ask me any questions about our internal policies, benefits, employee handbooks, and more.
                            </p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-2 sm:gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-lg bg-primary-700 text-white flex items-center justify-center flex-shrink-0 mt-1">
                                        <Bot size={16} />
                                    </div>
                                )}

                                <div className={`max-w-[85%] sm:max-w-2xl rounded-2xl p-3 sm:p-4 ${msg.role === 'user'
                                    ? 'bg-primary-600 text-white rounded-br-none'
                                    : 'bg-gray-50 border border-gray-100 rounded-tl-none'
                                    }`}>
                                    {/* Content */}
                                    <div className={`text-sm leading-relaxed prose prose-sm max-w-none ${msg.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                                        {msg.role === 'assistant' ? (
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        ) : (
                                            <p className="m-0 whitespace-pre-wrap">{msg.content}</p>
                                        )}
                                    </div>

                                    {/* Source Attribution Badge */}
                                    {msg.role === 'assistant' && msg.source && (
                                        <div className="mt-4 pt-4 border-t border-gray-200/60">
                                            {msg.source === 'docs' && (
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                                                    <span>📄</span> Answered from: Uploaded Documents
                                                </div>
                                            )}
                                            {msg.source === 'general' && (
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                                                    <span>🌐</span> Answered from: General AI Knowledge
                                                </div>
                                            )}
                                            {msg.source === 'both' && (
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                                                    <span>📄🌐</span> Answered from: Uploaded Documents + General AI Knowledge
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Citations */}
                                    {msg.sources && msg.sources.length > 0 && msg.sources.some(s => s.type !== 'general' && s.filename !== 'General AI Knowledge') && (
                                        <div className="mt-3">
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Document Citations</p>
                                            <div className="space-y-1">
                                                {msg.sources.filter(s => s.type !== 'general' && s.filename !== 'General AI Knowledge').map((src, i) => (
                                                    <CitationItem key={i} source={src} onViewerOpen={setViewingSource} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    {loading && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-primary-700 text-white flex items-center justify-center flex-shrink-0">
                                <Loader2 size={16} className="animate-spin" />
                            </div>
                            <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="relative p-4 bg-white border-t border-gray-100">
                    {/* Suggestions Dropdown */}
                    {showSuggestions && (
                        <div className="absolute bottom-full left-0 right-0 max-w-4xl mx-auto px-4 mb-2 z-50">
                            <div className="bg-white rounded-xl shadow-xl shadow-black/5 border border-gray-100 overflow-hidden divide-y divide-gray-50/50">
                                {filteredSuggestions.map((suggestion, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setQuestion(suggestion)
                                            setShowSuggestions(false)
                                            document.getElementById('chat_question')?.focus()
                                        }}
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors flex items-center gap-3"
                                    >
                                        <Search size={14} className="text-gray-400" />
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="max-w-4xl mx-auto flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-2 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 transition-shadow">
                        <label htmlFor="chat_question" className="sr-only">Ask a question</label>
                        <textarea
                            id="chat_question"
                            name="chat_question"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleAsk()
                                }
                            }}
                            placeholder="Ask a question about HR policies..."
                            className="flex-1 max-h-32 min-h-[40px] bg-transparent resize-none outline-none py-2 px-3 text-sm text-gray-800 placeholder-gray-400"
                            rows={1}
                        />
                        <button
                            onClick={handleAsk}
                            disabled={loading || !question.trim()}
                            className="w-10 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-0.5"
                        >
                            <Send size={16} className={question.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
                        </button>
                    </div>
                    <p className="text-center text-[11px] text-gray-400 mt-2">
                        AI can make mistakes. Please verify important information with official documents.
                    </p>
                </div>
            </div>
            <PdfViewerModal docSource={viewingSource} onClose={() => setViewingSource(null)} />
        </div>
    )
}
