package com.orion.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.Map;

public class AlarmBootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;

        SharedPreferences prefs = context.getSharedPreferences("orion_alarms", Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Map<String, ?> all = prefs.getAll();

        for (Map.Entry<String, ?> e : all.entrySet()) {
            try {
                int id = Integer.parseInt(e.getKey());
                JSONObject o = new JSONObject(String.valueOf(e.getValue()));
                int hour = o.getInt("hour");
                int minute = o.getInt("minute");
                String message = o.optString("message", "Hannan, uth ja bhai!");
                boolean repeat = o.optBoolean("repeatDaily", false);

                Intent alarmIntent = new Intent(context, AlarmReceiver.class);
                alarmIntent.setAction("com.orion.app.ALARM_" + id);
                alarmIntent.putExtra("id", id);
                alarmIntent.putExtra("message", message);

                PendingIntent pi = PendingIntent.getBroadcast(context, id, alarmIntent,
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
                    am.setRepeating(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), 24L * 60 * 60 * 1000, pi);
                } else {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
                }
            } catch (Exception ignored) {}
        }
    }
}