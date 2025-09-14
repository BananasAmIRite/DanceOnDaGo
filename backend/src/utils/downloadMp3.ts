import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

export interface DownloadOptions {
  filename?: string;
  outputDir?: string;
}

export const downloadMp3 = async (
  url: string, 
  options: DownloadOptions = {}
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Default options
      const outputDir = options.outputDir || path.join(__dirname, '../../downloads');
      const filename = options.filename || `audio-${Date.now()}.mp3`;
      
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filePath = path.join(outputDir, filename);
      const file = fs.createWriteStream(filePath);
      
      // Choose appropriate module based on URL protocol
      const client = url.startsWith('https:') ? https : http;
      
      const request = client.get(url, (response) => {
        // Check if response is successful
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }
        
        // Check content type (optional validation)
        const contentType = response.headers['content-type'];
        if (contentType && !contentType.includes('audio') && !contentType.includes('octet-stream')) {
          console.warn(`Warning: Content-Type is ${contentType}, expected audio format`);
        }
        
        // Pipe the response to file
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log(`MP3 downloaded successfully: ${filePath}`);
          resolve(filePath);
        });
        
        file.on('error', (err) => {
          fs.unlink(filePath, () => {}); // Delete incomplete file
          reject(new Error(`File write error: ${err.message}`));
        });
      });
      
      request.on('error', (err) => {
        reject(new Error(`Download request error: ${err.message}`));
      });
      
    //   request.setTimeout(30000, () => {
    //     request.destroy();
    //     reject(new Error('Download timeout after 30 seconds'));
    //   });
      
    } catch (error) {
      reject(new Error(`Download setup error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
};

export const downloadMp3Buffer = async (url: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const client = url.startsWith('https:') ? https : http;
      
      const request = client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }
        
        const chunks: Buffer[] = [];
        
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`MP3 downloaded to buffer: ${buffer.length} bytes`);
          resolve(buffer);
        });
        
        response.on('error', (err) => {
          reject(new Error(`Response error: ${err.message}`));
        });
      });
      
      request.on('error', (err) => {
        reject(new Error(`Download request error: ${err.message}`));
      });
      
    //   request.setTimeout(30000, () => {
    //     request.destroy();
    //     reject(new Error('Download timeout after 30 seconds'));
    //   });
      
    } catch (error) {
      reject(new Error(`Download setup error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
};
