import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Save, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from 'framer-motion';

interface TelegramGroup {
    id: string;
    name: string;
    chat_id: string;
}

export default function RoboTelegramGroups() {
    const [groups, setGroups] = useState<TelegramGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [newChatId, setNewChatId] = useState("");

    const [legacyChatId, setLegacyChatId] = useState<string | null>(null);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const { data, error } = await supabase
                .from('telegram_groups')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setGroups(data || []);

            // Verificar grupo legado
            const { data: settingsData } = await supabase
                .from('settings')
                .select('telegram_chat_id')
                .maybeSingle();
            
            if (settingsData?.telegram_chat_id) {
                setLegacyChatId(settingsData.telegram_chat_id);
            }
        } catch (error: any) {
            toast.error("Erro ao carregar grupos: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImportLegacy = async () => {
        if (!legacyChatId) return;
        
        try {
            const { data, error } = await supabase
                .from('telegram_groups')
                .insert([{ name: "Grupo Principal (Legado)", chat_id: legacyChatId }])
                .select();

            if (error) throw error;

            toast.success("Grupo legado importado com sucesso!");
            setGroups([data[0], ...groups]);
            setLegacyChatId(null);
        } catch (error: any) {
            toast.error("Erro ao importar grupo: " + error.message);
        }
    };

    const handleAddGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName || !newChatId) return;

        try {
            const { data, error } = await supabase
                .from('telegram_groups')
                .insert([{ name: newName, chat_id: newChatId }])
                .select();

            if (error) throw error;

            toast.success("Grupo adicionado com sucesso!");
            setGroups([data[0], ...groups]);
            setNewName("");
            setNewChatId("");
        } catch (error: any) {
            toast.error("Erro ao adicionar grupo: " + error.message);
        }
    };

    const handleDeleteGroup = async (id: string) => {
        try {
            const { error } = await supabase
                .from('telegram_groups')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success("Grupo removido com sucesso!");
            setGroups(groups.filter(g => g.id !== id));
        } catch (error: any) {
            toast.error("Erro ao remover grupo: " + error.message);
        }
    };

    return (
        <Card className="bg-zinc-900/20 p-8 rounded-[2rem] border border-zinc-800/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl pointer-events-none" />
            
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <Send className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-white tracking-tighter uppercase">Grupos do Telegram</h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Gestão de canais para notificações de alertas</p>
                </div>
            </div>

            <form onSubmit={handleAddGroup} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome do Grupo</label>
                    <Input 
                        placeholder="Ex: VIP Gols HT" 
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="bg-zinc-950/50 border-zinc-800 focus:border-emerald-500/50 transition-colors uppercase text-xs font-bold tracking-tighter"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">ID do Chat (Telegram)</label>
                    <Input 
                        placeholder="Ex: -100123456789" 
                        value={newChatId}
                        onChange={(e) => setNewChatId(e.target.value)}
                        className="bg-zinc-950/50 border-zinc-800 focus:border-emerald-500/50 transition-colors font-mono text-xs"
                    />
                </div>
                <div className="flex items-end">
                    <Button 
                        type="submit" 
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase tracking-tighter h-10 rounded-xl"
                        disabled={!newName || !newChatId}
                    >
                        <Plus className="w-4 h-4 mr-2 stroke-[3px]" />
                        Adicionar Grupo
                    </Button>
                </div>
            </form>
            {legacyChatId && !groups.some(g => g.chat_id === legacyChatId) && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                            <ShieldCheck className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-amber-500 uppercase tracking-tighter">Grupo Legado Detectado</p>
                            <p className="text-[10px] text-amber-500/70 font-bold uppercase tracking-widest leading-tight">
                                O grupo que você usava anteriormente ({legacyChatId}) não está na lista.
                            </p>
                        </div>
                    </div>
                    <Button 
                        onClick={handleImportLegacy}
                        variant="outline" 
                        size="sm"
                        className="bg-amber-500/20 border-amber-500/30 text-amber-500 hover:bg-amber-500 hover:text-black font-black uppercase tracking-tighter text-[10px] h-8"
                    >
                        Importar Agora
                    </Button>
                </motion.div>
            )}

            <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                    {groups.length === 0 ? (
                        <div className="py-10 text-center border-2 border-dashed border-zinc-800/50 rounded-3xl">
                            <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Nenhum grupo cadastrado</p>
                        </div>
                    ) : (
                        groups.map((group) => (
                            <motion.div
                                key={group.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="flex items-center justify-between p-4 bg-zinc-950/40 border border-zinc-800/50 rounded-2xl hover:border-zinc-700/50 transition-colors group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
                                        <ShieldCheck className="w-5 h-5 text-zinc-500 group-hover:text-emerald-500 transition-colors" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-tight">{group.name}</h4>
                                        <p className="text-[10px] font-mono text-zinc-500">{group.chat_id}</p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteGroup(group.id)}
                                    className="text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </Card>
    );
}
