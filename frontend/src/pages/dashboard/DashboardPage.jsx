import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Plus,
  ExternalLink,
  RefreshCw
} from 'lucide-react'
import { useMonitorsStore } from '../../stores/monitorsStore'
import { useAuthStore } from '../../stores/authStore'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import StatusIndicator from '../../components/ui/StatusIndicator'
import UptimeChart from '../../components/dashboard/UptimeChart'
import ResponseTimeChart from '../../components/dashboard/ResponseTimeChart'
import { formatDistanceToNow } from 'date-fns'

function DashboardPage() {
  const { user } = useAuthStore()
  const { 
    monitors, 
    isLoading, 
    fetchMonitors, 
    getMonitorsByStatus,
    getMonitorStats
  } = useMonitorsStore()
  
  const [stats, setStats] = useState({
    totalMonitors: 0,
    upMonitors: 0,
    downMonitors: 0,
    avgUptime: 0,
    avgResponseTime: 0
  })
  const [recentIncidents, setRecentIncidents] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    // Calculate stats when monitors change
    if (monitors.length > 0) {
      const statusCounts = getMonitorsByStatus()
      const totalUptime = monitors.reduce((sum, m) => sum + (m.uptime_percentage_30d || 100), 0)
      const totalResponseTime = monitors.reduce((sum, m) => sum + (m.last_response_time || 0), 0)
      
      setStats({
        totalMonitors: statusCounts.total,
        upMonitors: statusCounts.up.length,
        downMonitors: statusCounts.down.length,
        avgUptime: statusCounts.total > 0 ? totalUptime / statusCounts.total : 100,
        avgResponseTime: statusCounts.total > 0 ? totalResponseTime / statusCounts.total : 0
      })
    }
  }, [monitors])

  const loadDashboardData = async () => {
    setRefreshing(true)
    await fetchMonitors({ limit: 10 })
    // Load recent incidents
    // TODO: Implement incidents API
    setRefreshing(false)
  }

  const handleRefresh = () => {
    loadDashboardData()
  }

  if (isLoading && monitors.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.username}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Here's what's happening with your monitors today.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link to="/dashboard/monitors" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Monitor
          </Link>
        </div>
      </div>

      {/* Statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Activity className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Monitors</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats.totalMonitors}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-success-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Online</p>
                <p className="text-2xl font-semibold text-success-600">
                  {stats.upMonitors}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-danger-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Offline</p>
                <p className="text-2xl font-semibold text-danger-600">
                  {stats.downMonitors}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Uptime</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {stats.avgUptime.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent monitors */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Recent Monitors
                </h3>
                <Link 
                  to="/dashboard/monitors" 
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  View all
                </Link>
              </div>
            </div>
            <div className="card-body p-0">
              {monitors.length === 0 ? (
                <div className="p-6 text-center">
                  <Activity className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    No monitors yet
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Get started by creating your first monitor.
                  </p>
                  <div className="mt-6">
                    <Link to="/dashboard/monitors" className="btn-primary">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Monitor
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {monitors.slice(0, 5).map((monitor) => (
                    <div key={monitor.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <StatusIndicator status={monitor.current_status} />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {monitor.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {monitor.url || monitor.hostname}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {(monitor.uptime_percentage_30d || 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              30-day uptime
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {monitor.last_response_time || 0}ms
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {monitor.last_checked_at ? (
                                formatDistanceToNow(new Date(monitor.last_checked_at), { addSuffix: true })
                              ) : (
                                'Never checked'
                              )}
                            </p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats and actions */}
        <div className="space-y-6">
          {/* System status */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                System Status
              </h3>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Overall Status</span>
                  <StatusIndicator 
                    status={stats.downMonitors > 0 ? 'down' : 'up'} 
                    showText 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Avg Response Time</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {Math.round(stats.avgResponseTime)}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Last Update</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDistanceToNow(new Date(), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Quick Actions
              </h3>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                <Link 
                  to="/dashboard/monitors" 
                  className="flex items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <Plus className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Add Monitor
                  </span>
                </Link>
                <Link 
                  to="/dashboard/status-pages" 
                  className="flex items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <ExternalLink className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Create Status Page
                  </span>
                </Link>
                <Link 
                  to="/dashboard/alerts" 
                  className="flex items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <AlertTriangle className="h-5 w-5 text-primary-600 mr-3" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Setup Alerts
                  </span>
                </Link>
              </div>
            </div>
          </div>

          {/* Recent incidents */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Recent Incidents
              </h3>
            </div>
            <div className="card-body">
              {recentIncidents.length === 0 ? (
                <div className="text-center py-4">
                  <CheckCircle className="mx-auto h-8 w-8 text-success-600" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    No recent incidents
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentIncidents.map((incident) => (
                    <div key={incident.id} className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 text-danger-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {incident.monitor_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(incident.started_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts section */}
      {monitors.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Uptime Overview
              </h3>
            </div>
            <div className="card-body">
              <UptimeChart monitors={monitors.slice(0, 5)} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Response Times
              </h3>
            </div>
            <div className="card-body">
              <ResponseTimeChart monitors={monitors.slice(0, 5)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
