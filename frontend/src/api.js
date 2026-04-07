import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('hr_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// On 401 → redirect to login
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('hr_token')
            localStorage.removeItem('hr_user')
            window.location.href = '/login'
        }
        return Promise.reject(err)
    }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
    register: (data) => api.post('/api/auth/register', data),
    login: (email, password) => {
        const form = new URLSearchParams()
        form.append('username', email)
        form.append('password', password)
        return api.post('/api/auth/login', form, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
    },
    me: () => api.get('/api/auth/me'),
    changePassword: (data) => api.put('/api/auth/change-password', data),
    updateProfile: (data) => api.put('/api/auth/profile', data),
}

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentsAPI = {
    upload: (file, onProgress) => {
        const form = new FormData()
        form.append('file', file)
        return api.post('/api/documents/upload', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: onProgress,
        })
    },
    extractText: (file) => {
        const form = new FormData()
        form.append('file', file)
        return api.post('/api/documents/extract-text', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
    },
    list: () => api.get('/api/documents'),
    view: (id, page = null) => {
        const url = page ? `/api/documents/${id}/view?page=${page}` : `/api/documents/${id}/view`
        return api.get(url, { responseType: 'blob' })
    },
    rename: (id, filename) => api.put(`/api/documents/${id}`, { filename }),
    delete: (id) => api.delete(`/api/documents/${id}`),
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chatAPI = {
    ask: (question, sessionId) => api.post('/api/chat/ask', { question, session_id: sessionId }),
    listSessions: () => api.get('/api/chat/sessions'),
    createSession: (title) => api.post('/api/chat/sessions', { title }),
    getMessages: (sessionId) => api.get(`/api/chat/sessions/${sessionId}/messages`),
    renameSession: (sessionId, title) => api.put(`/api/chat/sessions/${sessionId}`, { title }),
    deleteSession: (sessionId) => api.delete(`/api/chat/sessions/${sessionId}`),
}

// ── JD Builder ────────────────────────────────────────────────────────────────
export const jdAPI = {
    generate: (data) => api.post('/api/jd/generate', data),
    exportDocx: (data) =>
        api.post('/api/jd/export-docx', data, { responseType: 'blob' }),
    list: () => api.get('/api/jd'),
    rename: (id, title) => api.put(`/api/jd/${id}`, { title }),
    delete: (id) => api.delete(`/api/jd/${id}`),
}

// ── Offer Letter ──────────────────────────────────────────────────────────────
export const offerAPI = {
    generate: (data) => api.post('/api/offer/generate', data),
    exportDocx: (data) =>
        api.post('/api/offer/export-docx', data, { responseType: 'blob' }),
    list: () => api.get('/api/offer'),
    rename: (id, candidate_name, position) => api.put(`/api/offer/${id}`, { candidate_name, position }),
    delete: (id) => api.delete(`/api/offer/${id}`),
}

// ── Resume Scanner ────────────────────────────────────────────────────────────
export const resumeAPI = {
    scan: (jdText, files, candidateName, role) => {
        const form = new FormData()
        form.append('jd_text', jdText)
        if (candidateName) form.append('candidate_name', candidateName)
        if (role) form.append('role', role)
        files.forEach((f) => form.append('files', f))
        return api.post('/api/resume/scan', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
    },
    list: () => api.get('/api/resume'),
    rename: (id, candidate_name, role) => api.put(`/api/resume/${id}`, { candidate_name, role }),
    delete: (id) => api.delete(`/api/resume/${id}`),
}

// ── Insights ──────────────────────────────────────────────────────────────────
export const insightsAPI = {
    stats: () => api.get('/api/insights/stats'),
    scannedResumes: () => api.get('/api/insights/scanned-resumes'),
    jdRecords: () => api.get('/api/insights/jd-records'),
    offerRecords: () => api.get('/api/insights/offer-records'),
}

export default api
