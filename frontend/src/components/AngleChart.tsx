import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AngleChartProps } from '../types';

const LINE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

export function AngleChart({ jointAngles }: AngleChartProps) {
  const joints = Object.entries(jointAngles).filter(([, values]) => values.length > 0);

  if (joints.length === 0) return null;

  // Build data array: one object per frame index, with each joint as a key
  const frameCount = Math.max(...joints.map(([, v]) => v.length));
  const data = Array.from({ length: frameCount }, (_, i) => {
    const point: Record<string, number> = { frame: i + 1 };
    for (const [joint, values] of joints) {
      if (i < values.length) point[joint] = values[i];
    }
    return point;
  });

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <XAxis
            dataKey="frame"
            label={{ value: 'Frame', position: 'insideBottom', offset: -2, fontSize: 12 }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            label={{ value: 'Ângulo (°)', angle: -90, position: 'insideLeft', fontSize: 12 }}
            tick={{ fontSize: 11 }}
          />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {joints.map(([joint], index) => (
            <Line
              key={joint}
              type="monotone"
              dataKey={joint}
              stroke={LINE_COLORS[index % LINE_COLORS.length]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
