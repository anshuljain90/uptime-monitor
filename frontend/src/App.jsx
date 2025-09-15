import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { useThemeStore } from './stores/themeStore'

// Layout components
import ProtectedRoute from './components/auth/ProtectedRoute'
import PublicLayout from './components/layout/PublicLayout'
import DashboardLayout from './components/layout/DashboardLayout'

// Auth pages
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'

// Dashboard pages
import DashboardPage from './pages/dashboard/DashboardPage'
import MonitorsPage from './pages/dashboard/MonitorsPage'
import StatusPagesPage from './pages/dashboard/StatusPagesPage'
import AlertsPage from './pages/dashboard/AlertsPage'
import SettingsPage from './pages/dashboard/SettingsPage'

// Public pages
import HomePage from './pages/public/HomePage'
import StatusPage from './pages/public/StatusPage'
import NotFoundPage from './pages/public/NotFoundPage'

function App() {
  const { user, initializeAuth } = useAuthStore()
  const { theme, initializeTheme } = useThemeStore()

  useEffect(() => {
    initializeAuth()
    initializeTheme()
  }, [])

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<PublicLayout />}>
          <Route index element={user ? <Navigate to="/dashboard" replace /> : <HomePage />} />
          <Route path="login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
          <Route path="register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
        </Route>

        {/* Public status pages */}
        <Route path="/status/:slug" element={<StatusPage />} />

        {/* Protected dashboard routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="monitors" element={<MonitorsPage />} />
          <Route path="status-pages" element={<StatusPagesPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* 404 page */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}

export default App
