package fr.bodhiyoga.seances;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SeanceLivePlugin.class); // séance en cours en notification Live Update
        super.onCreate(savedInstanceState);
    }
}
