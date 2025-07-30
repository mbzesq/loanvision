import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Bell, BellOff, Settings, TestTube } from 'lucide-react';
import { audioNotificationService, AudioNotificationSettings, NotificationSoundType } from '../services/audioNotificationService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export function NotificationSettings() {
  const [settings, setSettings] = useState<AudioNotificationSettings>(audioNotificationService.getSettings());
  const [isOpen, setIsOpen] = useState(false);
  const [isTestingSound, setIsTestingSound] = useState<NotificationSoundType | null>(null);

  useEffect(() => {
    const currentSettings = audioNotificationService.getSettings();
    setSettings(currentSettings);
  }, [isOpen]);

  const handleEnabledChange = (enabled: boolean) => {
    const newSettings = { ...settings, enabled };
    setSettings(newSettings);
    audioNotificationService.updateSettings(newSettings);
  };

  const handleVolumeChange = (volume: number[]) => {
    const newSettings = { ...settings, volume: volume[0] };
    setSettings(newSettings);
    audioNotificationService.updateSettings(newSettings);
  };

  const handleSoundToggle = (soundType: NotificationSoundType, enabled: boolean) => {
    const newSettings = {
      ...settings,
      enabledSounds: {
        ...settings.enabledSounds,
        [soundType]: enabled,
      },
    };
    setSettings(newSettings);
    audioNotificationService.updateSettings(newSettings);
  };

  const handleTestSound = async (soundType: NotificationSoundType) => {
    setIsTestingSound(soundType);
    try {
      await audioNotificationService.testSound(soundType);
    } catch (error) {
      console.warn('Error testing sound:', error);
    } finally {
      // Clear testing state after a short delay to show feedback
      setTimeout(() => setIsTestingSound(null), 500);
    }
  };

  const soundTypeLabels: Record<NotificationSoundType, { label: string; description: string }> = {
    message: { label: 'Chat Messages', description: 'New messages in chat rooms' },
    urgent: { label: 'Urgent Alerts', description: 'High priority notifications' },
    task: { label: 'Task Assignments', description: 'New tasks assigned to you' },
    mention: { label: 'Mentions', description: 'When someone mentions you' },
    success: { label: 'Success Actions', description: 'Successful operations' },
    error: { label: 'Error Alerts', description: 'Error notifications' },
  };

  const isAudioSupported = audioNotificationService.isAudioSupported();
  const isInitialized = audioNotificationService.getInitializationStatus();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        onClick={() => setIsOpen(true)}
      >
        {settings.enabled ? (
          <Bell className="w-4 h-4" />
        ) : (
          <BellOff className="w-4 h-4" />
        )}
        <Settings className="w-4 h-4" />
        <span className="hidden sm:inline">Notifications</span>
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Audio Support Status */}
          {!isAudioSupported && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                Audio notifications are not supported in this browser.
              </p>
            </div>
          )}

          {isAudioSupported && !isInitialized && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                Audio notifications are initializing...
              </p>
            </div>
          )}

          {/* Master Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.enabled ? (
                <Volume2 className="w-5 h-5 text-blue-600" />
              ) : (
                <VolumeX className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <div className="font-medium">Audio Notifications</div>
                <div className="text-sm text-gray-500">
                  Play sounds for notifications
                </div>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={handleEnabledChange}
              disabled={!isAudioSupported}
            />
          </div>

          {/* Volume Control */}
          {settings.enabled && isAudioSupported && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Volume</label>
                <span className="text-sm text-gray-500">
                  {Math.round(settings.volume * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.volume]}
                onValueChange={handleVolumeChange}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
            </div>
          )}

          {/* Individual Sound Controls */}
          {settings.enabled && isAudioSupported && (
            <div className="space-y-4">
              <div className="text-sm font-medium">Sound Types</div>
              <div className="space-y-3">
                {Object.entries(soundTypeLabels).map(([soundType, config]) => (
                  <div key={soundType} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{config.label}</span>
                        {settings.enabledSounds[soundType as NotificationSoundType] && (
                          <Badge variant="secondary" className="text-xs">On</Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{config.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestSound(soundType as NotificationSoundType)}
                        disabled={!settings.enabledSounds[soundType as NotificationSoundType] || isTestingSound === soundType}
                        className="p-1 h-8 w-8"
                      >
                        <TestTube className={`w-3 h-3 ${isTestingSound === soundType ? 'animate-pulse' : ''}`} />
                      </Button>
                      <Switch
                        checked={settings.enabledSounds[soundType as NotificationSoundType]}
                        onCheckedChange={(enabled) => handleSoundToggle(soundType as NotificationSoundType, enabled)}
                        size="sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Information */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">
              Audio notifications respect your browser's autoplay policy. 
              You may need to interact with the page first for sounds to play.
            </p>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}

export default NotificationSettings;