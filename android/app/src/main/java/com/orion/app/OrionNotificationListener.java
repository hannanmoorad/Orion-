package com.orion.app;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public class OrionNotificationListener extends NotificationListenerService {

    public static OrionNotificationListener instance = null;

    @Override
    public void onListenerConnected() {
        instance = this;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {}

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {}

    public String listNotifications() {
        StringBuilder sb = new StringBuilder();
        try {
            StatusBarNotification[] active = getActiveNotifications();
            if (active != null) {
                for (StatusBarNotification sbn : active) {
                    Notification n = sbn.getNotification();
                    CharSequence title = n.extras.getCharSequence(Notification.EXTRA_TITLE);
                    CharSequence text = n.extras.getCharSequence(Notification.EXTRA_TEXT);
                    if (title != null || text != null) {
                        sb.append(sbn.getPackageName()).append(": ")
                                .append(title == null ? "" : title)
                                .append(" - ")
                                .append(text == null ? "" : text)
                                .append('\n');
                    }
                }
            }
        } catch (Exception ignored) {}
        return sb.toString().trim();
    }
}