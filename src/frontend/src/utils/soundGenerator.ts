/**
 * Sound Generator Utility
 * Generates simple notification sounds programmatically when audio files are not available
 */

export interface SoundParameters {
  frequency: number;
  duration: number;
  volume: number;
  type: 'sine' | 'square' | 'triangle' | 'sawtooth';
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

export class SoundGenerator {
  private audioContext: AudioContext | null = null;

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
      }
    } catch (error) {
      console.warn('AudioContext not supported:', error);
    }
  }

  public async generateTone(params: SoundParameters): Promise<AudioBuffer | null> {
    if (!this.audioContext) return null;

    try {
      const sampleRate = this.audioContext.sampleRate;
      const length = Math.floor(sampleRate * params.duration);
      const buffer = this.audioContext.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      const fadeInSamples = Math.floor((params.fadeInDuration || 0.01) * sampleRate);
      const fadeOutSamples = Math.floor((params.fadeOutDuration || 0.01) * sampleRate);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        let sample = 0;

        // Generate waveform
        switch (params.type) {
          case 'sine':
            sample = Math.sin(2 * Math.PI * params.frequency * t);
            break;
          case 'square':
            sample = Math.sign(Math.sin(2 * Math.PI * params.frequency * t));
            break;
          case 'triangle':
            sample = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * params.frequency * t));
            break;
          case 'sawtooth':
            sample = 2 * (t * params.frequency - Math.floor(0.5 + t * params.frequency));
            break;
        }

        // Apply volume
        sample *= params.volume;

        // Apply fade in/out
        if (i < fadeInSamples) {
          sample *= i / fadeInSamples;
        } else if (i > length - fadeOutSamples) {
          sample *= (length - i) / fadeOutSamples;
        }

        data[i] = sample;
      }

      return buffer;
    } catch (error) {
      console.warn('Error generating tone:', error);
      return null;
    }
  }

  public async generateSequence(tones: SoundParameters[]): Promise<AudioBuffer | null> {
    if (!this.audioContext || tones.length === 0) return null;

    try {
      const totalDuration = tones.reduce((sum, tone) => sum + tone.duration, 0);
      const sampleRate = this.audioContext.sampleRate;
      const totalLength = Math.floor(sampleRate * totalDuration);
      const buffer = this.audioContext.createBuffer(1, totalLength, sampleRate);
      const data = buffer.getChannelData(0);

      let currentOffset = 0;

      for (const tone of tones) {
        const toneBuffer = await this.generateTone(tone);
        if (toneBuffer) {
          const toneData = toneBuffer.getChannelData(0);
          const toneLength = toneData.length;
          
          for (let i = 0; i < toneLength && currentOffset + i < totalLength; i++) {
            data[currentOffset + i] = toneData[i];
          }
          
          currentOffset += toneLength;
        }
      }

      return buffer;
    } catch (error) {
      console.warn('Error generating tone sequence:', error);
      return null;
    }
  }

  // Predefined notification sounds
  public static getNotificationSoundParams(type: string): SoundParameters[] {
    switch (type) {
      case 'message':
        return [{
          frequency: 800,
          duration: 0.15,
          volume: 0.3,
          type: 'sine',
          fadeInDuration: 0.01,
          fadeOutDuration: 0.05,
        }];

      case 'urgent':
        return [
          {
            frequency: 1000,
            duration: 0.1,
            volume: 0.4,
            type: 'sine',
            fadeInDuration: 0.005,
            fadeOutDuration: 0.02,
          },
          {
            frequency: 800,
            duration: 0.1,
            volume: 0.4,
            type: 'sine',
            fadeInDuration: 0.005,
            fadeOutDuration: 0.02,
          },
          {
            frequency: 1000,
            duration: 0.15,
            volume: 0.4,
            type: 'sine',
            fadeInDuration: 0.005,
            fadeOutDuration: 0.05,
          },
        ];

      case 'task':
        return [{
          frequency: 600,
          duration: 0.2,
          volume: 0.25,
          type: 'triangle',
          fadeInDuration: 0.02,
          fadeOutDuration: 0.05,
        }];

      case 'mention':
        return [
          {
            frequency: 1200,
            duration: 0.08,
            volume: 0.35,
            type: 'sine',
            fadeInDuration: 0.01,
            fadeOutDuration: 0.02,
          },
          {
            frequency: 900,
            duration: 0.12,
            volume: 0.35,
            type: 'sine',
            fadeInDuration: 0.01,
            fadeOutDuration: 0.03,
          },
        ];

      case 'success':
        return [
          {
            frequency: 600,
            duration: 0.1,
            volume: 0.3,
            type: 'sine',
            fadeInDuration: 0.01,
            fadeOutDuration: 0.02,
          },
          {
            frequency: 800,
            duration: 0.15,
            volume: 0.3,
            type: 'sine',
            fadeInDuration: 0.01,
            fadeOutDuration: 0.05,
          },
        ];

      case 'error':
        return [
          {
            frequency: 400,
            duration: 0.15,
            volume: 0.35,
            type: 'square',
            fadeInDuration: 0.01,
            fadeOutDuration: 0.03,
          },
          {
            frequency: 300,
            duration: 0.2,
            volume: 0.35,
            type: 'square',
            fadeInDuration: 0.01,
            fadeOutDuration: 0.05,
          },
        ];

      default:
        return [{
          frequency: 800,
          duration: 0.15,
          volume: 0.3,
          type: 'sine',
          fadeInDuration: 0.01,
          fadeOutDuration: 0.05,
        }];
    }
  }

  public async playTone(params: SoundParameters): Promise<void> {
    if (!this.audioContext) return;

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const buffer = await this.generateTone(params);
      if (!buffer) return;

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.warn('Error playing tone:', error);
    }
  }

  public async playSequence(tones: SoundParameters[]): Promise<void> {
    if (!this.audioContext) return;

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const buffer = await this.generateSequence(tones);
      if (!buffer) return;

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.warn('Error playing tone sequence:', error);
    }
  }
}

export const soundGenerator = new SoundGenerator();