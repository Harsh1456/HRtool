import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
                <App />
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 3500,
                        style: {
                            borderRadius: '10px',
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '14px',
                        },
                        success: {
                            style: { background: '#e8f5e9', color: '#1b5e20', border: '1px solid #a5d6a7' },
                            iconTheme: { primary: '#2e7d32', secondary: '#fff' },
                        },
                        error: {
                            style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5' },
                            iconTheme: { primary: '#dc2626', secondary: '#fff' },
                        },
                    }}
                />
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
)
