# Physics — região terminal de melee, candidato em cópia

**Atualização posterior:** API/adapter selecionados por Root para prova nativa em cópia; [integração, input real, custo e auditoria](physics-pursuit-native.md) concluídos. Sem promoção; provas CPU abaixo preservadas.

**Pronto para revisão/seleção, sem promoção.** Com o layout proposto Environment **a5f4**, contacts **912c** e adapter mínimo sobre o main **afc7d5ac**, o BloodCow offline chegou e atacou pelas duas origens capturadas: norte **3,50 s**, sul **7,35 s**. O baseline com as mesmas fontes e geometria permaneceu parado, sem hit por 30 s. Todos os relatórios finais têm `sourceStable:true`. Runtime, servidor5173 e módulos Environment foram preservados; nenhum uso de GPU ou repetição dos72 cenários.

[Recibo completo e hashes](../../output/physics/pursuit-terminal-20260919/receipt.json), [patch navigation](../../output/physics/pursuit-terminal-20260919/navigation-attack-region.patch), [adapter BloodCow para Combat](../../output/physics/pursuit-terminal-20260919/main-bloodcow-adapter.patch). O candidato está congelado para revisão; nenhuma próxima escrita runtime está prevista.

## Causa discriminada

O caller pede `arrivalRadius = 1.72 + .72 = 2.44`, mas o ataque offline real alcança `1.72 + .64 + .74 = 3.10`. Corrigir apenas esse número não basta: a grade de1,25 m continua sem amostrar um terminal aceito. A região explícita permite conectar a grade a poses locais dentro do alcance e com LOS real.

| Consulta nas duas origens, layout a5f4 | Norte | Sul |
| --- | --- | --- |
| Navegação anterior, arrival2,44 | Falha,768 nós | Falha,768 nós |
| Navegação anterior, somente arrival3,10 | Falha,768 nós | Falha,768 nós |
| Região local range2,44/minDistance2,36 | Falha,0/16 poses válidas | Falha,0/16 poses válidas |
| Região local range3,10/minDistance2,36 | Rota,14 nós/5 sweeps terminais | Rota,74 nós/14 sweeps terminais |

[Matriz, caminhos exatos e verificações do contrato](../../output/physics/pursuit-terminal-20260919/contract-checks.json). As consultas que falham por orçamento não são prova geral de impossibilidade; a impossibilidade corporal do layout9e45 tem seu [certificado histórico separado](physics-maintenance-boss-approach.md).

## API pequena e limites

Opção adicional de `findNavigationPath` e `getPursuitDirection`:

```js
{ attackRegion: { range, minDistance, losY }, ...existingOptions }
```

`range` deve ser finito, positivo e no máximo5; `minDistance` finito, não negativo e menor que `range`; `losY` é a altura absoluta finita do LOS. Entrada inválida lança `RangeError`. O caller fornece esses valores a partir de sua regra real de ataque. Para este BloodCow: `{ range: 3.10, minDistance: 2.36, losY: .9 }`.

- Uma pose terminal precisa estar entre `minDistance` e `range`, ser corporalmente válida e ter LOS sem sólido na altura informada. A região não aplica dano nem concede alcance adicional.
- São16 amostras determinísticas: oito ângulos em cada um dos raios `range - min(.05, (range-minDistance)/4)` e `(range+minDistance)/2`. Cada amostra é validada pelo corpo real via `moveActor` e pelo LOS via `sweepStatic`.
- Um nó da busca já dentro da região pode terminar ali. Caso contrário, pode conectar-se a uma amostra por sweep corporal contínuo, desde que o segmento tenha até quatro células:5 m na grade atual.
- Há no máximo256 sweeps extras de conexão terminal por plano. O teto de768 nós, a grade1,25 e a autorização global de quatro planos/tick permanecem iguais. Além dos conectores, há as16 validações de poses e verificações de região/LOS durante a busca: **o custo adicional é limitado, mas não foi aprovado por medição de CPU/frame**.
- O último waypoint não é descartado antecipadamente pela tolerância de passagem. Ao chegar à região real, o steering retorna direção zero e `mode:'arrived'`. Se o alvo muda e o terminal deixa de pertencer à região, o caminho é invalidado segundo o ciclo de replanejamento existente.
- As rotas planejadas expõem `terminal:{sampled,valid,sweeps,sweepLimit,connectorLimit}` para auditoria. Sem `attackRegion`, o caminho anterior permanece:24 consultas legadas tiveram resultado exatamente igual.

