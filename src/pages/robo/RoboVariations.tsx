import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Check, X, Loader2, Edit3, Trash2, Power, Send, Hash, MousePointer2, LayoutPanelLeft, Rocket, FlaskConical, Target, Clock, Activity, Zap, Info, LayoutGrid, List } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";

interface Variation {
    id: string;
    name: string;
    description: string;
    min_minute: number;
    max_minute: number;
    require_score_zero: boolean;
    min_shots: number;
    min_shots_on_target: number;
    min_expected_goals: number;
    min_corners: number;
    min_shots_insidebox: number;
    min_possession: number;
    min_combined_shots: number;
    pressure_1?: number;
    pressure_2?: number;
    max_goals?: number;
    active: boolean;
    send_telegram: boolean;
    send_to_sheet: boolean;
    telegram_group_id?: string;
    telegram_alert_minute?: number;
}

interface TelegramGroup {
    id: string;
    name: string;
}


export default function RoboVariations() {
    const [variations, setVariations] = useState<Variation[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVariation, setEditingVariation] = useState<Variation | null>(null);
    const [groups, setGroups] = useState<TelegramGroup[]>([]);
    const [formData, setFormData] = useState({
        name: '', description: '', min_minute: 15, max_minute: 30,
        require_score_zero: true, min_shots: 0, min_shots_on_target: 0,
        min_expected_goals: 0, min_corners: 0, min_shots_insidebox: 0, min_possession: 0, min_combined_shots: 0,
        pressure_1: 0, pressure_2: 0, max_goals: 99,
        send_telegram: true, send_to_sheet: true, telegram_group_id: '',
        telegram_alert_minute: null as number | null
    });


    useEffect(() => {
        fetchVariations();
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        const { data } = await supabase.from('telegram_groups').select('id, name').order('name');
        if (data) setGroups(data);
    };


    const fetchVariations = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('robot_variations')
                .select('*')
                .order('name');

            if (error) throw error;
            setVariations(data || []);
        } catch (error: any) {
            toast.error('Erro ao buscar variações', { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const toggleActive = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('robot_variations')
                .update({ active: !currentStatus })
                .eq('id', id);

            if (error) throw error;
            setVariations(variations.map(v => v.id === id ? { ...v, active: !currentStatus } : v));
            toast.success(`Estratégia ${!currentStatus ? 'ativada' : 'desativada'} com sucesso.`);
        } catch (error: any) {
            toast.error('Erro ao alterar status', { description: error?.message || 'Erro desconhecido' });
        }
    };

    const toggleTelegram = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('robot_variations')
                .update({ send_telegram: !currentStatus })
                .eq('id', id);

            if (error) throw error;
            setVariations(variations.map(v => v.id === id ? { ...v, send_telegram: !currentStatus } : v));
            toast.success(`Notificação Telegram ${!currentStatus ? 'ativada' : 'desativada'} para esta variação.`);
        } catch (error: any) {
            toast.error('Erro ao alterar notificação', { description: error?.message || 'Erro desconhecido' });
        }
    };

    const toggleSheet = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('robot_variations')
                .update({ send_to_sheet: !currentStatus })
                .eq('id', id);

            if (error) throw error;
            setVariations(variations.map(v => v.id === id ? { ...v, send_to_sheet: !currentStatus } : v));
            toast.success(`Sincronização Sheets ${!currentStatus ? 'ativada' : 'desativada'} para esta variação.`);
        } catch (error: any) {
            toast.error('Erro ao alterar status da planilha', { description: error?.message || 'Erro desconhecido' });
        }
    };

    const handleOpenCreate = () => {
        setEditingVariation(null);
        setFormData({
            name: '', description: '', min_minute: 15, max_minute: 30,
            require_score_zero: true, min_shots: 0, min_shots_on_target: 0,
            min_expected_goals: 0, min_corners: 0, min_shots_insidebox: 0, min_possession: 0, min_combined_shots: 0,
            pressure_1: 0, pressure_2: 0, max_goals: 99,
            send_telegram: true, send_to_sheet: true, telegram_group_id: '',
            telegram_alert_minute: null
        });

        setIsModalOpen(true);
    };

    const handleOpenEdit = (v: Variation) => {
        setEditingVariation(v);
        setFormData({
            name: v.name,
            description: v.description || '',
            min_minute: v.min_minute,
            max_minute: v.max_minute,
            require_score_zero: v.require_score_zero,
            min_shots: v.min_shots,
            min_shots_on_target: v.min_shots_on_target,
            min_expected_goals: v.min_expected_goals || 0,
            min_corners: v.min_corners || 0,
            min_shots_insidebox: v.min_shots_insidebox || 0,
            min_possession: v.min_possession,
            min_combined_shots: v.min_combined_shots,
            pressure_1: v.pressure_1 || 0,
            pressure_2: v.pressure_2 || 0,
            max_goals: v.max_goals ?? 99,
            send_telegram: v.send_telegram ?? true,
            send_to_sheet: v.send_to_sheet ?? true,
            telegram_group_id: v.telegram_group_id || '',
            telegram_alert_minute: v.telegram_alert_minute ?? null
        });

        setIsModalOpen(true);
    };

    const deleteVariation = async (id: string, name: string) => {
        if (!confirm(`Deseja realmente excluir a estratégia "${name}"? Esta ação removerá permanentemente TODO o histórico da aba Simulação e registros de performance.`)) return;
        
        try {
            setLoading(true);
            
            // Função para limpar tabelas pesadas em lotes indexados
            const cleanTableInBatches = async (tableName: string) => {
                let hasMore = true;
                let totalDeleted = 0;
                
                while (hasMore) {
                    // Busca rápida de IDs via Índice (Lote de 300 para evitar Bad Request)
                    const { data: batch, error: fetchError } = await supabase
                        .from(tableName)
                        .select('id')
                        .eq('variation_id', id)
                        .limit(300);

                    if (fetchError) throw fetchError;

                    if (!batch || batch.length === 0) {
                        hasMore = false;
                        break;
                    }

                    const ids = batch.map(b => b.id);
                    const { error: deleteError } = await supabase
                        .from(tableName)
                        .delete()
                        .in('id', ids);

                    if (deleteError) throw deleteError;
                    
                    totalDeleted += ids.length;
                    console.log(`Limpando ${tableName}... ${totalDeleted} registros removidos.`);
                    
                    if (ids.length < 300) hasMore = false;
                }
            };

            // 1. Limpar Alertas de Simulação (Aba Simulação)
            await cleanTableInBatches('live_alerts');

            // 2. Limpar Logs de Execução (Audit Logs)
            await cleanTableInBatches('robot_execution_logs');

            // 3. Deletar a variação em si
            const { error: variantError } = await supabase
                .from('robot_variations')
                .delete()
                .eq('id', id);

            if (variantError) throw variantError;

            setVariations(variations.filter(v => v.id !== id));
            toast.success('Estratégia e histórico removidos com sucesso!');
        } catch (error: any) {
            console.error('Erro detalhado:', error);
            toast.error('Erro ao excluir estratégia', { 
                description: error.message || "Muitos dados vinculados. Tente novamente." 
            });
        } finally {
            setLoading(false);
        }
    };

    const handleTestTelegram = async (v: Variation) => {
        // 1. Busca o Bot Token nas configurações globais
        const { data: settingsData } = await supabase
            .from('settings')
            .select('telegram_bot_token')
            .limit(1)
            .single();

        // 2. Busca o chat_id no grupo vinculado
        const { data: groupData } = await supabase
            .from('telegram_groups')
            .select('chat_id')
            .eq('id', v.telegram_group_id)
            .single();

        const botToken = settingsData?.telegram_bot_token;
        const targetChatId = groupData?.chat_id;

        if (!botToken) {
            toast.error("Configuração de Bot não encontrada na tabela 'settings'.");
            return;
        }

        if (!targetChatId) {
            toast.error("Este grupo não possui um Chat ID configurado ou não está vinculado à variação.");
            return;
        }

        const toastId = toast.loading(`Enviando teste para ${v.name}...`);

        try {
            const message = `🛠️ <b>TESTE DE CONEXÃO: ${v.name}</b>\n\nEste é um alerta de teste para confirmar que as configurações da variação estão funcionando corretamente.\n\n✅ <b>BOT:</b> OK\n✅ <b>CHAT ID:</b> ${targetChatId}`;
            
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: targetChatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            if (!response.ok) throw new Error('Falha ao enviar para o Telegram');

            toast.success("Mensagem de teste enviada!", { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error("Erro ao enviar teste. Verifique o Bot Token e Chat ID.", { id: toastId });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Sanitização para campos UUID (converte string vazia para null)
            const preparedData = {
                ...formData,
                telegram_group_id: formData.telegram_group_id === '' ? null : formData.telegram_group_id
            };

            if (editingVariation) {
                const { data, error } = await supabase
                    .from('robot_variations')
                    .update(preparedData)
                    .eq('id', editingVariation.id)
                    .select()
                    .single();

                if (error) throw error;
                setVariations(variations.map(v => v.id === editingVariation.id ? data : v));
                toast.success('Configurações salvas!');
            } else {
                const { data, error } = await supabase.from('robot_variations').insert([preparedData]).select().single();
                if (error) throw error;
                setVariations([...variations, data]);
                toast.success('Nova estratégia criada!');
            }

            setIsModalOpen(false);
            setEditingVariation(null);
        } catch (error: any) {
            toast.error(editingVariation ? 'Erro ao atualizar' : 'Erro ao criar', { description: error?.message || 'Erro desconhecido' });
        }
    };

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-6 rounded-2xl bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 shadow-2xl relative overflow-hidden"
            >
                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -ml-32 -mb-32" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                            <Rocket className="w-5 h-5 text-primary animate-pulse" />
                        </div>
                        <h3 className="text-2xl font-black text-white tracking-tight uppercase">
                            Arquitetura de Estratégias
                        </h3>
                    </div>
                    <p className="text-zinc-400 text-sm max-w-md">
                        Configure os algoritmos de detecção e gatilhos de precisão para o seu robô.
                    </p>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <div className="bg-zinc-950/50 p-1 rounded-xl border border-zinc-800 flex items-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "h-8 px-3 rounded-lg text-xs font-bold transition-all",
                                viewMode === 'grid' ? "bg-primary text-primary-foreground shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <LayoutGrid className="w-3.5 h-3.5 mr-2" /> Cards
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "h-8 px-3 rounded-lg text-xs font-bold transition-all",
                                viewMode === 'list' ? "bg-primary text-primary-foreground shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <List className="w-3.5 h-3.5 mr-2" /> Lista
                        </Button>
                    </div>

                    <Dialog open={isModalOpen} onOpenChange={(open) => {
                        setIsModalOpen(open);
                        if (!open) setEditingVariation(null);
                    }}>
                        <DialogTrigger asChild>
                            <Button
                                onClick={handleOpenCreate}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-6 rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 uppercase text-xs"
                            >
                                <Plus className="w-4 h-4 mr-2" /> Nova Variação
                            </Button>
                        </DialogTrigger>

                        <DialogContent className="bg-[#0f1117] border-zinc-800 text-white sm:max-w-[700px] h-[90vh] overflow-y-auto rounded-3xl backdrop-blur-3xl shadow-2xl">
                            <DialogHeader className="mb-6">
                                <DialogTitle className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                                    <FlaskConical className="w-6 h-6 text-primary" />
                                    {editingVariation ? 'Editar Algoritmo' : 'Projetar Novo Algoritmo'}
                                </DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-8 mt-2 pb-8">
                                <div className="grid gap-8">
                                    {/* Basic Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <Label className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">Identificação</Label>
                                            <Input
                                                placeholder="Ex: OVER 1.5 HT AGRESSIVO"
                                                required
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                className="bg-zinc-950/50 border-zinc-800 rounded-xl py-6 text-white focus:ring-primary/20"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <Label className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">Janela de Tempo (Minutos)</Label>
                                            <div className="flex items-center gap-3">
                                                <Input
                                                    type="number"
                                                    required
                                                    min={0}
                                                    max={90}
                                                    value={formData.min_minute}
                                                    onChange={e => setFormData({ ...formData, min_minute: parseInt(e.target.value) })}
                                                    className="bg-zinc-950/50 border-zinc-800 rounded-xl py-6 text-center"
                                                />
                                                <span className="text-zinc-700">até</span>
                                                <Input
                                                    type="number"
                                                    required
                                                    min={0}
                                                    max={90}
                                                    value={formData.max_minute}
                                                    onChange={e => setFormData({ ...formData, max_minute: parseInt(e.target.value) })}
                                                    className="bg-zinc-950/50 border-zinc-800 rounded-xl py-6 text-center"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">Resumo Operacional</Label>
                                        <Textarea
                                            placeholder="Descreva a lógica por trás desta estratégia..."
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="bg-zinc-950/50 border-zinc-800 rounded-xl min-h-[80px]"
                                        />
                                    </div>

                                    {/* Toggles */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950/30 border border-zinc-800 transition-colors hover:border-zinc-700">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-blue-500/10">
                                                    <Target className="w-4 h-4 text-blue-400" />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <Label htmlFor="require-zero" className="cursor-pointer text-sm font-bold">Apenas 0x0</Label>
                                                    <p className="text-[10px] text-zinc-500">Filtrar apenas jogos sem gols</p>
                                                </div>
                                            </div>
                                            <Switch
                                                id="require-zero"
                                                checked={formData.require_score_zero}
                                                onCheckedChange={(c) => setFormData({ ...formData, require_score_zero: c })}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-zinc-950/30 border border-zinc-800 transition-colors hover:border-zinc-700 md:col-span-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-blue-500/10">
                                                        <Send className="w-4 h-4 text-blue-400" />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <Label htmlFor="send-telegram-form" className="cursor-pointer text-sm font-bold">Grupo Telegram</Label>
                                                        <p className="text-[10px] text-zinc-500">Onde os alertas serão enviados</p>
                                                    </div>
                                                </div>
                                                <Switch
                                                    id="send-telegram-form"
                                                    checked={formData.send_telegram}
                                                    onCheckedChange={(c) => setFormData({ ...formData, send_telegram: c })}
                                                />
                                            </div>
                                            {formData.send_telegram && (
                                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] text-zinc-500 font-bold uppercase">Grupo de Destino</Label>
                                                        <select
                                                            value={formData.telegram_group_id}
                                                            onChange={(e) => setFormData({ ...formData, telegram_group_id: e.target.value })}
                                                            className="w-full bg-zinc-900 border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-primary/20 outline-none"
                                                        >
                                                            <option value="">Selecione um grupo...</option>
                                                            {groups.map(group => (
                                                                <option key={group.id} value={group.id}>{group.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-[10px] text-zinc-500 font-bold uppercase">Minuto p/ Alerta</Label>
                                                            <span title="Se definido, o Telegram só avisará neste minuto do jogo.">
                                                                <Info className="w-3 h-3 text-zinc-600 cursor-help" />
                                                            </span>
                                                        </div>
                                                        <Input
                                                            type="number"
                                                            placeholder="Imediato (vazio)"
                                                            value={formData.telegram_alert_minute ?? ''}
                                                            onChange={(e) => setFormData({ ...formData, telegram_alert_minute: e.target.value ? parseInt(e.target.value) : null })}
                                                            className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-primary/20"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950/30 border border-zinc-800 transition-colors hover:border-zinc-700">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-yellow-500/10">
                                                    <LayoutGrid className="w-4 h-4 text-yellow-400" />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <Label htmlFor="send-sheet-form" className="cursor-pointer text-sm font-bold">Planilha Sheets</Label>
                                                    <p className="text-[10px] text-zinc-500">Sincronizar com Google Sheets</p>
                                                </div>
                                            </div>
                                            <Switch
                                                id="send-sheet-form"
                                                checked={formData.send_to_sheet}
                                                onCheckedChange={(c) => setFormData({ ...formData, send_to_sheet: c })}
                                            />
                                        </div>


                                    </div>

                                    {/* Technical Specs */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-2">
                                            <Activity className="w-4 h-4 text-primary" />
                                            <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Métricas de Pressão (Gatilhos)</h4>
                                        </div>

                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                                            <StatField label="Min xG Pressionante" value={formData.min_expected_goals} icon={<Zap className="w-3 h-3" />}
                                                onChange={v => setFormData({ ...formData, min_expected_goals: parseFloat(v) })} />

                                            <StatField label="Escanteios" value={formData.min_corners} icon={<LayoutPanelLeft className="w-3 h-3" />}
                                                onChange={v => setFormData({ ...formData, min_corners: parseInt(v) })} />

                                            <StatField label="Chutes na Área" value={formData.min_shots_insidebox} icon={<Target className="w-3 h-3" />}
                                                onChange={v => setFormData({ ...formData, min_shots_insidebox: parseInt(v) })} />

                                            <StatField label="Chutes Totais" value={formData.min_shots} icon={<Activity className="w-3 h-3" />}
                                                onChange={v => setFormData({ ...formData, min_shots: parseInt(v) })} />

                                            <StatField label="No Alvo" value={formData.min_shots_on_target} icon={<MousePointer2 className="w-3 h-3" />}
                                                onChange={v => setFormData({ ...formData, min_shots_on_target: parseInt(v) })} />

                                             <StatField label="Posse Mínima %" value={formData.min_possession} icon={<Hash className="w-3 h-3" />}
                                                 onChange={v => setFormData({ ...formData, min_possession: parseInt(v) })} />

                                             <StatField label="Pressão Casa (%)" value={formData.pressure_1 ?? 0} icon={<Zap className="w-3 h-3 text-orange-500" />}
                                                 onChange={v => setFormData({ ...formData, pressure_1: parseInt(v) })} />

                                             <StatField label="Pressão Fora (%)" value={formData.pressure_2 ?? 0} icon={<Zap className="w-3 h-3 text-purple-500" />}
                                                 onChange={v => setFormData({ ...formData, pressure_2: parseInt(v) })} />

                                             <StatField label="Máx Gols Jogo" value={formData.max_goals ?? 99} icon={<Target className="w-3 h-3 text-red-500" />}
                                                 onChange={v => setFormData({ ...formData, max_goals: parseInt(v) })} />
                                         </div>
                                     </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Activity className="w-4 h-4 text-blue-400" />
                                            <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Dinâmica Global do Jogo</h4>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-zinc-950/30 border border-zinc-800">
                                            <StatField label="Volume de Chutes Somados (Equipe A + Equipe B)" value={formData.min_combined_shots} wide
                                                onChange={v => setFormData({ ...formData, min_combined_shots: parseInt(v) })} />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 justify-end pt-6">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setIsModalOpen(false)}
                                        className="rounded-full px-8 text-zinc-500 hover:text-white"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-10 rounded-full shadow-xl shadow-primary/10"
                                    >
                                        {editingVariation ? 'Salvar Configurações' : 'Iniciar Estratégia'}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </motion.div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-12 h-12 animate-spin text-primary opacity-50" />
                    <p className="mt-4 text-zinc-600 font-bold uppercase tracking-widest text-[10px]">Carregando Arquivos...</p>
                </div>
            ) : variations.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl">
                    <FlaskConical className="w-12 h-12 text-zinc-800 mb-4" />
                    <p className="text-zinc-600 font-bold uppercase tracking-[0.2em] text-xs">Nenhum protocolo ativo</p>
                    <Button onClick={handleOpenCreate} variant="link" className="text-primary mt-2">Clique para projetar seu primeiro alerta</Button>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                        {/* existing card mapping */}
                        {variations.map((v, idx) => (
                            <motion.div
                                key={v.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                className="relative group"
                            >
                                {/* ... card content ... */}
                                <Card className={cn(
                                    "relative bg-zinc-900/40 backdrop-blur-xl border-zinc-800/80 transition-all duration-500 overflow-hidden flex flex-col h-full",
                                    "hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5",
                                    !v.active && "opacity-40 grayscale pointer-events-none"
                                )}>
                                    {/* Glass reflection */}
                                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                                    <div className="p-5 flex justify-between items-start border-b border-zinc-800/50">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full animate-pulse",
                                                    v.active ? "bg-emerald-500" : "bg-zinc-700"
                                                )} />
                                                <h4 className="font-black text-white uppercase tracking-tighter text-xl leading-none">
                                                    {v.name}
                                                </h4>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono uppercase bg-zinc-950/50 px-2 py-0.5 rounded-full border border-zinc-800">
                                                    <Clock className="w-3 h-3 text-primary" />
                                                    {v.min_minute}-{v.max_minute}min
                                                </div>
                                                {v.require_score_zero && (
                                                    <div className="text-[10px] text-blue-400 font-black uppercase bg-blue-500/5 px-2 py-0.5 rounded-full border border-blue-500/20">
                                                        SCORE 0x0
                                                    </div>
                                                )}
                                                {v.telegram_alert_minute && (
                                                    <div className="text-[10px] text-emerald-400 font-black uppercase bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                        TELEGRAM @ {v.telegram_alert_minute}'
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center">
                                            <Switch
                                                checked={v.active}
                                                onCheckedChange={() => toggleActive(v.id, v.active)}
                                                className="scale-90 data-[state=checked]:bg-emerald-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-5 flex-1 space-y-6">
                                        {v.description && (
                                            <div className="text-[11px] text-zinc-500 leading-relaxed italic bg-zinc-950/20 p-3 rounded-xl border border-zinc-800/30">
                                                "{v.description}"
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <MetricItem label="Min xG" value={v.min_expected_goals} color="text-emerald-500" />
                                            <MetricItem label="Chutes" value={v.min_shots} color="text-white" />
                                            <MetricItem label="Cantos" value={v.min_corners} color="text-blue-400" />
                                            <MetricItem label="Posse" value={`${v.min_possession}%`} color="text-zinc-300" />
                                        </div>
                                    </div>

                                    <div className="p-4 bg-zinc-950/40 border-t border-zinc-800/50 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 group/tip" title="Notificações via Telegram">
                                                <Send className={cn("w-3.5 h-3.5 transition-colors", v.send_telegram ? "text-blue-400" : "text-zinc-800")} />
                                                <Switch
                                                    checked={v.send_telegram ?? true}
                                                    onCheckedChange={() => toggleTelegram(v.id, v.send_telegram ?? true)}
                                                    className="h-3.5 scale-75 data-[state=checked]:bg-blue-500"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 group/tip" title="Sincronização com Google Sheets">
                                                <LayoutGrid className={cn("w-3.5 h-3.5 transition-colors", v.send_to_sheet ? "text-yellow-400" : "text-zinc-800")} />
                                                <Switch
                                                    checked={v.send_to_sheet ?? true}
                                                    onCheckedChange={() => toggleSheet(v.id, v.send_to_sheet ?? true)}
                                                    className="h-3.5 scale-75 data-[state=checked]:bg-yellow-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleTestTelegram(v)}
                                                className="h-8 w-8 text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10"
                                                title="Testar Conexão Telegram"
                                            >
                                                <Send className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(v)} className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-white/10">
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => deleteVariation(v.id, v.name)} className="h-8 w-8 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>

                                {!v.active && (
                                    <div className="absolute inset-x-0 bottom-4 flex justify-center z-20">
                                        <Button
                                            variant="secondary"
                                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 font-black rounded-full"
                                            onClick={() => toggleActive(v.id, false)}
                                        >
                                            REATIVAR SISTEMA
                                        </Button>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40 backdrop-blur-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-950/50 border-b border-zinc-800">
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Estratégia</th>
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Janela</th>
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Gatilhos Principais</th>
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Telegram</th>
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sheets</th>
                                <th className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {variations.map((v, idx) => (
                                    <motion.tr
                                        key={v.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className={cn(
                                            "border-b border-zinc-800/50 hover:bg-white/5 transition-colors",
                                            !v.active && "opacity-40 grayscale"
                                        )}
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    v.active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-700"
                                                )} />
                                                <span className="font-bold text-white text-sm uppercase tracking-tight">{v.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge variant="outline" className="bg-zinc-950/50 border-zinc-800 text-zinc-400 font-mono text-[10px]">
                                                {v.min_minute}-{v.max_minute}'
                                            </Badge>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-2">
                                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black border-none">
                                                    xG {v.min_expected_goals}
                                                </Badge>
                                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 text-[9px] font-black border-none">
                                                    Chutes {v.min_shots}
                                                </Badge>
                                                <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 text-[9px] font-black border-none">
                                                    Posse {v.min_possession}%
                                                </Badge>
                                                {v.require_score_zero && (
                                                    <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[9px] font-black">
                                                        0x0
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center">
                                                <Switch
                                                    checked={v.send_telegram ?? true}
                                                    onCheckedChange={() => toggleTelegram(v.id, v.send_telegram ?? true)}
                                                    disabled={!v.active}
                                                    className="h-3.5 scale-75 data-[state=checked]:bg-blue-500"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center">
                                                <Switch
                                                    checked={v.send_to_sheet ?? true}
                                                    onCheckedChange={() => toggleSheet(v.id, v.send_to_sheet ?? true)}
                                                    disabled={!v.active}
                                                    className="h-3.5 scale-75 data-[state=checked]:bg-yellow-500"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <Switch
                                                    checked={v.active}
                                                    onCheckedChange={() => toggleActive(v.id, v.active)}
                                                    className="scale-75 data-[state=checked]:bg-emerald-500"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleOpenEdit(v)}
                                                    className="h-8 w-8 p-0 rounded-full text-zinc-500 hover:text-white"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => deleteVariation(v.id, v.name)}
                                                    className="h-8 w-8 p-0 rounded-full text-zinc-500 hover:text-red-500 hover:bg-red-500/10"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function MetricItem({ label, value, color }: { label: string, value: string | number, color: string }) {
    return (
        <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-800/30 flex flex-col items-center justify-center transition-all hover:bg-zinc-900/50">
            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">{label}</span>
            <span className={cn("text-base font-black font-mono tracking-tighter", color)}>{value}</span>
        </div>
    )
}

function StatField({ label, value, icon, onChange, wide = false }: { label: string, value: number, icon?: React.ReactNode, onChange: (v: string) => void, wide?: boolean }) {
    return (
        <div className={cn("space-y-2", wide && "w-full")}>
            <div className="flex items-center gap-2 text-zinc-500">
                {icon}
                <Label className="text-[9px] font-black uppercase tracking-widest">{label}</Label>
            </div>
            <Input
                type="number"
                step={label.includes('xG') ? "0.1" : "1"}
                required
                min={0}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="bg-zinc-950/50 border-zinc-800 rounded-xl py-5 focus:ring-primary/20 text-white font-mono"
            />
        </div>
    )
}
