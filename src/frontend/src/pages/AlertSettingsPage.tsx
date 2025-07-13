import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { 
  Settings, 
  Save, 
  RotateCcw, 
  Bell, 
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Scale,
  Package
} from 'lucide-react';
import { alertService, AlertSettings, AlertCategory, defaultAlertSettings } from '../services/alertService';
import { useToast } from '../hooks/use-toast';
import '../styles/global-warm-theme.css';

const AlertSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AlertSettings>(defaultAlertSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      const currentSettings = alertService.getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
      setSettings(defaultAlertSettings);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      alertService.saveSettings(settings);
      toast({
        title: "Settings Saved",
        description: "Alert settings have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Save Failed", 
        description: "Failed to save alert settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setSettings(defaultAlertSettings);
    toast({
      title: "Settings Reset",
      description: "Alert settings have been reset to defaults.",
    });
  };

  const handleCategoryToggle = (category: AlertCategory, enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      enabledCategories: enabled 
        ? [...prev.enabledCategories, category]
        : prev.enabledCategories.filter(c => c !== category)
    }));
  };

  const handleThresholdChange = (key: keyof AlertSettings['thresholds'], value: number) => {
    setSettings(prev => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [key]: value
      }
    }));
  };

  const getCategoryInfo = (category: AlertCategory) => {
    const categoryMap = {
      performance_degradation: {
        name: 'Performance Degradation',
        description: 'Alerts for payment issues, credit score drops, and regional clustering',
        icon: TrendingDown,
        color: 'text-red-600',
        examples: ['First missed payment in 6+ months', 'Geographic clustering of delinquencies', 'Credit score drops (future)']
      },
      performance_improvement: {
        name: 'Performance Improvement', 
        description: 'Alerts for loans approaching securitizable status and rehabilitation',
        icon: TrendingUp,
        color: 'text-green-600',
        examples: ['Approaching 12-month current status', 'Payment rehabilitation', 'Workout success']
      },
      legal_regulatory: {
        name: 'Legal & Regulatory',
        description: 'Alerts for foreclosure delays and regulatory compliance',
        icon: AlertTriangle,
        color: 'text-orange-600',
        examples: ['Foreclosure milestone delays', 'Regulatory compliance issues']
      },
      portfolio_level: {
        name: 'Portfolio Level',
        description: 'Portfolio-wide opportunities and risks',
        icon: Package,
        color: 'text-blue-600',
        examples: ['Securitization opportunities', 'Portfolio-wide trends']
      },
      sol: {
        name: 'Statute of Limitations',
        description: 'SOL expiration warnings and risk assessment',
        icon: Scale,
        color: 'text-purple-600',
        examples: ['SOL expired', 'High SOL risk', 'Approaching expiration']
      }
    };
    return categoryMap[category];
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-6">
            <div className="h-48 bg-slate-200 rounded"></div>
            <div className="h-32 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="global-warm-theme p-6 space-y-6" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-blue-600" />
            Alert Settings
          </h1>
          <p className="text-slate-600 mt-1">
            Configure portfolio alert preferences and thresholds
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleResetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSaveSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert Categories */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Alert Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(getCategoryInfo('sol')).length > 0 && (
                <>
                  {(['performance_degradation', 'performance_improvement', 'legal_regulatory', 'portfolio_level', 'sol'] as AlertCategory[]).map((category) => {
                    const info = getCategoryInfo(category);
                    const IconComponent = info.icon;
                    const isEnabled = settings.enabledCategories.includes(category);
                    
                    return (
                      <div key={category} className={`border rounded-lg p-4 ${isEnabled ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={info.color}>
                              <IconComponent className="h-5 w-5 mt-0.5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium text-gray-900">{info.name}</h3>
                                {isEnabled && <Badge variant="secondary" className="text-xs">Enabled</Badge>}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{info.description}</p>
                              <div className="space-y-1">
                                {info.examples.map((example, index) => (
                                  <div key={index} className="text-xs text-gray-500 flex items-center gap-1">
                                    <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                    {example}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Checkbox
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleCategoryToggle(category, !!checked)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alert Thresholds */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Alert Thresholds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="creditScoreDropMinimum" className="text-sm font-medium">
                  Credit Score Drop Minimum
                </Label>
                <Input
                  id="creditScoreDropMinimum"
                  type="number"
                  value={settings.thresholds.creditScoreDropMinimum}
                  onChange={(e) => handleThresholdChange('creditScoreDropMinimum', parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Points decrease to trigger alert</p>
              </div>

              <div>
                <Label htmlFor="paymentDeteriorationDays" className="text-sm font-medium">
                  Payment History Length
                </Label>
                <Input
                  id="paymentDeteriorationDays"
                  type="number"
                  value={settings.thresholds.paymentDeteriorationDays}
                  onChange={(e) => handleThresholdChange('paymentDeteriorationDays', parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Days of good payment history before deterioration alert</p>
              </div>

              <div>
                <Label htmlFor="foreclosureDelayDays" className="text-sm font-medium">
                  Foreclosure Delay Threshold
                </Label>
                <Input
                  id="foreclosureDelayDays"
                  type="number"
                  value={settings.thresholds.foreclosureDelayDays}
                  onChange={(e) => handleThresholdChange('foreclosureDelayDays', parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Days behind schedule to trigger delay alert</p>
              </div>

              <div>
                <Label htmlFor="securitizationMinimumLoans" className="text-sm font-medium">
                  Securitization Pool Minimum
                </Label>
                <Input
                  id="securitizationMinimumLoans"
                  type="number"
                  value={settings.thresholds.securitizationMinimumLoans}
                  onChange={(e) => handleThresholdChange('securitizationMinimumLoans', parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum loans for securitization opportunity</p>
              </div>

              <div>
                <Label htmlFor="geographicClusterMinimum" className="text-sm font-medium">
                  Geographic Cluster Minimum
                </Label>
                <Input
                  id="geographicClusterMinimum"
                  type="number"
                  value={settings.thresholds.geographicClusterMinimum}
                  onChange={(e) => handleThresholdChange('geographicClusterMinimum', parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Delinquent loans in same state to trigger clustering alert</p>
              </div>

              <div>
                <Label htmlFor="partialPaymentThreshold" className="text-sm font-medium">
                  Partial Payment Threshold
                </Label>
                <Input
                  id="partialPaymentThreshold"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={settings.thresholds.partialPaymentThreshold}
                  onChange={(e) => handleThresholdChange('partialPaymentThreshold', parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Percentage of full payment to consider partial (0.0-1.0)</p>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Notification Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label className="text-sm font-medium">Notification Frequency</Label>
                <div className="mt-2 space-y-2">
                  {[
                    { value: 'real_time', label: 'Real-time' },
                    { value: 'daily', label: 'Daily Summary' },
                    { value: 'weekly', label: 'Weekly Summary' }
                  ].map((option) => (
                    <Label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="frequency"
                        value={option.value}
                        checked={settings.notificationFrequency === option.value}
                        onChange={(e) => setSettings(prev => ({ ...prev, notificationFrequency: e.target.value as any }))}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">{option.label}</span>
                    </Label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AlertSettingsPage;