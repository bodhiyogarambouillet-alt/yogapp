package fr.bodhiyoga.seances;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Séance en cours affichée en notification « Live Update » (Android 16) : posture, côté, compte à rebours tenu par
 * le système, progression de la séance découpée par phases, boutons Pause / Suivante.
 * Avant Android 16, la même notification, sans la mise en avant dans la barre d'état.
 *
 * L'appli envoie le plan de la séance (postures et durées) et où elle en est ; le service fait avancer la notification
 * seul d'une posture à l'autre, même quand l'appli est en arrière-plan. Service de premier plan : Android ne met pas
 * l'appli en veille pendant la séance (minuteur et voix guide continuent).
 */
public class SeanceService extends Service {
    static final String CANAL = "seance";
    static final int ID = 4210;
    static final String ACTION_ETAT = "fr.bodhiyoga.seances.ETAT";
    static final String ACTION_PAUSE = "pause";
    static final String ACTION_SUIVANTE = "suivante";

    /** Boutons de la notification, transmis à l'appli (SeanceLivePlugin). */
    interface Ecouteur { void action(String nom); }
    static Ecouteur ecouteur;
    /** Service en marche : l'appli lui transmet directement les mises à jour (pas de nouveau démarrage en arrière-plan). */
    static SeanceService actif;

