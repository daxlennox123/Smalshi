'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export function ProbabilityMiniChart({ data }: { data: { t: number; prob: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <YAxis domain={[0, 100]} hide />
        <Line type="stepAfter" dataKey="prob" stroke="#000" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function ProbabilityTimeChart({ data }: { data: { t: number; prob: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
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
    </ResponsiveContainer>
  )
}

