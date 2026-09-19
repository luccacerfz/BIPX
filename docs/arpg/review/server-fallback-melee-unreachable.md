# Fallback melee do servidor: alcance bloqueado pela separação corporal

Reprodução root em CPU, 2026-09-19 05:24:52Z. **Defeito confirmado no caller isolado; correção de runtime e prova em rede ainda pendentes.** O lote Environment/pursuit continua independente e não deve absorver esta alteração sem sua própria evidência.

Fonte `server.mjs` SHA256 `29bbf681ab613cd79be702400e2b6a3eb49a275a03d173e3a7f2d3bdcb62eefb`. O fallback sem timing específico exige distância menor ou igual a `meleeRange * .84`, mas os corpos se separam por soma de raios maior que esse limiar. `getMeleeTiming` envia Walker/zombie e runner a outro ramo.

[Reprodutor](../../../output/qa/arpg-root-review/server-fallback-melee-20260919/reproduce.mjs) e [resultado completo](../../../output/qa/arpg-root-review/server-fallback-melee-20260919/report.json). O script extrai as funções literais de produção de targeting, status, crowd bodies e update dos monstros; usa contacts/navigation/crowd/timing reais. Arena aberta sintética, jogador parado, um inimigo, 100 passos de .05s. Observa chamadas de dano sem aplicar HP/progressão. Dois starts por família: contato sem penetração e .05m além do alcance nominal. Nenhum browser, WebSocket ou servidor foi alterado.

| Família | Soma de raios | Limiar antigo | Nominal | Chamadas de dano em 5s: original → contrafactual |
| --- | ---: | ---: | ---: | ---: |
| Brute | 1.82m | 1.596m | 1.90m | 0 → 8 |
| Orc Peon | 1.49m | 1.302m | 1.55m | 0 → 6 |
| Cow Walker | 1.50m | 1.3272m | 1.58m | 0 → 8 |
| Blood Cow | 2.36m | 2.0496m | 2.44m | 0 → 6 |
| Zombie/Walker, timing próprio | 1.42m | não usado neste ramo | 1.50m | 5 → 5 |
| Runner, timing próprio | 1.22m | não usado neste ramo | 1.30m | 5 → 5 |

Os resultados se repetem nos dois starts. O contrafactual muda somente o fator .84 no gate e no `arrivalRadius`, usando o alcance nominal já definido. As posições finais dos inimigos sem timing não são idênticas entre variantes: o original tenta avançar até a separação corporal; o contrafactual pode parar dentro do alcance nominal. Não houve sobreposição além da tolerância .001m. Zombie/runner preservaram exatamente posições e chamadas de dano. Todas as fontes permaneceram estáveis.

## Direção autorizada para Combat e Physics

Após fechar o lote Environment/pursuit, preparar uma cópia nova com a menor correção da política de alcance. Combat continua dono de `server.mjs`; Physics pode revisar coerência geométrica e casos de parede em CPU sem edição concorrente. Não diminuir os raios, deslocar o jogador, aumentar dano ou mudar animações para esconder o defeito.

Revisar alcance nominal, bônus de elites, cooldown e exigência de linha de visão. Exigir prova WebSocket com redução de HP real para as quatro famílias, controle negativo fora do alcance/atrás de parede, cooldown sem repetição por tick e controles Walker/runner/ranged. Reutilizar provas existentes onde o código não muda; não repetir a suíte global sem motivo. Só promover a correção com fontes congeladas e smoke do servidor servido, preservando porta 5173, ledger local e Supabase desativado.

Este diagnóstico não aprova o golpe Brute07: a análise de encaixe mostra que ele não toca os heróis reais. A futura atuação v6 precisa de seu próprio marker/FSM, sem comprimir 1.30s no contrato antigo de .55s.

## Revisão posterior do candidato e da prova de rede

Root leu candidato16ac7e88 e revisão independente Physics58simulações/3761passos. O patch é mais restrito que o primeiro contrafactual: usa nominal só sem `meleeTiming`, preservando .84 também na perseguição Walker/runner. Três linhas, sem alterar perfis, raios, dano, cooldown ou LOS. CPU independente inclui parede fina dentro do alcance, elites e contorno dos controles.

O reportWS05:42 tem17checks aprovados antes de falhar no arranjo ranged; o recorte05:43 corrige somente essa fixture e passa ranged/projétil/HP real. Não apagar o reportfalse nem chamar seus17casos de captura totalmente aprovada. A primeira tentativa05:41 falhou porque o harness lia `radius` do objeto serializado que não possui esse campo; o raio passou a ser retornado separadamente.

Achado root no harnessWS: o negativo `wall` procura inimigo a5–20m com jogador(0,0), portanto também está fora do alcance melee. Esse teste não distingue a proteção daLOS. Solicitado um recorte adicional causal, sem repetir17casos: usar o par realPhysics da grade `burial-rail-2`, jogador(-14,18.26), Bruteexecutioner(-14,20.28), distância2.02m<alcance2.72m, corpos válidos, zeroHP através da grade. Parede dentro de alcance já foi provada emCPU; falta fechar o transporte/dano real nesse mesmo tipo de situação. Fonte candidata deve continuar16ac7e88.

## Integração conferida Root

19/09/2026, revisão após05:59 UTC: report WS causal `protocol/2026-09-19T05-51-38-819Z-rail/report.json` passou em dois casos no mesmo servidor16ac/dependências: distância2.02, alcance2.72, rail real bloqueia (HP200), LOS livre atinge (HP113, três hits). Continua fixture estacionária com IPC declarado, não gameplay natural.

Combat promoveu somente `server.mjs` às05:54:28 e reiniciou5173 no PID5973. Root conferiu os225 hashes de promoção: zero divergências. Smoke servido05:55 passou HTTP público e dois clientesWS em menu, preservando os reports de harness falhos anteriores; não abriu endpoint público para código backend. Ledger continua7f58079816e9b7f6506c77b236def2044925811a97a8f30eb533d9d319f4d333. Ver `output/server-fallback-melee-v1/integration-addendum.json`.
