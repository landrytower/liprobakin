# Error Monitoring System

A comprehensive error tracking and analytics dashboard for monitoring application errors in real-time.

## Features

### 📊 Smart Analytics Panels

1. **Overview Statistics**
   - Total errors count
   - Errors in last 24 hours
   - Critical errors count
   - Resolved errors count
   - Error rate (errors per hour)

2. **Error Types Distribution**
   - Client-side errors
   - Server-side errors
   - API errors
   - Database errors
   - Authentication errors
   - Validation errors
   - Network errors

3. **Error Sources Analysis**
   - Top 5 components/pages generating errors
   - Visual distribution charts

4. **Common Errors**
   - Most frequently occurring error messages
   - Occurrence counts

5. **Hourly Distribution**
   - Error patterns over the last 24 hours
   - Visual bar chart by hour

### 🔍 Advanced Filtering

- Filter by severity (Critical, High, Medium, Low)
- Filter by type (Client, Server, API, Database, etc.)
- Toggle resolved/unresolved errors
- Real-time updates via Firestore listeners

### 📝 Error Details

Each error log includes:
- Error message and stack trace
- Severity level and type
- Source (page/component)
- User information (if available)
- Device/browser information
- Timestamp
- Custom metadata

## Usage

### Accessing the Dashboard

Only **master administrators** can access the error monitoring dashboard at:
```
/admin/errors
```

The dashboard is automatically added to the admin navigation menu with a ⚠️ icon.

### Logging Errors in Your Code

#### 1. Basic Error Logging

```typescript
import { logError } from "@/lib/errorLogger";

try {
  // Your code
} catch (error) {
  logError(error as Error, {
    source: "ComponentName",
    severity: "high",
    type: "client",
  });
}
```

#### 2. With User Context

```typescript
import { logError } from "@/lib/errorLogger";

logError(error as Error, {
  source: "UserProfile",
  userId: user.id,
  userEmail: user.email,
  severity: "medium",
  type: "validation",
  metadata: {
    field: "email",
    attemptedValue: formData.email,
  },
});
```

#### 3. Async Operations

```typescript
import { logError } from "@/lib/errorLogger";

async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error('API request failed');
    return await response.json();
  } catch (error) {
    logError(error as Error, {
      source: "DataFetching",
      type: "api",
      severity: "high",
      metadata: {
        endpoint: '/api/data',
        status: response?.status,
      },
    });
    throw error;
  }
}
```

#### 4. Function Wrapper (Auto-logging)

```typescript
import { withErrorLogging } from "@/lib/errorLogger";

const myFunction = withErrorLogging(async (params: any) => {
  // Your code that might throw errors
  return result;
}, "MyFunctionName");
```

#### 5. Error Boundaries

```typescript
import { logErrorBoundary } from "@/lib/errorLogger";

class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logErrorBoundary(error, errorInfo, "MyComponent");
  }
}
```

#### 6. Global Error Handler (Initialize in App)

Add to your root layout or app initialization:

```typescript
import { initializeGlobalErrorHandler } from "@/lib/errorLogger";

// In your app initialization (client-side only)
useEffect(() => {
  initializeGlobalErrorHandler();
}, []);
```

### Error Types

- `client` - Client-side JavaScript errors
- `server` - Server-side errors
- `api` - API request/response errors
- `database` - Firestore/database errors
- `auth` - Authentication/authorization errors
- `validation` - Form/data validation errors
- `network` - Network connectivity errors
- `unknown` - Unclassified errors

### Severity Levels

- `critical` - Application-breaking errors requiring immediate attention
- `high` - Important errors affecting functionality
- `medium` - Errors that should be addressed but don't break core features
- `low` - Minor errors or warnings

## Dashboard Actions

### Mark as Resolved
Remove an error from the active list (deletes the error log)

### Delete Error
Permanently remove a specific error log

### Clear All Errors
Remove all error logs at once (requires confirmation)

### View Stack Trace
Expand error details to see full stack trace

## Firestore Collection

Error logs are stored in the `errorLogs` collection with the following structure:

```typescript
{
  type: "client" | "server" | "api" | "database" | "auth" | "validation" | "network" | "unknown",
  severity: "low" | "medium" | "high" | "critical",
  message: string,
  stack?: string,
  source: string,
  userId?: string,
  userEmail?: string,
  timestamp: Timestamp,
  device?: {
    userAgent: string,
    platform: string,
    browser: string,
    isMobile: boolean,
    screenResolution: string,
    language: string,
    timezone: string,
  },
  metadata?: Record<string, any>,
  resolved: boolean,
}
```

## Best Practices

1. **Always provide source context** - Use descriptive source names like "TeamManagement/CreateTeam" instead of generic names

2. **Include relevant metadata** - Add context-specific data to help debugging:
   ```typescript
   metadata: {
     teamId: selectedTeam.id,
     action: "delete",
     timestamp: new Date().toISOString(),
   }
   ```

3. **Set appropriate severity levels**:
   - Critical: Auth failures, database connection errors
   - High: Failed API calls, data corruption
   - Medium: Validation errors, missing data
   - Low: Minor UI glitches, logging issues

4. **Don't log sensitive data** - Avoid logging passwords, tokens, or personal information

5. **Use error boundaries** - Wrap major components in error boundaries to catch React errors

6. **Monitor regularly** - Check the dashboard daily for patterns and trends

7. **Clean up resolved errors** - Mark errors as resolved after fixing to keep the dashboard clean

## Performance

- Logs are written asynchronously and won't block your application
- Failed logging operations fail silently to prevent cascading errors
- Real-time dashboard updates via Firestore snapshots (500 most recent errors)
- Efficient filtering and sorting on the client side

## Security

- Only master administrators can access the dashboard
- Error logs include device info but no session tokens or passwords
- Firestore security rules should restrict read/write access to admin users only

## Monitoring Tips

1. **Watch for patterns** - Recurring errors from the same source indicate a systemic issue
2. **Check error rates** - Sudden spikes may indicate deployment issues
3. **Monitor critical errors** - These should always be zero or addressed immediately
4. **Review hourly distribution** - Identifies peak error times
5. **Analyze error types** - Helps prioritize infrastructure improvements

## Future Enhancements

- Email/Slack notifications for critical errors
- Error grouping and deduplication
- Custom alert thresholds
- Integration with external monitoring services (Sentry, LogRocket)
- Error trend analysis over weeks/months
- Automatic error categorization using ML
