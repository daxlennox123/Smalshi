'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function useContainerWidth(minWidth = 100) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number>(0)

  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0) setWidth(w)
    })
    observer.observe(ref.current)
    // Trigger immediately
    const w = ref.current.getBoundingClientRect().width
    if (w > 0) setWidth(w)
    return () => observer.disconnect()
  }, [])

  return { ref, width: Math.max(width, minWidth) }
}

export function ProbabilityMiniChart({ data }: { data: { t: number; prob: number }[] }) {
  const { ref, width } = useContainerWidth()

  return (
    <div ref={ref} style={{ width: '100%', height: 64 }}>
      {width > 0 && (
        <LineChart width={width} height={64} data={data}>
          <YAxis domain={[0, 100]} hide />
          <Line type="stepAfter" dataKey="prob" stroke="#000" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      )}
    </div>
  )
}

export function ProbabilityTimeChart({ data }: { data: { t: number; prob: number }[] }) {
  const { ref, width } = useContainerWidth()

  return (
    <div ref={ref} style={{ width: '100%', height: 320 }}>
      {width > 0 && (
        <LineChart width={width} height={320} data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tick={{ fill: '#000', fontFamily: 'monospace', fontWeight: 'bold' }}
            tickFormatter={(ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#000', fontFamily: 'monospace', fontWeight: 'bold' }}
            tickFormatter={(val) => `${val}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '2px solid #000',
              borderRadius: '0',
              boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
            }}
            itemStyle={{ color: '#000', fontWeight: 'bold' }}
            labelFormatter={(ms) => new Date(ms as number).toLocaleString()}
            formatter={(value) => [`${value}%`, 'Probability']}
          />
          <Line type="stepAfter" dataKey="prob" stroke="#000" strokeWidth={4} activeDot={{ r: 8, strokeWidth: 2, fill: '#fef08a' }} />
        </LineChart>
      )}
    </div>
  )
}

