# Astra — revisão independente do dash

Revisão de 2026-09-19. **Aceite técnico focal: SIM. Aceite artístico final: NÃO CONCEDIDO, cobertura pendente.** Não é aprovação global, de produção, nem nota 10. A revisão não alterou runtime, não publicou, não chamou JEF, não abriu browser/GPU nem reiniciou 5173.

## Candidato e integridade

Fonte revisada: `output/qa/aaa-20260919/dash-segment-v1/candidate/`. Baseline e fontes vivas: 239 arquivos verificados; candidato e snapshot nativo: 240 arquivos verificados, sem divergência em nenhum dos quatro conjuntos no início. Ver `output/qa/aaa-20260919/astra-review-ctx-c63/integrity-start.json` e `integrity-end.json`. A nova pasta conserva o identificador curto do primeiro dispatch, não significa que aquele dispatch foi concluído.

| Arquivo | Baseline SHA256 | Candidato SHA256 |
| --- | --- | --- |
| src/main.js | d9e6fed48d8609acbd495f9a1c747bbe8e6b9d3cc00447aa75e4896b156b6d3b | 45fe29b2e0e8f3ce58fddd6a97c9b4f5cd0b90955b47c9a23313a7b6b59c6b08 |
| src/vfx/class-skill-vfx.js | cdbdf7642e0526f8c7fe1d38c4458e0dd71aff522b4bf6ea115cd3083ae766b9 | 08d5abfe3d69563eb0be90101ddd90753b66e1b57deac528813ba777d5bfe1a5 |
| src/vfx/dash-vfx.js | ausente | 0d8efb4ad3f087ca9e8f670289ec3cb692a53f76ea8704dde55e0faf33faa212 |

Manifesto da revisão: `output/qa/aaa-20260919/astra-review-ctx-c63/review-manifest.json`, com hashes dos relatórios originais e patch. O campo textual `status` do manifesto original ainda diz CPU pendente; é metadado desatualizado, não resultado do ensaio. O contrato histórico lista pool e19eef…; o pool revisado é 0d8ef… e corrige a abertura remota.

## Correção técnica literal

`output/qa/aaa-20260919/dash-segment-v1/candidate/src/vfx/dash-vfx.js:124` reserva um segmento quando há deslocamento autoritativo de root **ou** deslocamento do emissor; o evento remoto pode chegar antes de o mixer/interpolador mover o socket. O pool anterior e19eef… exigia deslocamento do emissor nessa etapa e deixava o remoto sem segmentos. O hook em `output/qa/aaa-20260919/dash-segment-v1/candidate/src/main.js:6025` resolve a posição após o mixer; `output/qa/aaa-20260919/dash-segment-v1/candidate/src/vfx/dash-vfx.js:131` altera arco/ponta aberta sem reescrever segmentos fechados, criar eventos, modificar clocks/life ou prolongar a cauda.

O negativo original está preservado: `remote-open-segment-negative.json` registra local 5/remoto 0, `desiredGatePassed:false`, pool e19eef…. O positivo registra local 5/remoto 5, pool 0d8ef…. Mesmo main e wrapper nos dois controles; a evidência negativa não foi sobrescrita. A integridade dos arquivos de simulação, autoridade e servidor permanece a do baseline.

## Verificação independente

- Reexecução CPU integrada **7/7** passou com o presenter/interpolador literal e pool real Three; somente o destino do relatório e import do suporte foram redirecionados para a pasta da revisão. Original preservado. Arquivos `rerun-integrated.mjs` e `cpu-integrated.json` na pasta da revisão.
- `independent-checks.mjs` executa **23 expectativas**, incluindo uma limitação esperada do gate; isso não equivale a 23 critérios de qualidade aprovados. Ver JSON detalhado. São pacotes/poses sintéticos em CPU, sem alegação de gameplay ou render novo.
- Matriz local/remoto × high/low × reduced on/off: root e socket imóveis não criam segmentos/contatos; salto de socket de 20 m oculta a ponta aberta e mantém o trecho fechado e número de contatos. As 16 combinações desses dois cenários passaram.
- Reprodução literal do gate sobre cópias do relatório: original passa; remover todas as pontas do caster ou observer falha com `Missing live trail`; zerar segmentos falha para ambos; remover pontas remotas entre eventos falha. A lista vazia não obtém mais aprovação.
- **P2 — lacuna reproduzida do gate:** remover somente as pontas locais entre eventos ainda passa. Reprodução no teste `no between-event tips on caster`. `output/qa/aaa-20260919/dash-segment-v1/tools/verify-native.mjs:78` só exige essa cobertura no remoto; estender a ambos e exigir ponta em cada frame de travel vivo evita falsos positivos futuros. O relatório nativo atual contém as 19 pontas locais, portanto essa limitação não invalida os dados positivos presentes.
- **P2 — rastreio de input incompleto:** o trace preservou `keyup Digit2 isTrusted:true`, sem `keydown`; o teste aceita qualquer tipo de evento confiável. A fonte chama `keyboard.press('2')`, a sequência sobe uma vez e os eventos confirmados são iguais. Isso sustenta uma execução focal por input automatizado confiável, mas o JSON isolado não demonstra a dupla keydown/keyup. Na próxima captura, conservar ambos explicitamente.

