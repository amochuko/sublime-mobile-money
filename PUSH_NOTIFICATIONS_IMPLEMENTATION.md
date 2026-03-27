# Push Notifications (FCM/APNs) Implementation

## Overview

This document describes the implementation of Firebase Cloud Messaging (FCM) push notifications for the Mobile Money application, supporting both Android and iOS platforms.

## Implementation Details

### Files Created

1. **`src/services/push.ts`** - Push notification service with FCM integration
2. **`src/routes/push.ts`** - API endpoints for token management
3. **`migrations/009_add_push_tokens.sql`** - Database migration for push tokens table

### Files Modified

1. **`src/queue/worker.ts`** - Integrated push notifications into transaction workflow
2. **`src/index.ts`** - Registered push notification API routes
3. **`.env.example`** - Added Firebase configuration variables

### Dependencies Added

```json
{
  "firebase-admin": "^12.0.0"
}
```

## Database Schema

### push_tokens Table

```sql
CREATE TABLE push_tokens (
  id            UUID        PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES users(id),
  token         TEXT        NOT NULL UNIQUE,
  platform      VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Firebase Cloud Messaging Configuration
# Get this from Firebase Console > Project Settings > Service Accounts
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project",...}
# OR provide path to JSON file
FIREBASE_SERVICE_ACCOUNT_KEY=/path/to/firebase-service-account.json
```

### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Enable Cloud Messaging
4. Go to Project Settings > Service Accounts
5. Generate new private key (downloads JSON file)
6. Use the JSON content or file path in `FIREBASE_SERVICE_ACCOUNT_KEY`

## API Endpoints

### Register Push Token

**POST** `/push/register`

Register a new FCM token for the authenticated user.

