# Corte v3 — revisão independente da correção de braços

Root inspecionou os PNGs originais do Walker em.38/.90s, Orc em.90s e um frame de gameplay natural após o corte. Paths e hashes estão em `v3-cut-arms-followup.json`. A fonte runtime coincide com a candidata final `e37398db9fa3d02294cd5abb4929a52afc6caa84678f465fa099f62c61b63371`, promovida pelo dono Animation.

O defeito específico da mão desconectada suspensa não aparece mais nos dois frames corrigidos do Walker. Mãos e braços acompanham o torso; sombras não mostram a peça solta da revisão anterior. A correção atende a esse achado localizado. As metades ainda ficam visualmente próximas e os braços podem apoiar o torso: a silhueta do cadáver parece dobrada, especialmente no Orc. Isso permanece uma limitação de leitura artística, não um novo erro de descarte ou uma alegação de ragdoll.

Na captura real `death-cut-warrior-high-settled.png`, o cadáver aparece à esquerda/acima do guerreiro e não há a mão flutuante vista no primeiro v3. A escala da câmera, os inimigos vivos e os efeitos sobrepostos tornam a separação das metades menos evidente que na fixture. Um PNG não prova a qualidade temporal de queda/corte durante a luta. Root não inspecionou o vídeo completo nesta revisão e não atribui nota AAA.

O relatório nativo `arpg-animation-cut-v3-arms-final/report.json` declara fonte estável, render passado e zero erros. `arms-cpu.json` declara16casos aprovados; são provas do candidato, não benchmarks de horda. `animation-cut-v3-handoff.md` registra a prova integrada com entrada real, morte única e expiração. Essas evidências não aprovam locomoção, performance móvel, áudio ou12dimensões JEF.

A revisão com mão suspensa e suas imagens/hashes em `v3-cut-followup.*` continua preservada como histórico. Próxima prioridade Animation: continuidade de sola e ré rápida do dwarf em staging; acabamento adicional de separação/pose exige comparação de movimento na câmera do jogo.