## Captura nativa revisada

Origem: `native-2026-09-19T08-58-17-805Z/report.json`, SHA256 `6b04161dd60d16dadf209fa8e59982e8f3dd882952f37a7d29452e83e9a6658d`. Inspecionei as duas screenshots originais a 1440×900 e sequências de frames extraídas dos dois WebM reais. As folhas em `astra-review-ctx-c63/*-sheet-*.jpg` são somente mosaicos dos frames nativos amostrados a 10 Hz; não são render sintético nem playback contínuo de todos os frames. Conferi adicionalmente quatro frames do gesto a resolução nativa (`caster-native-3.5/3.6.png`, `observer-native-2.0/2.1.png`). Não ouvi áudio.

| Medida | Local | Remoto |
| --- | --- | --- |
| Frames com arco seguindo | 33 | 35 |
| Frames de travel com ponta | 27 | 27 |
| Frames com ponta entre eventos | 19 | 19 |
| Segmentos emitidos | 8 | 8 |
| Frames de cauda terminal | 5 | 5 |
| Erro máximo ponta/socket | 3.4824e-7 m | 2.3619e-7 m |
| Erro pool/socket | 0 | 0 |
| Cauda ainda interpolando root remoto | n/a | 5 |

11 eventos autoritativos idênticos nos dois clientes, zero erros de console reportados, expiração observada e nenhuma inatividade antes do terminal no trace. As medidas foram recalculadas pelo gate literal sobre o relatório. Esta é uma captura high de um único cast/miss e um único slot, em dois Chrome reais com servidor isolado; não cobre rede adversa, late join, reconnect ou sessões longas.

## Arte, silhueta e lacunas

O arco azul/branco curto aparece junto à lâmina e o corpo/escudo permanece identificável nas screenshots locais. A esteira é muito fina e discreta contra as pedras escuras; na vista remota compete com o anel do jogador e o nome acima da cabeça. Isso é uma observação visual focal de legibilidade limitada, não prova de ausência de segmentos (os buffers e a captura mostram segmentos). O círculo azul no chão já existia antes do dash nas sequências; não atribuí esse círculo ao novo VFX.

**Parecer artístico: pendente, não selecionar como arte final ainda.** O recorte não prova a clareza de contato por alvo, corte de cadáver, legibilidade em horda, distinção entre dash e escudo, nem leitura low/reduced em render. O CPU prova comportamento dos buffers nesses modos, não sua percepção. Não há defeito P0/P1 de implementação reproduzido nesta revisão focal. Recomendo próxima captura coordenada com lock próprio: contatos reais/sobreviventes/mortos, caminho perto de obstáculos, dois atores em movimento e high/low/reduced, seguida de revisão do gesto inteiro e da esteira em escala de jogo. Não repetir JEF com evidência idêntica.

## Handoff para integração única

Patch final técnico pronto: `output/qa/aaa-20260919/astra-review-ctx-c63/dash-segment-final.patch`, SHA256 `ee9727f2d85254c44ad5432d3b05496bb81f084b19ce95e308d772f64d1edb68`. `git apply --check` passou contra os arquivos vivos verificados; **não aplicado**. Contém exatamente os três deltas da tabela, incluindo o pool novo inteiro. Não copiar todo o snapshot sobre a fonte viva.

O coordenador deve combinar esse patch com os candidatos Fable/Grok e resolver a sobreposição em main/servidor conforme ownership. Repetir a verificação de aplicação após outras integrações; sucesso neste baseline não garante aplicação após novos deltas. Depois da integração, repetir os checks focais no hash combinado antes de promoção. A aprovação técnica deste patch permite sua revisão/integração, não libera arte final, multiplayer global ou deploy.

## Comunicação da Run

A Run é `run_f726ad723cdd`; coordenação global permanece com `term_2c92353e-2d09-430c-88cf-cfeeaeb6f924`. Os três preâmbulos recebidos usaram ctx_c63caee1e70d, ctx_cb5189462e90 e ctx_8adb89d4e0e4; as tentativas de escalation/heartbeat foram rejeitadas por capability revogada. O primeiro dispatch foi confirmado `failed / agent_prompt_stalled`, sem worker_done anterior desta sessão. Nenhuma credencial/capability foi gravada no relatório. A conclusão deverá ser enviada uma única vez pelo último comando recebido; se revogado, o coordenador precisa regularizar o lifecycle, sem repetir trabalho já entregue.
