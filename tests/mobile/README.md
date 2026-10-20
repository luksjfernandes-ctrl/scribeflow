# Escrita no celular — issue #32

O teste usa o app real, com Supabase fictício e capítulo inventado. Não precisa
de `.env`, login ou contas reais; o cliente de produção não é importado.

Com as dependências do app disponíveis, abra o servidor local:

```sh
node_modules/.bin/vite --config tests/mobile/vite.config.ts
```

Instale o Playwright gratuito num diretório separado (exemplo em disco externo),
sem alterar as dependências compartilhadas do app:

```sh
npm install --prefix /Volumes/SANDISK/scribeflow-celular-validacao --no-audit --no-fund playwright
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/codex-scribeflow-1110-browsers node /Volumes/SANDISK/scribeflow-celular-validacao/node_modules/playwright/cli.js install webkit
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/codex-scribeflow-1110-browsers PLAYWRIGHT_MODULE=file:///Volumes/SANDISK/scribeflow-celular-validacao/node_modules/playwright/index.mjs MOBILE_TEST_OUTPUT=/private/tmp/scribeflow-mobile-results node tests/mobile/check.mjs
```

Se `playwright` já estiver no `node_modules`, `PLAYWRIGHT_MODULE` é dispensável.
O script bloqueia rede externa nos perfis de celular e produz PNGs e JSON.
Não execute esse teste apontando para produção ou preview.

Cobertura: toque/foco, escrita, fila de salvamento e recarga; fonte mínima e
seleção no editor/Foco; uma coluna em retrato, paisagem e 320px; inspetor;
retomada da geometria e formatação acima da área útil do teclado; desktop.

**Limite:** WebKit com perfil de iPhone não é Safari num aparelho. A abertura do
teclado e a pinça são eventos de `visualViewport` **injetados**, identificados
nos nomes dos prints e no JSON. Não comprovam teclado, seleção por alças ou
zoom físicos do iOS. Safari/PWA instalado, modo standalone e offline continuam
pendentes de teste no iPhone. O viewport mantém o zoom manual acessível.

Regressão do layout com `interactive-widget=resizes-content`: com Chromium e a
mesma fixture local, execute `node tests/mobile/layout-check.mjs`.
`PLAYWRIGHT_MODULE` aceita a instalação externa; `CHROMIUM_PATH` aceita um
Chromium já instalado. O teste conserva a tela do dispositivo e reduz somente
a altura da janela, cobrindo tablets de 768, 820 e 1023px e celular com rotação.
Isso simula o redimensionamento por teclado; não substitui o teste em aparelho.
