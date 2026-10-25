import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Download,
  Upload,
  HardDrive,
  Cloud,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Shield,
  FileCheck,
  Lock,
  Unlock,
  Layers,
  RotateCcw,
  KeyRound,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { db, requestPersistentStorage } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { TutorSettings } from '../types';
import { hashPassword } from '../components/auth/LoginView';
import {
  requestGoogleDriveAuth,
  performDriveSync,
  getDriveSnapshots,
  restoreDriveSnapshot,
  getDriveAccessToken,
} from '../utils/driveSync';

export const SettingsView: React.FC = () => {
  const currentSettings = useLiveQuery(() => db.settings.get('current'));
  const mutations = useLiveQuery(() => db.mutations.filter((m) => !m.synced).toArray()) || [];

  const [formData, setFormData] = useState<Partial<TutorSettings>>({});
  const [isPersisted, setIsPersisted] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>('');

  // Sync state
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [driveSnapshots, setDriveSnapshots] = useState<Array<{ id: string; name: string; modifiedTime?: string }>>([]);

  useEffect(() => {
    if (currentSettings) {
      setFormData(currentSettings);
    }
  }, [currentSettings]);

  useEffect(() => {
    requestPersistentStorage().then((persisted) => setIsPersisted(persisted));
    if (getDriveAccessToken()) {
      getDriveSnapshots().then((snaps) => setDriveSnapshots(snaps));
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    await db.settings.put({
      ...currentSettings,
      ...formData,
    } as TutorSettings);
    setSaveStatus('Paramètres enregistrés avec succès !');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const handleChangePassword = async () => {
    const currentPass = prompt('Entrez votre mot de passe actuel :');
    if (!currentPass) return;
    const currentHash = await hashPassword(currentPass);
    const savedHash = localStorage.getItem('profplan_master_hash');
    if (savedHash && currentHash !== savedHash) {
      alert('Mot de passe actuel incorrect.');
      return;
    }
    const newPass = prompt('Entrez votre nouveau mot de passe (au moins 4 caractères) :');
    if (!newPass || newPass.length < 4) {
      alert('Le nouveau mot de passe doit comporter au moins 4 caractères.');
      return;
    }
    const confirmPass = prompt('Confirmez le nouveau mot de passe :');
    if (newPass !== confirmPass) {
      alert('Les mots de passe ne correspondent pas.');
      return;
    }
    const newHash = await hashPassword(newPass);
    localStorage.setItem('profplan_master_hash', newHash);
    alert('Mot de passe principal mis à jour avec succès !');
  };

  // Google Drive Connect
  const handleConnectDrive = async () => {
    if (!formData.googleClientId) {
      alert('Veuillez saisir votre Google Client ID OAuth 2.0.');
      return;
    }
    try {
      setIsSyncing(true);
      setSyncStatusMsg('Connexion à Google Drive en cours...');
      await requestGoogleDriveAuth(formData.googleClientId);
      setSyncStatusMsg('Connecté avec succès ! Récupération des données...');
      const res = await performDriveSync((msg, pct) => {
        setSyncStatusMsg(msg);
        setSyncProgress(pct);
      });
      if (res.success) {
        setSyncStatusMsg(`Synchronisation réussie ! (${res.pushedCount || 0} envoyés, ${res.pulledCount || 0} reçus)`);
        const snaps = await getDriveSnapshots();
        setDriveSnapshots(snaps);
      } else {
        setSyncStatusMsg(`Erreur : ${res.errorMessage || res.reason}`);
      }
    } catch (err: any) {
      setSyncStatusMsg(`Erreur de connexion : ${err.message || String(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual Trigger Sync
  const handleSyncNow = async () => {
    if (!getDriveAccessToken()) {
      handleConnectDrive();
      return;
    }
    setIsSyncing(true);
    const res = await performDriveSync((msg, pct) => {
      setSyncStatusMsg(msg);
      setSyncProgress(pct);
    });
    if (res.success) {
      setSyncStatusMsg(`Synchronisation terminée (${res.pushedCount || 0} envoyés, ${res.pulledCount || 0} reçus).`);
      const snaps = await getDriveSnapshots();
      setDriveSnapshots(snaps);
    } else {
      setSyncStatusMsg(`Erreur : ${res.errorMessage || res.reason}`);
    }
    setIsSyncing(false);
  };

  // Restore Drive Snapshot
  const handleRestoreDriveSnap = async (fileId: string, snapName: string) => {
    if (!confirm(`Restaurer l'instantané "${snapName}" ? Les données locales actuelles seront remplacées.`)) {
      return;
    }
    try {
      await restoreDriveSnapshot(fileId);
      alert('Instantané restauré avec succès ! L’application va recharger.');
      window.location.reload();
    } catch (err: any) {
      alert('Erreur lors de la restauration : ' + err.message);
    }
  };

  // Full Offline Backup (Export all Dexie tables to JSON)
  const handleExportBackup = async () => {
    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: await db.settings.toArray(),
      students: await db.students.toArray(),
      trials: await db.trials.toArray(),
      lessons: await db.lessons.toArray(),
      lessonSnapshots: await db.lessonSnapshots.toArray(),
      vocabulary: await db.vocabulary.toArray(),
      bookings: await db.bookings.toArray(),
      exercises: await db.exercises.toArray(),
      templates: await db.templates.toArray(),
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ProfPlan_Sauvegarde_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import Backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Attention : restaurer un fichier de sauvegarde écrasera les données locales. Continuer ?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.students || !data.settings) {
          alert('Fichier de sauvegarde invalide ou corrompu.');
          return;
        }

        if (data.students) await db.students.bulkPut(data.students);
        if (data.trials) await db.trials.bulkPut(data.trials);
        if (data.lessons) await db.lessons.bulkPut(data.lessons);
        if (data.lessonSnapshots) await db.lessonSnapshots.bulkPut(data.lessonSnapshots);
        if (data.vocabulary) await db.vocabulary.bulkPut(data.vocabulary);
        if (data.bookings) await db.bookings.bulkPut(data.bookings);
        if (data.exercises) await db.exercises.bulkPut(data.exercises);
        if (data.templates) await db.templates.bulkPut(data.templates);
        if (data.settings) await db.settings.bulkPut(data.settings);

        alert('Restauration effectuée avec succès !');
        window.location.reload();
      } catch (err) {
        alert('Erreur lors de la lecture du fichier : ' + err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            Paramètres & Synchronisation
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Personnalisation du tuteur, budgets temps par défaut, verrouillage et synchronisation Google Drive.
          </p>
        </div>
      </div>

      {saveStatus && (
        <div className="p-3 rounded-xl bg-chart-3/15 border border-chart-3/30 text-chart-3 text-xs font-semibold flex items-center gap-2">
          <CheckCircle size={15} />
          <span>{saveStatus}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Tutor Identity & Branding */}
        <Card padding="md">
          <h3 className="text-sm font-bold text-foreground mb-3">
            Identité du Tuteur & Marque
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Nom complet affiché sur les bilans
              </label>
              <input
                type="text"
                value={formData.tutorName || ''}
                onChange={(e) => setFormData({ ...formData, tutorName: e.target.value })}
                placeholder="Ex: Prof. Alexandre"
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Fuseau horaire de travail (IANA)
              </label>
              <input
                type="text"
                value={formData.tutorTimezone || 'Europe/Paris'}
                onChange={(e) => setFormData({ ...formData, tutorTimezone: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Devise
              </label>
              <input
                type="text"
                value={formData.currencySymbol || '€'}
                onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Format papier d'impression PDF
              </label>
              <select
                value={formData.paperSize || 'a4'}
                onChange={(e) => setFormData({ ...formData, paperSize: e.target.value as any })}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="a4">A4 (Standard International / Europe)</option>
                <option value="letter">Letter (US / Canada)</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Starter Block Lengths (PRD Section 3.4 Table) */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers size={16} className="text-primary" />
              Budgets Temps des Blocs par Défaut (Minutes)
            </h3>
            <Badge variant="yellow" size="sm">
              Section 3.4 PRD
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Personnalisez la répartition des minutes pour les cours de 25 et 50 minutes.
          </p>

          <div className="space-y-4">
            {/* 25 min class */}
            <div className="p-3.5 rounded-xl bg-background border border-border">
              <div className="text-xs font-bold text-foreground mb-2 flex items-center justify-between">
                <span>Cours de 25 minutes :</span>
                <span className="font-mono text-primary font-bold">
                  {(formData.starterBlockMinutes?.m25?.warmup || 3) +
                    (formData.starterBlockMinutes?.m25?.vocabulary || 5) +
                    (formData.starterBlockMinutes?.m25?.reading || 7) +
                    (formData.starterBlockMinutes?.m25?.speaking || 5) +
                    (formData.starterBlockMinutes?.m25?.review || 5)}{' '}
                  / 25 min
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Échauffement</label>
                  <input
                    type="number"
                    value={formData.starterBlockMinutes?.m25?.warmup ?? 3}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        starterBlockMinutes: {
                          ...(formData.starterBlockMinutes as any),
                          m25: { ...(formData.starterBlockMinutes?.m25 as any), warmup: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full bg-card border border-border rounded-lg p-2 font-mono text-center text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Vocabulaire</label>
                  <input
                    type="number"
                    value={formData.starterBlockMinutes?.m25?.vocabulary ?? 5}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        starterBlockMinutes: {
                          ...(formData.starterBlockMinutes as any),
                          m25: { ...(formData.starterBlockMinutes?.m25 as any), vocabulary: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full bg-card border border-border rounded-lg p-2 font-mono text-center text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Lecture</label>
                  <input
                    type="number"
                    value={formData.starterBlockMinutes?.m25?.reading ?? 7}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        starterBlockMinutes: {
                          ...(formData.starterBlockMinutes as any),
                          m25: { ...(formData.starterBlockMinutes?.m25 as any), reading: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full bg-card border border-border rounded-lg p-2 font-mono text-center text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Speaking</label>
                  <input
                    type="number"
                    value={formData.starterBlockMinutes?.m25?.speaking ?? 5}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        starterBlockMinutes: {
                          ...(formData.starterBlockMinutes as any),
                          m25: { ...(formData.starterBlockMinutes?.m25 as any), speaking: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full bg-card border border-border rounded-lg p-2 font-mono text-center text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Bilan & Devoirs</label>
                  <input
                    type="number"
                    value={formData.starterBlockMinutes?.m25?.review ?? 5}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        starterBlockMinutes: {
                          ...(formData.starterBlockMinutes as any),
                          m25: { ...(formData.starterBlockMinutes?.m25 as any), review: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full bg-card border border-border rounded-lg p-2 font-mono text-center text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* 50 min class */}
            <div className="p-3.5 rounded-xl bg-background border border-border">
              <div className="text-xs font-bold text-foreground mb-2 flex items-center justify-between">
                <span>Cours de 50 minutes :</span>
                <span className="font-mono text-primary font-bold">
                  {(formData.starterBlockMinutes?.m50?.warmup || 5) +
                    (formData.starterBlockMinutes?.m50?.vocabulary || 10) +
                    (formData.starterBlockMinutes?.m50?.reading || 12) +
                    (formData.starterBlockMinutes?.m50?.grammar || 10) +
                    (formData.starterBlockMinutes?.m50?.speaking || 8) +
                    (formData.starterBlockMinutes?.m50?.review || 5)}{' '}
                  / 50 min
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Échauffement</label>
                  <input
                    type="number"
                    value={formData.starterBlockMinutes?.m50?.warmup ?? 5}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        starterBlockMinutes: {
                          ...(formData.starterBlockMinutes as any),
                          m50: { ...(formData.starterBlockMinutes?.m50 as any), warmup: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full bg-card border border-border rounded-lg p-2 font-mono text-center text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Vocabulaire</label>
                  <input
                    type="number"
                    value={formData.starterBlockMinutes?.m50?.vocabulary ?? 10}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        starterBlockMinutes: {
                          ...(formData.starterBlockMinutes as any),
                          m50: { ...(formData.starterBlockMinutes?.m50 as any), vocabulary: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full bg-card border border-border rounded-lg p-2 font-mono text-center text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Lecture</label>
                  <input
                    type="number"
                    value={formData.starterBlockMinutes?.m50?.reading ?? 12}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        starterBlockMinutes: {
                          ...(formData.starterBlockMinutes as any),
                          m50: { ...(formData.starterBlockMinutes?.m50 as any), reading: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full bg-card border border-border rounded-lg p-2 font-mono text-center text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Grammaire</label>
                  <input
                    type="number"
                    value={formData.starterBlockMinutes?.m50?.grammar ?? 10}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        starterBlockMinutes: {
                          ...(formData.starterBlockMinutes as any),
                          m50: { ...(formData.starterBlockMinutes?.m50 as any), grammar: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full bg-card border border-border rounded-lg p-2 font-mono text-center text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Speaking</label>
                  <input
                    type="number"
                    value={formData.starterBlockMinutes?.m50?.speaking ?? 8}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        starterBlockMinutes: {
                          ...(formData.starterBlockMinutes as any),
                          m50: { ...(formData.starterBlockMinutes?.m50 as any), speaking: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full bg-card border border-border rounded-lg p-2 font-mono text-center text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Bilan</label>
                  <input
                    type="number"
                    value={formData.starterBlockMinutes?.m50?.review ?? 5}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        starterBlockMinutes: {
                          ...(formData.starterBlockMinutes as any),
                          m50: { ...(formData.starterBlockMinutes?.m50 as any), review: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full bg-card border border-border rounded-lg p-2 font-mono text-center text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Default Rates (PRD Section 3.4) */}
        <Card padding="md">
          <h3 className="text-sm font-bold text-foreground mb-1">
            Tarifs par Défaut ({formData.currencySymbol || '€'})
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Montants indicatifs privés pour le calcul prévisionnel des gains. Jamais visibles par les élèves.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Cours Standard 25 min
              </label>
              <input
                type="number"
                value={formData.defaultRates?.standard25 || 22}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultRates: {
                      ...(formData.defaultRates as any),
                      standard25: Number(e.target.value),
                    },
                  })
                }
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Cours Standard 50 min
              </label>
              <input
                type="number"
                value={formData.defaultRates?.standard50 || 40}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultRates: {
                      ...(formData.defaultRates as any),
                      standard50: Number(e.target.value),
                    },
                  })
                }
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Cours d'essai 25 min
              </label>
              <input
                type="number"
                value={formData.defaultRates?.trial25 || 15}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultRates: {
                      ...(formData.defaultRates as any),
                      trial25: Number(e.target.value),
                    },
                  })
                }
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Cours d'essai 50 min
              </label>
              <input
                type="number"
                value={formData.defaultRates?.trial50 || 25}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultRates: {
                      ...(formData.defaultRates as any),
                      trial50: Number(e.target.value),
                    },
                  })
                }
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
              />
            </div>
          </div>
        </Card>

        {/* Privacy & Screen Lock (PRD Section 3.1) */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Shield size={16} className="text-primary" />
              Sécurité & Verrouillage d'Écran
            </h3>
            <Badge variant={formData.screenLockEnabled ? 'yellow' : 'neutral'} size="sm">
              {formData.screenLockEnabled ? 'Actif' : 'Désactivé'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Protégez les données personnelles et notes privées de vos élèves sur un ordinateur partagé.
          </p>

          <div className="p-4 rounded-xl bg-background border border-border space-y-3">
            <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={!!formData.screenLockEnabled}
                onChange={(e) => setFormData({ ...formData, screenLockEnabled: e.target.checked })}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>Activer le code de verrouillage de l'écran (PIN)</span>
            </label>

            {formData.screenLockEnabled && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Code PIN de déverrouillage (4 à 8 chiffres)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={formData.screenLockPin || ''}
                  onChange={(e) => setFormData({ ...formData, screenLockPin: e.target.value })}
                  placeholder="Ex: 1234"
                  className="w-48 bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>
            )}

            {/* Master Password Setting */}
            <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-foreground text-xs block">
                  Mot de passe d'accès principal de l'application
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Ce mot de passe verrouille l'entrée sur le site pour empêcher tout visiteur ou tiers d'accéder à vos dossiers.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleChangePassword}
                icon={<KeyRound size={14} />}
                className="shrink-0 text-xs"
              >
                Changer le mot de passe
              </Button>
            </div>
          </div>
        </Card>

        {/* Local Storage & Data Safety */}
        <Card padding="md">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
            <HardDrive size={16} className="text-primary" />
            Stockage Local Persistant & Sauvegarde JSON
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border">
              <span className="text-muted-foreground">Statut de persistance du navigateur :</span>
              {isPersisted ? (
                <Badge variant="success" size="sm" className="flex items-center gap-1">
                  <CheckCircle size={12} /> Persistant (Aucune éviction possible)
                </Badge>
              ) : (
                <Badge variant="neutral" size="sm">
                  Standard (Stockage IndexedDB)
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border">
              <span className="text-muted-foreground">Modifications locales en attente de sync :</span>
              <span className="font-mono font-bold text-primary">{mutations.length} élément(s)</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleExportBackup}
                icon={<Download size={14} />}
                className="w-full sm:w-auto"
              >
                Exporter une sauvegarde JSON
              </Button>

              <label className="w-full sm:w-auto">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  icon={<Upload size={14} />}
                  className="w-full sm:w-auto cursor-pointer"
                  onClick={(e) => {
                    (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
                  }}
                >
                  Restaurer un fichier JSON
                </Button>
              </label>
            </div>
          </div>
        </Card>

        {/* Google Drive Serverless Sync (PRD Section 3.1, 3.3, 3.8) */}
        <Card padding="md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Cloud size={16} className="text-primary" />
                Synchronisation Google Drive (Dossier Caché appDataFolder)
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                Modèle sans serveur : l’application communique directement avec l’API Google Drive sans intermédiaire.
                Vos données sont privées et stockées dans un dossier applicatif caché que vous seul pouvez consulter.
              </p>
            </div>

            <Badge variant={formData.googleDriveConnected ? 'yellow' : 'neutral'} size="sm">
              {formData.googleDriveConnected ? 'Connecté' : 'Serverless'}
            </Badge>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-background border border-border text-xs space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Google Client ID (OAuth 2.0 Web Client)
              </label>
              <input
                type="text"
                value={formData.googleClientId || ''}
                onChange={(e) => setFormData({ ...formData, googleClientId: e.target.value })}
                placeholder="Ex: 123456789-abcdef.apps.googleusercontent.com"
                className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div>
                <span className="font-semibold text-foreground">
                  Identifiant unique de cet appareil :
                </span>
                <div className="font-mono text-muted-foreground text-[11px] mt-0.5">{formData.deviceId}</div>
                {formData.lastSyncedAt && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Dernière sync : {new Date(formData.lastSyncedAt).toLocaleString('fr-FR')}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  type="button"
                  loading={isSyncing}
                  onClick={handleSyncNow}
                  icon={<RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />}
                >
                  Synchroniser maintenant
                </Button>
              </div>
            </div>

            {syncStatusMsg && (
              <div className="mt-2 p-2.5 rounded-lg bg-card border border-border text-[11px] text-primary font-medium flex items-center justify-between">
                <span>{syncStatusMsg}</span>
                {syncProgress > 0 && <span className="font-mono">{syncProgress}%</span>}
              </div>
            )}
          </div>

          {/* Drive Snapshots List */}
          {driveSnapshots.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                <RotateCcw size={13} className="text-primary" />
                Instantanés conservés sur Google Drive ({driveSnapshots.length}/10)
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {driveSnapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-2 rounded-lg bg-background border border-border text-xs flex items-center justify-between gap-2"
                  >
                    <span className="font-mono text-[11px] text-muted-foreground">{snap.name}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => handleRestoreDriveSnap(snap.id, snap.name)}
                      className="text-[11px] h-7 px-2"
                    >
                      Restaurer
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button variant="primary" size="lg" type="submit" icon={<Save size={16} />}>
            Enregistrer les paramètres
          </Button>
        </div>
      </form>
    </div>
  );
};
