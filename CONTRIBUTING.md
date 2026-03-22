# Guia de Contribuição - ScribeFlow

Bem-vindo ao **ScribeFlow**, o santuário para criação e organização intelectual. Este projeto foi concebido sob os princípios da *Architecture of Reason (AoR)*, priorizando velocidade, profundidade e rigor técnico.

## Requisitos
- **Node.js**: v18 ou superior.
- **npm**: v9 ou superior.
- **Supabase Account**: Necessário para persistência em nuvem e autenticação.

## Setup do Supabase
Para rodar o projeto com suporte a nuvem, você deve:
1. Criar um projeto no [Supabase Dashboard](https://supabase.com).
2. Na aba **SQL Editor**, execute o script de schema (disponível em `.sql/schema.sql` ou similar no repositório).
3. Habilite o provedor de **Email/Password** em *Authentication > Providers*.
4. Ative as políticas de **Row Level Security (RLS)** para garantir que cada usuário acesse apenas seus próprios dados.

## Como Rodar Localmente
1. Clone o repositório.
2. Crie um arquivo `.env` baseado no `.env.example` e preencha as variáveis do Supabase.
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## Estrutura de Pastas
- `src/components`: Componentes UI modulares (Small, Focus, SRP).
- `src/hooks`: Lógica de estado e integração com Supabase.
- `src/lib`: Configurações de bibliotecas externas (Supabase Client, Utils).
- `src/utils`: Funções auxiliares compartilhadas.
- `src/types`: Definições de tipos TypeScript rigorosos.

## Princípios de Código
- **Tipagem Estrita**: Sem o uso de `any` injustificado.
- **Nomenclatura**: Variáveis e funções em **Inglês** descritivo.
- **Documentação**: Documentos e READMEs em **Português**.
- **Erros**: Tratamento obrigatório com `try-catch` e mensagens amigáveis em português para o usuário.

---
*"Quem controla as narrativas controla o mundo."*
