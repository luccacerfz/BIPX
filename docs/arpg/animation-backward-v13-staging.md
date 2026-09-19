# V13 — junção com o pouso, CPU em cópia

**Candidato a7792f05 retido para revisão; ganho linear parcial, junção material/angular ainda aberta.** Parte da c402b5ac selecionada em [Root v12](review/animation-backward-v12-native-review.md). Nenhuma promoção, GPU ou nova matriz. Runtime07952, GLBs live, candidatos anteriores e servidor5173 preservados.

[Status e hashes](../../output/arpg-animation/backward-v13/status.json) · [diff causal](../../output/arpg-animation/backward-v13/candidate.diff) · [comparação de contatos](../../output/arpg-animation/backward-v13/candidate-final/comparison.json) · [continuidade completa por frame](../../output/arpg-animation/backward-v13/landing-continuity.json) · [seis casos dt0](../../output/arpg-animation/backward-v13/zero-refresh-verification/report.json).

## Escopo e fontes

Mesma história inteira0–5s,6.5m/s,30/60Hz:151+301frames por variante. O relatório de continuidade inclui a aproximação, pouso declarado103/207, release106/213, aterrissagem seguinte114/228 e mais dois frames, além das métricas de toda a história. Nada foi retirado do gate.

- Base preservada: `output/arpg-animation/backward-v13/before`, controller **c402b5acc9c08214608bf78fec566cdb2a081baed5fa6a2bcc50817be4df21cc**.
- Candidato: `output/arpg-animation/backward-v13/candidate`, controller **a7792f0595066635a8139f2cc2b05fdc1ba68dbb621cc7ee73443e5aafb4e2ba**.
- Só `src/assets/hero-locomotion.js` difere entre os19arquivos das cópias. Takes, rig, comprimentos, grip, probes e auditor são idênticos. GLBs históricos **Dwarf e11/Aldric0e5**, sem incorporar metadata live dc/5c às evidências antigas.
- Runner instrumenta outra cópia; ator gêmeo sem hooks verifica perturbação **zero**. Hashes da fonte testada e da cópia final coincidem. Treze fontes protegidas conferidas sem drift;5173 permanece no NodePID5973. Nenhum arquivo main/server foi editado.

## Causa e implementação

Na v12, preservar a pose aérea inicial corrige a entrada100/200, mas o blend quintic converge para um destino que continua se movendo. Igualdade da posição no pouso não determina a velocidade de chegada. A30Hz, a velocidade Z do tornozelo passa aproximadamente10.039→18.060→12.492→.572m/s em100–103. A diferença vetorial no pouso sobe5.519→12.086m/s em relação à v11.

A v13 obtém condições de contorno do destino antes de interpolar. Um segundo driver, isolado do rig visível, amostra **as ações que estão tocando, com seus tempos, rates e pesos da mistura de .14s**, no próximo frame de contato e um dt depois. Usa o mesmo witness de aterrissagem14497, plano material e correção de heading do apoio. Não consulta frames futuros gravados pelo teste.

Era necessário prever a pose misturada. A ablação `diagnostics/pure-profile-boundary` amostrava somente o take destino: erro de posição **33.841/34.213mm**, Foot **4.520/4.565°**. A previsão misturada de `diagnostics/mixed-boundary`, comparada ao pouso posterior inalterado, reduz isso a **.000333/.000385mm**, Foot **.000050/.000059°**. O erro da velocidade prevista é.0000148/.0000302m/s. Ambas são observações sem alteração da pose final.

A primeira amostra resolvida da v12 permanece exata. A partir dela, uma curva cúbica Hermite liga posição e velocidade observadas à posição e velocidade previstas do pouso. Duração **.100/.116667s**, derivada do próximo frame que satisfaz o contato, sem mudar a fase ou o instante de aquisição. Foot e Toe usam a mesma ideia em vetores de rotação, convertendo a velocidade angular final pela Jacobiana inversa da representação. A altura material da sola tem suas próprias condições de contorno; o solver recompõe a perna com a orientação escolhida e piso de2mm. Não há anchor aéreo, deslocamento do quadril ou extensão dos membros.

Uma primeira tentativa, **2e34efda**, lia a velocidade de `airMotion` logo depois de `clearContacts`, portanto herdava zero. A30Hz melhorava o pouso, mas a60Hz criava mudança de velocidade10.835m/s em201. Essa tentativa e seu replay estão preservados em `diagnostics/reset-velocity-hermite` e `hermite-candidate`. O candidato final calcula o primeiro passo resolvido contra o histórico positivo que já estava preservado em `airHandoff`. O guard `dt>0` da c402 continua; refresh0 reaplica a pose sem sobrescrever a cinemática.

A previsão pressupõe o rate, heading e crossfade desta história delimitada. Mudança de dt, colisão, outra troca de direção ou outro gameplay durante a ligação **não foram validados**. O sampler é criado sob demanda e descartado com o controller; custo de produção não foi aprovado.

## Resultado linear, sem esconder a saída

Valores são diferenças vetoriais de velocidade entre frames, em m/s, não velocidades de sliding nem acelerações em m/s².

| Medida |30Hz, c402→v13|60Hz, c402→v13|
|---|---:|---:|
| Entrada100/200 |1.467→1.467|.288→.288|
| Pouso103/207 |12.086→**5.539**|6.952→**4.601**|
| Frame seguinte104/208 |4.127→**4.512**|4.934→**2.737**|
| Máximo da entrada até o frame seguinte ao pouso |12.086→5.539|7.007→4.601|
| Pico de velocidade3D do tornozelo nessa janela |19.673→13.971|21.566→15.256|

