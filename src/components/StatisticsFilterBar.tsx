import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Method } from '@/types';
import { cn } from '@/lib/utils';

export interface StatisticsFilters {
  period: 'today' | '7days' | '30days' | 'thisMonth' | 'lastMonth' | 'custom' | 'all';
  dateFrom: Date | null;
  dateTo: Date | null;
  selectedMethods: string[];
  selectedLeagues: string[];
  result: 'all' | 'Green' | 'Red';
}

interface StatisticsFilterBarProps {
  methods: Method[];
  leagues: string[];
  filters: StatisticsFilters;
  onFilterChange: (filters: StatisticsFilters) => void;
}

const periodOptions = [
  { value: 'all', label: 'Todo período' },
  { value: 'today', label: 'Hoje' },
  { value: '7days', label: 'Últimos 7 dias' },
  { value: '30days', label: 'Últimos 30 dias' },
  { value: 'thisMonth', label: 'Este mês' },
  { value: 'lastMonth', label: 'Mês passado' },
  { value: 'custom', label: 'Personalizado' },
];

export function StatisticsFilterBar({ methods, leagues, filters, onFilterChange }: StatisticsFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePeriodChange = (period: StatisticsFilters['period']) => {
    const now = new Date();
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;

    switch (period) {
      case 'today':
        dateFrom = now;
        dateTo = now;
        break;
      case '7days':
        dateFrom = subDays(now, 7);
        dateTo = now;
        break;
      case '30days':
        dateFrom = subDays(now, 30);
        dateTo = now;
        break;
      case 'thisMonth':
        dateFrom = startOfMonth(now);
        dateTo = endOfMonth(now);
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        dateFrom = startOfMonth(lastMonth);
        dateTo = endOfMonth(lastMonth);
        break;
      case 'custom':
        // Keep existing dates
        dateFrom = filters.dateFrom;
        dateTo = filters.dateTo;
        break;
      case 'all':
      default:
        dateFrom = null;
        dateTo = null;
    }

    onFilterChange({ ...filters, period, dateFrom, dateTo });
  };

  const handleMethodToggle = (methodId: string) => {
    const newMethods = filters.selectedMethods.includes(methodId)
      ? filters.selectedMethods.filter((id) => id !== methodId)
      : [...filters.selectedMethods, methodId];
    onFilterChange({ ...filters, selectedMethods: newMethods });
  };

  const handleLeagueToggle = (league: string) => {
    const newLeagues = filters.selectedLeagues.includes(league)
      ? filters.selectedLeagues.filter((l) => l !== league)
      : [...filters.selectedLeagues, league];
    onFilterChange({ ...filters, selectedLeagues: newLeagues });
  };

  const clearFilters = () => {
    onFilterChange({
      period: 'all',
      dateFrom: null,
      dateTo: null,
      selectedMethods: [],
      selectedLeagues: [],
      result: 'all',
    });
  };

  const hasActiveFilters =
    filters.period !== 'all' ||
    filters.selectedMethods.length > 0 ||
    filters.selectedLeagues.length > 0 ||
    filters.result !== 'all';

  const activeFilterCount =
    (filters.period !== 'all' ? 1 : 0) +
    filters.selectedMethods.length +
    filters.selectedLeagues.length +
    (filters.result !== 'all' ? 1 : 0);

  return (
    <Card className="p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              {activeFilterCount} ativo{activeFilterCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Período */}
        <Select value={filters.period} onValueChange={(v) => handlePeriodChange(v as StatisticsFilters['period'])}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Datas personalizadas */}
        {filters.period === 'custom' && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yy', { locale: ptBR }) : 'De'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom || undefined}
                  onSelect={(date) => onFilterChange({ ...filters, dateFrom: date || null })}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {filters.dateTo ? format(filters.dateTo, 'dd/MM/yy', { locale: ptBR }) : 'Até'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo || undefined}
                  onSelect={(date) => onFilterChange({ ...filters, dateTo: date || null })}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </>
        )}

        {/* Resultado */}
        <Select
          value={filters.result}
          onValueChange={(v) => onFilterChange({ ...filters, result: v as StatisticsFilters['result'] })}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Resultado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Green">Apenas Green</SelectItem>
            <SelectItem value="Red">Apenas Red</SelectItem>
          </SelectContent>
        </Select>

        {/* Expandir/Recolher */}
        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="ml-auto">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="ml-1 text-xs">{isExpanded ? 'Menos' : 'Mais'}</span>
        </Button>

        {/* Limpar */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Filtros expandidos */}
      {isExpanded && (
        <div className="mt-4 grid gap-4 border-t pt-4 md:grid-cols-2">
          {/* Métodos */}
          <div>
            <Label className="mb-2 block text-sm font-medium">Métodos</Label>
            <div className="flex flex-wrap gap-2">
              {methods.map((method) => (
                <div key={method.id} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`method-${method.id}`}
                    checked={filters.selectedMethods.includes(method.id)}
                    onCheckedChange={() => handleMethodToggle(method.id)}
                  />
                  <Label htmlFor={`method-${method.id}`} className="text-xs cursor-pointer">
                    {method.name}
                  </Label>
                </div>
              ))}
              {methods.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhum método cadastrado</span>
              )}
            </div>
          </div>

          {/* Ligas */}
          <div>
            <Label className="mb-2 block text-sm font-medium">Ligas</Label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {leagues.map((league) => (
                <div key={league} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`league-${league}`}
                    checked={filters.selectedLeagues.includes(league)}
                    onCheckedChange={() => handleLeagueToggle(league)}
                  />
                  <Label htmlFor={`league-${league}`} className="text-xs cursor-pointer">
                    {league}
                  </Label>
                </div>
              ))}
              {leagues.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhuma liga encontrada</span>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
