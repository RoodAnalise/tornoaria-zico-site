# Modelos 3D (.glb) — Tornaria Zico

Esta pasta é onde você coloca os arquivos **.glb** (ou .gltf com texturas .bin/.png)
dos projetos mecânicos. O site carrega tudo direto do navegador, sem servidor.

---

## Como adicionar um modelo

### Opção 1 — só copiar o arquivo (mais simples)

Copie seu `.glb` para esta pasta com um dos nomes abaixo e recarregue a página:

| Aba / Equipamento                    | Nome do arquivo             |
|--------------------------------------|-----------------------------|
| Capa (projeto em destaque)            | `hero.glb`                  |
| Rodapé (modelo em destaque)           | `destaque.glb`              |
| 01 · Esteira de Entrada de Toras     | `eq-01-esteira.glb`         |
| 02 · Stepfeeder Unitizador           | `eq-02-stepfeeder.glb`      |
| 03 · Serra Log Split Saw             | `eq-03-serrasplit.glb`      |
| 04 · Transposição com Tombador       | `eq-04-transposicao.glb`    |
| 05 · Stepfeeder 1.4                  | `eq-05-stepfeeder14.glb`    |
| 06 · Esteira Pulmão Dupla Tração     | `eq-06-pulmao.glb`          |
| 07 · Centrador Tornado 1.4           | `eq-07-centrador.glb`       |
| 08 · Pista de Lâminas 2 Decks        | `eq-08-pista.glb`           |
| 09 · Esteiras de Resíduos            | `eq-09-residuos.glb`        |

### Opção 2 — `manifest.json`

Edite `manifest.json` e aponte o `url`:

```json
"eq-03-serrasplit": {
  "url": "serra-split-v2.glb",
  "nome": "Serra Log Split Saw",
  "autoRotate": true
}
```

### Opção 3 — arrastar e soltar (teste rápido)

Abra o site, vá na aba **Equipamentos** e **arraste o .glb direto por cima do visor**.
O modelo aparece na hora, sem precisar renomear ou recarregar nada.
(use para testar; para publicar de forma definitiva, use a opção 1 ou 2)

---

## Onde conseguir um .glb

| Origem | Como exportar |
|---|---|
| **SolidWorks** | `Arquivo > Salvar Como > glTF/GLB (*.glb)` — marque "Exportar com appearance" |
| **Autodesk Inventor / Fusion 360** | `Publicar > glTF` ou use o plugin glTF para Fusion |
| **Blender** | `Arquivo > Exportar > glTF 2.0` → formato `.glb`, incluir texturas |
| **STEP / IGES (.stp)** | Abra no Fusion 360 ou FreeCAD e exporte como `.glb` |
| **SolidWorks sem glTF nativo** | Plugin *glTF Export for SOLIDWORKS* (gratuito) |

### Dicas para o modelo ficar leve e bonito

- **Reduza as polígonas** — abaixo de 100 mil triângulos o site abre rápido mesmo no celular.
- **Aplicar transformações** antes de exportar (posição/rotação/escala = 1).
- **Métrica real** — se o SolidWorks estiver em milímetros, o modelo aparece gigante.
  Exporte com escala aplicada ou ajuste no Fusion (`Measure > Scale`).
- **Centralize na origem** — `Origem do componente` no SolidWorks, senão o modelo
  aparece fora do enquadramento.
- **Orientação** — se o eixo "para cima" do GLB for o +Y (padrão), o site já mostra
  corretamente. Se o modelo vier deitado, exporte com `+Y Up` marcado.
- **Fundo transparente** — o site usa um fundo próprio; textura alpha não é necessária.

---

## Como o usuário interage com o modelo

| Ação | Resultado |
|---|---|
| Arrastar com o mouse / dedo | Gira o modelo (rotação) |
| Roda do mouse / pinça | Aproxima e afasta (zoom) |
| Arrastar com o botão direito / 2 dedos | Move a câmera (pan) |
| Duplo clique | Recentraliza o modelo |
| Botão ⚙ | Liga/desliga a rotação automática |
| Botão ⛶ | Tela cheia no modelo |
| Arrastar um .glb sobre o visor | Carrega o modelo na hora |

---

## Formatos aceitos

- `.glb` — recomendado (modelo + texturas num arquivo só)
- `.gltf` — funciona, mas o `.bin` e as texturas precisam estar **na mesma pasta**
- `.stp` / `.step` / `.iges` — **não funciona direto**; converta para `.glb` antes