Sequência inteira de Δv30Hz100–104: **1.467,3.313,4.390,5.539,4.512**. A60Hz200–208: **.288,2.107,2.558,1.760,1.836,2.526,3.405,4.601,2.737**. O pico linear reduzido não reaparece com amplitude antiga em um vizinho. Entretanto,104 piora.385m/s, e5.539 ainda excede levemente os5.519 da v11.

As poses finais voltam exatamente à c402 a partir de103/207. Diferenças finitas ainda incluem os frames anteriores: toda a cinemática medida volta a ser exata a partir de105/209. Isso inclui release106/213 e aterrissagem seguinte114/228. Os picos posteriores11.010m/s em111 e7.275 em222 já existiam e não mudaram. Toda a história permanece publicada: os grandes picos anteriores20.617/43.300m/s em54/107 também continuam. Esta correção localizada não resolve o ciclo inteiro.

## Limites materiais e angulares — não declarar junção resolvida

O tornozelo não basta para julgar a bota. O mesmo material14493 mostra:

| Δv material14493 |30Hz, c402→v13|60Hz, c402→v13|
|---|---:|---:|
| No pouso103/207 |10.923→8.794|9.678→7.287|
| No frame seguinte104/208 |6.741→**8.980**|3.519→**4.533**|
| Máximo nessa janela |10.923em103→8.980em104|9.678em207→7.287em207|

Logo, **o máximo material30Hz cai, mas muda para104 e esse frame piora**. A condição de “não apenas deslocar o pico” está demonstrada para o ganho linear do tornozelo, não plenamente resolvida para a junção do material. No frame104, a própria velocidade do vértice é idêntica à c402 (.0676m/s); o aumento da diferença vem da chegada anterior mais rápida. Não foi alterado o patch apoiado para obter essa redução.

No pouso, os passos angulares Foot caem20.928→11.648° e8.831→3.234°; Toe cai14.582→12.948° e7.042→6.418°. Porém:

- A30Hz o maior passo Foot sobe **36.028→36.203° em102**. A mudança de velocidade angular Foot no próprio pouso sobe12.822→13.143rad/s, embora seu máximo da janela caia19.566→13.891rad/s.
- O pico local de mudança de velocidade angular Toe30Hz sobe **13.832em101→15.080rad/s em102**. A60Hz cai18.370→18.092rad/s, com redistribuição anterior explícita nos frames.
- A rotação Toe inicial39.225/37.265° fica exata. A v13 conserva o histórico rápido observado; não congela o pé no ar. Isso não constitui aprovação artística dessa orientação.
- Os primeiros contatos declarados103/207 têm **zero patches qualificados**. Os primeiros patches posteriores104/208 têm4/2 amostras e permanecem exatos. `contact=true` sem patch não é PASS.

A v13 combina condições de posição do tornozelo, orientação da bota e altura material. A redução do pico do tornozelo não garante que todas as derivadas de um vértice deformado coincidam: sua posição também depende da rotação Foot/Toe. O próximo alvo causal, se selecionado por Root, é a velocidade do mesmo material na última aproximação e primeiro apoio, mantendo o ganho inicial. Não há justificativa aqui para outra busca de takes ou compensação arbitrária do corpo.

## Preservação e decisão

Só poses finais esquerdas101–102/201–206 mudam. Entrada100/200, prefixo, apoio direito e seu roll, torso/props/root, posições/escalas locais dos membros ficam exatos. Todos **160/583 pares materiais qualificados** mantêm identidade, posição e velocidade: zero adições, perdas ou flags alterados. Alcance excedido0; mínimas globais da sola1.97983/1.96492mm. Altura máxima local do pé esquerdo.15834m a30Hz permanece; a60Hz cai.18570→.16001m.

P90 global de apoio **.225024/.140175m/s**, cobertura **48/302 e124/602**, transições e casos sem patch permanecem como antes. Não são aprovados por esta comparação. Seis casos de refresh0 passam: depois de24/48, antes da troca99/199 e durante a nova ligação101/201, cada um com dois refreshes. Histórico cinemático exato, solver reaplicado e poses finitas.

**Reter a7792f05 como progresso CPU parcial.** Nenhuma promoção/no-slide/AAA; nenhum nativev13 executado ou reservado. Root coordena eventual recorte nativo após ler o ganho e as regressões material/angular. A prova nativa anterior continua ligada à c402 e seus GLBs históricos, sem reatribuição.

Reprodução delimitada, destino novo obrigatório:

```sh
node output/arpg-animation/backward-v13/witness-runner.mjs \
  output/arpg-animation/backward-v13/candidate /tmp/bipx-v13-new-trace
python3 output/arpg-animation/backward-v13/compare.py /tmp/bipx-v13-new-trace
node output/arpg-animation/backward-v13/refresh-zero.mjs \
  output/arpg-animation/backward-v13/candidate /tmp/bipx-v13-refresh-new
python3 output/arpg-animation/backward-v13/analyze.py
python3 output/arpg-animation/backward-v13/finalize.py
```

`analyze.py` e `finalize.py` usam os traces congelados do pacote; o comparador aceita o replay independente. O auditor e os critérios físicos8mm/3mm/.05m/s não foram modificados.
