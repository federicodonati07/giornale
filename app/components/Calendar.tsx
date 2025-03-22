"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

interface CalendarProps {
  selectedDate: Date | null
  onSelectDate: (date: Date) => void
  minDate?: Date
  maxDate?: Date
  scheduledDates?: Date[]
}

export function Calendar({ selectedDate, onSelectDate, minDate = new Date(), maxDate, scheduledDates = [] }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Funzioni helper per il calendario
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const isDateDisabled = (date: Date) => {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const minDateTime = new Date(minDate)
    minDateTime.setHours(0, 0, 0, 0)
    
    if (maxDate) {
      const maxDateTime = new Date(maxDate)
      maxDateTime.setHours(23, 59, 59, 999)
      return startOfDay < minDateTime || startOfDay > maxDateTime
    }
    
    return startOfDay < minDateTime
  }

  const isSelectedDate = (date: Date) => {
    return selectedDate?.toDateString() === date.toDateString()
  }

  const isToday = (date: Date) => {
    return new Date().toDateString() === date.toDateString()
  }

  const isScheduledDate = (date: Date) => {
    return scheduledDates.some(scheduledDate => scheduledDate.toDateString() === date.toDateString())
  }

  // Aggiungi questa funzione per contare gli articoli per data
  const getScheduledArticlesCount = (date: Date, scheduledDates: Date[] = []) => {
    return scheduledDates.filter(scheduledDate => 
      scheduledDate.getDate() === date.getDate() &&
      scheduledDate.getMonth() === date.getMonth() &&
      scheduledDate.getFullYear() === date.getFullYear()
    ).length
  }

  // Navigazione tra i mesi
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const handleDateSelect = (date: Date) => {
    // Imposta l'ora a mezzanotte UTC per evitare problemi di fuso orario
    const selectedDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    onSelectDate(selectedDate)
  }

  // Genera la griglia del calendario
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const days = []

    // Giorni del mese precedente
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10" />)
    }

    // Giorni del mese corrente
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      const disabled = isDateDisabled(date)
      const scheduled = isScheduledDate(date)
      
      const scheduledCount = getScheduledArticlesCount(date, scheduledDates)
      
      days.push(
        <motion.button
          key={day}
          whileHover={!disabled ? { scale: 1.1 } : undefined}
          whileTap={!disabled ? { scale: 0.95 } : undefined}
          onClick={() => !disabled && handleDateSelect(date)}
          disabled={disabled}
          className={`
            h-10 w-10 rounded-full flex items-center justify-center text-sm
            transition-colors duration-200
            ${disabled 
              ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed' 
              : 'hover:bg-amber-100 dark:hover:bg-amber-900/30 cursor-pointer'
            }
            ${isSelectedDate(date) 
              ? 'bg-amber-500 text-white hover:bg-amber-600' 
              : ''
            }
            ${isToday(date) && !isSelectedDate(date)
              ? 'border-2 border-amber-500 text-amber-500'
              : ''
            }
            ${scheduled && !isSelectedDate(date)
              ? 'bg-green-200 dark:bg-green-800'
              : ''
            }
          `}
        >
          <span>{day}</span>
          {scheduledCount > 0 && (
            <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] text-xs font-medium bg-amber-500 text-white rounded-full">
              {scheduledCount}
            </span>
          )}
        </motion.button>
      )
    }

    return days
  }

  return (
    <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl shadow-lg">
      {/* Header del calendario */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
          {currentMonth.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={previousMonth}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <FiChevronLeft className="w-5 h-5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={nextMonth}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <FiChevronRight className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Giorni della settimana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map((day) => (
          <div key={day} className="h-10 flex items-center justify-center text-xs font-medium text-zinc-500">
            {day}
          </div>
        ))}
      </div>

      {/* Griglia dei giorni */}
      <div className="grid grid-cols-7 gap-1">
        {generateCalendarDays()}
      </div>
    </div>
  )
} 