import React from 'react';
import { Layout, Layouts } from 'react-grid-layout';

// Widget Types
export type WidgetType = 
  | 'kpi'
  | 'alerts' 
  | 'sol_monitor'
  | 'loan_status_chart'
  | 'geographical_chart'
  | 'cashflow_chart'
  | 'foreclosure_chart'
  | 'custom';

export type WidgetCategory = 
  | 'performance'
  | 'alerts'
  | 'analytics'
  | 'sol'
  | 'foreclosure'
  | 'geographic';

export interface WidgetMetadata {
  id: string;
  type: WidgetType;
  title: string;
  description: string;
  category: WidgetCategory;
  component: React.ComponentType<any>;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
  configurable: boolean;
  resizable: boolean;
  icon: string; // Lucide icon name
  defaultProps?: Record<string, any>;
}

export interface DashboardWidget extends WidgetMetadata {
  layout: Layout;
  visible: boolean;
  config?: Record<string, any>;
}

export interface DashboardLayout {
  id: string;
  name: string;
  description: string;
  layouts: Layouts; // Responsive layouts for lg, md, sm
  widgets: DashboardWidget[];
  isDefault: boolean;
  role?: 'executive' | 'analyst' | 'legal' | 'custom';
}

export interface WidgetSettings {
  autoSave: boolean;
  snapToGrid: boolean;
  compactType: 'vertical' | 'horizontal' | null;
  preventCollision: boolean;
  theme: 'light' | 'dark';
}

// Default widget settings
export const defaultWidgetSettings: WidgetSettings = {
  autoSave: true,
  snapToGrid: true,
  compactType: 'vertical',
  preventCollision: false,
  theme: 'light'
};

// Grid breakpoints and columns
export const gridBreakpoints = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0
};

export const gridCols = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2
};

export const gridRowHeight = 60;
export const gridMargin: [number, number] = [16, 16];

class WidgetService {
  private widgets: Map<string, WidgetMetadata> = new Map();
  private layouts: Map<string, DashboardLayout> = new Map();
  private settings: WidgetSettings = defaultWidgetSettings;

  constructor() {
    this.loadSettings();
    this.registerDefaultWidgets();
    this.loadLayouts();
  }

  // Widget Registration
  public registerWidget(metadata: WidgetMetadata): void {
    this.widgets.set(metadata.id, metadata);
  }

  public getWidget(id: string): WidgetMetadata | undefined {
    return this.widgets.get(id);
  }

  public getAllWidgets(): WidgetMetadata[] {
    return Array.from(this.widgets.values());
  }

  public getWidgetsByCategory(category: WidgetCategory): WidgetMetadata[] {
    return Array.from(this.widgets.values()).filter(w => w.category === category);
  }

  // Layout Management
  public saveLayout(layout: DashboardLayout): void {
    this.layouts.set(layout.id, layout);
    localStorage.setItem('dashboardLayouts', JSON.stringify(Array.from(this.layouts.values())));
  }

  public getLayout(id: string): DashboardLayout | undefined {
    return this.layouts.get(id);
  }

  public getAllLayouts(): DashboardLayout[] {
    return Array.from(this.layouts.values());
  }

  public getDefaultLayout(role?: string): DashboardLayout {
    // Try to find role-specific default
    if (role) {
      const roleLayout = Array.from(this.layouts.values())
        .find(l => l.role === role && l.isDefault);
      if (roleLayout) return roleLayout;
    }

    // Fall back to general default
    const defaultLayout = Array.from(this.layouts.values()).find(l => l.isDefault);
    if (defaultLayout) return defaultLayout;

    // Create emergency fallback
    return this.createDefaultLayout();
  }

  public deleteLayout(id: string): void {
    this.layouts.delete(id);
    localStorage.setItem('dashboardLayouts', JSON.stringify(Array.from(this.layouts.values())));
  }

