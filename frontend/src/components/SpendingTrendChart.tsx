import React, { useMemo, useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { TrendingUp, BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { Transaction, ThemeMode } from '../types';

interface SpendingTrendChartProps {
  transactions: Transaction[];
  currencySymbol: string;
  theme: ThemeMode;
}

export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({
  transactions,
  currencySymbol,
  theme,
}) => {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  // Aggregate daily expenses chronologically
  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; amount: number; count: number; rawDate: Date }>();

    transactions.forEach((tx) => {
      const d = new Date(tx.transaction_time);
      if (isNaN(d.getTime())) return;
      const key = d.toISOString().split('T')[0]; // YYYY-MM-DD
      const val = Number(tx.amount) || 0;
      if (val <= 0) return;

      const existing = map.get(key);
      if (existing) {
        existing.amount += val;
        existing.count += 1;
      } else {
        map.set(key, {
          date: d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
          amount: val,
          count: 1,
          rawDate: d,
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())
      .map((item) => ({
        date: item.date,
        amount: Number(item.amount.toFixed(2)),
        count: item.count,
      }));
  }, [transactions]);

  const isDark = theme === 'dark';
  const strokeColor = isDark ? '#ffffff' : '#09090b';
  const gridColor = isDark ? '#27272a' : '#e4e4e7';
  const textColor = isDark ? '#a1a1aa' : '#71717a';

  return (
    <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
              Trayectoria de Gastos
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {dailyData.length} Días con Consumo
            </span>
          </div>
          <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50 mt-0.5">
            Volumen Diario de Gastos
          </h3>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setChartType('area')}
            className={`p-1.5 rounded-lg transition ${
              chartType === 'area'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            title="Vista de Área Suave"
          >
            <LineChartIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`p-1.5 rounded-lg transition ${
              chartType === 'bar'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            title="Vista de Barras Diarias"
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-56">
        {dailyData.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 text-xs">
            <TrendingUp className="h-6 w-6 mb-2 opacity-50" />
            <span>Sin datos de consumo en este rango temporal</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={strokeColor} stopOpacity={isDark ? 0.35 : 0.25} />
                    <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  stroke={textColor} 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: gridColor }}
                  fontFamily="Geist Mono, monospace"
                />
                <YAxis 
                  stroke={textColor} 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: gridColor }}
                  tickFormatter={(val) => `${currencySymbol}${val}`}
                  fontFamily="Geist Mono, monospace"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-xl text-xs font-mono">
                          <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mb-1">{data.date}</p>
                          <p className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                            {currencySymbol} {data.amount.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            {data.count} {data.count === 1 ? 'operación' : 'operaciones'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke={strokeColor} 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#spendGradient)" 
                />
              </AreaChart>
            ) : (
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis 
                  dataKey="date" 
                  stroke={textColor} 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: gridColor }}
                  fontFamily="Geist Mono, monospace"
                />
                <YAxis 
                  stroke={textColor} 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: gridColor }}
                  tickFormatter={(val) => `${currencySymbol}${val}`}
                  fontFamily="Geist Mono, monospace"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-xl text-xs font-mono">
                          <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mb-1">{data.date}</p>
                          <p className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                            {currencySymbol} {data.amount.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            {data.count} {data.count === 1 ? 'operación' : 'operaciones'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="amount" 
                  fill={strokeColor} 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
