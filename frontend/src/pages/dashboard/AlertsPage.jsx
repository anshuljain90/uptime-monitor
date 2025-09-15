import React from 'react'

export default function AlertsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Alerts
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure alert channels and notification settings
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No alert channels configured
          </p>
          <p className="text-gray-400 dark:text-gray-500 mt-2">
            Set up email, SMS, or webhook notifications
          </p>
        </div>
      </div>
    </div>
  )
}