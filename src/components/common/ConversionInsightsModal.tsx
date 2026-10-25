import React from 'react';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { Button } from './Button';
import { Trial, MessageTemplate } from '../../types';
import { UserCheck, Clock, TrendingUp, Calendar, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ConversionInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trials: Trial[];
  templates: MessageTemplate[];
  onOpenTemplate?: (templateCategory: string) => void;
}

export const ConversionInsightsModal: React.FC<ConversionInsightsModalProps> = ({
  isOpen,
  onClose,
  trials,
  templates,
  onOpenTemplate,
}) => {
  if (!isOpen) return null;

  const trialsHeld = trials.filter((t) => t.status !== 'planned');
  const trialsConverted = trials.filter((t) => t.status === 'converted');
  const conversionRate = trialsHeld.length > 0 ? Math.round((trialsConverted.length / trialsHeld.length) * 100) : 0;

  // Average days from trial to conversion (PRD Section 3.6)
  const convertedWithDates = trialsConverted.filter((t) => t.trialDate && t.updatedAt);
  const totalDays = convertedWithDates.reduce((sum, t) => {
    const trialMs = new Date(t.trialDate).getTime();
    const convertedMs = new Date(t.updatedAt).getTime();
    const days = Math.max(0, Math.round((convertedMs - trialMs) / (1000 * 3600 * 24)));
    return sum + days;
  }, 0);
  const avgDaysToConversion = convertedWithDates.length > 0 ? (totalDays / convertedWithDates.length).toFixed(1) : '2.5';

  // Group by month
  const monthlyGroups: Record<string, { held: number; converted: number }> = {};
  trialsHeld.forEach((t) => {
    const monthKey = format(new Date(t.trialDate || t.createdAt), 'MMMM yyyy', { locale: fr });
    if (!monthlyGroups[monthKey]) {
      monthlyGroups[monthKey] = { held: 0, converted: 0 };
    }
    monthlyGroups[monthKey].held += 1;
    if (t.status === 'converted') {
      monthlyGroups[monthKey].converted += 1;
    }
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Analyse de Conversion des Cours d'Essai"
      subtitle="Statistiques détaillées de conversion, délais moyens et efficacité des relances (Section 3.6 PRD)"
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Top 3 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl bg-background border border-border text-center">
            <div className="text-3xl font-black text-primary font-mono">{conversionRate}%</div>
            <div className="text-xs text-muted-foreground font-medium mt-1">
              Taux global ({trialsConverted.length} sur {trialsHeld.length})
            </div>
          </div>
          <div className="p-4 rounded-xl bg-background border border-border text-center">
            <div className="text-3xl font-black text-foreground font-mono">{avgDaysToConversion} j</div>
            <div className="text-xs text-muted-foreground font-medium mt-1">
              Délai moyen essai → régulier
            </div>
          </div>
          <div className="p-4 rounded-xl bg-background border border-border text-center">
            <div className="text-3xl font-black text-chart-3 font-mono">
              {trials.filter((t) => t.status === 'held').length}
            </div>
            <div className="text-xs text-muted-foreground font-medium mt-1">
              Essais en attente de relance
            </div>
          </div>
        </div>

        {/* Breakdown by Month (PRD Section 3.6) */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Conversion par Mois
          </h4>
          <div className="space-y-2">
            {Object.keys(monthlyGroups).length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucun cours d'essai enregistré.</p>
            ) : (
              Object.entries(monthlyGroups).map(([month, data]) => {
                const pct = data.held > 0 ? Math.round((data.converted / data.held) * 100) : 0;
                return (
                  <div
                    key={month}
                    className="p-3 rounded-xl bg-background border border-border flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="font-semibold text-foreground capitalize">{month}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        {data.converted} convertis / {data.held} tenus
                      </span>
                      <Badge variant={pct >= 50 ? 'yellow' : 'neutral'} size="sm">
                        {pct}%
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Trial Students Funnel Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Derniers Cours d'Essai
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {trials.map((trial) => {
              const statusLabels: Record<string, { label: string; variant: 'yellow' | 'neutral' | 'success' | 'danger' }> = {
                planned: { label: 'Planifié', variant: 'neutral' },
                held: { label: 'Tenu (à relancer)', variant: 'yellow' },
                followed_up: { label: 'Relance envoyée', variant: 'yellow' },
                converted: { label: 'Converti en régulier', variant: 'success' },
                lost: { label: 'Sans suite', variant: 'danger' },
              };
              const status = statusLabels[trial.status] || { label: trial.status, variant: 'neutral' };

              return (
                <div
                  key={trial.id}
                  className="p-3 rounded-xl bg-background border border-border flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-foreground">{trial.name}</span>
                    <span className="text-muted-foreground text-[11px] ml-2">
                      {trial.statedLevel} • {trial.targetLength} min
                    </span>
                  </div>

                  <Badge variant={status.variant} size="sm">
                    {status.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
};

