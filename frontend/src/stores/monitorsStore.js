import { create } from 'zustand'
import axios from 'axios'
import toast from 'react-hot-toast'

export const useMonitorsStore = create((set, get) => ({
  monitors: [],
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  },

  // Fetch all monitors
  fetchMonitors: async (params = {}) => {
    set({ isLoading: true, error: null })
    try {
      const response = await axios.get('/monitors', { params })
      set({
        monitors: response.data.monitors,
        pagination: response.data.pagination,
        isLoading: false
      })
    } catch (error) {
      console.error('Failed to fetch monitors:', error)
      set({
        error: error.response?.data?.message || 'Failed to fetch monitors',
        isLoading: false
      })
    }
  },

  // Create new monitor
  createMonitor: async (monitorData) => {
    set({ isLoading: true })
    try {
      const response = await axios.post('/monitors', monitorData)
      
      // Add to monitors list
      set(state => ({
        monitors: [response.data.monitor, ...state.monitors],
        isLoading: false
      }))

      toast.success('Monitor created successfully')
      return { success: true, monitor: response.data.monitor }

    } catch (error) {
      set({ isLoading: false })
      const message = error.response?.data?.message || 'Failed to create monitor'
      toast.error(message)
      return { success: false, error: message }
    }
  },

  // Update monitor
  updateMonitor: async (id, updates) => {
    set({ isLoading: true })
    try {
      await axios.put(`/monitors/${id}`, updates)
      
      // Update monitor in list
      set(state => ({
        monitors: state.monitors.map(monitor =>
          monitor.id === id ? { ...monitor, ...updates } : monitor
        ),
        isLoading: false
      }))

      toast.success('Monitor updated successfully')
      return { success: true }

    } catch (error) {
      set({ isLoading: false })
      const message = error.response?.data?.message || 'Failed to update monitor'
      toast.error(message)
      return { success: false, error: message }
    }
  },

  // Delete monitor
  deleteMonitor: async (id) => {
    try {
      await axios.delete(`/monitors/${id}`)
      
      // Remove from monitors list
      set(state => ({
        monitors: state.monitors.filter(monitor => monitor.id !== id)
      }))

      toast.success('Monitor deleted successfully')
      return { success: true }

    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete monitor'
      toast.error(message)
      return { success: false, error: message }
    }
  },

  // Test monitor
  testMonitor: async (id) => {
    try {
      const response = await axios.post(`/monitors/${id}/test`)
      toast.success('Monitor test completed')
      return { success: true, result: response.data.result }

    } catch (error) {
      const message = error.response?.data?.message || 'Monitor test failed'
      toast.error(message)
      return { success: false, error: message }
    }
  },

  // Get monitor checks/history
  getMonitorChecks: async (id, params = {}) => {
    try {
      const response = await axios.get(`/monitors/${id}/checks`, { params })
      return { success: true, data: response.data }

    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch checks'
      toast.error(message)
      return { success: false, error: message }
    }
  },

  // Get single monitor
  getMonitor: async (id) => {
    try {
      const response = await axios.get(`/monitors/${id}`)
      return { success: true, monitor: response.data.monitor }

    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch monitor'
      toast.error(message)
      return { success: false, error: message }
    }
  },

  // Get monitor statistics
  getMonitorStats: async (id, period = '30d') => {
    try {
      const response = await axios.get(`/statistics/monitors/${id}`, {
        params: { period }
      })
      return { success: true, stats: response.data }

    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch statistics'
      return { success: false, error: message }
    }
  },

  // Get monitors by status
  getMonitorsByStatus: () => {
    const { monitors } = get()
    return {
      up: monitors.filter(m => m.current_status === 'up'),
      down: monitors.filter(m => m.current_status === 'down'),
      unknown: monitors.filter(m => m.current_status === 'unknown'),
      total: monitors.length
    }
  },

  // Real-time updates via WebSocket (for future implementation)
  subscribeToUpdates: (monitorId, callback) => {
    // TODO: Implement WebSocket connection for real-time updates
    console.log('WebSocket subscription not yet implemented')
  },

  // Clear monitors
  clearMonitors: () => {
    set({ monitors: [], error: null })
  }
}))
