import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { LogIn, UserPlus } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (isSignUp && !name.trim()) {
      toast.error('Preencha seu nome');
      return;
    }

    setLoading(true);
    
    if (isSignUp) {
      const { error } = await signUp(email, password);
      setLoading(false);

      if (error) {
        toast.error('Erro ao criar conta: ' + error.message);
      } else {
        toast.success('Conta criada com sucesso! Agora você já pode acessar e gerenciar seus planejamentos de qualquer lugar.');
      }
    } else {
      const { error } = await signIn(email, password);
      setLoading(false);

      if (error) {
        toast.error('Erro ao fazer login: ' + error.message);
      } else {
        toast.success('Login realizado com sucesso!');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-md p-8 shadow-card">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            {isSignUp ? (
              <UserPlus className="h-8 w-8 text-primary" />
            ) : (
              <LogIn className="h-8 w-8 text-primary" />
            )}
          </div>
          <h1 className="text-3xl font-bold">
            {isSignUp ? 'Criar Conta' : 'Bem-vindo'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isSignUp 
              ? 'Crie sua conta para começar o planejamento'
              : 'Faça login para acessar seu planejamento'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading 
              ? (isSignUp ? 'Criando conta...' : 'Entrando...') 
              : (isSignUp ? 'Criar conta' : 'Entrar')
            }
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setName('');
                setEmail('');
                setPassword('');
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading}
            >
              {isSignUp 
                ? 'Já tem conta? Entrar' 
                : 'Ainda não tem conta? Criar agora'
              }
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