```json
// Request
{
  "token": "fcm-device-token-string",
  "platform": "android"
}

// Response (201 Created)
{
  "success": true,
  "data": {
    "id": "uuid",
    "token": "fcm-device-token-string",
    "platform": "android",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get User's Tokens

**GET** `/push/tokens`

Retrieve all registered tokens for the authenticated user.

```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "tokens": [
      {
        "id": "uuid",
        "token": "fcm-token-1",
        "platform": "android",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

### Unregister Token

**DELETE** `/push/unregister`

Remove a specific FCM token.

```json
// Request
{
  "token": "fcm-device-token-string"
}

// Response (200 OK)
{
  "success": true,
  "message": "Token unregistered successfully"
}
```

### Unregister All Tokens

**DELETE** `/push/unregister-all`

Remove all FCM tokens for the authenticated user.

```json
// Response (200 OK)
{
  "success": true,
  "message": "All tokens unregistered successfully"
}
```

### Send Test Notification

**POST** `/push/test`

Send a test push notification to all user devices (for development/testing).

```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "tokensSent": 2,
    "message": "Test notification sent to 2 device(s)"
  }
}
```

## Automatic Notifications

Push notifications are automatically sent when:

### Transaction Completed

- **Deposit Successful**: "Deposit Successful - Received {amount} - Ref: {referenceNumber}"
- **Withdrawal Complete**: "Withdrawal Complete - Sent {amount} - Ref: {referenceNumber}"

### Transaction Failed

- **Deposit Failed**: "Deposit Failed - {error message}"
- **Withdrawal Failed**: "Withdrawal Failed - {error message}"

## Client Integration

### Android (Firebase Cloud Messaging)

```kotlin
class MyFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Send token to your backend
        registerTokenWithBackend(token, "android")
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        
        message.notification?.let { notification ->
            // Show notification
            showNotification(
                title = notification.title ?: "",
                body = notification.body ?: "",
                data = message.data
            )
        }
    }
}

private fun registerTokenWithBackend(token: String, platform: String) {
    // Call POST /push/register with the token
    apiService.registerPushToken(
        PushTokenRequest(token, platform)
    )
}
```

### iOS (Apple Push Notification service)

```swift
import UserNotifications
import FirebaseMessaging

class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                application.registerForRemoteNotifications()
            }
        }
        
        Messaging.messaging().delegate = self
        return true
    }
}

extension AppDelegate: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String) {
        // Send token to your backend
        registerTokenWithBackend(fcmToken, platform: "ios")
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge])
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        // Handle notification tap
        let data = response.notification.request.content.userInfo
        if let transactionId = data["transactionId"] as? String {
            // Navigate to transaction details
        }
        completionHandler()
    }
}

private func registerTokenWithBackend(_ token: String, platform: String) {
    // Call POST /push/register with the token
    APIService.shared.registerPushToken(token: token, platform: platform)
}
```

### React Native

```typescript
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';

async function registerForPushNotifications() {
  // Request permission
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    // Get FCM token
    const token = await messaging().getToken();
    
    // Register with backend
    await api.registerPushToken({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
  }
}

// Listen for token refresh
messaging().onTokenRefresh(async (token) => {
  await api.registerPushToken({
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
});

// Handle foreground notifications
messaging().onMessage(async (remoteMessage) => {
  await notifee.displayNotification({
    title: remoteMessage.notification?.title,
    body: remoteMessage.notification?.body,
    data: remoteMessage.data,
  });
});

// Handle notification tap
notifee.onForegroundEvent(({ type, detail }) => {
  if (type === EventType.PRESS && detail.notification?.data) {
    // Navigate based on notification data
    if (detail.notification.data.type === 'transaction_complete') {
      navigation.navigate('TransactionDetails', {
        id: detail.notification.data.transactionId,
      });
    }
  }
});
```

## Token Management

### Automatic Cleanup

Invalid or expired tokens are automatically removed from the database when:
- FCM returns `messaging/invalid-registration-token`
- FCM returns `messaging/registration-token-not-registered`
- APNs returns `UNREGISTERED` or `NOT_FOUND`

### Manual Cleanup

Old tokens (90+ days) can be cleaned up manually:

```typescript
import { pushTokenModel } from './services/push';

// Run periodically (e.g., daily cron job)
const deletedCount = await pushTokenModel.cleanupOldTokens();
console.log(`Cleaned up ${deletedCount} old tokens`);
```

## Error Handling

The implementation handles errors gracefully:

1. **Firebase Not Configured**: Push notifications are silently skipped if `FIREBASE_SERVICE_ACCOUNT_KEY` is not set
2. **Invalid Tokens**: Automatically removed from database
3. **Network Errors**: Logged but don't block transaction flow
4. **User Not Found**: Silently skipped (user may not have linked account yet)

## Testing

### Manual Testing

1. **Register a token**:
```bash
curl -X POST http://localhost:3000/push/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"token":"test-token-123","platform":"android"}'
```

2. **Send test notification**:
```bash
curl -X POST http://localhost:3000/push/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

3. **Verify token registration**:
```bash
curl http://localhost:3000/push/tokens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Integration Testing

```typescript
// tests/services/push.test.ts
describe('PushNotificationService', () => {
  it('should register token for user', async () => {
    const token = await pushNotificationService.registerToken(
      'user-id',
      'test-fcm-token',
      'android'
    );
    expect(token.platform).toBe('android');
  });

  it('should handle invalid tokens gracefully', async () => {
    const result = await pushNotificationService.sendToToken(
      'invalid-token',
      { title: 'Test', body: 'Test' }
    );
    expect(result).toBe(false);
  });
});
```

## Acceptance Criteria Met

✅ **Store user FCM tokens**: Implemented with `push_tokens` table and token management API
✅ **Send Push on Complete/Fail**: Integrated into transaction worker workflow
✅ **Handle invalid/expired tokens**: Automatic detection and removal from database
✅ **Push works seamlessly on Android/iOS**: Platform-agnostic FCM implementation
✅ **Fails gracefully**: Silent failures, doesn't block transaction flow

## Security Considerations

1. **Authentication Required**: All push endpoints require authenticated users
2. **Token Ownership**: Users can only manage their own tokens
3. **Token Validation**: Input validation on token format and platform
4. **Cascade Delete**: Tokens are deleted when user account is deleted

## Future Enhancements

1. **Topic Subscriptions**: Allow users to subscribe to specific notification types
2. **Notification Preferences**: User settings for notification frequency and types
3. **Notification History**: Store sent notifications for audit/retry
4. **Analytics**: Track delivery rates, open rates, and engagement
5. **Scheduled Notifications**: Reminders for pending transactions
6. **Rich Notifications**: Images, action buttons, and deep links
