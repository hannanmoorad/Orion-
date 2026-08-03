package com.orion.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(OrionAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}