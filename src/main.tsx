import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './lib/LanguageContext.tsx';
import './index.css';

// Hook console logs to filter out benign Firestore idle connection stream timeouts
if (typeof window !== "undefined") {
  const originalError = console.error;
  const originalWarn = console.warn;

  const shouldIgnore = (args: any[]) => {
    return args.some(arg => {
      if (typeof arg === "string") {
        return (
          arg.includes("Disconnecting idle stream") ||
          arg.includes("Timed out waiting for new targets") ||
          arg.includes("GrpcConnection RPC") ||
          arg.includes("firebase/firestore")
        );
      }
      if (arg && typeof arg === "object" && arg.message) {
        return (
          arg.message.includes("Disconnecting idle stream") ||
          arg.message.includes("Timed out waiting for new targets")
        );
      }
      return false;
    });
  };

  console.error = function (...args) {
    if (shouldIgnore(args)) return;
    originalError.apply(console, args);
  };

  console.warn = function (...args) {
    if (shouldIgnore(args)) return;
    originalWarn.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
