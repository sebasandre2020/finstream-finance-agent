import React, { useMemo } from 'react';
import { PieChart as PieIcon, Store, ArrowUpRight } from 'lucide-react';
import { Transaction } from '../types';

interface CategoryBreakdownProps {
  transactions: Transaction[];
  currencySymbol: string;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onSelectMerchant: (merchant: string) => void;
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({
  transactions,
  currencySymbol,
  selectedCategory,
  onSelectCategory,
  onSelectMerchant,
}) => {
  const totalSpend = useMemo(() => {
    return transactions.reduce((acc, t) => acc + (Number(t.amount) > 0 ? Number(t.amount) : 0), 0);
  }, [transactions]);

  // Aggregate by category
  const categoriesData = useMemo(() => {
    const map = new Map<string, { category: string; amount: number; count: number }>();

    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (amt <= 0) return;
      const cat = tx.category || 'Otros';
      const existing = map.get(cat);
      if (existing) {
        existing.amount += amt;
        existing.count += 1;
      } else {
        map.set(cat, { category: cat, amount: amt, count: 1 });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        percentage: totalSpend > 0 ? (item.amount / totalSpend) * 100 : 0,
      }));
  }, [transactions, totalSpend]);

  // Aggregate top 4 merchants
  const topMerchants = useMemo(() => {
    const map = new Map<string, { merchant: string; amount: number; count: number }>();

    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (amt <= 0) return;
      const m = tx.normalized_merchant || 'Desconocido';
      const existing = map.get(m);
      if (existing) {
        existing.amount += amt;
        existing.count += 1;
      } else {
        map.set(m, { merchant: m, amount: amt, count: 1 });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [transactions]);

  return (
    <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm space-y-5">
      {/* Category Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <PieIcon className="h-4 w-4 text-zinc-500" />
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
              Distribución por Categorías
            </span>
          </div>
          {selectedCategory && (
            <button
              onClick={() => onSelectCategory('')}
              className="text-[10px] font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline"
            >
              Ver todas
            </button>
          )}
        </div>

        {categoriesData.length === 0 ? (
          <p className="text-xs text-zinc-400 py-3 text-center">Sin consumos categorizados</p>
        ) : (
          <div className="space-y-3">
            {categoriesData.map((item) => {
              const isSelected = selectedCategory === item.category;
              return (
                <button
                  key={item.category}
                  onClick={() => onSelectCategory(isSelected ? '' : item.category)}
                  className={`w-full text-left group transition p-1.5 -mx-1.5 rounded-xl ${
                    isSelected ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate pr-2 group-hover:text-zinc-950 dark:group-hover:text-white">
                      {item.category}
                    </span>
                    <span className="font-mono text-zinc-950 dark:text-zinc-50 font-bold tabular-nums shrink-0">
                      {currencySymbol} {item.amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Progress track */}
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden flex items-center">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isSelected 
                          ? 'bg-zinc-950 dark:bg-white' 
                          : 'bg-zinc-400 dark:bg-zinc-600 group-hover:bg-zinc-800 dark:group-hover:bg-zinc-300'
                      }`}
                      style={{ width: `${Math.max(4, item.percentage)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mt-1">
                    <span>{item.percentage.toFixed(1)}% del total</span>
                    <span>{item.count} {item.count === 1 ? 'operación' : 'operaciones'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Merchants Section */}
      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <Store className="h-4 w-4 text-zinc-500" />
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
              Comercios Más Frecuentes
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">Top 4</span>
        </div>

        {topMerchants.length === 0 ? (
          <p className="text-xs text-zinc-400 py-2 text-center">Sin comercios registrados</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {topMerchants.map((m) => (
              <button
                key={m.merchant}
                onClick={() => onSelectMerchant(m.merchant)}
                className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40 hover:border-zinc-300 dark:hover:border-zinc-700 text-left transition group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate pr-1 group-hover:text-zinc-950 dark:group-hover:text-white">
                    {m.merchant}
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 shrink-0 transition" />
                </div>
                <div className="text-[11px] font-mono font-bold text-zinc-950 dark:text-zinc-50 tabular-nums mt-1.5">
                  {currencySymbol} {m.amount.toFixed(2)}
                </div>
                <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                  {m.count} {m.count === 1 ? 'visita' : 'visitas'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
