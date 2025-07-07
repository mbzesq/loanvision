import { useEffect } from 'react';
import { WidgetDashboard } from '../components/Widgets/WidgetDashboard';
import registerAllWidgets, { initializeDefaultLayout } from '../components/Widgets/WidgetRegistry';
import '../styles/design-system.css';

function DashboardPage() {
  useEffect(() => {
    // Register all widgets on component mount
    registerAllWidgets();
    initializeDefaultLayout();
  }, []);


  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Portfolio Dashboard
        </h1>
        <p className="text-lg text-slate-600">
          Customizable real-time insights into your loan portfolio performance
        </p>
      </div>

      {/* Widget-based Dashboard */}
      <WidgetDashboard 
        layoutId="default"
        className="widget-dashboard"
      />
    </div>
  );
}

export default DashboardPage;