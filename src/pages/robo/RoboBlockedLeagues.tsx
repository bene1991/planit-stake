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
                <div>
                    <h3 className="text-xl font-medium text-white flex items-center">
                        <ShieldX className="w-5 h-5 mr-2 text-red-400" />
                        Ligas Ignoradas ({blockedLeagues.length})
                    </h3>
                    <p className="text-sm text-muted-foreground">O robô não analisará jogos destas competições.</p>
                </div>

                <div className="rounded-md border border-[#2a3142] overflow-hidden">
                    <Table>
                        <TableHeader className="bg-[#1e2333]/50">
                            <TableRow className="border-[#2a3142] hover:bg-transparent">
                                <TableHead className="text-[#a1a1aa] font-medium">Nome da Liga</TableHead>
                                <TableHead className="text-right text-[#a1a1aa] font-medium">Desbloquear</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="bg-[#1a1f2d]">
                            {loading ? (
                                <TableRow className="border-[#2a3142]">
                                    <TableCell colSpan={2} className="h-24 text-center">
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : blockedLeagues.length === 0 ? (
                                <TableRow className="border-[#2a3142]">
                                    <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                                        Nenhuma liga bloqueada. O robô analisará todas que tiverem dados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                blockedLeagues.map(l => (
                                    <TableRow key={l.id} className="border-[#2a3142] hover:bg-[#1e2333]/50">
                                        <TableCell className="font-medium text-zinc-300">{l.league_name}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => removeLeague(l.id, l.league_name)}>
                                                <Trash2 className="w-4 h-4" />
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
            <div className="space-y-4 p-4 rounded-md bg-[#1e2333]/30 border border-[#2a3142] h-fit">
                <h4 className="text-lg font-medium text-white">Bloquear Nova Liga</h4>
                <p className="text-sm text-zinc-400 mb-4">Busque pelo nome do país ou liga (mín. 3 letras) para adicioná-la à lista de exclusão.</p>

                <form onSubmit={handleSearch} className="flex gap-2">
                    <Input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Ex: Brazil, Premier League, Italy..."
                        className="bg-[#1a1f2d] border-[#2a3142]"
                    />
                    <Button type="submit" disabled={isSearching || searchTerm.length < 3} className="bg-[#2a3142] hover:bg-[#363f54] text-white">
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                </form>

                {searchResults.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {searchResults.map((res, index) => (
                            <div key={index} className="flex items-center justify-between p-3 rounded-md bg-[#1a1f2d] border border-[#2a3142] hover:border-[#363f54] transition-colors">
                                <div className="flex items-center gap-3">
                                    {res.country.flag && <img src={res.country.flag} alt={res.country.name} className="w-6 h-4 object-cover rounded-sm" />}
                                    <div>
                                        <p className="text-sm font-medium text-white">{res.league.name}</p>
                                        <p className="text-xs text-zinc-500">{res.country.name}</p>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" className="text-xs h-8 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => blockLeague(res)}>
                                    Bloquear
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
