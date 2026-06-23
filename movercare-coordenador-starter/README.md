# MoverCare - Painel do Coordenador

Painel web para o coordenador acompanhar a operação dos maqueiros e dos chamados em tempo real.

## O que já vem pronto

- Login com Supabase Auth
- Bloqueio para permitir apenas `COORDENADOR` ou `ADMIN`
- Dashboard de chamados ativos
- Lista de maqueiros e status operacional
- Filtro por status do chamado
- Reatribuição manual de chamado para outro maqueiro disponível
- Atualização manual com botão "Atualizar"

## Instalação

1. Instale as dependências:

```bash
npm install
```

2. Crie o arquivo `.env` baseado no `.env.example`:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_SUPABASE_ANON_KEY
```

3. Rode o SQL do arquivo:

```txt
supabase/sql/coordenador_funcoes.sql
```

4. Execute o painel:

```bash
npm run dev
```

## Regras importantes

O usuário precisa existir em `auth.users` e em `public.profiles` com:

```txt
role = COORDENADOR
active = true
```

ou:

```txt
role = ADMIN
active = true
```
