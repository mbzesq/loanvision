import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
  Search, 
  Plus, 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Map, 
  Bell,
  Scale,
  DollarSign,
  Target,
  Activity
} from 'lucide-react';
import { widgetService, WidgetCategory } from '../../services/widgetService';

interface WidgetCatalogProps {
  onAddWidget: (widgetId: string) => void;
  onClose: () => void;
}

export const WidgetCatalog: React.FC<WidgetCatalogProps> = ({
  onAddWidget,
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<WidgetCategory | 'all'>('all');

  const availableWidgets = widgetService.getAllWidgets();

  // Filter widgets based on search and category
  const filteredWidgets = availableWidgets.filter(widget => {
    const matchesSearch = widget.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         widget.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || widget.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories: Array<{ key: WidgetCategory | 'all'; label: string; icon: React.ComponentType<any> }> = [
    { key: 'all', label: 'All Widgets', icon: Target },
    { key: 'performance', label: 'Performance', icon: TrendingUp },
    { key: 'alerts', label: 'Alerts', icon: Bell },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'sol', label: 'SOL', icon: Scale },
    { key: 'foreclosure', label: 'Foreclosure', icon: Activity },
    { key: 'geographic', label: 'Geographic', icon: Map }
  ];

  const getWidgetIcon = (type: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      kpi: DollarSign,
      alerts: Bell,
      sol_monitor: Scale,
      loan_status_chart: PieChart,
      geographical_chart: Map,
      cashflow_chart: BarChart3,
      foreclosure_chart: Activity,
      custom: Target
    };
    return iconMap[type] || Target;
  };

  const getCategoryColor = (category: WidgetCategory) => {
    const colorMap: Record<WidgetCategory, string> = {
      performance: 'bg-green-100 text-green-700',
      alerts: 'bg-red-100 text-red-700',
      analytics: 'bg-blue-100 text-blue-700',
      sol: 'bg-purple-100 text-purple-700',
      foreclosure: 'bg-orange-100 text-orange-700',
      geographic: 'bg-cyan-100 text-cyan-700'
    };
    return colorMap[category] || 'bg-gray-100 text-gray-700';
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Widget to Dashboard
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search widgets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const IconComponent = category.icon;
              const isSelected = selectedCategory === category.key;
              
              return (
                <Button
                  key={category.key}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.key)}
                  className="h-8"
                >
                  <IconComponent className="h-3 w-3 mr-1" />
                  {category.label}
                </Button>
              );
            })}
          </div>

          {/* Widget Grid */}
          <div className="flex-1 overflow-y-auto">
            {filteredWidgets.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No widgets found matching your criteria.</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your search or category filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWidgets.map((widget) => {
                  const IconComponent = getWidgetIcon(widget.type);
                  
                  return (
                    <Card 
                      key={widget.id}
                      className="cursor-pointer hover:shadow-md transition-shadow duration-200 group"
                      onClick={() => onAddWidget(widget.id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-md group-hover:bg-blue-200 transition-colors">
                              <IconComponent className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs mt-1 ${getCategoryColor(widget.category)}`}
                              >
                                {widget.category}
                              </Badge>
                            </div>
                          </div>
                          <Plus className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                          {widget.description}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>
                            Size: {widget.defaultSize.w}×{widget.defaultSize.h}
                          </span>
                          <div className="flex items-center gap-2">
                            {widget.configurable && (
                              <Badge variant="outline" className="text-xs">
                                Configurable
                              </Badge>
                            )}
                            {widget.resizable && (
                              <Badge variant="outline" className="text-xs">
                                Resizable
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-gray-500">
              {filteredWidgets.length} widget{filteredWidgets.length !== 1 ? 's' : ''} available
            </p>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};