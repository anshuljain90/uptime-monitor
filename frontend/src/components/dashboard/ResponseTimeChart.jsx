import React from 'react'

export default function ResponseTimeChart({ monitors = [] }) {
  return (
    <div className="w-full h-64 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Response time chart will be displayed here
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Chart implementation coming soon
        </p>
      </div>
    </div>
  )
}