package com.orion.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;

import java.util.Locale;

public class AlarmReceiver extends BroadcastReceiver implements TextToSpeech.OnInitListener {

    private TextToSpeech tts;
    private String message = "Hannan, uth ja bhai!";
    private PowerManager.WakeLock wakeLock;
    private boolean done = false;

    @Override
    public void onReceive(Context context, Intent intent) {
        String msg = intent.getStringExtra("message");
        if (msg != null) message = msg;

        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Orion:Alarm");
        wakeLock.acquire(120000L);

        NotificationHelper.show(context, "Orion - utho bhai!", message);

        if (tts == null) {
            tts = new TextToSpeech(context.getApplicationContext(), this);
        } else {
            onInit(TextToSpeech.SUCCESS);
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            try {
                tts.setLanguage(Locale.ENGLISH);
                tts.setSpeechRate(1.0f);
                tts.setOnUtteranceProgressListener(new TextToSpeech.OnUtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {}

                    @Override
                    public void onDone(String utteranceId) {
                        finish();
                    }

                    @Override
                    public void onError(String utteranceId) {
                        finish();
                    }

                    @Override
                    @SuppressWarnings("deprecation")
                    public void onError(String utteranceId, int errorCode) {
                        finish();
                    }
                });
                tts.speak(message, TextToSpeech.QUEUE_FLUSH, null, "orion_alarm");
            } catch (Exception e) {
                finish();
            }
        } else {
            finish();
        }
    }

    private void finish() {
        if (done) return;
        done = true;
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {}
            tts = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }
}