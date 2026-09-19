# Fechamento Fable — verificação dos 7 Astras e plano de produção (2026-09-19)

Pedido direto do usuário. Sete agentes Fable (um por frente) fizeram auditoria **somente leitura**; notas em `output/qa/aaa-20260919/fable-closeout/<frente>/`. Nada foi editado no runtime vivo, em `integration-*` nem enviado a terminais Orca. **Nenhum deploy foi executado** (o deploy de preview foi bloqueado pelo classificador de permissões do Claude Code).

## Por que pararam

Os 7 Astras e o coordenador são sessões Codex e bateram no **limite de uso da conta** (volta em 25/09 19:25; Animação em 26/09 04:42). A sessão coordenadora e o "Astra retomada" saíram para o shell. Só Fable (Claude) e Grok continuam operáveis.

## Estado por frente

| Frente | Em voo ao parar | Integrado no v5 | Ficou pendente | Árvore viva |
| --- | --- | --- | --- | --- |
| SFX ElevenLabs | terminal reaproveitado para Brute motion v8 (só `output/`+`tools/`) | SFX v2 idêntico em vivo/v5/release; 28 cues presentes | escuta humana, aparelho físico, timeout intermitente do Aldric | íntegra |
| Física & Contatos | nada (última entrega: revisão CPU do fallback melee) | módulos idênticos vivo/v5; 22/22 e 12/12 CPU reexecutados nos dois | custo com horda, layout 153, `network-move` (Combat) sem prova de rede | íntegra |
| GUI ARPG | nada; mensagem do Combat não enviada não pede trabalho (contrato v2 já implementado) | HUD v2, painted-v3, fixes Fable, touch polish; pacote sem arquivo faltando | Safari iOS/VoiceOver/dispositivo físico | íntegra |
| Environment & Assets | canopy v4b depth fix (cópia, falhou por 1 pixel, sem GPU) | abertura de copa para companheiros; 31 assets dinâmicos + 158 refs presentes; 47 MB | canopy transition v1/v3/v4/v4b não promovidos (correto) | íntegra |
| VFX & Arsenal | ia corrigir o rastro remoto do dash; parou antes de escrever | correção válida é `dash-segment-v1` (`dash-vfx.js 0d8efb4a…`) — no v5; CPU reexecutado: local 5/remoto 5, 7/7 | arte final do dash, corte do cadáver, sobrevivente atingido | íntegra, pré-dash |
| Animação Mixamo | `backward-v15` CPU incompleto, com regressão registrada; **1 pergunta em fila não recuperável** (só via ⌥+↑ no Orca; provavelmente obsoleta) | animação do v5 = árvore local (nenhum arquivo de animação nos 17 alterados) | `acceptedNoSliding=false`; v13–v15 e Brute v4–v8 não promovidos | íntegra |
| Combat & Integração | fila de mensagens sem resposta; dono do 5173 (PID ativo, serve a árvore viva, não o v5) | v5: 244 arquivos congelados, hashes conferem; 17 diferenças vs vivo; inclui ordem de snapshots do Grok; `node --check` 95/95, `verify-class-skills` e paridade de progressão passam; servidor v5 protege `/server.mjs`, `/.env` | promoção local dos 17 arquivos + restart do 5173; reteste SFX de desconexão; late-join em browser | íntegra (`applied:false`) |

## Pacote pronto

`output/releases/integration-v5-20260919/public/` — 238 arquivos, 47 MB, byte-idêntico ao candidato v5 + `vercel.json`; sem servidor, tools, evidências ou segredos; smoke local de 2 classes passou. Inclui todos os patches aceitos (UX Fable, +Área, rede Grok v3 + ordem de snapshots, dash, canopy, loot labels, point-blank Opção A, touch polish). `qualityAccepted:false` continua valendo: nenhuma dimensão tem nota 10.

## O que muda em produção

- Produção hoje = commit `9124df5` (Vercel) + servidor WS no Render respondendo 200 com esse mesmo commit. **Multiplayer funciona hoje.**
- `src/audio`, `src/assets`, `src/combat`, `src/physics`, `src/render`, `src/vfx`, `src/ui`, `assets/` **não estão no git** (355 entradas não rastreadas). Deploy tem de sair da pasta do release, nunca do git.
- Deploy **só estático**: solo funciona; multiplayer **quebra** (cliente v5 espera `startRun`/`skill`/`pickup`/`chooseUpgrade`; o servidor antigo ignora → fica suspenso em "Conectando").
- Para multiplayer: o Render publica do GitHub `main` (repo **privado**), então é preciso commit + push de `server.mjs`, `package.json`, `src/**` (e o que o servidor importa) — ação fora do alcance desta sessão sem autorização explícita.

## Comandos (staging já preparado e vinculado ao projeto `bipx`, sem `.env`)

```
cd /private/tmp/claude-501/-Users-luccacerf-Projetos-Pessoal-Gaming-BIPX/2f407a79-d26b-4fa5-b8d7-023f62610f9e/scratchpad/deploy-v5
vercel deploy --yes          # preview
vercel deploy --prod --yes   # produção
```

Alternativa sem staging: `vercel deploy output/releases/integration-v5-20260919/public --prod` após `vercel link --project bipx` nessa pasta (apagar o `.env.local` que o link baixa).
