/* =========================================================
   14-excel-io.js  |  Gerador de Fluxograma
   Excel nativo (.xlsx) via SheetJS: baixar modelo, exportar e importar a BASE.

   Formato da planilha (aba "Fluxo"):
     - Bloco de cabeçalho (campos do topo do processo)
     - Tabela: Nº | Área | Atividade | Tipo | Sistema | Tempo | Cor | Não (Nº destino)
   Regras:
     - "Sim" das decisões é automático (próxima atividade da sequência).
     - "Não" é o Nº da atividade destino (coluna "Não (Nº destino)").
     - Ajustes visuais (lados, rótulos, terminais, posições) NÃO vêm no Excel — isso é JSON.
   Não toca no pipeline do SVG Excel (08-excel.js).
   ========================================================= */

const EXCEL_CAMPOS_TOPO = [
  ["Desenho", "desenho"],
  ["Nome do Processo", "processo"],
  ["Analista", "analista"],
  ["Negócio", "negocio"],
  ["Área", "area"],
  ["Gestor", "gestor"],
  ["Valor FTE (h/mês)", "valorFTE"],
  ["Volumetria (exec./mês)", "volumetria"]
];

const EXCEL_COLS_TABELA = ["Nº", "Área", "Atividade", "Tipo", "Sistema", "Tempo", "Cor", "Não (Nº destino)"];

const EXCEL_CORES_EN_PT = { white: "Branco", blue: "Azul", yellow: "Amarelo", green: "Verde", red: "Vermelho" };
const EXCEL_CORES_PT_EN = { branco: "white", azul: "blue", amarelo: "yellow", verde: "green", vermelho: "red" };

function excelLibDisponivel() {
  if (typeof XLSX === "undefined") {
    mostrarToast("Biblioteca de Excel não carregou. Verifique a conexão e recarregue a página.", "erro");
    return false;
  }
  return true;
}

function excelValorTopo(campo) {
  const el = document.getElementById(campo);
  return el ? String(el.value || "").trim() : "";
}

function excelNomeArquivo(sufixo) {
  const proc = excelValorTopo("processo") || "fluxo";
  let base = proc.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (!base) base = "fluxo";
  return base + (sufixo ? ("_" + sufixo) : "") + ".xlsx";
}

function excelCorParaPT(corEN) {
  return EXCEL_CORES_EN_PT[String(corEN || "").toLowerCase()] || "Branco";
}

function excelCorParaEN(corTexto) {
  const c = String(corTexto || "").trim().toLowerCase();
  const en = EXCEL_CORES_PT_EN[c] || c;
  return (typeof normalizarCor === "function") ? normalizarCor(en)
    : (["blue", "yellow", "green", "red", "white"].includes(en) ? en : "white");
}

// ---------- Monta o array-de-arrays da planilha ----------
function excelConstruirAOA(incluirDados) {
  const aoa = [];
  aoa.push(["GERADOR DE FLUXOGRAMA — BASE DO PROCESSO"]);
  aoa.push([]);
  aoa.push(["CABEÇALHO DO PROCESSO"]);
  aoa.push(EXCEL_CAMPOS_TOPO.map(([rot]) => rot));                                   // labels (horizontal)
  aoa.push(EXCEL_CAMPOS_TOPO.map(([, campo]) => incluirDados ? excelValorTopo(campo) : "")); // valores
  aoa.push([]);
  aoa.push(['ATIVIDADES  —  o "Sim" das decisões é automático (próxima atividade). Em "Não (Nº destino)" coloque o Nº da atividade para onde vai o "Não".']);
  aoa.push(EXCEL_COLS_TABELA.slice());                                               // cabeçalho da tabela

  if (incluirDados && Array.isArray(fluxoData)) {
    const validas = fluxoData.filter(l => String(l.atividade || "").trim() !== "");
    const uidParaNum = {};
    validas.forEach((l, i) => { uidParaNum[l.uid] = i + 1; });
    validas.forEach((l, i) => {
      const naoNum = (l.proxNao && uidParaNum[l.proxNao]) ? uidParaNum[l.proxNao] : "";
      aoa.push([i + 1, l.area || "", l.atividade || "", l.tipo || "", l.sistema || "", l.tempo || "", excelCorParaPT(l.cor), naoNum]);
    });
  } else {
    // Exemplos (apague antes de importar)
    aoa.push([1, "Financeira", "Receber NF (exemplo — apague)", "", "SAP", "5min", "Branco", ""]);
    aoa.push([2, "Financeira", "NF válida? (exemplo — apague)", "Decisão", "", "2min", "Amarelo", 4]);
    aoa.push([3, "Fiscal", "Lançar NF (exemplo — apague)", "", "TOTVS", "3min", "Verde", ""]);
    aoa.push([4, "Financeira", "Devolver ao fornecedor (exemplo — apague)", "", "E-mail", "4min", "Vermelho", ""]);
  }
  return aoa;
}

