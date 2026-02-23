import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { firebaseDB } from "./firebase";

type ErrorType = "client" | "server" | "api" | "database" | "auth" | "validation" | "network" | "unknown";
type ErrorSeverity = "low" | "medium" | "high" | "critical";

interface LogErrorOptions {
  type?: ErrorType;
  severity?: ErrorSeverity;
  source: string; // page or component name
  userId?: string;
  userEmail?: string;
  metadata?: Record<string, any>;
}

// Get device information
const getDeviceInfo = () => {
  if (typeof window === "undefined") return null;
  
  const ua = navigator.userAgent;
  let browser = "Unknown";
  
  if (ua.includes("Chrome") && !ua.includes("Edge")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";

  return {
    userAgent: ua,
    platform: navigator.platform,
    browser: browser,
    isMobile: /Mobile|Android|iPhone|iPad/i.test(ua),
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
};

/**
 * Log an error to the error monitoring system
 * @param error - The error object or message
 * @param options - Additional options for error logging
 */
export async function logError(
  error: Error | string,
  options: LogErrorOptions
): Promise<void> {
  try {
    const errorMessage = typeof error === "string" ? error : error.message;
    const errorStack = typeof error === "string" ? undefined : error.stack;

    // Determine error type based on message if not provided
    let errorType: ErrorType = options.type || "unknown";
    if (!options.type) {
      const msg = errorMessage.toLowerCase();
      if (msg.includes("firebase") || msg.includes("firestore")) errorType = "database";
      else if (msg.includes("api") || msg.includes("fetch")) errorType = "api";
      else if (msg.includes("auth") || msg.includes("login")) errorType = "auth";
      else if (msg.includes("network") || msg.includes("timeout")) errorType = "network";
      else if (msg.includes("validation") || msg.includes("invalid")) errorType = "validation";
      else if (typeof window !== "undefined") errorType = "client";
      else errorType = "server";
    }

    // Determine severity based on error type if not provided
    let severity: ErrorSeverity = options.severity || "medium";
    if (!options.severity) {
      if (errorType === "database" || errorType === "auth") severity = "high";
      else if (errorType === "validation") severity = "low";
      else if (errorMessage.includes("critical") || errorMessage.includes("fatal")) severity = "critical";
    }

    const errorData = {
      type: errorType,
      severity,
      message: errorMessage,
      stack: errorStack,
      source: options.source,
      userId: options.userId || null,
      userEmail: options.userEmail || null,
      device: getDeviceInfo(),
      metadata: options.metadata || {},
      timestamp: serverTimestamp(),
      resolved: false,
    };

    // Log to Firestore
    await addDoc(collection(firebaseDB, "errorLogs"), errorData);

    // Also log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error(`[Error Monitor] ${errorType.toUpperCase()} (${severity}):`, errorMessage);
      if (errorStack) console.error(errorStack);
    }
  } catch (loggingError) {
    // Fail silently - don't break the app if error logging fails
    console.error("Failed to log error:", loggingError);
  }
}

/**
 * Create an error boundary logger
 * Usage in error boundary: logErrorBoundary(error, errorInfo, componentName)
 */
export function logErrorBoundary(
  error: Error,
  errorInfo: { componentStack: string },
  componentName: string
): void {
  logError(error, {
    type: "client",
    severity: "high",
    source: `ErrorBoundary:${componentName}`,
    metadata: {
      componentStack: errorInfo.componentStack,
    },
  });
}

/**
 * Create a try-catch wrapper that automatically logs errors
 * @param fn - The function to wrap
 * @param source - Source identifier for the error
 */
export function withErrorLogging<T extends (...args: any[]) => any>(
  fn: T,
  source: string
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);
      // Handle async functions
      if (result instanceof Promise) {
        return result.catch((error) => {
          logError(error, { source, severity: "high" });
          throw error;
        });
      }
      return result;
    } catch (error) {
      logError(error as Error, { source, severity: "high" });
      throw error;
    }
  }) as T;
}

/**
 * Global error handler for uncaught errors (client-side only)
 * Call this in your app initialization
 */
export function initializeGlobalErrorHandler(): void {
  if (typeof window === "undefined") return;

  // Catch unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    logError(event.reason || "Unhandled Promise Rejection", {
      type: "client",
      severity: "high",
      source: "UnhandledPromiseRejection",
      metadata: {
        promise: event.promise.toString(),
      },
    });
  });

  // Catch global errors
  window.addEventListener("error", (event) => {
    logError(event.error || event.message, {
      type: "client",
      severity: "high",
      source: event.filename || "GlobalError",
      metadata: {
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });
}
