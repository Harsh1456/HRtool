import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    MessageSquare, FileText, Mail, UserCheck, BarChart2, Folder
} from 'lucide-react'

const features = [
    {
        to: '/ask',
        title: 'Ask HR Docs',
        description: 'Chat with our HR knowledge base to get instant answers about company policies, benefits, and PTO.',
        icon: MessageSquare,
        color: 'bg-blue-50 text-blue-600',
    },
    {
        to: '/jd',
        title: 'JD Builder',
        description: 'Generate comprehensive, formatted Job Descriptions instantly using our AI builder.',
        icon: FileText,
        color: 'bg-indigo-50 text-indigo-600',
    },
    {
        to: '/offer',
        title: 'Offer Letter',
        description: 'Create professional, cleanly formatted offer letters for new hires automatically.',
        icon: Mail,
        color: 'bg-purple-50 text-purple-600',
    },
    {
        to: '/documents',
        title: 'Document Manager',
        description: 'Upload and manage company handbooks and policies utilized by the AI assistant.',
        icon: Folder,
        color: 'bg-amber-50 text-amber-600',
    },
    {
        to: '/insights',
        title: 'HR Insights',
        description: 'View statistics and analytics on what employees are asking the AI about the most.',
        icon: BarChart2,
        color: 'bg-emerald-50 text-emerald-600',
    },
    {
        to: '/resume',
        title: 'Resume Scanner',
        description: 'Automatically scan and rank candidate resumes against required job descriptions.',
        icon: UserCheck,
        color: 'bg-rose-50 text-rose-600',
    }
]

export default function Home() {
    const { user } = useAuth()
    const navigate = useNavigate()

    return (
        <div className="max-w-6xl mx-auto animate-fade-in p-2">
            <div className="mb-10">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Welcome back, {user?.full_name?.split(' ')[0] || 'HR'}! 👋
                </h1>
                <p className="text-gray-500">
                    What would you like to achieve today? Select a tool from the dashboard below or use the sidebar to navigate.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {features.map((feature, idx) => {
                    const Icon = feature.icon
                    return (
                        <div
                            key={idx}
                            onClick={() => navigate(feature.to)}
                            className="card flex flex-col hover:shadow-lg transition-all duration-200 cursor-pointer group border border-gray-100 hover:border-primary-100"
                        >
                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${feature.color}`}>
                                    <Icon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-primary-700 transition-colors">
                                        {feature.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="mt-12 bg-primary-50 rounded-2xl p-6 sm:px-8 border border-primary-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-primary-900 mb-1">Keep Knowledge Up to Date</h3>
                    <p className="text-sm text-primary-700">Has the company handbook or insurance policy changed recently? Make sure the AI is using the latest rules.</p>
                </div>
                <button
                    onClick={() => navigate('/documents')}
                    className="btn-primary flex-shrink-0 shadow-sm"
                >
                    Manage PDF Documents
                </button>
            </div>
        </div>
    )
}