    private static final int[] COULEURS = { 0xFFA9472A, 0xFFCFA47A };

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable rafraichir = this::afficher;
    private JSONObject etat;
    private long recuLe;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_PAUSE.equals(action) || ACTION_SUIVANTE.equals(action)) {
            if (ecouteur != null) ecouteur.action(action);
            return START_NOT_STICKY;
        }
        actif = this;
        creerCanal();
        try {
            etat = new JSONObject(intent.getStringExtra("etat"));
            recuLe = System.currentTimeMillis();
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        Notification n = construire();
        if (Build.VERSION.SDK_INT >= 34) {
            ServiceCompat.startForeground(this, ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(ID, n);
        }
        planifier();
        return START_NOT_STICKY;
    }

    /** Nouvel état envoyé par l'appli (changement de posture, pause, +30 s…). */
    void mettreAJour(JSONObject nouvel) {
        etat = nouvel;
        recuLe = System.currentTimeMillis();
        afficher();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopSelf(); // appli fermée depuis les applis récentes : la séance s'arrête
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(rafraichir);
        if (actif == this) actif = null;
        super.onDestroy();
    }

    private void creerCanal() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel c = new NotificationChannel(CANAL, "Séance en cours", NotificationManager.IMPORTANCE_DEFAULT);
        c.setDescription("Posture et minuteur de la séance en direct");
        c.setSound(null, null);
        c.enableVibration(false);
        c.setShowBadge(false);
        nm.createNotificationChannel(c);
    }

    private void afficher() {
        try {
            NotificationManagerCompat.from(this).notify(ID, construire());
        } catch (SecurityException e) { /* notifications refusées : le service tient quand même l'appli éveillée */ }
        planifier();
    }

    /** Prochaine mise à jour : fin de la posture en cours, ou passage au côté gauche. */
    private void planifier() {
        handler.removeCallbacks(rafraichir);
        Position p = position();
        if (p == null || !etat.optBoolean("enCours")) return;
        long delai = p.resteMs;
        if (p.cotes && p.resteMs > p.dureeMs / 2) delai = p.resteMs - p.dureeMs / 2;
        if (p.index < p.nb - 1 || p.resteMs > 0) handler.postDelayed(rafraichir, Math.max(200, delai + 150));
    }

    /** Où en est la séance maintenant (l'état reçu, avancé du temps écoulé depuis). */
    private static class Position {
        int index, nb;
        long resteMs, dureeMs, ecouleTotalMs, totalMs;
        boolean cotes;
        JSONObject etape;
    }

    private Position position() {
        try {
            JSONArray etapes = etat.getJSONArray("etapes");
            Position p = new Position();
            p.nb = etapes.length();
            if (p.nb == 0) return null;
            p.index = Math.min(etat.optInt("index"), p.nb - 1);
            p.resteMs = (long) (etat.optDouble("restant") * 1000);
            if (etat.optBoolean("enCours")) {
                p.resteMs -= System.currentTimeMillis() - recuLe;
                while (p.resteMs <= 0 && p.index < p.nb - 1) {
                    p.index++;
                    p.resteMs += etapes.getJSONObject(p.index).optLong("secondes") * 1000;
                }
                if (p.resteMs < 0) p.resteMs = 0;
            }
            p.etape = etapes.getJSONObject(p.index);
            p.dureeMs = p.etape.optLong("secondes") * 1000;
            p.cotes = p.etape.optBoolean("cotes");
            for (int i = 0; i < p.nb; i++) {
                long d = etapes.getJSONObject(i).optLong("secondes") * 1000;
                p.totalMs += d;
                if (i < p.index) p.ecouleTotalMs += d;
            }
            p.ecouleTotalMs += Math.max(0, p.dureeMs - p.resteMs);
            return p;
        } catch (Exception e) {
            return null;
        }
    }

    private PendingIntent bouton(String action, int code) {
        Intent i = new Intent(this, SeanceService.class).setAction(action);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification construire() {
        Position p = position();
        boolean enCours = etat != null && etat.optBoolean("enCours");
        Intent ouvrir = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent retour = PendingIntent.getActivity(this, 0, ouvrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CANAL)
                .setSmallIcon(R.drawable.ic_stat_seance)
                .setColor(0xFFA9472A)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(retour)
                .setRequestPromotedOngoing(true);
        if (p == null) return b.setContentTitle("Séance en cours").build();

        String nom = p.etape.optString("nom");
        String phase = p.etape.optString("phase");
        String cote = p.cotes ? (p.resteMs <= p.dureeMs / 2 ? "Côté gauche" : "Côté droit") : null;
        StringBuilder texte = new StringBuilder(phase).append(" · ").append(p.index + 1).append('/').append(p.nb);
        if (cote != null) texte.append(" · ").append(cote);
        if (!enCours) texte.append(" · En pause, ").append(mmss(p.resteMs)).append(" restantes");
        b.setContentTitle(nom).setContentText(texte.toString());

        if (enCours) {
            // Compte à rebours tenu par le système jusqu'à la fin de la posture (aussi dans la puce de la barre d'état)
            b.setUsesChronometer(true).setChronometerCountDown(true).setShowWhen(true)
                    .setWhen(System.currentTimeMillis() + p.resteMs);
        } else {
            b.setShowWhen(false).setShortCriticalText("Pause");
        }

        // Progression de la séance : un segment par phase, couleurs alternées
        try {
            JSONArray etapes = etat.getJSONArray("etapes");
            List<NotificationCompat.ProgressStyle.Segment> segments = new ArrayList<>();
            String phaseCourante = null;
            int longueur = 0;
            for (int i = 0; i < etapes.length(); i++) {
                JSONObject e = etapes.getJSONObject(i);
                if (phaseCourante != null && !phaseCourante.equals(e.optString("phase"))) {
                    segments.add(new NotificationCompat.ProgressStyle.Segment(Math.max(1, longueur)).setColor(COULEURS[segments.size() % 2]));
                    longueur = 0;
                }
                phaseCourante = e.optString("phase");
                longueur += e.optInt("secondes");
            }
            segments.add(new NotificationCompat.ProgressStyle.Segment(Math.max(1, longueur)).setColor(COULEURS[segments.size() % 2]));
            b.setStyle(new NotificationCompat.ProgressStyle()
                    .setProgressSegments(segments)
                    .setStyledByProgress(true)
                    .setProgress((int) (p.ecouleTotalMs / 1000)));
            // Avant Android 16 : barre de progression classique
            if (Build.VERSION.SDK_INT < 36) b.setProgress((int) (p.totalMs / 1000), (int) (p.ecouleTotalMs / 1000), false);
        } catch (Exception ignore) { /* sans barre de progression */ }

        b.addAction(0, enCours ? "Pause" : "Reprendre", bouton(ACTION_PAUSE, 1));
        if (p.index < p.nb - 1) b.addAction(0, "Suivante", bouton(ACTION_SUIVANTE, 2));
        return b.build();
    }

    private static String mmss(long ms) {
        long s = Math.max(0, (ms + 999) / 1000);
        return (s / 60) + ":" + String.format(java.util.Locale.ROOT, "%02d", s % 60);
    }
}
