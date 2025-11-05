import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { Game, Method } from '@/types';

export interface FilterOptions {
  search: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  leagues: string[];
  methods: string[];
  result: 'all' | 'green' | 'red' | 'pending';
  status: 'all' | 'not-started' | 'live' | 'finished';
}

interface FilterBarProps {
  games: Game[];
  methods: Method[];
  onFilterChange: (filters: FilterOptions) => void;
}

const STORAGE_KEY = 'game-filters';

export function FilterBar({ games, methods, onFilterChange }: FilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {
      search: '',
      dateFrom: undefined,
      dateTo: undefined,
      leagues: [],
      methods: [],
      result: 'all',
      status: 'all',
    };
  });

  // Extrair ligas únicas dos jogos
  const uniqueLeagues = Array.from(new Set(games.map(g => g.league))).sort();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const handleClearFilters = () => {
    const clearedFilters: FilterOptions = {
      search: '',
      dateFrom: undefined,
      dateTo: undefined,
      leagues: [],
      methods: [],
      result: 'all',
      status: 'all',
    };
    setFilters(clearedFilters);
  };

  const hasActiveFilters = 
    filters.search || 
    filters.dateFrom || 
    filters.dateTo || 
    filters.leagues.length > 0 || 
    filters.methods.length > 0 || 
    filters.result !== 'all' || 
    filters.status !== 'all';

  return (
    <Card className="p-4 shadow-card">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Filtros</h3>
            {hasActiveFilters && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                Ativos
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                <X className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden"
            >
              {isOpen ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
        </div>

        <div className={cn("space-y-4", !isOpen && "hidden md:block")}>
          {/* Busca por texto */}
          <div>
            <Label>Buscar</Label>
            <Input
              placeholder="Time, liga ou observações..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Data inicial */}
            <div>
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateFrom ? format(filters.dateFrom, "PPP", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => setFilters({ ...filters, dateFrom: date })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Data final */}
            <div>
              <Label>Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateTo ? format(filters.dateTo, "PPP", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => setFilters({ ...filters, dateTo: date })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Resultado */}
            <div>
              <Label>Resultado</Label>
              <Select
                value={filters.result}
                onValueChange={(value: any) => setFilters({ ...filters, result: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="green">Apenas Green</SelectItem>
                  <SelectItem value="red">Apenas Red</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value: any) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="not-started">Não Iniciados</SelectItem>
                  <SelectItem value="live">Ao Vivo</SelectItem>
                  <SelectItem value="finished">Finalizados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ligas */}
          {uniqueLeagues.length > 0 && (
            <div>
              <Label className="mb-2 block">Ligas</Label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                {uniqueLeagues.map((league) => (
                  <label key={league} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={filters.leagues.includes(league)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilters({ ...filters, leagues: [...filters.leagues, league] });
                        } else {
                          setFilters({ ...filters, leagues: filters.leagues.filter(l => l !== league) });
                        }
                      }}
                    />
                    <span className="truncate">{league}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Métodos */}
          {methods.length > 0 && (
            <div>
              <Label className="mb-2 block">Métodos</Label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                {methods.map((method) => (
                  <label key={method.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={filters.methods.includes(method.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilters({ ...filters, methods: [...filters.methods, method.id] });
                        } else {
                          setFilters({ ...filters, methods: filters.methods.filter(m => m !== method.id) });
                        }
                      }}
                    />
                    <span className="truncate">{method.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
