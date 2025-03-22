"use client"

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  duration?: number
}

export function AnimatedCounter({ value, duration = 1000 }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const previousValue = useRef(0)
  
  useEffect(() => {
    const startValue = previousValue.current
    const endValue = value
    const startTime = performance.now()
    
    const updateValue = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Funzione di easing
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      
      const currentValue = Math.round(startValue + (endValue - startValue) * easeOutQuart)
      setDisplayValue(currentValue)
      
      if (progress < 1) {
        requestAnimationFrame(updateValue)
      }
    }
    
    requestAnimationFrame(updateValue)
    previousValue.current = value
  }, [value, duration])
  
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.5, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="font-medium text-amber-500"
    >
      {displayValue.toLocaleString()}
    </motion.span>
  )
} 