function excelBaixar(aoa, nomeArquivo) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 42 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fluxo");
  XLSX.writeFile(wb, nomeArquivo);
}

function baixarModeloExcel() {
  if (!excelLibDisponivel()) return;
  try {
    excelBaixar(excelConstruirAOA(false), "modelo_fluxo.xlsx");
    mostrarToast("Modelo Excel baixado. Preencha e use 'Importar Excel'.", "ok");
  } catch (e) {
    console.error(e);
    mostrarToast("Não foi possível gerar o modelo.", "erro");
  }
}

function exportarExcelNativo() {
  if (!excelLibDisponivel()) return;
  if (!Array.isArray(fluxoData) || !fluxoData.length) {
    mostrarToast("Não há etapas para exportar.", "alerta");
    return;
  }
  try {
    excelBaixar(excelConstruirAOA(true), excelNomeArquivo(""));
    mostrarToast("Excel exportado.", "ok");
  } catch (e) {
    console.error(e);
    mostrarToast("Não foi possível exportar o Excel.", "erro");
  }
}

// ---------- Import ----------
function excelAOAparaBase(aoa) {
  const norm = s => String(s == null ? "" : s).trim();
  const rotToCampo = {};
  EXCEL_CAMPOS_TOPO.forEach(([r, c]) => { rotToCampo[norm(r).toLowerCase()] = c; });
  // rótulos exclusivos do cabeçalho (não colidem com colunas da tabela, ex.: "Área")
  const EXCLUSIVOS = new Set(["desenho", "nome do processo", "analista", "negócio", "gestor", "valor fte (h/mês)", "volumetria (exec./mês)"]);

  // 1) cabeçalho da tabela: primeira célula "Nº"
  let idxHeader = -1;
  for (let i = 0; i < aoa.length; i++) {
    const c0 = norm((aoa[i] || [])[0]).toLowerCase();
    if (c0 === "nº" || c0 === "no" || c0 === "n°" || c0 === "num" || c0 === "n") { idxHeader = i; break; }
  }

  // 2) linha de labels do cabeçalho do processo: a que tem mais rótulos exclusivos (antes da tabela)
  let idxLabels = -1, melhor = 0;
  const limite = idxHeader < 0 ? aoa.length : idxHeader;
  for (let i = 0; i < limite; i++) {
    let cont = 0;
    (aoa[i] || []).forEach(cel => { if (EXCLUSIVOS.has(norm(cel).toLowerCase())) cont++; });
    if (cont > melhor) { melhor = cont; idxLabels = i; }
  }
  const topo = {};
  if (idxLabels >= 0) {
    const labels = aoa[idxLabels] || [];
    const valores = aoa[idxLabels + 1] || [];
    labels.forEach((cel, ci) => {
      const campo = rotToCampo[norm(cel).toLowerCase()];
      if (campo !== undefined) topo[campo] = norm(valores[ci]);
    });
  }

  // 3) tabela de atividades
  const linhas = [];
  if (idxHeader >= 0) {
    for (let i = idxHeader + 1; i < aoa.length; i++) {
      const r = aoa[i] || [];
      const atividade = norm(r[2]);
      if (!atividade) continue;
      linhas.push({
        num: norm(r[0]),
        area: norm(r[1]) || "Sem Área",
        atividade,
        tipo: norm(r[3]) || "Não informado",
        sistema: norm(r[4]) || "Sem sistema informado",
        tempo: norm(r[5]),
        cor: excelCorParaEN(r[6]),
        naoNum: norm(r[7])
      });
    }
  }
  return { topo, linhas };
}