  // Settings Management
  public getSettings(): WidgetSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<WidgetSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem('widgetSettings', JSON.stringify(this.settings));
  }

  // Generate unique widget ID
  public generateWidgetId(type: WidgetType): string {
    return `widget_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Private methods
  private loadSettings(): void {
    const stored = localStorage.getItem('widgetSettings');
    if (stored) {
      try {
        this.settings = { ...defaultWidgetSettings, ...JSON.parse(stored) };
      } catch (error) {
        console.warn('Failed to load widget settings:', error);
        this.settings = defaultWidgetSettings;
      }
    }
  }

  private loadLayouts(): void {
    const stored = localStorage.getItem('dashboardLayouts');
    if (stored) {
      try {
        const layouts: DashboardLayout[] = JSON.parse(stored);
        layouts.forEach(layout => {
          this.layouts.set(layout.id, layout);
        });
      } catch (error) {
        console.warn('Failed to load dashboard layouts:', error);
      }
    }

    // Ensure we have at least one default layout
    if (this.layouts.size === 0) {
      const defaultLayout = this.createDefaultLayout();
      this.saveLayout(defaultLayout);
    }
  }

  private registerDefaultWidgets(): void {
    // Note: Components will be registered when the dashboard loads
    // This just sets up the metadata structure
  }

  private createDefaultLayout(): DashboardLayout {
    return {
      id: 'default',
      name: 'Default Dashboard',
      description: 'Standard portfolio overview dashboard',
      isDefault: true,
      layouts: {
        lg: [
          { i: 'kpi-upb', x: 0, y: 0, w: 3, h: 2 },
          { i: 'kpi-loans', x: 3, y: 0, w: 3, h: 2 },
          { i: 'kpi-balance', x: 6, y: 0, w: 3, h: 2 },
          { i: 'kpi-performance', x: 9, y: 0, w: 3, h: 2 },
          { i: 'alerts', x: 0, y: 2, w: 4, h: 6 },
          { i: 'loan-status', x: 4, y: 2, w: 4, h: 6 },
          { i: 'sol-monitor', x: 8, y: 2, w: 4, h: 6 },
          { i: 'geographical', x: 0, y: 8, w: 6, h: 6 },
          { i: 'foreclosure', x: 6, y: 8, w: 6, h: 6 }
        ],
        md: [
          { i: 'kpi-upb', x: 0, y: 0, w: 5, h: 2 },
          { i: 'kpi-loans', x: 5, y: 0, w: 5, h: 2 },
          { i: 'kpi-balance', x: 0, y: 2, w: 5, h: 2 },
          { i: 'kpi-performance', x: 5, y: 2, w: 5, h: 2 },
          { i: 'alerts', x: 0, y: 4, w: 10, h: 6 },
          { i: 'loan-status', x: 0, y: 10, w: 5, h: 6 },
          { i: 'sol-monitor', x: 5, y: 10, w: 5, h: 6 },
          { i: 'geographical', x: 0, y: 16, w: 10, h: 6 },
          { i: 'foreclosure', x: 0, y: 22, w: 10, h: 6 }
        ],
        sm: [
          { i: 'kpi-upb', x: 0, y: 0, w: 6, h: 2 },
          { i: 'kpi-loans', x: 0, y: 2, w: 6, h: 2 },
          { i: 'kpi-balance', x: 0, y: 4, w: 6, h: 2 },
          { i: 'kpi-performance', x: 0, y: 6, w: 6, h: 2 },
          { i: 'alerts', x: 0, y: 8, w: 6, h: 8 },
          { i: 'loan-status', x: 0, y: 16, w: 6, h: 6 },
          { i: 'sol-monitor', x: 0, y: 22, w: 6, h: 6 },
          { i: 'geographical', x: 0, y: 28, w: 6, h: 6 },
          { i: 'foreclosure', x: 0, y: 34, w: 6, h: 6 }
        ]
      },
      widgets: [] // Will be populated when components register
    };
  }

  // Utility methods
  public createWidgetFromMetadata(metadata: WidgetMetadata, position?: { x: number; y: number }): DashboardWidget {
    return {
      ...metadata,
      layout: {
        i: this.generateWidgetId(metadata.type),
        x: position?.x || 0,
        y: position?.y || 0,
        w: metadata.defaultSize.w,
        h: metadata.defaultSize.h,
        minW: metadata.minSize.w,
        minH: metadata.minSize.h,
        maxW: metadata.maxSize?.w,
        maxH: metadata.maxSize?.h
      },
      visible: true,
      config: { ...metadata.defaultProps }
    };
  }

  public exportLayout(layoutId: string): string {
    const layout = this.getLayout(layoutId);
    if (!layout) throw new Error('Layout not found');
    
    return JSON.stringify(layout, null, 2);
  }

  public importLayout(layoutData: string): DashboardLayout {
    const layout: DashboardLayout = JSON.parse(layoutData);
    
    // Generate new ID to avoid conflicts
    layout.id = `imported_${Date.now()}`;
    layout.name = `${layout.name} (Imported)`;
    layout.isDefault = false;
    
    this.saveLayout(layout);
    return layout;
  }
}

// Export singleton instance
export const widgetService = new WidgetService();