import React from 'react';
import { RiskMatrixCell } from '../../types/fraudRisk';
import { Target, ActivitySquare } from 'lucide-react';

interface RiskMatrixProps {
    matrix: RiskMatrixCell[];
    loading: boolean;
}

export const RiskMatrix: React.FC<RiskMatrixProps> = ({ matrix, loading }) => {
    if (loading || !matrix || matrix.length === 0) {
        return (
            <div className="w-full h-80 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse flex items-center justify-center">
                <ActivitySquare className="w-8 h-8 text-gray-300 dark:text-gray-600 animate-spin" />
            </div>
        );
    }

    // Create a 5x5 grid layout mapping
    const grid = Array(5).fill(null).map(() => Array(5).fill(null));

    matrix.forEach(cell => {
        const xIndex = Math.min(4, Math.floor(cell.xRange[0] / 20));
        const yIndex = Math.min(4, Math.floor(cell.yRange[0] / 20));
        if (grid[yIndex] && grid[yIndex][xIndex] !== undefined) {
            grid[yIndex][xIndex] = cell;
        }
    });

    const getHeatmapColor = (score: number) => {
        if (score > 80) return 'bg-red-500 hover:bg-red-400';
        if (score > 60) return 'bg-orange-500 hover:bg-orange-400';
        if (score > 40) return 'bg-yellow-400 hover:bg-yellow-300';
        if (score > 20) return 'bg-emerald-400 hover:bg-emerald-300';
        return 'bg-blue-400 hover:bg-blue-300';
    };

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-rose-100 dark:bg-rose-500/20 p-2 rounded-lg">
                        <Target className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100">AI Risk Heatmap</h3>
                        <p className="text-xs text-gray-500">Transaction Value vs. Anomaly Velocity</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative">
                {/* Y Axis Label */}
                <div className="absolute -left-4 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Transaction Size
                </div>

                <div className="grid grid-rows-5 gap-1 w-full max-w-sm aspect-square">
                    {grid.map((row, y) => (
                        <div key={y} className="grid grid-cols-5 gap-1">
                            {row.map((cell, x) => {
                                const data = cell || { density: 0, averageRiskScore: 0 };
                                const opacity = Math.max(0.2, data.density / 50); // Scale opacity by density

                                return (
                                    <div
                                        key={`${x}-${y}`}
                                        className={`relative group rounded-md cursor-pointer transition-all ${getHeatmapColor(data.averageRiskScore)} border border-white/10`}
                                        style={{ opacity }}
                                    >
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-gray-900 text-white text-[10px] p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none z-50 text-center">
                                            <div className="font-bold text-gray-300 border-b border-gray-700 pb-1 mb-1">
                                                Vol: {x * 20}-{x * 20 + 20}, Val: {y * 20}-{y * 20 + 20}
                                            </div>
                                            <div className={data.averageRiskScore > 70 ? 'text-rose-400' : 'text-emerald-400'}>
                                                Avg Score: {data.averageRiskScore.toFixed(1)}
                                            </div>
                                            <div>Density: {data.density} events</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* X Axis Label */}
                <div className="mt-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Velocity / Frequency
                </div>

                {/* Legend */}
                <div className="flex gap-2 items-center mt-6 text-[10px] text-gray-500 font-medium">
                    <span>Safe</span>
                    <div className="w-3 h-3 rounded-sm bg-blue-400"></div>
                    <div className="w-3 h-3 rounded-sm bg-emerald-400"></div>
                    <div className="w-3 h-3 rounded-sm bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-sm bg-orange-500"></div>
                    <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                    <span>Critical</span>
                </div>
            </div>
        </div>
    );
};
