/* =========================================================
   10-export-app.js  |  Gerador de Fluxograma
   Exports (SVG/PNG/JSON), toasts/overlay, init da app e listeners globais
   (linhas 6319-6663 do script.js original - corte contiguo, sem alteracao de codigo)
   ========================================================= */
/* Insere o cabeçalho do processo (Desenho/Processo/Analista/...) no topo do
   SVG exportado por "Baixar Fluxo"/"Baixar PNG" — só campos preenchidos
   aparecem (obterLinhasCabecalhoProcesso, 06-analise.js), mesma regra usada
   no cabeçalho do PDF. Trabalha em cima do clone que obterSVGPronto()
   devolve (08-excel.js) — NÃO toca nela nem em gerarFluxoExcel, então não
   tem risco nenhum pro golden do Excel. Sem campo preenchido, devolve o SVG
   como veio (sem cabeçalho, sem espaço extra). */
function montarSVGComCabecalho(svg) {
  if (!svg) return svg;
  const linhas = (typeof obterLinhasCabecalhoProcesso === "function") ? obterLinhasCabecalhoProcesso() : [];
  if (!linhas.length) return svg;

  const NS = "http://www.w3.org/2000/svg";
  const larguraOriginal = Number(svg.getAttribute("width")) || 1200;
  const alturaOriginal = Number(svg.getAttribute("height")) || 800;

  const tamanhoFonte = 13;
  const alturaLinha = 18;
  const paddingTopo = 14;
  const paddingBaixo = 10;
  const alturaCabecalho = paddingTopo + linhas.length * alturaLinha + paddingBaixo;

  // Move todo o conteúdo existente pra baixo, abrindo espaço pro cabeçalho.
  const grupoOriginal = document.createElementNS(NS, "g");
  grupoOriginal.setAttribute("transform", `translate(0, ${alturaCabecalho})`);
  while (svg.firstChild) grupoOriginal.appendChild(svg.firstChild);
  svg.appendChild(grupoOriginal);

  linhas.forEach((linha, i) => {
    const texto = document.createElementNS(NS, "text");
    texto.setAttribute("x", "12");
    texto.setAttribute("y", String(paddingTopo + (i + 1) * alturaLinha - 4));
    texto.setAttribute("font-family", CONFIG.fontFamily);
    texto.setAttribute("font-size", String(tamanhoFonte));
    texto.setAttribute("fill", "#111111");
    texto.textContent = linha;
    svg.insertBefore(texto, grupoOriginal);
  });

  svg.setAttribute("height", String(alturaOriginal + alturaCabecalho));
  svg.setAttribute("viewBox", `0 0 ${larguraOriginal} ${alturaOriginal + alturaCabecalho}`);

  return svg;
}

