import React from 'react'

export default function MonitorsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Monitors
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your website monitors
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No monitors configured yet
          </p>
          <p className="text-gray-400 dark:text-gray-500 mt-2">
            Add your first monitor to start tracking uptime
          </p>
        </div>
      </div>
    </div>
  )
}