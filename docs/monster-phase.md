# Walker: recorte e sincronização de ataque

O controller do Walker agora recorta, em memória, o trecho **1/3–5/3 s** do take completo `Zombie Attack`. Os limites são interpolados; não há arredondamento para amostras vizinhas. A janela dura4/3s; tocada em0,88s resulta em **1,515×**. O GLB original continua com2,625s e o mesmo SHA `91c975ebfef06f38239a7e5f3258c8ac545340dc217b625f6488fe01cc745b2c`.

Só Walker/runner aceitam a nova rota. `controller.stats.supportsPhaseAttack` indica suporte. Brute/Lich preservam sua rota `attack({duration})`, e Orc continua na biblioteca própria. Os limites20/10 e criação sob demanda permanecem responsabilidade do pool; o controller não cria atores adicionais. Esta entrega não alterou main, servidor nem pool.

## Contrato confirmado

```js
const attack = {
  id: 7,               // inteiro monotônico por entidade; estável durante o golpe
  elapsed: 0.32,       // segundos decorridos, já estimados para o frame atual
  duration: 0.88,
  impactPhase: 0.46 / 0.88,
  active: true,
};
controller.update(dt, { speed: 0, dead: false, attack });
// Ou durante a entrada no pool, antes do primeiro render:
controller.syncAttack(attack);
```

`syncAttack` retorna `true` quando aplica um snapshot novo/cancelamento, `false` quando ignora um snapshot repetido, antigo, morto ou sem suporte. `phase` normalizada pode substituir `elapsed`; quando ambos existem, `elapsed` prevalece. IDs opacos exigem `sequence` monotônica separada para rejeitar pacotes de golpes anteriores. `reset()` limpa essa sequência quando o ator é reciclado para outra entidade.

- Novo ator com `elapsed>0`: aplica imediatamente a pose da fase solicitada, sem repetir preparação ou entrar por um blend de Idle.
- Mesmo ID/elapsed repetido: não reinicia ação nem fade. O controller avança a previsão visual por `dt` entre snapshots. Snapshot novo já representa o frame atual, portanto não recebe um segundo avanço por `dt`.
- Elapsed antigo não faz rewind. IDs anteriores são ignorados. Um ID concluído/cancelado nunca é reiniciado; novo golpe exige novo ID.
- `active:false`: encerra com blend de0,1s para a locomoção pedida, mantendo transformação/estado externo. Com elapsed≥duration, registra fim normal; antes disso, cancelamento. Cancelamento recebido antes de o golpe ser visto também impede replay tardio daquele ID.
- Morte cancela a visualização; reset limpa fase/ID; `dt=0` congela previsão. O controller não possui nem altera HP.

`stats.attack` publica `id`, `elapsed`, `duration`, `normalizedTime`, `impactPhase`, `impactReached`, `active`, `cancelled`, `clipTime` e `startCount`. `impactReached` é diagnóstico visual, **não evento de dano**. `stats.attackWindow` publica origem/limites/take completo. O gameplay/servidor continua responsável por consumir impacto uma vez, revalidar alcance/cone, interromper movimento e cancelar golpes.

Integração sugerida no pool, sem modificar a rota legada:

```js
controller.update(dt, {
  speed,
  dead: false,
  ...(controller.stats.supportsPhaseAttack && entity.attack
    ? { attack: entity.attack }
    : {}),
});
```

Enviar também estados `active:false`. Evitar chamar o gatilho antigo `attack({duration})` para o mesmo Walker quando o estado compartilhado já identifica seu golpe. `attack(options)` permanece disponível para fixtures e ações locais com ID automático; não substitui IDs da autoridade.

## Evidência CPU

`node tools/monster-phase-cpu.mjs`: **24 verificações passaram**, usando a biblioteca instalada e malha real em CPU; imagens removidas somente da resposta em memória para carregamento sem navegador. Relatório: [controller-cpu.json](../output/monster-phase/controller-cpu.json).

Entradas nas fases10/35/52,3/80/99% reproduziram as posições dos41 ossos da execução contínua, diferença máxima inferior a6e-10m. Passaram snapshots repetidos/antigos, ID anterior, cancelamento antes/depois de attach, conclusão sem replay, duração/fase, pausa, morte, reset, retorno a Run,20/10 instâncias e descarte. Maior erro de piso nas transições amostradas: **1,782mm**. Brute/Lich conservaram a duração/avanço legados. O teste confirma que os arquivos monitorados não mudaram durante sua execução; não é aprovação artística ou multiplayer.

## Revisão nativa do recorte

[Fixture Chrome/ANGLE Metal](../output/playwright/monster-phase/verification.json): cinco fases10/25/52,3/70/90%, poses contínuas comparadas com entrada no pool na mesma fase, mais4,3s de playback gravado. PASS, nenhum erro de página/HTTP/WebGL, arquivo do controller estável. As cinco imagens foram inspecionadas: preparação lateral, mão avançando na fase52,3% e recuperação curvada; poses equivalentes entre os dois atores, sem explosão visível. Trata-se de fixture de controller, **não valida dano, servidor ou combate em gameplay**.

Controller observado SHA `febe85c6c4b1bb4be36f80b5fbe824ba06c3679e669c6bbbe7a9c376fd6df483`. O primeiro acesso ao fixture pelo servidor do jogo foi recusado com404; o teste final usa servidor HTTP isolado criado pelo próprio script, sem alterar as rotas do jogo. Reproduzir: `node tools/monster-phase-native.mjs`.

## Candidato de conjuração para Lich, não integrado

Inspeção CPU de arquivos locais, sem reutilizar malha/identidade de personagem:

| Fonte | Duração / rig | Observação medida |
| --- | --- | --- |
| `Characters/Arthas/Animations/Mixamo_GreatSword/spell cast.fbx` | 1,133s,65 ossos, nenhum mesh | Palma esquerda avança; mão direita fica recolhida. A mão esquerda vai deY−0,418 para≈−1,094m no meio do gesto, com alturaZ≈1,30m. Pequeno passo à frente. É o candidato mais direto para testar um lançamento frontal. |
| `.../great sword casting.fbx` | 4,8s,65 ossos, nenhum mesh | Mãos sobem aZ≈1,78/1,97m e depois descem ao chão com quadril baixo. Sugere invocação/impacto no solo, inadequado como substituição automática de tiro frequente. |

SHA spell cast: `8a2f28f2911f60b8456cbbc2bf2f572e091b932b9d01cf13d799f87a9b734090`; great sword casting: `0fbda1a7b34260ca6970f6c4845c3ba14e599e746206034bc502e181291ccdfd`. São arquivos identificados localmente como Mixamo; isso não licencia personagens de franquias nem transforma os movimentos em CC0. Não foram copiados ao runtime.

Os dois `sword and shield casting` do acervo Aldric também existem, mas são FBX ASCII; a importação nativa desse Blender recusou esse formato. Não houve conversão nem conclusão de playback para esses dois. Dados/scripts de investigação ficam em `/tmp/bipx-walker-phase/cast-candidates` e `inspect-casts.py`.

A análise das mãos é de ossos sem malha: não aprova contato, dedos, deformação ou aparência no Lich. Retarget+revisão nativa e sincronização de projéteis ainda pendentes. A rota ranged/caster atual permanece um gap declarado.
