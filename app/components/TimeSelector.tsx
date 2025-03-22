"use client"

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiClock, FiChevronUp, FiChevronDown } from 'react-icons/fi'

interface TimeSelectorProps {
  value: string
  onChange: (time: string) => void
}

export function TimeSelector({ value, onChange }: TimeSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [hours, setHours] = useState('00')
  const [minutes, setMinutes] = useState('00')

  // Orari comuni per accesso rapido
  const quickTimes = ['09:00', '12:00', '15:00', '18:00', '20:00']

  // Sincronizza il valore esterno con i valori interni
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':')
      setHours(h)
      setMinutes(m)
    }
  }, [value])

  // Funzione per incrementare/decrementare ore
  const adjustHours = (increment: boolean) => {
    const current = parseInt(hours)
    let newHours
    if (increment) {
      newHours = current === 23 ? 0 : current + 1
    } else {
      newHours = current === 0 ? 23 : current - 1
    }
    const formatted = newHours.toString().padStart(2, '0')
    setHours(formatted)
    onChange(`${formatted}:${minutes}`)
  }

  // Funzione per incrementare/decrementare minuti
  const adjustMinutes = (increment: boolean) => {
    const current = parseInt(minutes)
    let newMinutes
    if (increment) {
      newMinutes = current === 59 ? 0 : current + 1
    } else {
      newMinutes = current === 0 ? 59 : current - 1
    }
    const formatted = newMinutes.toString().padStart(2, '0')
    setMinutes(formatted)
    onChange(`${hours}:${formatted}`)
  }

  return (
    <div className="relative">
      {/* Input principale */}
      <div 
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-full p-3 pl-10 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl 
          focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 
          text-zinc-900 dark:text-zinc-50 outline-none cursor-pointer hover:border-blue-400 relative"
      >
        <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500 dark:text-blue-400" />
        <span>{value || 'Seleziona orario'}</span>
      </div>

      {/* Dropdown del selettore orari */}
      {showDropdown && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-xl 
            border border-zinc-200 dark:border-zinc-700 z-50"
        >
          {/* Selettore preciso */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
            <div className="flex justify-center items-center gap-2">
              {/* Selettore ore */}
              <div className="flex flex-col items-center">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => adjustHours(true)}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <FiChevronUp className="h-5 w-5 text-blue-500" />
                </motion.button>
                <input
                  type="text"
                  value={hours}
                  onChange={(e) => {
                    const val = e.target.value
                    if (/^\d{0,2}$/.test(val)) {
                      const num = parseInt(val || '0')
                      if (num >= 0 && num <= 23) {
                        const formatted = num.toString().padStart(2, '0')
                        setHours(formatted)
                        onChange(`${formatted}:${minutes}`)
                      }
                    }
                  }}
                  className="w-12 text-center p-2 text-xl font-medium bg-zinc-50 dark:bg-zinc-800 rounded-lg"
                />
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => adjustHours(false)}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <FiChevronDown className="h-5 w-5 text-blue-500" />
                </motion.button>
              </div>

              <span className="text-2xl font-medium text-zinc-400">:</span>

              {/* Selettore minuti */}
              <div className="flex flex-col items-center">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => adjustMinutes(true)}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <FiChevronUp className="h-5 w-5 text-blue-500" />
                </motion.button>
                <input
                  type="text"
                  value={minutes}
                  onChange={(e) => {
                    const val = e.target.value
                    if (/^\d{0,2}$/.test(val)) {
                      const num = parseInt(val || '0')
                      if (num >= 0 && num <= 59) {
                        const formatted = num.toString().padStart(2, '0')
                        setMinutes(formatted)
                        onChange(`${hours}:${formatted}`)
                      }
                    }
                  }}
                  className="w-12 text-center p-2 text-xl font-medium bg-zinc-50 dark:bg-zinc-800 rounded-lg"
                />
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => adjustMinutes(false)}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <FiChevronDown className="h-5 w-5 text-blue-500" />
                </motion.button>
              </div>
            </div>
          </div>

          {/* Orari rapidi */}
          <div className="p-2">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 px-2">
              Orari suggeriti
            </div>
            <div className="flex flex-wrap gap-1">
              {quickTimes.map((time) => (
                <motion.button
                  key={time}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    onChange(time)
                    const [h, m] = time.split(':')
                    setHours(h)
                    setMinutes(m)
                    setShowDropdown(false)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors duration-200
                    ${value === time 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    }`}
                >
                  {time}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
} 