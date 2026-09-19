# JEF real — Physics dinâmico e spawn integrado

2026-09-19T02:26:39.802Z: TypeSafe Jev `jev-1.13.0`, **HTTP200 / requires_further_work**.12notas aceitasnull; goal AAA/10 incompleto. JEF recebeu texto, não imagens/áudio/vídeos; credencial só no ambiente do subprocesso, sem histórico privado enviado.

[214fontes](../output/qa/arpg-crowd-integrated-20260919/source-manifest.json), [15relatórios completos correspondentes](../output/qa/arpg-crowd-integrated-20260919/evidence-provenance.json), [evidência enviada](../output/qa/arpg-crowd-integrated-20260919/evidence.json), [resposta real](../output/qa/arpg-crowd-integrated-20260919/jef.json), [medições e paths](../output/qa/arpg-crowd-integrated-20260919/measurements.json), [cinco PNGs examinados](../output/qa/arpg-crowd-integrated-20260919/native-observations.json). Fonte estável. Apenas main/server/contacts/novo crowd-control diferem do Horizon01:46. Este checkpoint fecha a integração funcional Physics, sem aprovar todos os gates do produto.

Índice dinâmico por tick e sweep contínuo na perseguição, atualização imediata/removal, timers e budget4 preservados. Freeze/stun fixos no crowd ordinário, recuperação limitada para entradas já inválidas; pull explícito conserva resistência boss.35. Dash/charge mantêm sweep estático. Spawn único consulta corpos vivos/exclui self; rejeição atômica preserva sessão/recursos/CD/sequence. Cliente aplica posição autoritativa antes de enviarstate; welcome/reconnect coerentes sem relocação.

- CPUhooks17/17; geometria/cache/paridade/expiração/pressão10–60Hz/boss/pull/parede/spawn. A entrada inicialmente inválida mantém pico histórico de recuperação, não escondido como zero.
- Backend13/13, runtime/ferramentas estáveis; inclui progressão, autoridade, ranking, reconexão e skills.
- Spawn4gruposCPU/WebSocket; UI2fluxos; auditor Root20CPU distintos com transportstubs. UI de rejeição usa sala inativa/corpo sintético; rejeição em sala viva provada porWebSocket real separado.
- Combos3/3: guerreiro1stun vivo/1corte; dwarfhigh5freeze/5pull/3kills,low1freeze/3pull/2kills.178/189frames de campo visível comdepthválido/1passe.
- Rede6skills em dois browsers, mundo19monstros no tick comum; reconnectid/sequence3/recurso37.55, terceirojoin3players/23monstros. Pós-colisão parede/slide nas duas classes e dash/escudo bloqueadosPASS.
- Natural60s/classe, sem fixtures:142.53/141.24FPS,P958.3/8.4ms,pior41.8/27.3ms,0frames>50ms e0longtasks. DesktopChrome1440×900/MetalM5Pro; não mobile/soak.

## Desempenho e limites explícitos

Native sintético com IA realmente ativa,1280×720,10s medidos depois1.5s warmup/capturas:120atores142.38FPS/P95frame8.3ms/P95CPUcrowd3.4ms;400atores61.75FPS/P95frame21.6ms/P95CPUcrowd18ms. Contagens mantidas, controles expirados, índice descartado, zero sobreposição final/invisíveis. **400falha orçamento de P95≤20ms**; média≥57não substitui o gate. CPU17confere segmentos transitórios em cenários declarados; endpointzero não é prova universal.

NodeVMcorrigido400/60HzP956.448708ms e400/10Hz20.08875ms. Baseline sem sweepdinâmico3.144208/3.489708ms custa menos mas desloca controlados.28.940ms anterior permanece histórico comO(N²)extra do auditor. Corrigir medidor não foi otimizar runtime; não converter CPU emFPS.

No-slide continuafalse. Arte grito/canhão/corte/gelo, áudio sem escuta, mobile físico, acessibilidade, links degradados/soak continuam pendentes. UIrejeição tem título cortado/baixo contraste emPNG; próxima janela coordenada deve corrigir. Fogo novo e cenário selecionado ainda staging neste manifesto; gate coexistência fogo65% não atingido. AuditorCPU de origem do canhão encontra separação1.587m entre socketcapturado eprimeirotravel; gate core+adapter real perto de parede/alvo antes da promoção, sem alegar defeito perceptual já visto.

| Dimensão | Preliminar textual0–10 | Nota aceita |
| --- | ---: | --- |
| game_design | 5.11 | pendente/null |
| animation | 4.61 | pendente/null |
| art_direction | 4.96 | pendente/null |
| vfx | 4.83 | pendente/null |
| combat_feel | 6.16 | pendente/null |
| ui_ux | 5.56 | pendente/null |
| mobile | 0.59 | pendente/null |
| audio | 0.77 | pendente/null |
| performance | 6.10 | pendente/null |
| multiplayer | 6.71 | pendente/null |
| accessibility | 4.26 | pendente/null |
| reliability | 6.64 | pendente/null |

## Preservação

5173 atualizado após isolados, PID97873→66986, HTTP200, Supabase desligado. [Recibo](../output/qa/arpg-crowd-integrated-20260919/local-server-restart.json): ranking antes/depois SHA7f580798…idêntico; smokeWebSocketmenu também sem alteração. Nenhum reset/limpeza/commit/push/deploy. Horizon01:46 e todas as falhas históricas permanecem em suas pastas. GPU própria liberada; próxima janela Environment/layout143 separada, sem depender da aprovação de fogo.
