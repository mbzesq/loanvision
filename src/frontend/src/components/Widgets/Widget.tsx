import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { 
  MoreVertical, 
  Settings, 
  X, 
  Maximize, 
  Minimize,
  Move,
  RefreshCw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { DashboardWidget } from '../../services/widgetService';

interface WidgetProps {
  widget: DashboardWidget;
  children: React.ReactNode;
  onRemove?: (widgetId: string) => void;
  onConfigure?: (widgetId: string) => void;
  onRefresh?: (widgetId: string) => void;
  isDragging?: boolean;
  isResizing?: boolean;
  className?: string;
}

export const Widget: React.FC<WidgetProps> = ({
  widget,
  children,
  onRemove,
  onConfigure,
  onRefresh,
  isDragging = false,
  isResizing = false,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleRemove = () => {
    if (onRemove) {
      onRemove(widget.layout.i);
    }
  };

  const handleConfigure = () => {
    if (onConfigure) {
      onConfigure(widget.layout.i);
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh(widget.layout.i);
    }
  };

  const showControls = isHovered && !isDragging && !isResizing;

  return (
    <div
      className={`h-full ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className={`h-full flex flex-col transition-all duration-200 ${
        isDragging ? 'shadow-2xl scale-105 opacity-90' : 
        isResizing ? 'shadow-lg' : 
        'shadow-sm hover:shadow-md'
      } ${isExpanded ? 'z-50' : ''}`}>
        {/* Widget Header */}
        <CardHeader className={`pb-2 relative ${isExpanded ? 'border-b' : ''}`}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-700 truncate pr-2">
              {widget.title}
            </CardTitle>
            
            {/* Widget Controls */}
            <div className={`flex items-center gap-1 transition-opacity duration-200 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}>
              {/* Drag Handle */}
              <div className="drag-handle cursor-move p-1 hover:bg-slate-100 rounded">
                <Move className="h-3 w-3 text-slate-400" />
              </div>

              {/* Refresh Button */}
              {onRefresh && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  className="h-6 w-6 p-0 hover:bg-slate-100"
                >
                  <RefreshCw className="h-3 w-3 text-slate-500" />
                </Button>
              )}

              {/* Expand/Minimize Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 p-0 hover:bg-slate-100"
              >
                {isExpanded ? (
                  <Minimize className="h-3 w-3 text-slate-500" />
                ) : (
                  <Maximize className="h-3 w-3 text-slate-500" />
                )}
              </Button>

              {/* More Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-slate-100"
                  >
                    <MoreVertical className="h-3 w-3 text-slate-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  {widget.configurable && onConfigure && (
                    <>
                      <DropdownMenuItem onClick={handleConfigure}>
                        <Settings className="h-3 w-3 mr-2" />
                        Configure
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemove();
                    }}
                    className="text-red-600 focus:text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-3 w-3 mr-2" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Widget Description (when expanded) */}
          {isExpanded && widget.description && (
            <p className="text-xs text-slate-500 mt-1">{widget.description}</p>
          )}
        </CardHeader>

        {/* Widget Content */}
        <CardContent className={`flex-1 p-3 overflow-hidden ${
          isExpanded ? 'p-4' : ''
        }`}>
          <div className="h-full w-full flex flex-col">
            <div className="flex-1 min-h-0">
              {children}
            </div>
          </div>
        </CardContent>

        {/* Resize Handle (visual indicator) */}
        {showControls && widget.resizable && (
          <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize">
            <div className="absolute bottom-1 right-1 w-1 h-1 bg-slate-400 rounded-full" />
            <div className="absolute bottom-1 right-2 w-1 h-1 bg-slate-400 rounded-full" />
            <div className="absolute bottom-2 right-1 w-1 h-1 bg-slate-400 rounded-full" />
          </div>
        )}
      </Card>

      {/* Expanded Overlay */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
};