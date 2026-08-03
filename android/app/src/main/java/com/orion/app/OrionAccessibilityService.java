package com.orion.app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.graphics.Path;
import android.os.Bundle;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

public class OrionAccessibilityService extends AccessibilityService {

    public static OrionAccessibilityService instance = null;

    @Override
    protected void onServiceConnected() {
        instance = this;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {}

    @Override
    public void onInterrupt() {}

    public String readScreen() {
        StringBuilder sb = new StringBuilder();
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root != null) {
            collectText(root, sb);
            root.recycle();
        }
        return sb.toString().trim();
    }

    private void collectText(AccessibilityNodeInfo node, StringBuilder sb) {
        if (node == null) return;
        CharSequence t = node.getText();
        if (t != null && t.length() > 0) {
            sb.append(t).append('\n');
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            collectText(node.getChild(i), sb);
        }
    }

    public boolean typeText(String text) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;
        AccessibilityNodeInfo focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
        if (focused == null) {
            focused = root.findFocus(AccessibilityNodeInfo.FOCUS_ACCESSIBILITY);
        }
        boolean ok = false;
        if (focused != null && focused.isEditable()) {
            Bundle args = new Bundle();
            args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
            ok = focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
        }
        if (focused != null) focused.recycle();
        root.recycle();
        return ok;
    }

    public boolean tap(int x, int y) {
        if (android.os.Build.VERSION.SDK_INT < 24) return false;
        Path path = new Path();
        path.moveTo(x, y);
        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(new GestureDescription.StrokeDescription(path, 0, 100));
        return dispatchGesture(builder.build(), null, null);
    }

    public String openPackage(String pkg) {
        try {
            Intent i = getPackageManager().getLaunchIntentForPackage(pkg);
            if (i == null) return "not_found";
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            return "opened";
        } catch (Exception e) {
            return "error:" + e.getMessage();
        }
    }
}