function baixarSVG() {
  const svg = montarSVGComCabecalho(obterSVGPronto());
  if (!svg) return;

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${ultimoNomeArquivo}.svg`;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function _baixarSVGExcelInterno() {
  const svg = gerarFluxoExcel();
  if (!svg) return;

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${gerarNomeArquivo()}_excel.svg`;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baixarFluxo() {
  baixarSVG();
}

/* Wrappers com overlay "Gerando..." para exports pesados (Onda 1) */
async function baixarAnalisePDF() {
  await executarComProcessando("Gerando PDF da análise...", () => _baixarAnalisePDFInterno());
}

function baixarSVGExcel() {
  executarComProcessando("Gerando SVG para Excel...", () => _baixarSVGExcelInterno());
}

function atualizarBarraRolagemSuperior() {
  const wrap = document.getElementById("diagramWrap");
  const topScroll = document.getElementById("diagramScrollTop");
  const topInner = document.getElementById("diagramScrollTopInner");
  const diagram = document.getElementById("diagram");

  if (!wrap || !topScroll || !topInner || !diagram) return;

  topInner.style.width = diagram.scrollWidth + "px";

  topScroll.onscroll = () => {
    wrap.scrollLeft = topScroll.scrollLeft;
  };

  wrap.onscroll = () => {
    topScroll.scrollLeft = wrap.scrollLeft;
  };
}

function inicializarAplicacao() {
  configurarAutoSaveCamposFixos();

  const restaurou = restaurarEstadoLocal();

  atualizarTabela();
  configurarNavegacaoTabTabela();
  renderizarDatalists();

  if (!restaurou && !fluxoData.length) {
    adicionarLinha();
  }

  if (restaurou && !fluxoData.length) {
    adicionarLinha();
  }
}

window.addEventListener("scroll", fecharAutocomplete, true);
window.addEventListener("resize", fecharAutocomplete);

document.addEventListener("click", (event) => {
  const clicouNoInputAutocomplete = event.target.closest(
    'input[data-campo="area"], input[data-campo="tipo"], input[data-campo="sistema"], .autocomplete-box'
  );

  if (!clicouNoInputAutocomplete) {
    fecharAutocomplete();
  }
});

window.addEventListener("beforeunload", () => {
  salvarEstadoLocal(true);
});

window.addEventListener("DOMContentLoaded", inicializarAplicacao);
/* =====================================================================
   ONDA 1 — Feedback (toast/overlay), Decisão, PNG e Projeto JSON
   Bloco aditivo: não altera o motor de roteamento nem a geração do SVG.
===================================================================== */

/* ---------- Toast (substitui os alerts) ---------- */
function garantirToastContainer() {
  let c = document.getElementById("toastContainer");
  if (!c) {
    c = document.createElement("div");
    c.id = "toastContainer";
    document.body.appendChild(c);
  }
  return c;
}

function mostrarToast(mensagem, tipo = "info", duracaoMs = 3200) {
  const container = garantirToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensagem;
  toast.style.pointerEvents = "auto";
  container.appendChild(toast);

  // força reflow para ativar a transição
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 220);
  }, duracaoMs);
}

/* ---------- Overlay "Gerando..." para exports pesados ---------- */
function garantirProcessandoOverlay() {
  let o = document.getElementById("processandoOverlay");
  if (!o) {
    o = document.createElement("div");
    o.id = "processandoOverlay";
    o.innerHTML = `
      <div class="processando-box">
        <div class="processando-spinner"></div>
        <span id="processandoTexto">Gerando...</span>
      </div>`;
    document.body.appendChild(o);
  }
  return o;
}

function mostrarProcessando(texto = "Gerando...") {
  const o = garantirProcessandoOverlay();
  const t = document.getElementById("processandoTexto");
  if (t) t.textContent = texto;
  o.classList.add("show");
}

function esconderProcessando() {
  const o = document.getElementById("processandoOverlay");
  if (o) o.classList.remove("show");
}

/**
 * Executa uma tarefa (sync ou async) com overlay de processamento.
 * Usa duplo requestAnimationFrame para garantir que o overlay pinte
 * antes de iniciar trabalho pesado e síncrono.
 */
function executarComProcessando(texto, tarefa) {
  mostrarProcessando(texto);
  return new Promise((resolve, reject) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        try {
          const r = await tarefa();
          resolve(r);
        } catch (erro) {
          console.error(erro);
          mostrarToast("Erro ao gerar o arquivo. Veja o console para detalhes.", "erro");
          reject(erro);
        } finally {
          esconderProcessando();
        }
      });
    });
  });
}

/* ---------- Decisão: tipo "Decisão" OU texto terminado em "?" ---------- */
function ehDecisao(etapa) {
  if (!etapa) return false;
  if (isPergunta(etapa.atividade || "")) return true;
  const tipo = normalizarEspacos(etapa.tipo || "").toLocaleLowerCase("pt-BR");
  return tipo === "decisão" || tipo === "decisao";
}

