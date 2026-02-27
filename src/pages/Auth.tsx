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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md p-10 shadow-apple-xl border-0 backdrop-blur-xl bg-card/80 animate-scale-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-apple-lg">
            {isSignUp ? (
              <UserPlus className="h-10 w-10 text-primary-foreground" />
            ) : (
              <LogIn className="h-10 w-10 text-primary-foreground" />
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isSignUp ? 'Criar Conta' : 'Bem-vindo'}
          </h1>
          <p className="mt-3 text-muted-foreground font-light">
            {isSignUp
              ? 'Crie sua conta para começar o planejamento'
              : 'Faça login para acessar seu planejamento'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Nome</Label>
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
            <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
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
            <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full mt-6 h-12 shadow-apple-md" disabled={loading}>
            {loading
              ? (isSignUp ? 'Criando conta...' : 'Entrando...')
              : (isSignUp ? 'Criar conta' : 'Entrar')
            }
          </Button>

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setName('');
                setEmail('');
                setPassword('');
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-all duration-200 font-medium"
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
