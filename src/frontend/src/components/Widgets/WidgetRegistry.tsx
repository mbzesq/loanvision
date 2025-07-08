import { widgetService, WidgetMetadata } from '../../services/widgetService';
import {
  UPBWidget,
  LoanCountWidget,
  AverageBalanceWidget,
  PerformanceWidget,
  AlertsWidget,
  SOLMonitorWidget,
  LoanStatusWidget,
  GeographicalWidget,
  CashflowWidget,
  ForeclosureWidget
} from './WidgetComponents';

// Widget Metadata Definitions
const widgetDefinitions: WidgetMetadata[] = [
  // KPI Widgets
  {
    id: 'kpi-upb',
    type: 'kpi',
    title: 'Total UPB',
    description: 'Total Unpaid Principal Balance across the portfolio',
    category: 'performance',
    component: UPBWidget,
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    configurable: false,
    resizable: true,
    icon: 'dollar-sign'
  },
  {
    id: 'kpi-loans',
    type: 'kpi',
    title: 'Loan Count',
    description: 'Total number of loans in the portfolio',
    category: 'performance',
    component: LoanCountWidget,
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    configurable: false,
    resizable: true,
    icon: 'hash'
  },
  {
    id: 'kpi-balance',
    type: 'kpi',
    title: 'Average Balance',
    description: 'Average principal balance per loan',
    category: 'performance',
    component: AverageBalanceWidget,
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    configurable: false,
    resizable: true,
    icon: 'calculator'
  },
  {
    id: 'kpi-performance',
    type: 'kpi',
    title: 'Performance Score',
    description: 'Overall portfolio performance percentage',
    category: 'performance',
    component: PerformanceWidget,
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 4 },
    configurable: false,
    resizable: true,
    icon: 'trending-up'
  },

  // Alert Widgets
  {
    id: 'alerts',
    type: 'alerts',
    title: 'Portfolio Alerts',
    description: 'Real-time alerts for performance, legal, and SOL issues',
    category: 'alerts',
    component: AlertsWidget,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 4 },
    maxSize: { w: 6, h: 10 },
    configurable: true,
    resizable: true,
    icon: 'bell'
  },

  // SOL Widgets
  {
    id: 'sol-monitor',
    type: 'sol_monitor',
    title: 'SOL Monitor',
    description: 'Statute of Limitations risk monitoring and distribution',
    category: 'sol',
    component: SOLMonitorWidget,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 4 },
    maxSize: { w: 6, h: 8 },
    configurable: false,
    resizable: true,
    icon: 'scale'
  },

  // Analytics Chart Widgets
  {
    id: 'loan-status',
    type: 'loan_status_chart',
    title: 'Loan Status Distribution',
    description: 'Pie chart showing portfolio breakdown by loan status',
    category: 'analytics',
    component: LoanStatusWidget,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 4 },
    maxSize: { w: 8, h: 8 },
    configurable: false,
    resizable: true,
    icon: 'pie-chart'
  },
  {
    id: 'geographical',
    type: 'geographical_chart',
    title: 'Geographic Distribution',
    description: 'Map visualization of loan distribution across states',
    category: 'geographic',
    component: GeographicalWidget,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 4, h: 4 },
    maxSize: { w: 12, h: 8 },
    configurable: false,
    resizable: true,
    icon: 'map'
  },
  {
    id: 'cashflow',
    type: 'cashflow_chart',
    title: 'Cashflow Analysis',
    description: 'Monthly payment trends and investor breakdown charts',
    category: 'analytics',
    component: CashflowWidget,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 4, h: 4 },
    maxSize: { w: 12, h: 8 },
    configurable: false,
    resizable: true,
    icon: 'bar-chart-3'
  },
  {
    id: 'foreclosure',
    type: 'foreclosure_chart',
    title: 'Foreclosure Pipeline',
    description: 'Active foreclosure status and milestone tracking',
    category: 'foreclosure',
    component: ForeclosureWidget,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 4, h: 4 },
    maxSize: { w: 12, h: 8 },
    configurable: false,
    resizable: true,
    icon: 'activity'
  }
];

// Widget Registration Function
export function registerAllWidgets(): void {
  widgetDefinitions.forEach(widget => {
    widgetService.registerWidget(widget);
  });

  console.log(`Registered ${widgetDefinitions.length} widgets:`, 
    widgetDefinitions.map(w => w.title).join(', '));
}

// Initialize default layout with registered widgets
export function initializeDefaultLayout(): void {
  // Check if we already have a populated default layout
  const existingLayout = widgetService.getLayout('default');
  console.log('Checking existing layout:', existingLayout ? existingLayout.widgets.length : 'no layout');
  if (existingLayout && existingLayout.widgets && existingLayout.widgets.length > 0) {
    console.log('Layout already has widgets, skipping initialization');
    return;
  }

  console.log('Initializing default layout...');
  const defaultLayout = widgetService.getDefaultLayout();
  
  // Create widgets from metadata for default layout
  const widgets = [
    'kpi-upb',
    'kpi-loans', 
    'kpi-balance',
    'kpi-performance',
    'alerts',
    'loan-status',
    'sol-monitor',
    'geographical',
    'foreclosure'
  ].map(widgetId => {
    const metadata = widgetService.getWidget(widgetId);
    if (!metadata) {
      console.warn(`Widget ${widgetId} not found during layout initialization`);
      return null;
    }
    console.log(`Creating widget: ${widgetId} -> ${metadata.title}`);
    return widgetService.createWidgetFromMetadata(metadata);
  }).filter(Boolean);

  console.log(`Created ${widgets.length} widgets for default layout`);

  // Update default layout with widgets
  const updatedLayout = {
    ...defaultLayout,
    widgets: widgets as any[]
  };

  widgetService.saveLayout(updatedLayout);
  console.log('Default layout saved with widgets');
}

// Export for easy usage
export { widgetDefinitions };
export default registerAllWidgets;