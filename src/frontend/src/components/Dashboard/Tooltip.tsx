import React from 'react';
import ReactDOM from 'react-dom';

interface TooltipProps {
  content: string;
  x: number;
  y: number;
}

const Tooltip: React.FC<TooltipProps> = ({ content, x, y }) => {
  // Create tooltip element outside of the map container
  const tooltipElement = (
    <div
      style={{
        position: 'fixed',
        left: `${x + 15}px`,
        top: `${y - 40}px`,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '500',
        pointerEvents: 'none',
        zIndex: 99999,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        whiteSpace: 'nowrap',
        maxWidth: '200px',
        transform: 'translateZ(0)', // Force GPU acceleration
      }}
    >
      {content}
    </div>
  );

  // Render tooltip to document body using React Portal
  return ReactDOM.createPortal(tooltipElement, document.body);
};

export default Tooltip;