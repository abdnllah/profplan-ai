import React, { useState } from 'react';
import { Lock, Unlock, KeyRound } from 'lucide-react';
import { Button } from './Button';

interface ScreenLockModalProps {
  isLocked: boolean;
  expectedPin: string;
  onUnlock: () => void;
}

export const ScreenLockModal: React.FC<ScreenLockModalProps> = ({
  isLocked,
  expectedPin,
  onUnlock,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isLocked) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === expectedPin.trim()) {
      setPinInput('');
      setErrorMsg('');
      onUnlock();
    } else {
      setErrorMsg('Code PIN incorrect. Veuillez réessayer.');
      setPinInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0B]/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm p-6 rounded-2xl bg-card border border-border shadow-2xl text-center space-y-5 animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto text-primary">
          <Lock size={28} />
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-foreground tracking-tight">
            Écran Verrouillé
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Les dossiers élèves et plannings sont protégés. Saisissez votre code PIN pour déverrouiller.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="••••"
              className="w-full text-center text-2xl tracking-widest font-mono py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            {errorMsg && (
              <p className="text-xs text-destructive font-medium mt-1.5 animate-pulse">
                {errorMsg}
              </p>
            )}
          </div>

          <Button
            variant="primary"
            size="md"
            type="submit"
            icon={<Unlock size={16} />}
            className="w-full font-bold"
          >
            Déverrouiller
          </Button>
        </form>
      </div>
    </div>
  );
};

