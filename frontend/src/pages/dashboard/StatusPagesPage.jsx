import React from 'react'

export default function StatusPagesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Status Pages
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create and manage your public status pages
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No status pages created yet
          </p>
          <p className="text-gray-400 dark:text-gray-500 mt-2">
            Create a status page to keep your users informed
          </p>
        </div>
      </div>
    </div>
  )
}