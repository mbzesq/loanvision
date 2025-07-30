/**
 * Audio Notification Service
 * Manages sound notifications for chat messages and inbox items
 */

export type NotificationSoundType = 
  | 'message' 
  | 'urgent' 
  | 'task' 
  | 'mention' 
  | 'success' 
  | 'error';

export interface AudioNotificationSettings {
  enabled: boolean;
  volume: number; // 0-1
  enabledSounds: {
    [key in NotificationSoundType]: boolean;
  };
}

export class AudioNotificationService {
  private static instance: AudioNotificationService;
  private audioContext: AudioContext | null = null;
  private soundBuffers: Map<NotificationSoundType, AudioBuffer> = new Map();
  private settings: AudioNotificationSettings;
  private isInitialized = false;

  // Default settings
  private defaultSettings: AudioNotificationSettings = {
    enabled: true,
    volume: 0.7,
    enabledSounds: {
      message: true,
      urgent: true,
      task: true,
      mention: true,
      success: true,
      error: true,
    },
  };

  private constructor() {
    this.settings = this.loadSettings();
    this.initializeAudioContext();
  }

  public static getInstance(): AudioNotificationService {
    if (!AudioNotificationService.instance) {
      AudioNotificationService.instance = new AudioNotificationService();
    }
    return AudioNotificationService.instance;
  }

  private initializeAudioContext(): void {
    try {
      // Use modern AudioContext API
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        this.loadSoundAssets();
      }
    } catch (error) {
      console.warn('Audio notifications not supported in this browser:', error);
    }
  }

  private async loadSoundAssets(): Promise<void> {
    if (!this.audioContext) return;

    const soundUrls: Record<NotificationSoundType, string> = {
      message: '/sounds/message.mp3',
      urgent: '/sounds/urgent.mp3',
      task: '/sounds/task.mp3',
      mention: '/sounds/mention.mp3',
      success: '/sounds/success.mp3',
      error: '/sounds/error.mp3',
    };

    try {
      const loadPromises = Object.entries(soundUrls).map(async ([type, url]) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            console.warn(`Failed to load sound: ${url}`);
            return;
          }
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
          this.soundBuffers.set(type as NotificationSoundType, audioBuffer);
        } catch (error) {
          console.warn(`Error loading sound ${type}:`, error);
          // Generate a simple beep as fallback
          this.generateFallbackSound(type as NotificationSoundType);
        }
      });

      await Promise.all(loadPromises);
      this.isInitialized = true;
      console.log('Audio notification service initialized with', this.soundBuffers.size, 'sounds');
    } catch (error) {
      console.warn('Error loading sound assets:', error);
      this.generateFallbackSounds();
    }
  }

  private generateFallbackSound(type: NotificationSoundType): void {
    if (!this.audioContext) return;

    try {
      // Generate simple tone based on notification type
      const sampleRate = this.audioContext.sampleRate;
      const duration = type === 'urgent' ? 0.3 : 0.15;
      const length = sampleRate * duration;
      const buffer = this.audioContext.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      // Different frequencies for different notification types
      const frequencies: Record<NotificationSoundType, number[]> = {
        message: [800],
        urgent: [1000, 800, 1000], // Triple beep
        task: [600],
        mention: [1200, 900],
        success: [600, 800],
        error: [400, 300],
      };

      const freqs = frequencies[type];
      const segmentLength = length / freqs.length;

      freqs.forEach((freq, index) => {
        const start = Math.floor(index * segmentLength);
        const end = Math.floor((index + 1) * segmentLength);
        
        for (let i = start; i < end; i++) {
          const t = i / sampleRate;
          const fadeIn = Math.min(1, i / (sampleRate * 0.01)); // 10ms fade in
          const fadeOut = Math.min(1, (end - i) / (sampleRate * 0.01)); // 10ms fade out
          const envelope = fadeIn * fadeOut;
          data[i] = Math.sin(2 * Math.PI * freq * t) * 0.3 * envelope;
        }
      });

      this.soundBuffers.set(type, buffer);
    } catch (error) {
      console.warn(`Error generating fallback sound for ${type}:`, error);
    }
  }

  private generateFallbackSounds(): void {
    const types: NotificationSoundType[] = ['message', 'urgent', 'task', 'mention', 'success', 'error'];
    types.forEach(type => this.generateFallbackSound(type));
    this.isInitialized = true;
  }

  public async playNotification(type: NotificationSoundType, options?: { force?: boolean }): Promise<void> {
    // Check if notifications are enabled
    if (!this.settings.enabled && !options?.force) return;
    if (!this.settings.enabledSounds[type] && !options?.force) return;
    if (!this.audioContext || !this.isInitialized) return;

    // Check if page is hidden or user hasn't interacted (browser autoplay policy)
    if (document.hidden && !options?.force) return;

    try {
      // Resume audio context if suspended (required by browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const buffer = this.soundBuffers.get(type);
      if (!buffer) {
        console.warn(`No sound buffer available for type: ${type}`);
        return;
      }

      // Create and configure audio source
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      
      source.buffer = buffer;
      gainNode.gain.value = this.settings.volume;
      
      // Connect nodes
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Play sound
      source.start();
      
    } catch (error) {
      console.warn(`Error playing notification sound ${type}:`, error);
    }
  }

  public updateSettings(newSettings: Partial<AudioNotificationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  public getSettings(): AudioNotificationSettings {
    return { ...this.settings };
  }

  public setEnabled(enabled: boolean): void {
    this.updateSettings({ enabled });
  }

  public setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.updateSettings({ volume: clampedVolume });
  }

  public setSoundEnabled(type: NotificationSoundType, enabled: boolean): void {
    this.updateSettings({
      enabledSounds: {
        ...this.settings.enabledSounds,
        [type]: enabled,
      },
    });
  }

  public async testSound(type: NotificationSoundType): Promise<void> {
    await this.playNotification(type, { force: true });
  }

  public isAudioSupported(): boolean {
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }

  public getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  private loadSettings(): AudioNotificationSettings {
    try {
      const saved = localStorage.getItem('nplvision-audio-notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...this.defaultSettings, ...parsed };
      }
    } catch (error) {
      console.warn('Error loading audio notification settings:', error);
    }
    return { ...this.defaultSettings };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('nplvision-audio-notifications', JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Error saving audio notification settings:', error);
    }
  }

  // Utility method to determine notification type from inbox item
  public static getNotificationTypeFromInboxItem(item: any): NotificationSoundType {
    if (item.priority === 'urgent') return 'urgent';
    if (item.type === 'task_assignment') return 'task';
    if (item.type === 'user_message') {
      // Check if it's a mention (contains current user's name in body)
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (currentUser.name && item.body?.toLowerCase().includes(currentUser.name.toLowerCase())) {
        return 'mention';
      }
      return 'message';
    }
    return 'message';
  }
}

// Export singleton instance
export const audioNotificationService = AudioNotificationService.getInstance();