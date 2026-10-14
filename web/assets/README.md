# Nie — Sistema de Gestão · Tela de fundo

Resumo para levar a tela de fundo para o projeto no VS Code.

## Arquivos

| Arquivo | Uso |
|---|---|
| `nie-fundo-desktop.svg` | Fundo desktop (1440×900), vetorial — **recomendado** |
| `nie-fundo-mobile.svg` | Fundo mobile (390×844), vetorial |
| `nie-fundo-desktop.png` | Mesmo fundo em PNG 2x (2880×1800) |
| `nie-fundo-mobile.png` | Mesmo fundo em PNG 2x (780×1688) |

As imagens trazem só o fundo (grade + gráfico). A marca **"nie / Sistema de Gestão"** fica em HTML/CSS por cima, para ficar nítida e editável.

Coloque os arquivos em uma pasta de imagens do projeto, por exemplo `src/assets/` ou `public/img/`.

## Paleta

| Token | Cor | Onde aparece |
|---|---|---|
| `--nie-fundo` | `#0D1624` | Fundo |
| `--nie-grade` | `#162235` | Linhas da grade |
| `--nie-borda` | `#2A3B55` | Contorno das barras, linha base |
| `--nie-barra` | `#16233A` | Preenchimento das barras |
| `--nie-circulo` | `#1B2A40` | Círculos decorativos |
| `--nie-destaque` | `#F2A541` | Barra principal, linha de tendência, quadrado da marca |
| `--nie-texto` | `#F2F5F9` | Logotipo "nie" |
| `--nie-texto-2` | `#8FA1B8` | Subtítulo "Sistema de Gestão" |

Cores de destaque alternativas: `#3DBFA8` (verde-água), `#7B95FF` (azul), `#E8664A` (coral).

## Fontes

- **Sora** 700 — logotipo "nie"
- **Manrope** 600 — subtítulo e textos

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@700&family=Manrope:wght@500;600&display=swap">
```

## HTML

```html
<div class="nie-fundo">
  <div class="nie-marca">
    <div class="nie-logo">
      <span class="nie-logo__texto">nie</span>
      <span class="nie-logo__ponto" aria-hidden="true"></span>
    </div>
    <p class="nie-subtitulo">Sistema de Gestão</p>
  </div>

  <!-- conteúdo do app aqui -->
</div>
```

## CSS

```css
:root {
  --nie-fundo: #0D1624;
  --nie-destaque: #F2A541;
  --nie-texto: #F2F5F9;
  --nie-texto-2: #8FA1B8;
}

body { margin: 0; }

.nie-fundo {
  position: relative;
  min-height: 100vh;
  background: var(--nie-fundo) url("assets/nie-fundo-desktop.svg") center / cover no-repeat;
  font-family: "Manrope", sans-serif;
  color: var(--nie-texto);
  overflow: hidden;
}

.nie-marca {
  position: absolute;
  left: 96px;
  bottom: 96px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nie-logo { display: flex; align-items: flex-end; gap: 10px; }

.nie-logo__texto {
  font-family: "Sora", sans-serif;
  font-weight: 700;
  font-size: 128px;
  line-height: 0.9;
  letter-spacing: -5px;
  color: var(--nie-texto);
}

.nie-logo__ponto {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  margin-bottom: 12px;
  background: var(--nie-destaque);
}

.nie-subtitulo {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 5px;
  text-transform: uppercase;
  color: var(--nie-texto-2);
}

/* Celular */
@media (max-width: 600px) {
  .nie-fundo {
    background-image: url("assets/nie-fundo-mobile.svg");
    background-position: top center;
  }
  .nie-marca { left: 32px; bottom: 88px; gap: 10px; }
  .nie-logo__texto { font-size: 84px; letter-spacing: -3px; }
  .nie-logo__ponto { width: 15px; height: 15px; margin-bottom: 8px; }
  .nie-subtitulo { font-size: 14px; letter-spacing: 4px; }
}
```

> Ajuste o caminho em `url("C:\Users\athaualpa.magagnato\OneDrive - PRODESP\Documents\Vscode\Infraestrutura\src\assets")` conforme a pasta onde você salvou as imagens.

## Trocar a cor de destaque

No SVG, substitua `#F2A541` pela nova cor (Ctrl+H no VS Code no arquivo `.svg`) e mude `--nie-destaque` no CSS.
