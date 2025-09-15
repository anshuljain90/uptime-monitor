import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'light', // 'light', 'dark', 'system'
      
      initializeTheme: () => {
        const { theme } = get()
        
        if (theme === 'system') {
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
          document.documentElement.classList.toggle('dark', systemTheme === 'dark')
        } else {
          document.documentElement.classList.toggle('dark', theme === 'dark')
        }
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          if (get().theme === 'system') {
            document.documentElement.classList.toggle('dark', e.matches)
          }
        })
      },
      
      setTheme: (newTheme) => {
        set({ theme: newTheme })
        
        if (newTheme === 'system') {
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
          document.documentElement.classList.toggle('dark', systemTheme === 'dark')
        } else {
          document.documentElement.classList.toggle('dark', newTheme === 'dark')
        }
      },
      
      toggleTheme: () => {
        const { theme } = get()
        const newTheme = theme === 'light' ? 'dark' : 'light'
        get().setTheme(newTheme)
      },
      
      isDark: () => {
        const { theme } = get()
        if (theme === 'system') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches
        }
        return theme === 'dark'
      }
    }),
    {
      name: 'theme-storage'
    }
  )
)