Não há coordenadas ou IDs da manutenção no algoritmo. Quatro consultas em duas translações por células inteiras conservaram14/74 nós e sucesso; isso não estabelece completude em toda fase possível da grade. A amostragem limitada pode não encontrar uma janela estreita existente e pode falhar com segurança ao esgotar seu orçamento.

## Adapter do caller e fronteira com servidor

Somente a **cópia** do main recebeu alterações: `updateBossBehavior` calcula o `meleeRange` existente antes de chamar movimento e passa a opção apenas para `bloodCow`; `updateBossMovement` e `moveZombieWithPhysics` encaminham o argumento opcional. A ordem movimento→ataque e a condição literal de dano/LOS continuam. Nenhuma alteração de dano, range, radius, speed, collider, ranged ou crowd. Outros tipos recebem `undefined`.

Combat deve aplicar o pequeno adapter à sua fonte então atual caso o candidato seja selecionado; **não copiar o main inteiro do staging**. A fonte servidor copiada ficou byte-idêntica. Seu ramo de contato simples atualmente usa `(profile.meleeRange ?? radius+.72)*.84`: para BloodCow,2,0496 m, menor que a separação corporal2,36 m. O servidor também possui ranged. A vitória melee offline não corrige nem valida essa política servidor; eventual ajuste é decisão explícita de Combat. O contraexemplo ranged oeste foi preservado em0,30 s.

## Prova pelo caller literal

O [harness focal](../../output/physics/pursuit-terminal-20260919/focal.mjs) extrai `updateZombies` e helpers reais da cópia atual ou de seu adapter, usando imports reais de contacts/navigation/crowd/skills. Fixture CPU sintética de um BloodCow real: raio1,72, altura2, velocidade2,55 m/s, jogador raio.64, `dt=.05`, até30 s ou primeirohit. Não injeta waypoints, deslocamento ou teleporte no caller.

Alvo: `(18.933,14.268)`. Origem norte: `(16.56428861789936,8.359204549834535)`. Origem sul efetiva: `(16.847589032244333,18.323203398288207)`. A solicitação sul histórica `(16.941432443892353,17.38789948292686)` era inválida para esse boss; a correção de spawn de aproximadamente.94 m já estava arquivada. Esta prova inicia diretamente na mesma posição efetiva e não inclui nova recuperação no trajeto.

| Caller offline no candidato a5f4 | Norte | Sul |
| --- | --- | --- |
| Primeiro dano real, tipo melee | 3,50 s | 7,35 s |
| Planos no percurso | 1 | 3 |
| Máximo de nós por plano | 14 | 74 |
| Segmentos contínuos aceitos auditados | 207 | 438 |
| Maior passo do ator | .1275 m | .1275 m |
| Distância ao alvo no hit | 3,058812 m | 3,040402 m |

Todos os segmentos aceitos passaram pelo sweep corporal, sem contato estático no segmento e com poses válidas; LOS livre no hit, zero tiros. [Baseline30 s](../../output/physics/pursuit-terminal-20260919/2026-09-19T04-23-00-878Z-baseline-a5f4-focal.json), [candidato final](../../output/physics/pursuit-terminal-20260919/2026-09-19T04-23-55-358Z-candidate-a5f4-focal.json). O relatório candidato04:23:01 é intermediário preservado; o final acima já contém a validação completa de `minDistance`.

## Negativos e preservação focal

