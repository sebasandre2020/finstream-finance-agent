import React from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  CreditCard, 
  ShieldCheck, 
  AlertTriangle, 
  Hash, 
  FileText, 
  Tag 
} from 'lucide-react';
import { Transaction } from '../types';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
}) => {
  if (!transaction) return null;

  const txDate = new Date(transaction.transaction_time);
  const processedDate = new Date(transaction.processed_at);
  const currencySymbol = transaction.currency === 'USD' ? '$' : 'S/';
  const amount = Number(transaction.amount) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                Detalle de Transacción
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                ID: {transaction.id.slice(0, 13)}...
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Main Merchant & Amount Banner */}
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Comercio / Beneficiario
              </span>
              <h2 className="text-xl font-bold text-zinc-950 dark:text-zinc-50 mt-0.5">
                {transaction.normalized_merchant || 'Comercio no resuelto'}
              </h2>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/60">
                  <Tag className="h-3 w-3 text-zinc-500" />
                  {transaction.category}
                  {transaction.sub_category && (
                    <span className="text-zinc-400 dark:text-zinc-500">› {transaction.sub_category}</span>
                  )}
                </span>

                {transaction.is_anomaly ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    <AlertTriangle className="h-3 w-3" />
                    Atípico
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="h-3 w-3" />
                    Conciliado
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Importe
              </span>
              <div className="text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50 tabular-nums">
                {amount > 0 ? '-' : '+'}{currencySymbol}{amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] font-mono text-zinc-400 uppercase">
                {transaction.currency}
              </span>
            </div>
          </div>

          {/* Anomaly Callout if present */}
          {transaction.is_anomaly && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
              <div className="font-semibold flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Alerta de Gasto Atípico</span>
              </div>
              <p className="text-zinc-700 dark:text-zinc-300">
                {transaction.anomaly_reason || 'Se detectó una desviación estadística inusual en comparación a tus patrones de consumo.'}
              </p>
            </div>
          )}

          {/* Meta Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-1 font-mono text-[11px]">
                <Calendar className="h-3 w-3" /> Fecha y Hora
              </span>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
                {txDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </div>
              <div className="text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">
                {txDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>

            <div>
              <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-1 font-mono text-[11px]">
                <CreditCard className="h-3 w-3" /> Entidad Financiera
              </span>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                {transaction.institution_name || 'BCP / Yape'}
              </div>
            </div>

            <div>
              <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-1 font-mono text-[11px]">
                <Hash className="h-3 w-3" /> ID Operación Externa
              </span>
              <div className="font-mono text-zinc-700 dark:text-zinc-300 truncate">
                {transaction.ext_transaction_id || 'N/A'}
              </div>
            </div>

            <div>
              <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mb-1 font-mono text-[11px]">
                <Clock className="h-3 w-3" /> Sincronizado vía Kafka
              </span>
              <div className="font-mono text-zinc-700 dark:text-zinc-300 text-[11px]">
                {processedDate.toLocaleTimeString('es-PE')}
              </div>
            </div>
          </div>

          {/* AI Categorization Confidence */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Confianza de Clasificación
              </span>
              <span className="font-mono font-bold text-zinc-950 dark:text-zinc-50">
                {(transaction.confidence_score * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-zinc-950 dark:bg-zinc-100 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, transaction.confidence_score * 100))}%` }}
              />
            </div>
          </div>

          {/* Raw Email Snippet */}
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5 mb-1.5">
              <FileText className="h-3.5 w-3.5" />
              Notificación Bancaria Extraída
            </span>
            <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words leading-relaxed max-h-40 overflow-y-auto">
              {transaction.raw_description}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
