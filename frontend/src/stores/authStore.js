import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'
import toast from 'react-hot-toast'

// Configure axios defaults
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8787/api'
axios.defaults.headers.common['Content-Type'] = 'application/json'

// Add request interceptor to include auth token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Add response interceptor to handle auth errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth state on 401
      useAuthStore.getState().logout()
      toast.error('Session expired. Please log in again.')
    }
    return Promise.reject(error)
  }
)

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isInitialized: false,

      // Initialize auth state on app start
      initializeAuth: async () => {
        const token = localStorage.getItem('token')
        if (token) {
          try {
            const response = await axios.get('/auth/profile')
            set({
              user: response.data.user,
              token,
              isInitialized: true
            })
          } catch (error) {
            console.error('Failed to initialize auth:', error)
            localStorage.removeItem('token')
            set({ isInitialized: true })
          }
        } else {
          set({ isInitialized: true })
        }
      },

      // Login user
      login: async (credentials) => {
        set({ isLoading: true })
        try {
          const response = await axios.post('/auth/login', credentials)
          const { token, user } = response.data

          localStorage.setItem('token', token)
          set({
            user,
            token,
            isLoading: false
          })

          toast.success(`Welcome back, ${user.username}!`)
          return { success: true }

        } catch (error) {
          set({ isLoading: false })
          const message = error.response?.data?.message || 'Login failed'
          toast.error(message)
          return { success: false, error: message }
        }
      },

      // Register user
      register: async (userData) => {
        set({ isLoading: true })
        try {
          const response = await axios.post('/auth/register', userData)
          const { token, user } = response.data

          localStorage.setItem('token', token)
          set({
            user,
            token,
            isLoading: false
          })

          toast.success(`Welcome to UptimeGuard, ${user.username}!`)
          return { success: true }

        } catch (error) {
          set({ isLoading: false })
          const message = error.response?.data?.message || 'Registration failed'
          toast.error(message)
          return { success: false, error: message }
        }
      },

      // Logout user
      logout: () => {
        localStorage.removeItem('token')
        set({
          user: null,
          token: null,
          isLoading: false
        })
        toast.success('Logged out successfully')
      },

      // Update user profile
      updateProfile: async (updates) => {
        set({ isLoading: true })
        try {
          const response = await axios.put('/auth/profile', updates)
          
          // Update user data if email was changed
          if (updates.email) {
            set(state => ({
              user: { ...state.user, email: updates.email },
              isLoading: false
            }))
          } else {
            set({ isLoading: false })
          }

          toast.success('Profile updated successfully')
          return { success: true }

        } catch (error) {
          set({ isLoading: false })
          const message = error.response?.data?.message || 'Update failed'
          toast.error(message)
          return { success: false, error: message }
        }
      },

      // Check if user is authenticated
      isAuthenticated: () => {
        const { user, token } = get()
        return !!(user && token)
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token
      })
    }
  )
)
