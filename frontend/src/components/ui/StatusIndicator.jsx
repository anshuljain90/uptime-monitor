import React from 'react'
import { CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react'
import { clsx } from 'clsx'

function StatusIndicator({ status, size = 'sm', showText = false, className = '' }) {
  const statusConfig = {
    up: {
      icon: CheckCircle,
      text: 'Up',
      className: 'text-success-600',
      bgClassName: 'bg-success-100',
      dotClassName: 'bg-success-500'
    },
    down: {
      icon: XCircle,
      text: 'Down', 
      className: 'text-danger-600',
      bgClassName: 'bg-danger-100',
      dotClassName: 'bg-danger-500'
    },
    timeout: {
      icon: Clock,
      text: 'Timeout',
      className: 'text-warning-600', 
      bgClassName: 'bg-warning-100',
      dotClassName: 'bg-warning-500'
    },
    error: {
      icon: AlertCircle,
      text: 'Error',
      className: 'text-danger-600',
      bgClassName: 'bg-danger-100', 
      dotClassName: 'bg-danger-500'
    },
    unknown: {
      icon: AlertCircle,
      text: 'Unknown',
      className: 'text-gray-600',
      bgClassName: 'bg-gray-100',
      dotClassName: 'bg-gray-500'
    }
  }

  const config = statusConfig[status] || statusConfig.unknown
  const Icon = config.icon

  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4', 
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }

  const dotSizeClasses = {
    xs: 'h-2 w-2',
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3', 
    lg: 'h-4 w-4'
  }

  if (showText) {
    return (
      <div className={clsx('inline-flex items-center space-x-1.5', className)}>
        <div className={clsx('rounded-full', dotSizeClasses[size], config.dotClassName)} />
        <span className={clsx('text-sm font-medium', config.className)}>
          {config.text}
        </span>
      </div>
    )
  }

  return (
    <Icon className={clsx(sizeClasses[size], config.className, className)} />
  )
}

export default StatusIndicator
