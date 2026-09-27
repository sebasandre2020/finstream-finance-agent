import React from 'react';
import { 
  Search, 
  X, 
  Calendar, 
  RotateCcw, 
  Trash2 
} from 'lucide-react';

export const MONTH_OPTIONS = [
  { value: 'all', label: 'Todos los meses' },
  { value: '0', label: 'Enero' },
  { value: '1', label: 'Febrero' },
  { value: '2', label: 'Marzo' },
  { value: '3', label: 'Abril' },
  { value: '4', label: 'Mayo' },
  { value: '5', label: 'Junio' },
  { value: '6', label: 'Julio' },
  { value: '7', label: 'Agosto' },
  { value: '8', label: 'Septiembre' },
  { value: '9', label: 'Octubre' },
  { value: '10', label: 'Noviembre' },
  { value: '11', label: 'Diciembre' },
];

export const PERIOD_OPTIONS = [
  { key: 'all', label: 'Todo el tiempo' },
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '15d', label: '15 días' },
  { key: '30d', label: '30 días' },
  { key: 'this_month', label: 'Este mes' },
];

interface FilterToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onResetFilters: () => void;
  isFilterActive: boolean;
  onPurgeMockData: () => void;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedPeriod,
  onPeriodChange,
  selectedMonth,
  onMonthChange,
  onResetFilters,
  isFilterActive,
  onPurgeMockData,
}) => {
  return (
    <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-3.5 space-y-3 shadow-sm">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por comercio, concepto o categoría..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Right Utility: Purge Simulated Data */}
        <div className="flex items-center space-x-2 self-end sm:self-center">
          <button
            onClick={onPurgeMockData}
            title="Eliminar transacciones simuladas de prueba y dejar únicamente tus transacciones bancarias reales"
            className="text-xs text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 border border-zinc-200 dark:border-zinc-800 hover:border-rose-200 dark:hover:border-rose-900/50 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-xl transition flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Limpiar Simulados</span>
          </button>
        </div>
      </div>

      {/* Row 2: Period & Month Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80">
        {/* Segmented Period Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-0.5">
          {PERIOD_OPTIONS.map((opt) => {
            const isActive = selectedPeriod === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => onPeriodChange(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm font-semibold'
                    : 'bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-800'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Month Selector & Reset Filter */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1 text-xs">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="bg-transparent text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none cursor-pointer pr-1"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {isFilterActive && (
            <button
              onClick={onResetFilters}
              title="Restablecer todos los filtros"
              className="px-2.5 py-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition flex items-center gap-1.5 text-xs font-medium"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Restablecer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
