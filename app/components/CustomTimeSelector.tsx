import React, { useState, useEffect } from 'react';
import { FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { motion } from 'framer-motion';

interface CustomTimeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const CustomTimeSelector: React.FC<CustomTimeSelectorProps> = ({ value, onChange }) => {
  const [hour, setHour] = useState(parseInt(value.split(':')[0]));
  const [minute, setMinute] = useState(parseInt(value.split(':')[1]));

  const updateTime = (newHour: number, newMinute: number) => {
    const formattedHour = newHour.toString().padStart(2, '0');
    const formattedMinute = newMinute.toString().padStart(2, '0');
    onChange(`${formattedHour}:${formattedMinute}`);
  };

  const incrementHour = () => {
    setHour((prev) => (prev + 1) % 24);
  };

  const decrementHour = () => {
    setHour((prev) => (prev - 1 + 24) % 24);
  };

  const incrementMinute = () => {
    setMinute((prev) => (prev + 5) % 60);
  };

  const decrementMinute = () => {
    setMinute((prev) => (prev - 5 + 60) % 60);
  };

  useEffect(() => {
    updateTime(hour, minute);
  }, [hour, minute]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-6">
        {/* Hours */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={incrementHour}
              className="p-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <FiChevronUp className="h-4 w-4" />
            </motion.button>
            <span className="text-2xl font-medium text-zinc-900 dark:text-zinc-50 w-12 text-center">
              {hour.toString().padStart(2, '0')}
            </span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={decrementHour}
              className="p-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <FiChevronDown className="h-4 w-4" />
            </motion.button>
          </div>
          <span className="text-2xl font-medium text-zinc-900 dark:text-zinc-50">:</span>
          {/* Minutes */}
          <div className="flex flex-col items-center">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={incrementMinute}
              className="p-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <FiChevronUp className="h-4 w-4" />
            </motion.button>
            <span className="text-2xl font-medium text-zinc-900 dark:text-zinc-50 w-12 text-center">
              {minute.toString().padStart(2, '0')}
            </span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={decrementMinute}
              className="p-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <FiChevronDown className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Quick time selection buttons */}
      <div className="flex gap-2">
        {["09:00", "15:00", "20:00"].map((time) => {
          const [h, m] = time.split(':').map(Number);
          return (
            <motion.button
              key={time}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setHour(h);
                setMinute(m);
              }}
              className={`px-3 py-1 rounded-md text-sm transition-colors duration-200 ${
                hour === h && minute === m
                  ? 'bg-blue-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {time}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}; 