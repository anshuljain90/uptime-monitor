import React from 'react'
import { Link } from 'react-router-dom'
import { Activity, Shield, Zap, Globe, CheckCircle } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="bg-white dark:bg-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Monitor Your Website's
              <span className="text-blue-600 dark:text-blue-400 block">
                Uptime & Performance
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-3xl mx-auto">
              Get instant notifications when your websites go down. Monitor performance,
              track uptime, and keep your users happy with our reliable monitoring solution.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors"
              >
                Start Monitoring Free
              </Link>
              <Link
                to="/login"
                className="border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 px-8 py-3 rounded-lg text-lg font-medium transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need to Monitor Your Sites
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Powerful features to keep your websites running smoothly
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-sm">
              <Activity className="h-12 w-12 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Real-time Monitoring
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Monitor your websites 24/7 with checks every minute from multiple locations worldwide.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-sm">
              <Shield className="h-12 w-12 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                SSL Certificate Monitoring
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Get alerts before your SSL certificates expire and avoid security warnings.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-sm">
              <Zap className="h-12 w-12 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Instant Alerts
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Receive notifications via email, SMS, or webhooks the moment something goes wrong.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-sm">
              <Globe className="h-12 w-12 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Global Monitoring
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Monitor from multiple locations around the world to ensure global accessibility.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-sm">
              <CheckCircle className="h-12 w-12 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Status Pages
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Create beautiful status pages to keep your users informed about service availability.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-sm">
              <Activity className="h-12 w-12 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Performance Analytics
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Track response times, uptime percentages, and get detailed performance insights.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 bg-blue-600 dark:bg-blue-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Start Monitoring?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of websites that trust UptimeGuard for their monitoring needs.
          </p>
          <Link
            to="/register"
            className="bg-white text-blue-600 hover:bg-gray-50 px-8 py-3 rounded-lg text-lg font-medium transition-colors"
          >
            Get Started for Free
          </Link>
        </div>
      </div>
    </div>
  )
}