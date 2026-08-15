import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

function generateDistManifest() {
  return {
    name: 'generate-dist-manifest',
    writeBundle() {
      if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist');
      }
      
      const distManifest = {
        manifest_version: 3,
        name: "Meta AI Scene Generator & Auto-Prompter",
        version: "1.0.0",
        description: "Splits video scripts into visual scenes and automatically generates images on Meta AI.",
        permissions: [
          "sidePanel",
          "storage",
          "activeTab",
          "scripting",
          "downloads"
        ],
        host_permissions: [
          "https://www.meta.ai/*",
          "https://meta.ai/*",
          "https://generativelanguage.googleapis.com/*",
          "https://api.openai.com/*",
          "https://api.anthropic.com/*",
          "https://api.groq.com/*",
          "https://openrouter.ai/*",
          "<all_urls>"
        ],
        background: {
          service_worker: "background.js"
        },
        side_panel: {
          default_path: "sidepanel.html"
        },
        action: {
          default_title: "Open Meta AI Scene Generator"
        },
        content_scripts: [
          {
            matches: [
              "https://www.meta.ai/*",
              "https://meta.ai/*"
            ],
            js: ["content.js"],
            run_at: "document_idle"
          }
        ],
        icons: {
          "16": "icons/icon16.png",
          "48": "icons/icon48.png",
          "128": "icons/icon128.png"
        }
      };

      fs.writeFileSync('dist/manifest.json', JSON.stringify(distManifest, null, 2));

      if (fs.existsSync('public/icons')) {
        if (!fs.existsSync('dist/icons')) {
          fs.mkdirSync('dist/icons', { recursive: true });
        }
        const files = fs.readdirSync('public/icons');
        for (const file of files) {
          fs.copyFileSync(`public/icons/${file}`, `dist/icons/${file}`);
        }
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), generateDistManifest()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        background: resolve(__dirname, 'src/background/background.ts'),
        content: resolve(__dirname, 'src/content/contentScript.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          if (chunkInfo.name === 'content') return 'content.js';
          if (chunkInfo.name === 'sidepanel') return 'sidepanel.js';
          return 'assets/[name].js';
        },
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});
