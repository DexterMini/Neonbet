'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProgressionStore, ACHIEVEMENTS } from '@/stores/progressionStore'

export default function AchievementToast() {
  const recentUnlock = useProgressionStore(s => s.recentUnlock)
  const clearRecentUnlock = useProgressionStore(s => s.clearRecentUnlock)
  const [visible, setVisible] = useState(false)
  const [achievement, setAchievement] = useState<typeof ACHIEVEMENTS[0] | null>(null)

  useEffect(() => {
    if (recentUnlock) {
      const ach = ACHIEVEMENTS.find(a => a.id === recentUnlock)
      if (ach) {
        setAchievement(ach)
        setVisible(true)
        const timer = setTimeout(() => {
          setVisible(false)
          clearRecentUnlock()
        }, 4000)
        return () => clearTimeout(timer)
      }
    }
  }, [recentUnlock, clearRecentUnlock])

  return (
    <AnimatePresence>
      {visible && achievement && (
        <motion.div
          initial={{ x: 350, opacity: 0, scale: 0.8 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ x: 350, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed top-4 right-4 z-[100] pointer-events-none"
        >
          <div className="bg-[#111827]/95 backdrop-blur-xl border border-violet-500/40 rounded-xl p-4 shadow-2xl shadow-violet-500/10 w-[300px]">
            <div className="flex items-center gap-1 text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2">
              <span>🏆</span> Achievement Unlocked!
            </div>
            <div className="flex items-center gap-3">
              <div className="text-3xl">{achievement.icon}</div>
              <div>
                <div className="font-bold text-sm text-white">{achievement.title}</div>
                <div className="text-xs text-gray-400">{achievement.description}</div>
                <div className="text-xs text-violet-400 font-medium mt-1">+{achievement.xpReward} XP</div>
              </div>
            </div>
            {/* progress bar closing */}
            <motion.div
              className="absolute bottom-0 left-0 h-0.5 bg-violet-500 rounded-b-xl"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 4, ease: 'linear' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
