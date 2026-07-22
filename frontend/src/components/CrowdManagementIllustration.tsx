import React from 'react';
import { motion } from 'framer-motion';

// Adaptive colors for light/dark mode
const colors = {
  stadium: 'var(--stadium-fill)', // will be set via CSS variables
  gate: 'var(--gate-fill)',
  path: 'var(--path-stroke)',
  person: 'var(--person-fill)',
  nodeLow: '#10B981', // green
  nodeMedium: '#F59E0B', // yellow
  nodeHigh: '#EF4444', // red
};

// Simple utility to generate a few moving "people"
const People = ({ count, delay }: { count: number; delay: number }) => {
  const items = [];
  for (let i = 0; i < count; i++) {
    const startX = Math.random() * 20 - 10; // start near gate
    const endX = Math.random() * 20 - 10;
    const startY = 0;
    const endY = -30; // move upwards slightly then down
    items.push(
      <motion.circle
        key={i}
        cx={startX}
        cy={startY}
        r={1.5}
        fill={colors.person}
        animate={{ cx: endX, cy: endY }}
        transition={{
          repeat: Infinity,
          repeatType: 'reverse',
          duration: 3 + Math.random(),
          delay: delay + i * 0.2,
          ease: 'easeInOut',
        }}
      />
    );
  }
  return <>{items}</>;
};

export const CrowdManagementIllustration: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      className={className}
      viewBox="-40 -20 120 80"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Stadium silhouette – simple isometric polygon */}
      <polygon
        points="0,0 30,20 70,20 100,0 70,-20 30,-20"
        fill={colors.stadium}
        stroke={colors.path}
        strokeWidth={0.5}
      />

      {/* Gates – small rectangles around the stadium */}
      <rect x="-5" y="-5" width="10" height="5" fill={colors.gate} />
      <rect x="95" y="-5" width="10" height="5" fill={colors.gate} />
      <rect x="45" y="25" width="10" height="5" fill={colors.gate} />
      <rect x="45" y="-30" width="10" height="5" fill={colors.gate} />

      {/* Paths from gates to center */}
      <motion.path
        d="M0,0 L30,20"
        stroke={colors.path}
        strokeWidth={0.3}
        fill="none"
        animate={{ pathLength: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
      />
      <motion.path
        d="M100,0 L70,20"
        stroke={colors.path}
        strokeWidth={0.3}
        fill="none"
        animate={{ pathLength: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 4, delay: 1, ease: 'linear' }}
      />
      <motion.path
        d="M50,10 L45,25"
        stroke={colors.path}
        strokeWidth={0.3}
        fill="none"
        animate={{ pathLength: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 4, delay: 0.5, ease: 'linear' }}
      />
      <motion.path
        d="M50,-10 L45,-30"
        stroke={colors.path}
        strokeWidth={0.3}
        fill="none"
        animate={{ pathLength: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 4, delay: 1.5, ease: 'linear' }}
      />

      {/* AI prediction nodes – colored circles at junctions */}
      <motion.circle
        cx="30"
        cy="20"
        r={3}
        fill={colors.nodeLow}
        initial={{ scale: 0.8, opacity: 0.6 }}
        animate={{ scale: 1.2, opacity: 1 }}
        transition={{ repeat: Infinity, repeatType: 'reverse', duration: 2 }}
      />
      <motion.circle
        cx="70"
        cy="20"
        r={3}
        fill={colors.nodeMedium}
        initial={{ scale: 0.8, opacity: 0.6 }}
        animate={{ scale: 1.2, opacity: 1 }}
        transition={{ repeat: Infinity, repeatType: 'reverse', duration: 2.5, delay: 0.5 }}
      />
      <motion.circle
        cx="45"
        cy="25"
        r={3}
        fill={colors.nodeHigh}
        initial={{ scale: 0.8, opacity: 0.6 }}
        animate={{ scale: 1.2, opacity: 1 }}
        transition={{ repeat: Infinity, repeatType: 'reverse', duration: 3, delay: 1 }}
      />

      {/* Heatmap overlay – simple radial gradient circles */}
      <defs>
        <radialGradient id="heatLow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={colors.nodeLow} stopOpacity="0.4" />
          <stop offset="100%" stopColor={colors.nodeLow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heatMedium" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={colors.nodeMedium} stopOpacity="0.4" />
          <stop offset="100%" stopColor={colors.nodeMedium} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heatHigh" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={colors.nodeHigh} stopOpacity="0.4" />
          <stop offset="100%" stopColor={colors.nodeHigh} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="30" cy="20" r="12" fill="url(#heatLow)" />
      <circle cx="70" cy="20" r="15" fill="url(#heatMedium)" />
      <circle cx="45" cy="25" r="10" fill="url(#heatHigh)" />

      {/* Animated people groups */}
      <g transform="translate(0,0)">
        <People count={4} delay={0} />
        <People count={3} delay={1} />
        <People count={5} delay={2} />
      </g>
    </svg>
  );
};

export default CrowdManagementIllustration;
