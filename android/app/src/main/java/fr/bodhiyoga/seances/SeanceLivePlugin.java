package fr.bodhiyoga.seances;

import android.Manifest;
import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

/**
 * Pont entre la séance en direct (src/seance-live.js) et la notification Live Update (SeanceService).
 * afficher(etat) : démarre ou met à jour la notification ; arreter() : la retire ; événement « action » : boutons
 * Pause / Suivante de la notification.
 */
@CapacitorPlugin(
        name = "SeanceLive",
        permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications") }
)
public class SeanceLivePlugin extends Plugin {

    @Override
    public void load() {
        SeanceService.ecouteur = (nom) -> {
            JSObject d = new JSObject();
            d.put("action", nom);
            notifyListeners("action", d, true);
        };
    }

    /** Demande l'autorisation d'afficher des notifications (Android 13 et plus), une seule fois. */
    @PluginMethod
    public void autoriser(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            repondre(call, true);
        } else {
            requestPermissionForAlias("notifications", call, "apresAutorisation");
        }
    }

    @PermissionCallback
    private void apresAutorisation(PluginCall call) {
        repondre(call, getPermissionState("notifications") == PermissionState.GRANTED);
    }

    private void repondre(PluginCall call, boolean ok) {
        JSObject r = new JSObject();
        r.put("autorise", ok);
        call.resolve(r);
    }

    @PluginMethod
    public void afficher(PluginCall call) {
        try {
            JSONObject etat = new JSONObject(call.getData().toString());
            SeanceService actif = SeanceService.actif;
            if (actif != null) {
                actif.mettreAJour(etat);
            } else {
                Intent i = new Intent(getContext(), SeanceService.class)
                        .setAction(SeanceService.ACTION_ETAT)
                        .putExtra("etat", etat.toString());
                ContextCompat.startForegroundService(getContext(), i);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Notification de séance impossible : " + e.getMessage());
        }
    }

    /** Ouvre une autre appli installée (Spotify, pour qu'il apparaisse dans les appareils de lecture). */
    @PluginMethod
    public void ouvrirAppli(PluginCall call) {
        String paquet = call.getString("paquet", "");
        Intent i = getContext().getPackageManager().getLaunchIntentForPackage(paquet);
        if (i == null) {
            call.reject("Appli absente");
            return;
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void arreter(PluginCall call) {
        getContext().stopService(new Intent(getContext(), SeanceService.class));
        call.resolve();
    }
}
