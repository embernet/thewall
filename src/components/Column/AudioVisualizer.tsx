import React from 'react';

interface AudioVisualizerProps {
  active: boolean;
  level: number;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ active, level }) => (
  <div className="flex items-end" style={{ gap: 1.5, height: 24 }}>
    {Array.from({ length: 18 }, (_, i) => {
      const h = active
        ? Math.max(
            2,
            level * (0.3 + 0.7 * Math.sin((i / 18) * Math.PI)) * 22 +
              Math.random() * 3,
          )
        : 2;
      return (
        <div
          key={i}
          style={{
            width: 2.5,
            height: h,
            borderRadius: 1,
            background: active
              ? `hsl(${(i / 18) * 40},80%,58%)`
              : '#334155',
            transition: 'height 0.08s',
          }}
        />
      );
    })}
  </div>
);

export default AudioVisualizer;
