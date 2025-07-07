import React, { useState, useEffect, useCallback } from 'react';
import { Responsive, WidthProvider, Layout, Layouts } from 'react-grid-layout';
import { Button } from '../ui/button';
import { 
  Plus, 
  Settings, 
  Save, 
  RotateCcw
} from 'lucide-react';
import { Widget } from './Widget';
import { WidgetCatalog } from './WidgetCatalog';
import { 
  widgetService, 
  DashboardWidget, 
  DashboardLayout,
  gridBreakpoints,
  gridCols,
  gridRowHeight,
  gridMargin
} from '../../services/widgetService';
import { useToast } from '../../hooks/use-toast';

// Note: react-grid-layout CSS will be loaded globally

const ResponsiveGridLayout = WidthProvider(Responsive);

interface WidgetDashboardProps {
  layoutId?: string;
  onLayoutChange?: (layouts: Layouts) => void;
  readOnly?: boolean;
  className?: string;
}

export const WidgetDashboard: React.FC<WidgetDashboardProps> = ({
  layoutId = 'default',
  onLayoutChange,
  readOnly = false,
  className = ''
}) => {
  const [currentLayout, setCurrentLayout] = useState<DashboardLayout | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [layouts, setLayouts] = useState<Layouts>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  // Load layout and widgets on mount
  useEffect(() => {
    loadLayout(layoutId);
  }, [layoutId]);

  const loadLayout = useCallback(async (id: string) => {
    try {
      const layout = widgetService.getLayout(id) || widgetService.getDefaultLayout();
      setCurrentLayout(layout);
      setLayouts(layout.layouts);
      setWidgets(layout.widgets);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error loading layout:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load dashboard layout. Using default layout.",
        variant: "destructive",
      });
      
      // Fall back to default layout
      const defaultLayout = widgetService.getDefaultLayout();
      setCurrentLayout(defaultLayout);
      setLayouts(defaultLayout.layouts);
      setWidgets(defaultLayout.widgets);
    }
  }, [toast]);

  // Handle layout changes from react-grid-layout
  const handleLayoutChange = useCallback((_layout: Layout[], allLayouts: Layouts) => {
    setLayouts(allLayouts);
    setHasUnsavedChanges(true);
    
    if (onLayoutChange) {
      onLayoutChange(allLayouts);
    }
  }, [onLayoutChange]);

  // Widget management
  const handleAddWidget = useCallback((widgetType: string) => {
    const metadata = widgetService.getWidget(widgetType);
    if (!metadata) {
      toast({
        title: "Widget Not Found",
        description: `Widget type "${widgetType}" is not registered.`,
        variant: "destructive",
      });
      return;
    }

    // Find available position
    const maxY = Math.max(0, ...Object.values(layouts.lg || []).map(item => item.y + item.h));
    const newWidget = widgetService.createWidgetFromMetadata(metadata, { x: 0, y: maxY });

    // Update layouts for all breakpoints
    const newLayouts = { ...layouts };
    Object.keys(gridCols).forEach(breakpoint => {
      if (!newLayouts[breakpoint]) newLayouts[breakpoint] = [];
      newLayouts[breakpoint].push({
        ...newWidget.layout,
        // Adjust for different breakpoint widths
        w: Math.min(newWidget.layout.w, gridCols[breakpoint as keyof typeof gridCols]),
        x: 0,
        y: maxY
      });
    });

    setWidgets(prev => [...prev, newWidget]);
    setLayouts(newLayouts);
    setHasUnsavedChanges(true);
    setShowCatalog(false);

    toast({
      title: "Widget Added",
      description: `${metadata.title} has been added to your dashboard.`,
    });
  }, [layouts, toast]);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.layout.i !== widgetId));
    
    // Remove from all layouts
    const newLayouts = { ...layouts };
    Object.keys(newLayouts).forEach(breakpoint => {
      newLayouts[breakpoint] = newLayouts[breakpoint].filter(item => item.i !== widgetId);
    });
    setLayouts(newLayouts);
    setHasUnsavedChanges(true);

    toast({
      title: "Widget Removed",
      description: "Widget has been removed from your dashboard.",
    });
  }, [layouts, toast]);

  const handleConfigureWidget = useCallback((widgetId: string) => {
    // TODO: Implement widget configuration modal
    console.log('Configure widget:', widgetId);
    toast({
      title: "Configuration",
      description: "Widget configuration is coming soon!",
    });
  }, [toast]);

  const handleRefreshWidget = useCallback((widgetId: string) => {
    // Force re-render of specific widget
    setWidgets(prev => prev.map(w => 
      w.layout.i === widgetId 
        ? { ...w, config: { ...w.config, refreshKey: Date.now() } }
        : w
    ));
    
    toast({
      title: "Widget Refreshed",
      description: "Widget data has been refreshed.",
    });
  }, [toast]);

  // Layout management
  const handleSaveLayout = useCallback(async () => {
    if (!currentLayout) return;

    try {
      const updatedLayout: DashboardLayout = {
        ...currentLayout,
        layouts,
        widgets
      };

      widgetService.saveLayout(updatedLayout);
      setHasUnsavedChanges(false);

      toast({
        title: "Layout Saved",
        description: "Your dashboard layout has been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving layout:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save dashboard layout. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentLayout, layouts, widgets, toast]);

  const handleResetLayout = useCallback(() => {
    if (currentLayout) {
      loadLayout(currentLayout.id);
      toast({
        title: "Layout Reset",
        description: "Dashboard has been reset to last saved state.",
      });
    }
  }, [currentLayout, loadLayout, toast]);

  // Drag and resize handlers
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragStop = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleResizeStop = useCallback(() => {
    setIsResizing(false);
  }, []);

  if (!currentLayout) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className={`widget-dashboard ${className}`}>
      {/* Dashboard Toolbar */}
      {!readOnly && (
        <div className="flex items-center justify-between mb-4 p-3 bg-white rounded-lg shadow-sm border">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{currentLayout.name}</h2>
            {hasUnsavedChanges && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                Unsaved changes
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCatalog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Widget
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetLayout}
              disabled={!hasUnsavedChanges}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveLayout}
              disabled={!hasUnsavedChanges}
            >
              <Save className="h-4 w-4 mr-1" />
              Save Layout
            </Button>
            
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Widget Grid */}
      <div className="min-h-screen">
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={gridBreakpoints}
          cols={gridCols}
          rowHeight={gridRowHeight}
          margin={gridMargin}
          containerPadding={[0, 0]}
          onLayoutChange={handleLayoutChange}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          onResizeStart={handleResizeStart}
          onResizeStop={handleResizeStop}
          isDraggable={!readOnly}
          isResizable={!readOnly}
          compactType="vertical"
          preventCollision={false}
        >
          {widgets.map((widget) => (
            <div key={widget.layout.i}>
              <Widget
                widget={widget}
                onRemove={readOnly ? undefined : handleRemoveWidget}
                onConfigure={readOnly ? undefined : handleConfigureWidget}
                onRefresh={handleRefreshWidget}
                isDragging={isDragging}
                isResizing={isResizing}
              >
                {/* Render the actual widget component */}
                <widget.component {...widget.config} />
              </Widget>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>

      {/* Widget Catalog Modal - Temporarily Disabled */}
      {false && showCatalog && (
        <WidgetCatalog
          onAddWidget={handleAddWidget}
          onClose={() => setShowCatalog(false)}
        />
      )}

      {/* Custom styles for react-grid-layout */}
      <style>{`
        .react-grid-item {
          transition: all 200ms ease;
          transition-property: left, top, width, height;
        }
        
        .react-grid-item.cssTransforms {
          transition-property: transform, width, height;
        }
        
        .react-grid-item > .react-resizable-handle {
          position: absolute;
          width: 20px;
          height: 20px;
          bottom: 0;
          right: 0;
          background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNiIgaGVpZ2h0PSI2IiB2aWV3Qm94PSIwIDAgNiA2IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZG90cyBmaWxsPSIjODg4IiBzdHJva2U9IiM4ODgiIHN0cm9rZS13aWR0aD0iMSI+CjxjaXJjbGUgY3g9IjEiIGN5PSI1IiByPSIxIi8+CjxjaXJjbGUgY3g9IjUiIGN5PSIxIiByPSIxIi8+CjxjaXJjbGUgY3g9IjUiIGN5PSI1IiByPSIxIi8+CjxjaXJjbGUgY3g9IjMiIGN5PSIzIiByPSIxIi8+CjxjaXJjbGUgY3g9IjMiIGN5PSI1IiByPSIxIi8+CjxjaXJjbGUgY3g9IjUiIGN5PSIzIiByPSIxIi8+CjwvZG90cz4KPHN2Zz4K');
          background-position: bottom right;
          padding: 0 3px 3px 0;
          background-repeat: no-repeat;
          background-origin: content-box;
          box-sizing: border-box;
          cursor: se-resize;
        }
        
        .react-grid-item.react-grid-placeholder {
          background: rgb(59 130 246 / 0.1);
          border: 2px dashed rgb(59 130 246 / 0.4);
          opacity: 0.2;
          transition-duration: 100ms;
          z-index: 2;
          user-select: none;
        }
        
        .react-grid-item.react-draggable-dragging {
          transition: none;
          z-index: 3;
        }
        
        .react-grid-item.react-resizable-resizing {
          transition: none;
          z-index: 3;
        }
      `}</style>
    </div>
  );
};