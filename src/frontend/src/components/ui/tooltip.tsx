import React, { useState } from 'react';

interface TooltipProps {
  children: React.ReactNode;
}

interface TooltipTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

interface TooltipContentProps {
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactNode;
}

// Simple tooltip context
const TooltipContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {}
});

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({ children }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <TooltipContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="relative inline-block">
        {children}
      </div>
    </TooltipContext.Provider>
  );
}

export function TooltipTrigger({ children }: TooltipTriggerProps) {
  const { setIsOpen } = React.useContext(TooltipContext);
  
  return (
    <div
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      className="inline-block"
    >
      {children}
    </div>
  );
}

export function TooltipContent({ side = 'top', children }: TooltipContentProps) {
  const { isOpen } = React.useContext(TooltipContext);

  if (!isOpen) return null;

  const sideClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2'
  };

  return (
    <div
      className={`absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-nowrap ${sideClasses[side]}`}
    >
      {children}
      {/* Arrow */}
      <div
        className={`absolute w-0 h-0 ${
          side === 'right' ? 'right-full top-1/2 transform -translate-y-1/2 border-r-4 border-r-gray-900 border-t-4 border-t-transparent border-b-4 border-b-transparent' :
          side === 'left' ? 'left-full top-1/2 transform -translate-y-1/2 border-l-4 border-l-gray-900 border-t-4 border-t-transparent border-b-4 border-b-transparent' :
          side === 'bottom' ? 'bottom-full left-1/2 transform -translate-x-1/2 border-b-4 border-b-gray-900 border-l-4 border-l-transparent border-r-4 border-r-transparent' :
          'top-full left-1/2 transform -translate-x-1/2 border-t-4 border-t-gray-900 border-l-4 border-l-transparent border-r-4 border-r-transparent'
        }`}
      />
    </div>
  );
}