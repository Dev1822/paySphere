import { Zap, Droplet, Users, ShieldAlert, Cpu } from 'lucide-react';

interface LogFeed {
    id: string;
    type: string;
    desc: string;
    date: string;
    val: string;
}

interface Props {
    logs: LogFeed[];
}

export default function EmissionsTimeline({ logs }: Props) {
    return (
        <div className="bg-[#080b18] border border-gray-800/80 rounded-3xl p-6 shadow-2xl flex flex-col h-[550px] relative overflow-hidden">

            <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/5 blur-[80px] rounded-full opacity-50 pointer-events-none"></div>

            <div className="relative z-10 flex justify-between items-center mb-6 pb-4 border-b border-gray-800/50">
                <h3 className="text-lg font-black text-white flex items-center gap-3">
                    <Cpu className="text-indigo-400 h-5 w-5" />
                    Live Sensor Feeds
                </h3>
                <span className="text-[10px] text-rose-500 font-bold font-mono tracking-widest bg-rose-950/20 px-2 py-1 rounded border border-rose-900/50 animate-pulse">
                    {logs.length} ALERTS ACTIVE
                </span>
            </div>

            <div className="relative z-10 flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
                {logs.map((log, idx) => (
                    <div key={log.id} className="relative group pl-8">
                        <div className="absolute left-2.5 top-8 bottom-[-35px] w-px bg-gray-800/80 z-0"></div>

                        <div className={`absolute left-0 top-1 h-5 w-5 rounded-full flex items-center justify-center border-[3px] border-[#080b18] z-10 shadow-lg
                  ${log.type === 'Violation' ? 'bg-rose-500' :
                                log.type === 'Mitigation' ? 'bg-emerald-500' : 'bg-cyan-500'}
                `}></div>

                        <div className="bg-black/40 border border-gray-800/80 p-4 rounded-xl hover:bg-[#0c1122] transition-colors group-hover:border-gray-600">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="text-gray-200 font-black tracking-wide text-xs uppercase">{log.type}</h4>
                                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-1 font-mono">{log.id} | {log.date}</p>
                                </div>
                                <div className={`text-xs font-mono font-black ${log.type === 'Violation' ? 'text-rose-400' : log.type === 'Mitigation' ? 'text-emerald-400' : 'text-cyan-400'}`}>
                                    {log.val}
                                </div>
                            </div>

                            <p className="text-xs text-gray-400 leading-relaxed mt-2">{log.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
