import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
    active: boolean;
}

export default function RoboVariations() {
    const [variations, setVariations] = useState<Variation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVariation, setEditingVariation] = useState<Variation | null>(null);
    const [formData, setFormData] = useState({
        name: '', description: '', min_minute: 15, max_minute: 30,
        require_score_zero: true, min_shots: 0, min_shots_on_target: 0,
        min_expected_goals: 0, min_corners: 0, min_shots_insidebox: 0, min_possession: 0, min_combined_shots: 0
    });

    useEffect(() => {
        fetchVariations();
    }, []);

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
            toast.success(`Variação ${!currentStatus ? 'ativada' : 'desativada'} com sucesso.`);
        } catch (error: any) {
            toast.error('Erro ao alterar status', { description: error?.message || 'Erro desconhecido' });
        }
    };

    const handleOpenCreate = () => {
        setEditingVariation(null);
        setFormData({
            name: '', description: '', min_minute: 15, max_minute: 30,
            require_score_zero: true, min_shots: 0, min_shots_on_target: 0,
            min_expected_goals: 0, min_corners: 0, min_shots_insidebox: 0, min_possession: 0, min_combined_shots: 0
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
            min_combined_shots: v.min_combined_shots
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingVariation) {
                const { data, error } = await supabase
                    .from('robot_variations')
                    .update(formData)
                    .eq('id', editingVariation.id)
                    .select()
                    .single();

                if (error) throw error;
                setVariations(variations.map(v => v.id === editingVariation.id ? data : v));
                toast.success('Variação atualizada com sucesso!');
            } else {
                const { data, error } = await supabase.from('robot_variations').insert([formData]).select().single();
                if (error) throw error;
                setVariations([...variations, data]);
                toast.success('Variação criada com sucesso!');
            }

            setIsModalOpen(false);
            setEditingVariation(null);
        } catch (error: any) {
            toast.error(editingVariation ? 'Erro ao atualizar' : 'Erro ao criar', { description: error?.message || 'Erro desconhecido' });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-medium text-white">Variações de Análise</h3>
                    <p className="text-sm text-muted-foreground">Regras e gatilhos que o robô utiliza para encontrar padrões de pressão.</p>
                </div>

                <Dialog open={isModalOpen} onOpenChange={(open) => {
                    setIsModalOpen(open);
                    if (!open) setEditingVariation(null);
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                            <Plus className="w-4 h-4 mr-2" /> Nova Variação
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#1a1f2d] border-[#2a3142] text-white sm:max-w-[600px] h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingVariation ? 'Editar Variação' : 'Criar Nova Variação'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label>Nome</Label>
                                    <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-[#1e2333] border-[#2a3142]" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Descrição</Label>
                                    <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="bg-[#1e2333] border-[#2a3142]" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Minuto Inicial</Label><Input type="number" required min={0} max={90} value={formData.min_minute} onChange={e => setFormData({ ...formData, min_minute: parseInt(e.target.value) })} className="bg-[#1e2333] border-[#2a3142]" /></div>
                                    <div className="space-y-2"><Label>Minuto Final</Label><Input type="number" required min={0} max={90} value={formData.max_minute} onChange={e => setFormData({ ...formData, max_minute: parseInt(e.target.value) })} className="bg-[#1e2333] border-[#2a3142]" /></div>
                                </div>
                                <div className="flex items-center justify-between p-3 border border-[#2a3142] rounded-md bg-[#1e2333]">
                                    <Label htmlFor="require-zero" className="cursor-pointer">Exigir Placar 0x0</Label>
                                    <Switch id="require-zero" checked={formData.require_score_zero} onCheckedChange={(c) => setFormData({ ...formData, require_score_zero: c })} />
                                </div>
                                <h4 className="text-sm font-medium text-emerald-400 mt-4 mb-2">Estatísticas Ofensivas da Equipe que Pressiona</h4>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="space-y-2"><Label>Posse Ofensiva (xG)</Label><Input type="number" step="0.1" required min={0} value={formData.min_expected_goals} onChange={e => setFormData({ ...formData, min_expected_goals: parseFloat(e.target.value) })} className="bg-[#1e2333] border-[#2a3142]" /></div>
                                    <div className="space-y-2"><Label>Escanteios</Label><Input type="number" required min={0} value={formData.min_corners} onChange={e => setFormData({ ...formData, min_corners: parseInt(e.target.value) })} className="bg-[#1e2333] border-[#2a3142]" /></div>
                                    <div className="space-y-2"><Label>Chutes Dentro da Área</Label><Input type="number" required min={0} value={formData.min_shots_insidebox} onChange={e => setFormData({ ...formData, min_shots_insidebox: parseInt(e.target.value) })} className="bg-[#1e2333] border-[#2a3142]" /></div>
                                    <div className="space-y-2"><Label>Chutes Totais</Label><Input type="number" required min={0} value={formData.min_shots} onChange={e => setFormData({ ...formData, min_shots: parseInt(e.target.value) })} className="bg-[#1e2333] border-[#2a3142]" /></div>
                                    <div className="space-y-2"><Label>Chutes no Alvo</Label><Input type="number" required min={0} value={formData.min_shots_on_target} onChange={e => setFormData({ ...formData, min_shots_on_target: parseInt(e.target.value) })} className="bg-[#1e2333] border-[#2a3142]" /></div>
                                    <div className="space-y-2"><Label>Posse %</Label><Input type="number" required min={0} max={100} value={formData.min_possession} onChange={e => setFormData({ ...formData, min_possession: parseInt(e.target.value) })} className="bg-[#1e2333] border-[#2a3142]" /></div>
                                </div>

                                <h4 className="text-sm font-medium text-blue-400 mt-4 mb-2">Estatísticas do Jogo (Soma das Duas Equipes)</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2"><Label>Mínimo de Chutes Somados no Jogo</Label><Input type="number" required min={0} value={formData.min_combined_shots} onChange={e => setFormData({ ...formData, min_combined_shots: parseInt(e.target.value) })} className="bg-[#1e2333] border-[#2a3142]" /></div>
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                                    {editingVariation ? 'Atualizar Variação' : 'Salvar Variação'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border border-[#2a3142] overflow-hidden">
                <Table>
                    <TableHeader className="bg-[#1e2333]/50">
                        <TableRow className="border-[#2a3142] hover:bg-transparent">
                            <TableHead className="text-[#a1a1aa] font-medium">Nome</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium">Minuto</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium text-center">Placar 0x0</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium text-center">Chutes</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium text-center whitespace-nowrap">xG (Ofensivo)</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium text-center whitespace-nowrap">Chutes na Área</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium text-center">Escanteios</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium text-center">Posse</TableHead>
                            <TableHead className="text-[#a1a1aa] font-medium text-center">Status</TableHead>
                            <TableHead className="text-right text-[#a1a1aa] font-medium">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="bg-[#1a1f2d]">
                        {loading ? (
                            <TableRow className="border-[#2a3142]">
                                <TableCell colSpan={11} className="h-24 text-center">
                                    <div className="flex items-center justify-center text-muted-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                        Carregando variações...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : variations.length === 0 ? (
                            <TableRow className="border-[#2a3142]">
                                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                                    Nenhuma variação encontrada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            variations.map((v) => (
                                <TableRow key={v.id} className="border-[#2a3142] hover:bg-[#1e2333]/50 transition-colors group">
                                    <TableCell className="font-medium text-white">
                                        {v.name}
                                        <div className="text-xs text-muted-foreground font-normal max-w-xs truncate" title={v.description}>
                                            {v.description}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-zinc-300">{v.min_minute}' - {v.max_minute}'</TableCell>
                                    <TableCell className="text-center">
                                        {v.require_score_zero ? (
                                            <Check className="w-4 h-4 mx-auto text-emerald-500" />
                                        ) : (
                                            <X className="w-4 h-4 mx-auto text-zinc-500" />
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center text-emerald-400 font-bold">{v.min_shots}</TableCell>
                                    <TableCell className="text-center text-zinc-300">{v.min_expected_goals}</TableCell>
                                    <TableCell className="text-center text-zinc-300">{v.min_shots_insidebox}</TableCell>
                                    <TableCell className="text-center text-zinc-300">{v.min_corners}</TableCell>
                                    <TableCell className="text-center text-zinc-300">{v.min_possession}%</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={v.active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}>
                                            {v.active ? 'Ativa' : 'Inativa'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right flex justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleOpenEdit(v)}
                                            className="text-zinc-400 hover:text-white hover:bg-white/10"
                                        >
                                            Editar
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleActive(v.id, v.active)}
                                            className={v.active ? "text-red-400 hover:text-red-300 hover:bg-red-500/10" : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"}
                                        >
                                            {v.active ? 'Desativar' : 'Ativar'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