function excelAplicarBase(base) {
  const topo = base.topo || {};
  const linhas = base.linhas || [];
  if (!linhas.length) {
    mostrarToast("Não encontrei atividades na planilha. Confira se usou o modelo (coluna 'Nº' e 'Atividade').", "alerta");
    return;
  }

  EXCEL_CAMPOS_TOPO.forEach(([rot, campo]) => {
    if (topo[campo] !== undefined) preencherCampoSeExistir(campo, topo[campo]);
  });

  fluxoData = [];
  uidCounter = 1;
  const numParaUid = {};

  linhas.forEach((l) => {
    const uid = gerarUID();
    if (l.num) numParaUid[l.num] = uid;
    fluxoData.push({
      uid, ordem: 0, id: "",
      area: l.area, atividade: l.atividade, tipo: l.tipo, sistema: l.sistema,
      tempo: l.tempo, coluna: 1, linha: 1, colunaManual: false, linhaManual: false, cor: l.cor,
      proxSim: "", proxSimAuto: false, proxNao: "", extras: [],
      _naoNum: l.naoNum
    });
  });

  fluxoData.forEach((l) => {
    l.proxNao = (l._naoNum && numParaUid[l._naoNum]) ? numParaUid[l._naoNum] : "";
    delete l._naoNum;
  });

  // distribui coluna/linha automaticamente (senão as caixas ficam sobrepostas em 1x1)
  reaplicarSugestoesPosicao();
  reaplicarSugestoesConexao(true); // Sim = próxima atividade
  atualizarTabela();
  salvarEstadoLocal(true);
  mostrarToast("Base importada do Excel. Clique em GERAR FLUXO para visualizar.", "ok");
}

function importarExcelNativo(event) {
  const input = event && event.target ? event.target : null;
  const file = input && input.files && input.files[0];
  if (!file) return;

  const nome = String(file.name || "").toLowerCase();
  const ehBinario = nome.endsWith(".xlsx") || nome.endsWith(".xls") || nome.endsWith(".xlsm");
  const finalizar = () => { if (input) input.value = ""; };

  const reader = new FileReader();

  if (ehBinario) {
    if (!excelLibDisponivel()) { finalizar(); return; }
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        excelAplicarBase(excelAOAparaBase(aoa));
      } catch (e) {
        console.error(e);
        mostrarToast("Não consegui ler o .xlsx. Ele foi gerado pelo modelo da ferramenta?", "erro");
      } finally { finalizar(); }
    };
    reader.onerror = () => { mostrarToast("Falha ao ler o arquivo.", "erro"); finalizar(); };
    reader.readAsArrayBuffer(file);
  } else {
    // fallback: texto (CSV/TSV) no mesmo layout de colunas
    reader.onload = () => {
      try {
        const txt = String(reader.result || "").replace(/^\uFEFF/, "");
        const aoa = txt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
          .filter(l => l.trim() !== "")
          .map(l => {
            if (l.indexOf("\t") >= 0) return l.split("\t");
            return (l.split(";").length > l.split(",").length) ? l.split(";") : l.split(",");
          });
        excelAplicarBase(excelAOAparaBase(aoa));
      } catch (e) {
        console.error(e);
        mostrarToast("Não consegui ler o arquivo de texto.", "erro");
      } finally { finalizar(); }
    };
    reader.onerror = () => { mostrarToast("Falha ao ler o arquivo.", "erro"); finalizar(); };
    reader.readAsText(file, "UTF-8");
  }
}
