# Copas v3 — suavidade da junção e acúmulo de máscaras

Root leu shader04f3a377, plano nativo e12checks de `output/environment/canopy-transition-v3/cpu.json`. O código preserva o modo legado, uniforms, passe compartilhado, dressing1edbc6 e demais assets. A análise da derivada prova a remoção da quina no exemplo analítico, não a causa de toda borda angular observada no PNG.

O próprio relatório mostra um tradeoff: a união `a+b-a*b` dá.1,.19,.3439,.65132156 para1/2/4/10máscaras iguais a.1. O `max` anterior permanece.1. Como o contorno é aproximadamente.12, essa mudança pode revelar folhagem antes intacta apenas pela quantidade de raios semelhantes. O limite de10ameaças torna o efeito finito, mas não torna seu impacto artístico desprezível. Mudanças de conjunto durante combate precisam ser consideradas antes de chamar o resultado estável ou equivalente.

**Reter v3 e preparar alternativa CPU em nova cópia**, sem repetir native agora. Suavizar junções com crescimento controlado por sobreposição, explicitando raios duplicados/quase coincidentes e os mesmos1/2/4/10witnesses. A escolha deve balancear continuidade e preservação do cenário, mantendo corredores necessários para corpos e áreas de skills; não otimizar apenas a derivada no encontro. Fórmula e margem não estão arbitrariamente fixadas por Root.

O próximo candidato selecionado pelo dono após essa análise pode seguir ao par curto1.2s contra v2 live, já autorizado após janelas Combat e VFXdash coordenadas. Painel fechado pelo fluxo normal, retículo/folhas/atores normalizados, RGBA19x19 e color/depth inalterados. Novo render continua necessário para arte; nenhuma promoção automática. A versão v2 já integrada permanece intacta.
