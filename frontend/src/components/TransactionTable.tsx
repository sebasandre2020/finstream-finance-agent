import React from 'react';
import { 
  Calendar, 
  Clock, 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  ChevronRight,
  Inbox
} from 'lucide-react';
import { Transaction } from '../types';

interface TransactionTableProps {
  transactions: Transaction[];
  totalTransactionsCount: number;
  onSelectTransaction: (tx: Transaction) => void;
  currencySymbol: string;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  totalTransactionsCount,
  onSelectTransaction,
  currencySymbol,
}) => {
  return (
    <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              Libro Mayor de Transacciones Reales
              <span className="text-xs font-mono font-normal text-zinc-500 dark:text-zinc-400">
                ({transactions.length} de {totalTransactionsCount})
              </span>
            </h2>
          </div>
        </div>

        <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 self-start sm:self-center">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Actualización en tiempo real vía Gmail API</span>
        </div>
      </div>

      {/* Table container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/60 text-zinc-500 dark:text-zinc-400 font-mono text-[11px] uppercase tracking-wider">
              <th className="py-3 px-4 font-semibold">Fecha y Hora</th>
              <th className="py-3 px-4 font-semibold">Cuenta / Tarjeta</th>
              <th className="py-3 px-4 font-semibold">Comercio / Beneficiario</th>
              <th className="py-3 px-4 font-semibold">Categoría</th>
              <th className="py-3 px-4 font-semibold">Estado</th>
              <th className="py-3 px-4 font-semibold text-right">Monto</th>
              <th className="py-3 px-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="max-w-xs mx-auto space-y-2">
                    <div className="h-10 w-10 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                      <Inbox className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      Sin transacciones
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      No se encontraron transacciones que coincidan con los filtros seleccionados.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const txDate = new Date(tx.transaction_time);
                const amount = Number(tx.amount) || 0;
                const txCurr = tx.currency === 'USD' ? '$' : currencySymbol;

                return (
                  <tr
                    key={tx.id}
                    onClick={() => onSelectTransaction(tx)}
                    className={`cursor-pointer transition-colors duration-150 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 group ${
                      tx.is_anomaly ? 'bg-rose-50/40 dark:bg-rose-950/10' : ''
                    }`}
                  >
                    {/* FECHA Y HORA */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                        <span>
                          {txDate.toLocaleDateString('es-PE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-1 mt-0.5 pl-4.5">
                        <Clock className="h-2.5 w-2.5 text-zinc-400 dark:text-zinc-500" />
                        <span>
                          {txDate.toLocaleTimeString('es-PE', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>

                    {/* CUENTA / TARJETA */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/60 text-xs font-medium">
                        <CreditCard className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                        <span>{tx.institution_name || 'BCP / Yape'}</span>
                      </span>
                    </td>

                    {/* COMERCIO / BENEFICIARIO */}
                    <td className="py-3 px-4 max-w-xs sm:max-w-sm">
                      <div className="font-semibold text-zinc-950 dark:text-zinc-50 truncate">
                        {tx.normalized_merchant || 'Comercio no resuelto'}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate font-mono mt-0.5">
                        {tx.raw_description}
                      </div>
                    </td>

                    {/* CATEGORÍA */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
                        {tx.category}
                        {tx.sub_category && (
                          <span className="text-zinc-400 dark:text-zinc-500">› {tx.sub_category}</span>
                        )}
                      </span>
                    </td>

                    {/* ESTADO */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {tx.is_anomaly ? (
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          title={tx.anomaly_reason || 'Gasto atípico detectado'}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Atípico
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          Verificado
                        </span>
                      )}
                    </td>

                    {/* MONTO */}
                    <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap text-zinc-950 dark:text-zinc-50 text-sm tabular-nums">
                      {amount > 0 ? '-' : '+'}{txCurr}{amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* ARROW ICON */}
                    <td className="py-3 px-3 text-right">
                      <ChevronRight className="h-4 w-4 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-950 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
