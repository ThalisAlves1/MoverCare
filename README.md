# MoverCare Enfermagem Starter

Starter web/PWA para o painel da enfermagem do MoverCare.

## Como rodar

```bash
npm install
cp .env.example .env
npm run dev
```

Depois edite `.env` com:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_SUPABASE_ANON_KEY
```

Use sempre a `anon key` no frontend. Nunca use `service_role` no app.

## Fluxo coberto

- Login da enfermagem
- Validação de perfil ENFERMEIRA, COORDENADOR ou ADMIN
- Listagem de setores
- Criação de chamado por RPC `create_transport_call`
- Painel de chamados criados
- Atualização em tempo real da tabela `transport_calls`
