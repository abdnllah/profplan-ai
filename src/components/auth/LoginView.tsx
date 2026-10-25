import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, KeyRound, Sparkles } from 'lucide-react';
import { Button } from '../common/Button';

interface LoginViewProps {
  onAuthenticated: () => void;
}

// SHA-256 hashing using native browser Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const LoginView: React.FC<LoginViewProps> = ({ onAuthenticated }) => {
  const savedHash = localStorage.getItem('profplan_master_hash');
  const isSetupMode = !savedHash;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!password.trim()) {
      setErrorMsg('Veuillez saisir un mot de passe.');
      return;
    }

    setLoading(true);

    try {
      if (isSetupMode) {
        if (password.length < 4) {
          setErrorMsg('Le mot de passe doit comporter au moins 4 caractères.');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMsg('Les mots de passe ne correspondent pas.');
          setLoading(false);
          return;
        }

        const newHash = await hashPassword(password);
        localStorage.setItem('profplan_master_hash', newHash);
        sessionStorage.setItem('profplan_session_auth', 'true');
        onAuthenticated();
      } else {
        const inputHash = await hashPassword(password);
        if (inputHash === savedHash) {
          sessionStorage.setItem('profplan_session_auth', 'true');
          onAuthenticated();
        } else {
          setErrorMsg('Mot de passe incorrect. Accès refusé.');
          setPassword('');
        }
      }
    } catch (err: any) {
      setErrorMsg('Erreur lors de la vérification : ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-foreground flex items-center justify-center p-4 selection:bg-primary selection:text-black">
      {/* Background ambient subtle glow */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md p-8 rounded-3xl bg-[#141416] border border-border/80 shadow-2xl relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Logo and Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto text-black shadow-lg shadow-primary/20 glow-primary-sm">
            <Lock size={30} className="text-black" />
          </div>

          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground">ProfPlan AI</h1>
              <span className="text-[10px] font-mono font-extrabold bg-primary/20 text-primary px-1.5 py-0.5 rounded border border-primary/30 uppercase">
                Sécurisé
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              {isSetupMode
                ? 'Créez votre mot de passe tuteur pour verrouiller l’accès à votre application.'
                : 'Espace privé réservé au professeur. Saisissez votre mot de passe pour continuer.'}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              {isSetupMode ? 'Nouveau mot de passe tuteur' : 'Mot de passe'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder={isSetupMode ? 'Au moins 4 caractères...' : '••••••••'}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground pr-10 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary tracking-wide"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="Afficher ou masquer le mot de passe"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {isSetupMode && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Confirmer le mot de passe
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Répétez le mot de passe..."
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary tracking-wide"
              />
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs font-medium animate-pulse">
              {errorMsg}
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            type="submit"
            loading={loading}
            icon={<ShieldCheck size={18} />}
            className="w-full font-bold h-12 shadow-md shadow-primary/20 text-sm mt-2"
          >
            {isSetupMode ? 'Créer le mot de passe & Accéder' : 'Se connecter'}
          </Button>
        </form>

        {/* Security explanation note */}
        <div className="pt-2 border-t border-border/60 text-center">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Vos données sont privées et protégées localement sur votre appareil.
          </p>
        </div>
      </div>
    </div>
  );
};
