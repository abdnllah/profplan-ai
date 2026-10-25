import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { RecordConflict } from '../../types';
import { db } from '../../db';
import { GitCompare, Check, Copy } from 'lucide-react';

interface ConflictModalProps {
  conflict: RecordConflict | null;
  onResolved: () => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({ conflict, onResolved }) => {
  if (!conflict) return null;

  const { entityType, entityId, localRecord, remoteRecord, differingFields } = conflict;

  // Option 1: Keep local (Mine)
  const handleKeepLocal = async () => {
    const table = (db as any)[entityType];
    if (table) {
      const updated = {
        ...localRecord,
        revision: Math.max(localRecord.revision || 1, remoteRecord.revision || 1) + 1,
        updatedAt: new Date().toISOString(),
      };
      await table.put(updated);
    }
    onResolved();
  };

  // Option 2: Keep remote (Theirs)
  const handleKeepRemote = async () => {
    const table = (db as any)[entityType];
    if (table) {
      await table.put(remoteRecord);
    }
    onResolved();
  };

  // Option 3: Keep both (Copy)
  const handleKeepBoth = async () => {
    const table = (db as any)[entityType];
    if (table) {
      // Keep local with bumped revision
      await table.put({
        ...localRecord,
        revision: Math.max(localRecord.revision || 1, remoteRecord.revision || 1) + 1,
      });

      // Insert remote as copy with new UUID
      const copyId = entityId + '_copy_' + Date.now().toString(36);
      const copyRecord = {
        ...remoteRecord,
        id: copyId,
        name: remoteRecord.name ? `${remoteRecord.name} (Copie distante)` : undefined,
        title: remoteRecord.title ? `${remoteRecord.title} (Copie distante)` : undefined,
        revision: 1,
        updatedAt: new Date().toISOString(),
      };
      await table.put(copyRecord);
    }
    onResolved();
  };

  return (
    <Modal
      isOpen={!!conflict}
      onClose={handleKeepLocal}
      title="Résolution de Conflit de Synchronisation"
      subtitle={`Entité modifiée simultanément : ${entityType} (ID: ${entityId.slice(0, 10)}...)`}
      maxWidth="3xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Cet élément a été modifié sur un autre appareil et sur cet appareil depuis la dernière synchronisation.
          Comparez les différences champ par champ ci-dessous et choisissez comment résoudre le conflit.
        </p>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Local Record */}
          <div className="p-4 rounded-xl bg-card border border-primary/40 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Ma Version Locale (Cet Appareil)
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                Rév: {localRecord.revision}
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono max-h-60 overflow-y-auto">
              {differingFields.map((field) => (
                <div key={field} className="p-2 rounded bg-background border border-border">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">
                    {field}
                  </div>
                  <div className="text-foreground mt-0.5 break-words">
                    {typeof localRecord[field] === 'object'
                      ? JSON.stringify(localRecord[field])
                      : String(localRecord[field] ?? '—')}
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleKeepLocal}
              icon={<Check size={14} />}
              className="w-full text-xs"
            >
              Conserver ma version locale
            </Button>
          </div>

          {/* Remote Record */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-chart-3" />
                Version Distante (Google Drive)
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                Rév: {remoteRecord.revision}
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono max-h-60 overflow-y-auto">
              {differingFields.map((field) => (
                <div key={field} className="p-2 rounded bg-background border border-border">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">
                    {field}
                  </div>
                  <div className="text-foreground mt-0.5 break-words">
                    {typeof remoteRecord[field] === 'object'
                      ? JSON.stringify(remoteRecord[field])
                      : String(remoteRecord[field] ?? '—')}
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleKeepRemote}
              icon={<Check size={14} />}
              className="w-full text-xs"
            >
              Adopter la version distante
            </Button>
          </div>
        </div>

        {/* Option 3: Keep both as copies */}
        <div className="pt-2 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleKeepBoth}
            icon={<Copy size={14} />}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Conserver les deux versions (créer une copie)
          </Button>
        </div>
      </div>
    </Modal>
  );
};

