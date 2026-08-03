package com.orion.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Calendar;
import java.util.Map;

@CapacitorPlugin(name = "OrionAlarm")
public class OrionAlarmPlugin extends Plugin {

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences("orion_alarms", Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        Integer id = call.getInt("id");
        Integer hour = call.getInt("hour");
        Integer minute = call.getInt("minute");
        if (id == null || hour == null || minute == null) {
            call.reject("id, hour, minute required");
            return;
        }
        String message = call.getString("message", "Hannan, uth ja bhai! Office jana hai.");
        boolean repeat = call.getBoolean("repeatDaily", false);

        Context ctx = getContext();
        AlarmManager alarmManager = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);

        Intent intent = new Intent(ctx, AlarmReceiver.class);
        intent.setAction("com.orion.app.ALARM_" + id);
        intent.putExtra("id", id);
        intent.putExtra("message", message);

        PendingIntent pi = PendingIntent.getBroadcast(ctx, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, hour);
        cal.set(Calendar.MINUTE, minute);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis()) {
            cal.add(Calendar.DAY_OF_YEAR, 1);
        }

        if (repeat) {
            alarmManager.setRepeating(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), 24L * 60 * 60 * 1000, pi);
        } else {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
        }

        JSObject record = new JSObject();
        record.put("id", id);
        record.put("hour", hour);
        record.put("minute", minute);
        record.put("message", message);
        record.put("repeatDaily", repeat);
        prefs().edit().putString(String.valueOf(id), record.toString()).apply();

        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("id required");
            return;
        }
        Context ctx = getContext();
        AlarmManager alarmManager = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(ctx, AlarmReceiver.class);
        intent.setAction("com.orion.app.ALARM_" + id);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        alarmManager.cancel(pi);
        prefs().edit().remove(String.valueOf(id)).apply();
        call.resolve();
    }

    @PluginMethod
    public void list(PluginCall call) {
        JSObject out = new JSObject();
        Map<String, ?> all = prefs().getAll();
        for (Map.Entry<String, ?> e : all.entrySet()) {
            out.put(e.getKey(), String.valueOf(e.getValue()));
        }
        call.resolve(out);
    }
}