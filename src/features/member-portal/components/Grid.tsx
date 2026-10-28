import React from 'react';

export const Grid = ({ children, gap = 4 }: { children: React.ReactNode; gap?: number }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: `var(--spacing-${gap}, ${gap * 4}px)`,
    }}
  >
    {children}
  </div>
);