- [Layout9e45 fechado](../../output/physics/pursuit-terminal-20260919/2026-09-19T04-23-55-428Z-candidate-9e45-focal.json): ambas as origens sem movimento/hit em30 s, mesmo havendo duas poses terminais válidas, porém sem ligação corporal.
- [Parede completa](../../output/physics/pursuit-terminal-20260919/2026-09-19T04-23-55-713Z-candidate-wall-focal.json): boss a2,8 m, dentro do range, mas corpo/LOS bloqueados; zero movimento/hit em30 s.
- [Barreira baixa](../../output/physics/pursuit-terminal-20260919/2026-09-19T04-23-55-851Z-candidate-low-wall-focal.json): LOS.9 livre, passagem corporal bloqueada; zero movimento/hit em30 s. LOS sozinho não autoriza um caminho.
- [Seis bosses pelo caller literal](../../output/physics/pursuit-terminal-20260919/2026-09-19T04-26-15-393Z-candidate-low-wall-budget.json): três ticks planejam4,2,0 atores, respeitando budget4 e prioridade rotativa; máximo768 nós, nenhum movimento/hit inválido.
- Preservação: quatro walkers capturados, cliente/servidor, e tiro oeste serverBloodCow. **Os cinco resultados e todas as rotas são exatamente iguais** entre [baseline](../../output/physics/pursuit-terminal-20260919/2026-09-19T04-26-15-474Z-baseline-a5f4-preservation.json) e [candidato](../../output/physics/pursuit-terminal-20260919/2026-09-19T04-26-15-556Z-candidate-a5f4-preservation.json). Norte walker2,55 s; sul cliente2,60 s/servidor2,65 s; ranged oeste.30 s.
- Contrato:24 consultas sem opção iguais; caminhos repetidos determinísticos; segmentos e LOS terminal conferidos; `allowPlanning:false`, chegada e mudança de alvo verificados nas duas origens; região inválida rejeitada.

## Fontes e compatibilidade

Todos os imports diretos/transitivos locais estão fixados nas cópias baseline/candidate. Compatibilidade com **contacts912c** foi exercida nestes callers e controles; não é inferida das provas históricas290a. Os nove arquivos runtime registrados antes/depois ficaram idênticos; o [recibo](../../output/physics/pursuit-terminal-20260919/receipt.json) contém hashes completos dos artefatos e dependências.

| Fonte | SHA-256 |
| --- | --- |
| Contacts em ambas as cópias/runtime observado | `912c00fe18457ac0951812d31a6215bbff1cb01b05e9fae619e8aa2cbe4db6d4` |
| Navigation baseline/runtime observado | `911e0ea2e29bf4b937e8a9174b897d9bc8b197bab0de681e4c9a4f50af6d65d0` |
| Navigation candidato | `e46cc63f5964aabd2ecd737a5ceaef8911863a2e081ad1563f01a4761a77b98d` |
| Main baseline/runtime observado | `afc7d5acd1a5fbe33b03367acf93aec5e404d7aa720e7869bf9c9c6a0f76d7b1` |
| Main adapter em cópia | `c0fbc03bd99ba66deacac8122c75d625038ce950c8c5c00745d7c7662e6b2493` |
| Server preservado em ambas as cópias | `29bbf681ab613cd79be702400e2b6a3eb49a275a03d173e3a7f2d3bdcb62eefb` |
| Layout proposto a5f4, usado no A/B focal | `a5f46359e489f154618230bc66620a9c0598d0c4dc26a41386b87e700957a010` |
| Layout143 runtime observado, não alterado | `8e756fe4022c7916074220d44c0ff605aa8fdc9d80fdf6c61d8a03fb475fc8a7` |

A prova depende da combinação **abertura Environment a5f4 + navigation candidato + adapter Combat**. Não demonstra o mesmo resultado no layout143 ainda vigente. As evidências9e45/a5f4 anteriores, feitas com outras fontes, permanecem históricas.

## Coordenação e limites de entrega

Combat recebeu o contrato antes de qualquer alteração da proposta, recibo `01a0b7e2-512a-7562-8ee4-d933b4b9a3a9`. A tentativa única de aviso final encontrou fila cheia100; sem reenvios, este documento é a entrega durável. Environment recebeu os resultados, recibo `01a0b7ea-f973-7681-87ac-f3c2e3b2851c`: para estas duas origens não foi necessária abertura adicional à proposta a5f4.

Não houve promoção, GPU, restart ou mudança de ownership. ReservasCPU próprias liberadas. Permanecem fora da prova: custo nativo/frame, horda, gameplay com alvo móvel, multiplayer, mobile, soak e aprovação global. O check unitário de alvo movido valida invalidação de estado, não gameplay móvel completo. Seleção e integração coordenada continuam pendentes; não há pedido de alteração de props/planner adicional nem necessidade de repetir72/A/Bdensity para este handoff.
