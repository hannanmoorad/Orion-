package com.orion.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.telephony.SmsManager;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "OrionAccess")
public class OrionAccessPlugin extends Plugin {

    public static final String ACCESSIBILITY_SERVICE =
            "com.orion.app/com.orion.app.OrionAccessibilityService";

    private static boolean hasPermission(Context ctx, String perm) {
        return ContextCompat.checkSelfPermission(ctx, perm) == PackageManager.PERMISSION_GRANTED;
    }

    private static void request(Context ctx, String[] perms, int code) {
        ActivityCompat.requestPermissions((android.app.Activity) ctx, perms, code);
    }

    private boolean isEnabled(String settingsKey) {
        String enabled = Settings.Secure.getString(getContext().getContentResolver(), settingsKey);
        String pkg = getContext().getPackageName();
        if (enabled == null) return false;
        String[] parts = enabled.split(":");
        for (String p : parts) {
            if (p != null && p.contains(pkg)) return true;
        }
        return false;
    }

    private boolean isAccessibilityOn() {
        return isEnabled(Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
    }

    private boolean isNotifListenerOn() {
        return isEnabled(Settings.Secure.ENABLED_NOTIFICATION_LISTENERS);
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject out = new JSObject();
        Context ctx = getContext();
        out.put("accessibility", isAccessibilityOn());
        out.put("notifListener", isNotifListenerOn());
        out.put("notifications", Build.VERSION.SDK_INT < 33 || hasPermission(ctx, Manifest.permission.POST_NOTIFICATIONS));
        out.put("mic", hasPermission(ctx, Manifest.permission.RECORD_AUDIO));
        out.put("call", hasPermission(ctx, Manifest.permission.CALL_PHONE));
        out.put("sms", hasPermission(ctx, Manifest.permission.SEND_SMS));
        out.put("contacts", hasPermission(ctx, Manifest.permission.READ_CONTACTS));
        out.put("location", hasPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION)
                || hasPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION));
        out.put("storage", Build.VERSION.SDK_INT >= 33
                ? hasPermission(ctx, Manifest.permission.READ_MEDIA_IMAGES)
                : hasPermission(ctx, Manifest.permission.READ_EXTERNAL_STORAGE));
        out.put("exactAlarm", true);
        call.resolve(out);
    }

    @PluginMethod
    public void request(PluginCall call) {
        String kind = call.getString("kind", "");
        Context ctx = getContext();
        switch (kind) {
            case "mic":
                request(ctx, new String[]{Manifest.permission.RECORD_AUDIO}, 110);
                break;
            case "notifications":
                if (Build.VERSION.SDK_INT >= 33) {
                    request(ctx, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 111);
                }
                break;
            case "call":
                request(ctx, new String[]{Manifest.permission.CALL_PHONE}, 112);
                break;
            case "sms":
                request(ctx, new String[]{Manifest.permission.SEND_SMS}, 113);
                break;
            case "contacts":
                request(ctx, new String[]{Manifest.permission.READ_CONTACTS}, 114);
                break;
            case "location":
                request(ctx, new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 115);
                break;
            case "storage":
                if (Build.VERSION.SDK_INT >= 33) {
                    request(ctx, new String[]{Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO, Manifest.permission.READ_MEDIA_AUDIO}, 116);
                } else {
                    request(ctx, new String[]{Manifest.permission.READ_EXTERNAL_STORAGE}, 116);
                }
                break;
            default:
                call.resolve();
                return;
        }
        call.resolve();
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void readScreen(PluginCall call) {
        if (!isAccessibilityOn()) {
            call.reject("accessibility_off");
            return;
        }
        OrionAccessibilityService svc = OrionAccessibilityService.instance;
        if (svc == null) {
            call.reject("not_connected");
            return;
        }
        call.resolve(new JSObject().put("text", svc.readScreen()));
    }

    @PluginMethod
    public void typeText(PluginCall call) {
        String text = call.getString("text", "");
        if (!isAccessibilityOn()) {
            call.reject("accessibility_off");
        }
        OrionAccessibilityService svc = OrionAccessibilityService.instance;
        if (svc == null) {
            call.reject("not_connected");
            return;
        }
        call.resolve(new JSObject().put("ok", svc.typeText(text)));
    }

    @PluginMethod
    public void tap(PluginCall call) {
        Integer x = call.getInt("x");
        Integer y = call.getInt("y");
        if (!isAccessibilityOn()) {
            call.reject("accessibility_off");
        }
        OrionAccessibilityService svc = OrionAccessibilityService.instance;
        if (svc == null) {
            call.reject("not_connected");
            return;
        }
        call.resolve(new JSObject().put("ok", svc.tap(x == null ? 0 : x, y == null ? 0 : y)));
    }

    @PluginMethod
    public void openPackage(PluginCall call) {
        String pkg = call.getString("pkg", "");
        OrionAccessibilityService svc = OrionAccessibilityService.instance;
        if (svc == null) {
            call.reject("not_connected");
            return;
        }
        call.resolve(new JSObject().put("result", svc.openPackage(pkg)));
    }

    @PluginMethod
    public void listPackages(PluginCall call) {
        List<android.content.pm.PackageInfo> apps = getContext().getPackageManager()
                .getInstalledPackages(0);
        JSArray out = new JSArray();
        for (android.content.pm.PackageInfo a : apps) {
            if (a.applicationInfo == null) continue;
            String label = String.valueOf(a.applicationInfo.loadLabel(getContext().getPackageManager()));
            out.put(new JSObject().put("name", label).put("pkg", a.packageName));
        }
        call.resolve(new JSObject().put("apps", out));
    }

    @PluginMethod
    public void call(PluginCall call) {
        String number = call.getString("number", "");
        Context ctx = getContext();
        if (!hasPermission(ctx, Manifest.permission.CALL_PHONE)) {
            Toast.makeText(ctx, "Call permission nahi hai — Settings mein do.", Toast.LENGTH_LONG).show();
            request(ctx, new String[]{Manifest.permission.CALL_PHONE}, 112);
            call.reject("no_call_permission");
            return;
        }
        try {
            Intent i = new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + number));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void sms(PluginCall call) {
        String number = call.getString("number", "");
        String text = call.getString("text", "");
        Context ctx = getContext();
        if (!hasPermission(ctx, Manifest.permission.SEND_SMS)) {
            Toast.makeText(ctx, "SMS permission allowAhhe — do.", Toast.LENGTH_LONG).show();
            request(ctx, new String[]{Manifest.permission.SEND_SMS}, 113);
            call.reject("no_sms_permission");
            return;
        }
        try {
            SmsManager.getDefault().sendTextMessage(number, null, text, null, null);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void contacts(PluginCall call) {
        Context ctx = getContext();
        if (!hasPermission(ctx, Manifest.permission.READ_CONTACTS)) {
            call.reject("no_contacts_permission");
            return;
        }
        JSArray out = new JSArray();
        Cursor c = ctx.getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[]{
                        ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                        ContactsContract.CommonDataKinds.Phone.NUMBER
                }, null, null, null);
        if (c != null) {
            while (c.moveToNext()) {
                String n = c.getString(0);
                String num = c.getString(1);
                if (n != null && num != null) {
                    out.put(new JSObject().put("name", n).put("number", num));
                }
            }
            c.close();
        }
        call.resolve(new JSObject().put("contacts", out));
    }

    @PluginMethod
    public void notifications(PluginCall call) {
        if (!isNotifListenerOn()) {
            call.reject("listener_off");
            return;
        }
        OrionNotificationListener svc = OrionNotificationListener.instance;
        if (svc == null) {
            call.reject("not_connected");
            return;
        }
        call.resolve(new JSObject().put("text", svc.listNotifications()));
    }

    @PluginMethod
    public void screenOn(PluginCall call) {
        // Accessibility is enough for most actions; full wake needs extra perms.
        call.resolve();
    }
}