/* ---------- Exportar PNG (mantém SVG e PDF intactos) ---------- */
function baixarPNG() {
  const svg = montarSVGComCabecalho(obterSVGPronto());
  if (!svg) {
    mostrarToast("Gere o fluxo primeiro.", "alerta");
    return;
  }

  executarComProcessando("Gerando PNG...", () => new Promise((resolve, reject) => {
    try {
      const serializer = new XMLSerializer();
      const source = serializer.serializeToString(svg);
      const svg64 = "data:image/svg+xml;base64," +
        window.btoa(unescape(encodeURIComponent(source)));

      const largura = Number(svg.getAttribute("width")) || 1200;
      const altura = Number(svg.getAttribute("height")) || 800;
      const escala = 2; // 2x para boa nitidez ao colar em slides/e-mail

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = largura * escala;
        canvas.height = altura * escala;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Falha ao gerar PNG")); return; }
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${ultimoNomeArquivo}.png`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          mostrarToast("PNG gerado com sucesso.", "ok");
          resolve();
        }, "image/png");
      };
      img.onerror = () => reject(new Error("Falha ao carregar SVG para PNG"));
      img.src = svg64;
    } catch (erro) {
      reject(erro);
    }
  }));
}

/* ---------- Exportar projeto (.json) ---------- */
const PROJETO_VERSAO = 1;

function exportarProjetoJSON() {
  if (!fluxoData || !fluxoData.length) {
    mostrarToast("Não há nada para exportar. Monte o fluxo primeiro.", "alerta");
    return;
  }

  const estado = obterEstadoAtual();

  const projeto = {
    app: "gerador_fluxograma",
    versao: PROJETO_VERSAO,
    exportadoEm: new Date().toISOString(),
    estado,
    // Reservado para a Onda 2 (editor de conexões/raias).
    // Mantido aqui desde já para preservar compatibilidade.
    overridesConexoes: (typeof overridesConexoes !== "undefined") ? overridesConexoes : {},
    ordemRaias: (typeof ordemRaias !== "undefined") ? ordemRaias : []
  };

  const nomeBase = gerarNomeArquivo ? gerarNomeArquivo() : (ultimoNomeArquivo || "fluxograma_processo");
  const blob = new Blob([JSON.stringify(projeto, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeBase}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  mostrarToast("Projeto exportado. Guarde o arquivo .json para reabrir depois.", "ok");
}

/* ---------- Importar projeto (.json) ---------- */
function importarProjetoJSON(event) {
  const input = event && event.target ? event.target : null;
  const file = input && input.files && input.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const projeto = JSON.parse(reader.result);

      if (!projeto || typeof projeto !== "object" || !projeto.estado) {
        mostrarToast("Arquivo inválido: não parece um projeto exportado por esta ferramenta.", "erro");
        return;
      }

      // Reaproveita o pipeline de restauração existente:
      // grava o estado no storage e restaura por ele.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projeto.estado));
      const ok = restaurarEstadoLocal();

      // Carrega overrides reservados, se já existirem nesta versão do app.
      if (typeof overridesConexoes !== "undefined" && projeto.overridesConexoes) {
        overridesConexoes = projeto.overridesConexoes;
      }
      if (typeof ordemRaias !== "undefined" && Array.isArray(projeto.ordemRaias)) {
        ordemRaias = projeto.ordemRaias;
      }

      atualizarTabela();
      renderizarDatalists();
      salvarEstadoLocal(true);

      if (ok) {
        mostrarToast("Projeto importado. Clique em Gerar Fluxo para visualizar.", "ok");
      } else {
        mostrarToast("Projeto carregado, mas houve inconsistências ao restaurar.", "alerta");
      }
    } catch (erro) {
      console.error("Erro ao importar projeto:", erro);
      mostrarToast("Não foi possível ler o arquivo. Verifique se é um .json válido.", "erro");
    } finally {
      if (input) input.value = ""; // permite reimportar o mesmo arquivo
    }
  };

  reader.onerror = () => mostrarToast("Falha ao ler o arquivo.", "erro");
  reader.readAsText(file);
}

/* =====================================================================
   ONDA 2 — Editor interativo de conexões e raias
   - Ajuste de lados (saída/entrada) por conexão, via popover
   - Reordenação de raias via painel com setas ↑/↓
   - Tudo persiste no projeto (.json) e não vaza no SVG exportado
===================================================================== */

const LADOS = [
  { lado: "top", icone: "▲", nome: "Cima" },
  { lado: "right", icone: "▶", nome: "Direita" },
  { lado: "bottom", icone: "▼", nome: "Baixo" },
  { lado: "left", icone: "◀", nome: "Esquerda" }
];

