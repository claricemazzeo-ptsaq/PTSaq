/**
 * Seeds Postgres with the real snapshot captured during the design handoff:
 * "Painel Operacional" (Infraestrutura PTSaq.xlsx, updated 27/08/2026) and
 * "Plano de Trabalho" (Plano_de_Trabalho.xlsx), plus the institutional
 * Drive repository listing. This is the same data the Claude Design
 * prototype shipped with — transcribed here instead of re-parsing the raw
 * spreadsheets, since that transcription already resolved the two known
 * data-quality gaps (budget and goal-percentage columns holding row
 * numbers, not real values — see the `budgetCents: null` / no-percentage-
 * invented notes below).
 *
 * Run once against an empty database: `npm run seed`.
 */
import { prisma } from "./db.js";
import { hashPassword } from "./auth/passwords.js";
import { TASK_STATUS_FROM_LABEL, GOAL_STATUS_FROM_LABEL, DOC_STATUS_FROM_LABEL } from "./labels.js";

function parseDate(br: string | undefined): Date | null {
  if (!br || br === "—") return null;
  const [d, m, y] = br.split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function parseBRL(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

const DEPTS = [
  { id: "com", short: "Comunicação", name: "Comunicação" },
  { id: "jur", short: "Jurídico", name: "Jurídico-Institucional & Licitações" },
  { id: "tec", short: "Tecnologia", name: "Tecnologia & Inovação" },
  { id: "adm", short: "Administrativo", name: "Administrativo, Operações e Infraestrutura" },
];

const USERS = [
  { id: "andre", name: "André", email: "andre@saquarema.rj.gov.br", role: "admin" as const, title: "Executivo · Super-admin", dept: null, job: "Diretor executivo" },
  { id: "ana", name: "Ana Flávia", email: "ana.flavia@saquarema.rj.gov.br", role: "lead" as const, title: "Líder · Jurídico", dept: "jur", job: "Coordenadora jurídica e de licitações" },
  { id: "clarice", name: "Clarice", email: "clarice@saquarema.rj.gov.br", role: "lead" as const, title: "Líder · Comunicação", dept: "com", job: "Coordenadora de comunicação" },
  { id: "ailton", name: "Ailton", email: "ailton@saquarema.rj.gov.br", role: "lead" as const, title: "Líder · Tecnologia", dept: "tec", job: "Coordenador de tecnologia e inovação" },
  { id: "gabriel", name: "Gabriel", email: "gabriel@saquarema.rj.gov.br", role: "lead" as const, title: "Líder · Administrativo", dept: "adm", job: "Coordenador administrativo e de infraestrutura" },
  { id: "rhanon", name: "Rhanon", email: "rhanon@saquarema.rj.gov.br", role: "contrib" as const, title: "Equipe · Infraestrutura", dept: "adm", job: "Marcenaria, sinalização e acabamento" },
  { id: "carlos", name: "Carlos", email: "carlos@saquarema.rj.gov.br", role: "contrib" as const, title: "Equipe · Obras e manutenção", dept: "adm", job: "Obras, elétrica e hidráulica" },
];

const TASKS = [
  { id: "T1", d: "adm", frente: "Infraestrutura e Espaço Físico", title: "Recepção: marcenaria (projeto, logos, arquivos, LEDs); acompanhamento e qualidade.", owner: "Rhanon", status: "Em execução", due: "31/08/2026", budget: "R$ 38.000,00", note: "Precisa do Termo de cessão de uso.", goalId: "2.4", cell: "Painel Operacional!B4" },
  { id: "T2", d: "adm", frente: "Infraestrutura e Espaço Físico", title: "Correções no prédio: relatório, acompanhamento, elétrica e hidráulica.", owner: "Carlos", status: "Em execução", due: "31/08/2026", cell: "Painel Operacional!B5" },
  { id: "T3", d: "adm", frente: "Infraestrutura e Espaço Físico", title: "Sala temporária: mesa e cadeira.", owner: "Carlos", status: "Executado", due: "06/08/2026", cell: "Painel Operacional!B6" },
  { id: "T4", d: "com", frente: "Infraestrutura e Espaço Físico", title: "Adesivação de salas.", owner: "Clarice", status: "Em execução", due: "30/09/2026", note: "Aguardando Projeto Cerberus.", cell: "Painel Operacional!B7" },
  { id: "T5", d: "com", frente: "Comunicação", title: "Comunicação: redes sociais (Agência Inova, PTSaq); logo vetorizada.", owner: "Clarice", status: "Executado", due: "—", cell: "Painel Operacional!B8" },
  { id: "T6", d: "jur", frente: "Jurídico-Institucional", title: "Plano de negócios", owner: "Ana Flávia", status: "Executado", due: "11/08/2026", goalId: "1.1", cell: "Painel Operacional!B9" },
  { id: "T7", d: "jur", frente: "Jurídico-Institucional", title: "Oficializar o Conselho Técnico", owner: "Ana Flávia", status: "Em execução", due: "25/09/2026", goalId: "2.2", cell: "Painel Operacional!B10" },
  { id: "T8", d: "jur", frente: "Jurídico-Institucional", title: "Termo de cessão de uso do espaço", owner: "Ana Flávia", status: "Em execução", due: "30/09/2026", goalId: "1.4", cell: "Painel Operacional!B11" },
  { id: "T9", d: "jur", frente: "Jurídico-Institucional", title: "Lei de inovação de Saquarema", owner: "Ana Flávia", status: "Em execução", due: "31/10/2026", note: "Depende da Assembleia Legislativa.", contested: true, conflictSheetStatus: "Justificada", cell: "Painel Operacional!B12" },
  { id: "T10", d: "jur", frente: "Jurídico-Institucional", title: "Regimento interno", owner: "Ana Flávia", status: "Executado", due: "31/08/2026", goalId: "2.3", cell: "Painel Operacional!B13" },
  { id: "T11", d: "jur", frente: "Jurídico-Institucional", title: "Edital de chamamento das empresas", owner: "Ana Flávia", status: "Em execução", due: "31/08/2026", goalId: "3.4.1", cell: "Painel Operacional!B14" },
  { id: "T12", d: "jur", frente: "Jurídico-Institucional", title: "Decreto de constituição do programa PTSaq", owner: "Ana Flávia", status: "Em execução", due: "15/10/2026", cell: "Painel Operacional!B15" },
  { id: "T13", d: "jur", frente: "Licitações e Contratações", title: "Licitação de segurança", owner: "Ana Flávia", status: "Em execução", due: "10/10/2026", cell: "Painel Operacional!B16" },
  { id: "T14", d: "jur", frente: "Licitações e Contratações", title: "Contratação de internet", owner: "Ana Flávia", status: "Em execução", due: "—", cell: "Painel Operacional!B17" },
  { id: "T15", d: "jur", frente: "Licitações e Contratações", title: "Licitação de mobiliário", owner: "Ana Flávia", status: "Executado", due: "—", cell: "Painel Operacional!B18" },
  { id: "T16", d: "jur", frente: "Licitações e Contratações", title: "Licitação de computadores", owner: "Ana Flávia", status: "Executado", due: "—", cell: "Painel Operacional!B19" },
  { id: "T17", d: "jur", frente: "Licitações e Contratações", title: "Licitação de limpeza", owner: "Ana Flávia", status: "Executado", due: "—", cell: "Painel Operacional!B20" },
  { id: "T18", d: "adm", frente: "Mapeamento e Pesquisa", title: "Mapeamento do ecossistema de inovação", owner: "Gabriel, Mário", status: "Executado", due: "—", goalId: "1.9", cell: "Painel Operacional!B21" },
  { id: "T19", d: "adm", frente: "Mapeamento e Pesquisa", title: "Mapeamento de empresas / clientes", owner: "Gabriel, Mário", status: "Executado", due: "—", goalId: "1.9", cell: "Painel Operacional!B22" },
  { id: "T20", d: "tec", frente: "Capacitação / Geral", title: "Plano de estudos", owner: "Geral", status: "Em execução", due: "—", cell: "Painel Operacional!B23" },
  { id: "T21", d: "tec", frente: "Infraestrutura e Espaço Físico", title: "Sala de podcast: estruturação do espaço", owner: "Ailton, Clarice", status: "Não iniciado", due: "—", goalId: "2.5", cell: "Painel Operacional!B24" },
  { id: "T22", d: "jur", frente: "Jurídico-Institucional", title: "Verificar e viabilizar a entrega do plano de negócios", owner: "Ana Flávia", status: "Em execução", due: "—", cell: "Painel Operacional!B25" },
  { id: "T23", d: "jur", frente: "Jurídico-Institucional", title: "Plano de viabilidade econômico-financeira", owner: "Ana Flávia", status: "Não iniciado", due: "31/08/2026", goalId: "1.2", cell: "Painel Operacional!B26" },
  { id: "T24", d: "adm", frente: "Infraestrutura e Espaço Físico", title: "Desenvolver projeto arquitetônico da área de convivência", owner: "Barbara", status: "Em execução", due: "—", cell: "Painel Operacional!B27" },
];

const METAS = [
  { id: "1.1", d: "jur", title: "Plano de Negócios Integrado", owner: "Ana", sched: "Mês 4", status: "Concluída" },
  { id: "1.2", d: "jur", title: "Estudo de Viabilidade Econômico Financeira — estrutura, valores, parâmetros", owner: "Ana", sched: "Mês 5", status: "A iniciar", due: "15/09/2026" },
  { id: "1.3", d: "jur", title: "Planejamento Estratégico de metas e indicadores", owner: "Ana", sched: "Mês 1 ao 6", status: "A iniciar", due: "30/09/2026" },
  { id: "1.4", d: "jur", title: "Estudo jurídico e operacional de cessão de uso", owner: "Ana", sched: "Mês 5, 6 e 7", status: "Em andamento" },
  { id: "1.7", d: "com", title: "Plano Mestre de Comunicação", owner: "Clarice, André", sched: "Mês 3 ao 9", status: "Em andamento", due: "05/09/2026" },
  { id: "1.8", d: "com", title: "Estratégia de Disseminação Científica", owner: "Clarice", sched: "Mês 5 ao 10", status: "Em andamento" },
  { id: "1.9", d: "adm", title: "Mapeamento de Clusters", owner: "Gabriel", sched: "Mês 6 ao 12", status: "Em andamento" },
  { id: "2.1", d: "adm", title: "Implantação da equipe técnica", owner: "André", sched: "Mês 1, 2 e 3", status: "Em andamento", due: "30/11/2026" },
  { id: "2.2", d: "jur", title: "Instituição do Comitê Técnico Científico — reunião pendente", owner: "Ana", sched: "Mês 2, 3 e 4", status: "Em andamento", due: "30/09/2026" },
  { id: "2.3", d: "jur", title: "Elaboração de normas e regimento interno — revisão e procedimentos internos", owner: "Ana", sched: "Mês 4, 5 e 6", status: "Em andamento", due: "04/09/2026" },
  { id: "2.4", d: "adm", title: "Ambientação mínima dos prédios disponibilizados", owner: "Barbara", sched: "Mês 1 ao 6", status: "Em andamento", due: "30/09/2026" },
  { id: "2.5", d: "tec", title: "Estruturar espaços institucionais de atendimento, coworking e reunião", owner: "Ailton", sched: "Mês 1 ao 6", status: "Em andamento", due: "30/09/2026" },
  { id: "2.6", d: "tec", title: "Implantar infraestrutura de conectividade e rede lógica básica", owner: "Ailton", sched: "Mês 1 ao 7", status: "A iniciar", due: "07/09/2026" },
  { id: "2.7", d: "adm", title: "Instituir sistema de controle e protocolo da OS", owner: "Alyne", sched: "Mês 6, 7 e 8", status: "Em andamento" },
  { id: "2.8", d: "com", title: "Criação da identidade visual provisória · Cerberus", owner: "Clarice", sched: "Mês 3, 4 e 5", status: "Concluída" },
  { id: "2.9", d: "com", title: "Site institucional", owner: "Clarice", sched: "Mês 4, 5 e 6", status: "Concluída" },
  { id: "3.1", d: "adm", title: "Criação e operacionalização da incubadora de empresas", owner: "Barbara", sched: "Mês 24", status: "A iniciar", flag: "Cronograma “Mês 24” fora do horizonte do plano; confirmar com a coordenação." },
  { id: "3.1.2", d: "adm", title: "Implantar estrutura física e modelo de operação", owner: "Barbara / Sanson", sched: "Mês 1 ao 10", status: "A iniciar", flag: "Numeração sem 3.1.1 na planilha de origem." },
  { id: "3.1.3", d: "adm", title: "Realizar processo seletivo para incubação", owner: "Raphael Sanson", sched: "Mês 10, 11 e 12", status: "A iniciar" },
  { id: "3.2", d: "jur", title: "Implementação do Programa Sandbox Saquarema", owner: "Ana", sched: "—", status: "A iniciar" },
  { id: "3.2.1", d: "jur", title: "Regulamentar e lançar o Sandbox", owner: "Ana", sched: "Mês 4 a 10", status: "A iniciar" },
  { id: "3.2.2", d: "jur", title: "Selecionar e implementar projetos piloto", owner: "Ana / Clarice / Mário", sched: "Mês 10 a 14", status: "Em andamento" },
  { id: "3.3", d: "tec", title: "Programa de capacitação para profissões do futuro", owner: "Ailton", sched: "—", status: "A iniciar" },
  { id: "3.3.1", d: "tec", title: "Elaborar e lançar trilhas formativas tecnológicas", owner: "Ailton", sched: "Mês 5 a 10", status: "A iniciar" },
  { id: "3.3.2", d: "tec", title: "Executar capacitações e formações técnicas", owner: "Ailton", sched: "Mês 10 a 16", status: "A iniciar" },
  { id: "3.4", d: "jur", title: "Programa de residência de empresas de base tecnológica", owner: "—", sched: "—", status: "A iniciar" },
  { id: "3.4.1", d: "jur", title: "Estruturar edital de residência", owner: "Ana", sched: "Mês 1 a 10", status: "Em andamento" },
  { id: "3.4.2", d: "tec", title: "Selecionar empresas residentes", owner: "Ailton", sched: "Mês 10 a 15", status: "A iniciar" },
  { id: "4.1.1", d: "tec", title: "Firmar parcerias técnicas e científicas", owner: "Ailton", sched: "Mês 1 a 12", status: "Em andamento" },
  { id: "4.1.2", d: "tec", title: "Projetos P&D com ICTs em andamento", owner: "Ailton", sched: "Mês 1 a 18", status: "A iniciar" },
  { id: "4.2.1", d: "adm", title: "Implantar equipe e estrutura de captação", owner: "André", sched: "Mês 1 a 6", status: "A iniciar" },
  { id: "4.2.2", d: "adm", title: "Submeter projetos a agências de fomento", owner: "André", sched: "Mês 1 a 24", status: "A iniciar" },
  { id: "4.3.1", d: "com", title: "Agenda de Eventos de Difusão Tecnológica", owner: "Clarice", sched: "Mês 1 a 24", status: "Em andamento" },
  { id: "4.3.2", d: "tec", title: "Engajar estudantes e empreendedores locais", owner: "Ailton / Mário", sched: "Mês 1 a 24", status: "A iniciar" },
];

const DOCS: Array<{ id: string; d: string | null; type: string; title: string; v: string; up: string; size: string; status: string; tasks: string[]; note?: string }> = [
  { id: "D1", d: "jur", type: "PDF", title: "Termo de cessão de uso do espaço", v: "v3", up: "26/08/2026", size: "1.4", status: "Aguardando assinatura", tasks: ["T8", "T1"], note: "Duas assinaturas pendentes: Prefeitura e PTSaq." },
  { id: "D2", d: "jur", type: "DOCX", title: "Decreto de constituição do programa PTSaq", v: "v2", up: "25/08/2026", size: "0.086", status: "Em revisão", tasks: ["T12"] },
  { id: "D3", d: "jur", type: "PDF", title: "Edital de chamamento das empresas", v: "v5", up: "24/08/2026", size: "2.1", status: "Em revisão", tasks: ["T11", "3.4.1"] },
  { id: "D4", d: "jur", type: "DOCX", title: "Lei de inovação de Saquarema — minuta", v: "v7", up: "22/08/2026", size: "0.124", status: "Aguardando assinatura", tasks: ["T9"], note: "Em tramitação na Assembleia Legislativa." },
  { id: "D5", d: "jur", type: "PDF", title: "Regimento interno", v: "v1", up: "18/08/2026", size: "0.64", status: "Aprovado", tasks: ["T10", "2.3"] },
  { id: "D6", d: "jur", type: "PDF", title: "Plano de Negócios Integrado", v: "v4", up: "11/08/2026", size: "5.8", status: "Aprovado", tasks: ["T6", "1.1"] },
  { id: "D7", d: "com", type: "PDF", title: "Cerberus Brandbook — Saquarema", v: "v1.0", up: "19/06/2026", size: "18.2", status: "Aprovado", tasks: ["T4", "2.8"] },
  { id: "D8", d: "com", type: "DOCX", title: "Plano Mestre de Comunicação", v: "v2", up: "23/08/2026", size: "0.21", status: "Em revisão", tasks: ["1.7"] },
  { id: "D9", d: "com", type: "SVG", title: "Marca PTSaq — formatos principais", v: "v1", up: "19/06/2026", size: "0.32", status: "Aprovado", tasks: ["T5"] },
  { id: "D10", d: "adm", type: "PDF", title: "Projeto de marcenaria da recepção", v: "v3", up: "21/08/2026", size: "9.4", status: "Aguardando assinatura", tasks: ["T1", "2.4"], note: "Liberação condicionada ao Termo de cessão." },
  { id: "D11", d: "adm", type: "PDF", title: "Planta da área de convivência", v: "v1", up: "20/08/2026", size: "7.7", status: "Em revisão", tasks: ["T24"] },
  { id: "D12", d: "adm", type: "XLSX", title: "Mapeamento do ecossistema de inovação", v: "v2", up: "15/08/2026", size: "1.1", status: "Aprovado", tasks: ["T18", "1.9"] },
  { id: "D13", d: "tec", type: "PDF", title: "Especificação de rede e conectividade", v: "v2", up: "23/08/2026", size: "3.2", status: "Em revisão", tasks: ["2.6"] },
  { id: "D14", d: "tec", type: "DOCX", title: "Trilhas formativas tecnológicas — ementa", v: "v1", up: "19/08/2026", size: "0.096", status: "Em revisão", tasks: ["3.3.1"] },
  { id: "D15", d: null, type: "XLSX", title: "Painel Operacional", v: "—", up: "27/08/2026", size: "0.48", status: "Aprovado", tasks: [] },
  { id: "D16", d: null, type: "XLSX", title: "Plano de Trabalho", v: "—", up: "26/08/2026", size: "0.512", status: "Aprovado", tasks: [] },
  { id: "D17", d: null, type: "PDF", title: "Estatuto do Parque Tecnológico de Saquarema", v: "v2", up: "10/08/2026", size: "1.9", status: "Aprovado", tasks: ["1.1"] },
];

const DEFAULT_DEPS: Record<string, string> = { T4: "T8", T1: "T8", T11: "T12" };

const PENDING_ACCOUNTS = [
  { name: "Mário Lemos", email: "mario.lemos@saquarema.rj.gov.br", dept: "tec" },
  { name: "Bárbara Nunes", email: "barbara.nunes@saquarema.rj.gov.br", dept: "adm" },
];

const SEED_PASSWORD = "ptsaq2026-seed"; // demo credential — see README "Seed accounts"

async function main() {
  console.log("Seeding departments…");
  for (const d of DEPTS) {
    await prisma.department.upsert({ where: { id: d.id }, create: d, update: d });
  }

  console.log("Seeding users…");
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const userIdByName = new Map<string, string>();
  for (const u of USERS) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        title: u.title,
        departmentId: u.dept,
        status: "active",
      },
      update: {},
    });
    userIdByName.set(u.name, created.id);
  }

  console.log("Seeding tasks…");
  for (const t of TASKS) {
    await prisma.task.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        departmentId: t.d,
        frente: t.frente,
        title: t.title,
        ownerName: t.owner,
        status: TASK_STATUS_FROM_LABEL[t.status],
        dueDate: parseDate(t.due),
        budgetCents: parseBRL(t.budget),
        note: t.note || null,
        contested: !!t.contested,
        conflictSheetStatus: t.conflictSheetStatus ? TASK_STATUS_FROM_LABEL[t.conflictSheetStatus] : null,
        conflictAt: t.contested ? new Date() : null,
        goalId: t.goalId || null,
        sheetCell: t.cell,
      },
      update: {},
    });
  }
  // second pass: wire dependencies once every task row exists
  for (const [blockedId, blockerId] of Object.entries(DEFAULT_DEPS)) {
    await prisma.task.update({ where: { id: blockedId }, data: { blockedByTaskId: blockerId } });
  }
  // best-effort owner linking: match the task's free-text owner to a seeded user by first name
  for (const t of TASKS) {
    const firstName = t.owner.split(",")[0].split("/")[0].trim().split(" ")[0];
    const match = USERS.find((u) => u.name.split(" ")[0] === firstName);
    if (match) {
      await prisma.task.update({ where: { id: t.id }, data: { ownerId: userIdByName.get(match.name) } });
    }
  }

  console.log("Seeding goals…");
  // sheetCell is a best-effort guess (row 1 = header, goals in this array's
  // order from row 2) — the design handoff captured real per-cell refs for
  // tasks but not for goals. writeGoalCells() re-resolves the actual row by
  // title match before every live write, so this only has to be right
  // enough to bootstrap that lookup — see googleSync.ts resolveCurrentRow().
  for (const [i, m] of METAS.entries()) {
    const firstName = m.owner.split(",")[0].split("/")[0].trim().split(" ")[0];
    const match = USERS.find((u) => u.name.split(" ")[0] === firstName);
    await prisma.goal.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        departmentId: m.d,
        title: m.title,
        ownerName: m.owner,
        ownerId: match ? userIdByName.get(match.name) : null,
        schedule: m.sched === "—" ? null : m.sched,
        status: GOAL_STATUS_FROM_LABEL[m.status],
        dueDate: parseDate(m.due),
        flag: m.flag || null,
        sheetCell: `Plano de Trabalho!B${i + 2}`,
      },
      update: {},
    });
  }

  console.log("Seeding documents…");
  for (const doc of DOCS) {
    const created = await prisma.document.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        departmentId: doc.d,
        type: doc.type,
        title: doc.title,
        version: doc.v === "—" ? null : doc.v,
        sizeBytes: Math.round(Number(doc.size) * 1024 * 1024),
        status: DOC_STATUS_FROM_LABEL[doc.status],
        note: doc.note || null,
        driveUpdatedAt: parseDate(doc.up),
      },
      update: {},
    });
    for (const linkId of doc.tasks) {
      const isTask = linkId.startsWith("T");
      await prisma.documentLink.upsert({
        where: {
          documentId_taskId_goalId: {
            documentId: created.id,
            taskId: isTask ? linkId : null as unknown as string,
            goalId: isTask ? (null as unknown as string) : linkId,
          },
        },
        create: { documentId: created.id, taskId: isTask ? linkId : null, goalId: isTask ? null : linkId },
        update: {},
      }).catch(() => void 0);
    }
  }

  console.log("Seeding pinned documents (Clarice: D1, D7)…");
  const clarice = await prisma.user.findUnique({ where: { email: "clarice@saquarema.rj.gov.br" } });
  if (clarice) {
    for (const docId of ["D1", "D7"]) {
      await prisma.pinnedDocument.upsert({
        where: { userId_documentId: { userId: clarice.id, documentId: docId } },
        create: { userId: clarice.id, documentId: docId },
        update: {},
      });
    }
  }

  console.log("Seeding pending account requests…");
  for (const p of PENDING_ACCOUNTS) {
    await prisma.pendingAccountRequest.upsert({
      where: { email: p.email },
      create: { name: p.name, email: p.email, departmentId: p.dept },
      update: {},
    });
  }

  console.log("Seeding activity feed seed rows…");
  const feed = [
    { who: "Carlos", what: "atualizou o relatório de correções no prédio" },
    { who: "Clarice", what: "anexou a v5 do Edital ao repositório" },
    { who: "André", what: "marcou “Lei de inovação” como Justificada na planilha" },
    { who: "Ailton", what: "abriu a meta 2.6 · conectividade" },
  ];
  for (const f of feed) {
    const userId = userIdByName.get(f.who);
    if (userId) await prisma.activityEntry.create({ data: { userId, summary: f.what } });
  }

  console.log(`Done. Seed accounts share the password "${SEED_PASSWORD}" — see README.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
