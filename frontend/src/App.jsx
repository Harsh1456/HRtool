import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import AskHRDocs from './pages/AskHRDocs'
import JDBuilder from './pages/JDBuilder'
import OfferLetter from './pages/OfferLetter'
import ResumeScanner from './pages/ResumeScanner'
import HRInsights from './pages/HRInsights'
import Documents from './pages/Documents'
import Settings from './pages/Settings'

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8]">
                <div className="w-10 h-10 border-4 border-primary-700 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }
    return user ? children : <Navigate to="/login" replace />
}

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Home />} />
                <Route path="ask" element={<AskHRDocs />} />
                <Route path="jd" element={<JDBuilder />} />
                <Route path="offer" element={<OfferLetter />} />
                <Route path="resume" element={<ResumeScanner />} />
                <Route path="insights" element={<HRInsights />} />
                <Route path="documents" element={<Documents />} />
                <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}
