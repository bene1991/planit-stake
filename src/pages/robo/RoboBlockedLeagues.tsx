import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldX, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface BlockedLeague {
    id: string;
    league_id: number;
    league_name: string;
    created_at: string;
}

export default function RoboBlockedLeagues() {
    const [blockedLeagues, setBlockedLeagues] = useState<BlockedLeague[]>([]);
    const [loading, setLoading] = useState(true);

    // For searching API to add new ones
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        fetchBlockedLeagues();
    }, []);

    const fetchBlockedLeagues = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('robot_blocked_leagues')
                .select('*')
                .order('league_name');

            if (error) throw error;
            setBlockedLeagues(data || []);
        } catch (error: any) {
            toast.error('Erro ao buscar ligas bloqueadas', { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const removeLeague = async (id: string, name: string) => {
        try {
            const { error } = await supabase
                .from('robot_blocked_leagues')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setBlockedLeagues(blockedLeagues.filter(l => l.id !== id));
            toast.success(`Liga ${name} desbloqueada.`);
        } catch (error: any) {
            toast.error('Erro ao remover', { description: error.message });
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm || searchTerm.length < 3) return;

        try {
            setIsSearching(true);
            const { data, error } = await supabase.functions.invoke('api-football', {
                body: { endpoint: `leagues?search=${searchTerm}` }
            });
            if (error) throw error;
            setSearchResults(data?.response || []);
        } catch (err: any) {
            toast.error('Erro na busca', { description: err.message });
        } finally {
            setIsSearching(false);
        }
    };

    const blockLeague = async (leagueObj: any) => {
        try {
            const isAlreadyBlocked = blockedLeagues.some(l => l.league_id === leagueObj.league.id);
            if (isAlreadyBlocked) {
                toast.warning('Esta liga já está bloqueada.');
                return;
            }

            const payload = {
                league_id: leagueObj.league.id,
                league_name: `${leagueObj.country.name} - ${leagueObj.league.name}`
            };

            const { data, error } = await supabase
                .from('robot_blocked_leagues')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;
            setBlockedLeagues([...blockedLeagues, data]);
            setSearchResults([]);
            setSearchTerm('');
            toast.success(`Liga ${payload.league_name} bloqueada para o robô.`);
        } catch (err: any) {
            toast.error('Erro ao bloquear', { description: err.message });
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: List of Blocked Leagues */}
            <div className="space-y-4">

                <div className="rounded-2xl border border-white/5 bg-[#141416]/50 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-white/5">
                            <TableRow className="border-white/10 hover:bg-transparent">
                                <TableHead className="text-zinc-500 font-black uppercase text-[10px] tracking-widest px-6 py-4">Nome da Liga</TableHead>
                                <TableHead className="text-right text-zinc-500 font-black uppercase text-[10px] tracking-widest px-6 py-4 w-[100px]">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow className="border-white/5">
                                    <TableCell colSpan={2} className="h-40 text-center">
                                        <div className="flex flex-col items-center gap-3 justify-center text-zinc-600">
                                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                            <span className="font-black text-[10px] uppercase tracking-widest">Acessando bloqueios...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : blockedLeagues.length === 0 ? (
                                <TableRow className="border-white/5">
                                    <TableCell colSpan={2} className="h-40 text-center text-zinc-600">
                                        <div className="font-black text-[10px] uppercase tracking-widest italic opacity-50">
                                            Nenhuma liga bloqueada globalmente
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                blockedLeagues.map(l => (
                                    <TableRow key={l.id} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
                                        <TableCell className="px-6 py-4 font-bold text-zinc-300 text-xs uppercase tracking-tight">{l.league_name}</TableCell>
                                        <TableCell className="text-right px-6 py-4">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" onClick={() => removeLeague(l.id, l.league_name)}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Right Column: Search to Block */}
            <div className="space-y-6 p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 h-fit relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-2xl group-hover:bg-primary/10 transition-all duration-700 pointer-events-none" />

                <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        ADICIONAR BLOQUEIO
                    </h4>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">Busque pelo nome do país ou liga oficial</p>
                </div>

                <form onSubmit={handleSearch} className="flex gap-2">
                    <Input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Ex: Brazil, Premier League..."
                        className="bg-black/40 border-white/5 h-11 text-xs font-bold uppercase tracking-tight focus-visible:ring-primary/20 transition-all placeholder:text-zinc-700 uppercase"
                    />
                    <Button type="submit" disabled={isSearching || searchTerm.length < 3} className="bg-white/5 hover:bg-white/10 text-white w-11 h-11 p-0 rounded-xl transition-all border border-white/5">
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    </Button>
                </form>

                {searchResults.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {searchResults.map((res, index) => (
                            <div key={index} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all group/item">
                                <div className="flex items-center gap-3">
                                    {res.country.flag && <img src={res.country.flag} alt={res.country.name} className="w-6 h-4 object-cover rounded-sm grayscale opacity-30 group-hover/item:grayscale-0 group-hover/item:opacity-100 transition-all" />}
                                    <div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-tight">{res.league.name}</p>
                                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{res.country.name}</p>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-3 text-[9px] font-black uppercase tracking-widest text-primary/50 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                    onClick={() => blockLeague(res)}
                                >
                                    BLOQUEAR
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
