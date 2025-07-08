import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import os from 'os';

export class OCREnhancementService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'nplvision-ocr');
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('[OCREnhancementService] Failed to create temp directory:', error);
    }
  }

  /**
   * Enhance a PDF for better OCR results
   * Converts to grayscale images and reassembles as optimized PDF
   * @param inputBuffer - Original PDF buffer
   * @param fileName - Original filename for logging
   * @returns Enhanced PDF buffer
   */
  async enhancePDF(inputBuffer: Buffer, fileName: string): Promise<Buffer> {
    const sessionId = uuidv4();
    const inputPath = path.join(this.tempDir, `${sessionId}_input.pdf`);
    const outputPath = path.join(this.tempDir, `${sessionId}_enhanced.pdf`);
    const scriptPath = path.resolve(__dirname, '../../ocr_repair_helper.py');

    try {
      console.log(`[OCREnhancementService] Starting PDF enhancement for: ${fileName}`);

      // Write input buffer to temporary file
      await fs.writeFile(inputPath, inputBuffer);

      // Check if Python script exists
      try {
        await fs.access(scriptPath);
      } catch {
        console.warn('[OCREnhancementService] Python OCR script not found, returning original PDF');
        return inputBuffer;
      }

      // Call Python OCR enhancement script
      const enhancedBuffer = await this.callPythonEnhancement(inputPath, outputPath, scriptPath);

      console.log(`[OCREnhancementService] PDF enhancement completed for: ${fileName}`);
      console.log(`[OCREnhancementService] Original size: ${inputBuffer.length} bytes, Enhanced size: ${enhancedBuffer.length} bytes`);
      
      // Check if enhanced PDF is valid
      if (enhancedBuffer.length < 100) {
        console.warn('[OCREnhancementService] Enhanced PDF is suspiciously small, using original');
        return inputBuffer;
      }
      
      // Check for PDF header
      const pdfHeader = enhancedBuffer.slice(0, 4).toString();
      if (!pdfHeader.startsWith('%PDF')) {
        console.warn('[OCREnhancementService] Enhanced file is not a valid PDF, using original');
        return inputBuffer;
      }
      
      console.log(`[OCREnhancementService] Enhanced PDF validated successfully`);
      return enhancedBuffer;

    } catch (error) {
      console.error('[OCREnhancementService] Enhancement failed, using original PDF:', error);
      return inputBuffer; // Fallback to original
    } finally {
      // Cleanup temporary files
      await this.cleanup([inputPath, outputPath]);
    }
  }

  private async callPythonEnhancement(inputPath: string, outputPath: string, scriptPath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [scriptPath, inputPath, outputPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONPATH: path.dirname(scriptPath),
        },
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', async (code) => {
        if (code === 0) {
          try {
            // Read the enhanced PDF
            const enhancedBuffer = await fs.readFile(outputPath);
            console.log(`[OCREnhancementService] Python enhancement successful`);
            resolve(enhancedBuffer);
          } catch (readError) {
            console.error('[OCREnhancementService] Failed to read enhanced PDF:', readError);
            reject(readError);
          }
        } else {
          console.error('[OCREnhancementService] Python script failed:', stderr);
          reject(new Error(`Python OCR enhancement failed with code ${code}: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('[OCREnhancementService] Failed to spawn Python process:', error);
        reject(error);
      });

      // Set timeout to prevent hanging
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('OCR enhancement timed out'));
      }, 30000); // 30 second timeout
    });
  }

  private async cleanup(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Check if OCR enhancement is available (Python script and dependencies)
   * @returns boolean indicating if enhancement is available
   */
  async isEnhancementAvailable(): Promise<boolean> {
    try {
      const scriptPath = path.resolve(__dirname, '../../ocr_repair_helper.py');
      
      // Check if script exists
      try {
        await fs.access(scriptPath);
        console.log('[OCREnhancementService] Python script found at:', scriptPath);
      } catch {
        console.log('[OCREnhancementService] Python script not found at:', scriptPath);
        return false;
      }
      
      // Test if python3 is available
      return new Promise((resolve) => {
        console.log('[OCREnhancementService] Testing Python availability...');
        const testProcess = spawn('python3', ['--version'], { stdio: 'pipe' });
        
        let output = '';
        testProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        testProcess.stderr.on('data', (data) => {
          output += data.toString();
        });
        
        testProcess.on('close', (code) => {
          console.log('[OCREnhancementService] Python test result:', { code, output });
          if (code === 0) {
            // Test if required packages are available
            this.testPythonPackages().then(packagesAvailable => {
              console.log('[OCREnhancementService] Python packages available:', packagesAvailable);
              resolve(packagesAvailable);
            }).catch(() => {
              console.log('[OCREnhancementService] Failed to test Python packages');
              resolve(false);
            });
          } else {
            resolve(false);
          }
        });
        
        testProcess.on('error', (error) => {
          console.log('[OCREnhancementService] Python test error:', error.message);
          resolve(false);
        });
      });
    } catch (error) {
      console.log('[OCREnhancementService] Enhancement check failed:', error);
      return false;
    }
  }

  private async testPythonPackages(): Promise<boolean> {
    return new Promise((resolve) => {
      const testProcess = spawn('python3', ['-c', 'import pdf2image, PIL, img2pdf; print("OK")'], { stdio: 'pipe' });
      
      let output = '';
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      testProcess.on('close', (code) => {
        console.log('[OCREnhancementService] Package test result:', { code, output });
        resolve(code === 0 && output.includes('OK'));
      });
      
      testProcess.on('error', () => {
        resolve(false);
      });
    });
  }
}

// Export singleton instance
export const ocrEnhancementService = new OCREnhancementService();