import {
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  NodeResizer,
  Panel,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  Bot,
  BrainCircuit,
  Braces,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Cloud,
  Code2,
  Contact,
  Copy,
  Database,
  FileInput,
  FileOutput,
  FileText,
  GitBranch,
  Globe2,
  GripVertical,
  Image,
  KeyRound,
  Layers2,
  Lightbulb,
  ListChecks,
  MapPin,
  Megaphone,
  MessageSquare,
  Menu,
  MoreHorizontal,
  Network,
  Paperclip,
  Plus,
  Search,
  Settings2,
  Sparkles,
  StickyNote,
  ShieldCheck,
  Trash2,
  Target,
  WandSparkles,
  Waypoints,
  X,
  Zap,
} from "lucide-react";
type AwsArchitectureIconKey = keyof typeof import("@aws-icons/react/architecture-service");

type NodeKind =
  | "input"
  | "aws"
  | "llm"
  | "agent"
  | "prompt"
  | "memory"
  | "knowledge"
  | "logic"
  | "tools"
  | "data"
  | "integration"
  | "output"
  | "business"
  | "freeform";
type FreeformType = "text" | "image" | "file" | "link";
type FlowNodeData = {
  label: string;
  kind: NodeKind;
  sublabel: string;
  icon: keyof typeof icons;
  freeformType?: FreeformType;
  notes?: string;
  tokenLimit?: string;
  attachment?: {
    id: string;
    name: string;
    contentType: string;
    sizeBytes: number;
    url: string;
  };
  linkUrl?: string;
  collapsedBranches?: boolean;
  collapsedBranchCount?: number;
  branchCount?: number;
  toggleBranches?: () => void;
  previewImage?: () => void;
};
type GroupData = {
  label: string;
  description?: string;
  tint?: string;
  opacity?: number;
  notes?: string;
  collapsed?: boolean;
  memberCount?: number;
  expandedWidth?: number;
  expandedHeight?: number;
};

const icons = {
  Bot,
  BrainCircuit,
  Braces,
  Cloud,
  Code2,
  Database,
  FileInput,
  FileOutput,
  FileText,
  GitBranch,
  Globe2,
  Image,
  Layers2,
  Lightbulb,
  ListChecks,
  MapPin,
  Megaphone,
  MessageSquare,
  Network,
  Paperclip,
  Settings2,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Target,
  Waypoints,
  UsersRound: Contact,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  Contact,
  WandSparkles,
  Zap,
};
const categoryMeta: Record<
  NodeKind,
  { name: string; color: string; icon: keyof typeof icons }
> = {
  input: { name: "Entrada", color: "#3b82f6", icon: "FileInput" },
  llm: { name: "LLM", color: "#8b5cf6", icon: "BrainCircuit" },
  aws: { name: "AWS Cloud", color: "#e97926", icon: "Cloud" },
  agent: { name: "Agente", color: "#6366f1", icon: "Bot" },
  prompt: { name: "Prompt", color: "#f59e0b", icon: "MessageSquare" },
  memory: { name: "Memória", color: "#06b6d4", icon: "Network" },
  knowledge: { name: "Conhecimento", color: "#10b981", icon: "Database" },
  logic: { name: "Lógica", color: "#f97316", icon: "GitBranch" },
  tools: { name: "Ferramentas", color: "#ec4899", icon: "WandSparkles" },
  data: { name: "Dados", color: "#14b8a6", icon: "Database" },
  integration: { name: "Integrações", color: "#64748b", icon: "Zap" },
  output: { name: "Saída", color: "#4f46e5", icon: "FileOutput" },
  business: { name: "Estratégia", color: "#0f766e", icon: "Target" },
  freeform: { name: "Bloco livre", color: "#be5a20", icon: "StickyNote" },
};

const freeformTypeMeta: Record<FreeformType, { color: string }> = {
  text: { color: "#c76120" },
  image: { color: "#8b5cf6" },
  file: { color: "#2563d9" },
  link: { color: "#0f766e" },
};

function getFreeformType(data: Pick<FlowNodeData, "label" | "freeformType">): FreeformType {
  if (data.freeformType) return data.freeformType;
  if (data.label === "Imagem") return "image";
  if (data.label === "Arquivo") return "file";
  if (data.label === "Link") return "link";
  return "text";
}

function getNodeMeta(data: Pick<FlowNodeData, "kind" | "label" | "freeformType">) {
  const meta = categoryMeta[data.kind];
  return data.kind === "freeform"
    ? { ...meta, color: freeformTypeMeta[getFreeformType(data)].color }
    : meta;
}

function linkDisplayName(url?: string) {
  if (!url) return "Site, pesquisa ou fonte";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || "Link de referência";
  }
}
function safeExternalUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function attachmentDisplayName(attachment?: FlowNodeData["attachment"]) {
  if (!attachment) return null;
  const size = attachment.sizeBytes >= 1_000_000
    ? `${(attachment.sizeBytes / 1_000_000).toFixed(1)} MB`
    : attachment.sizeBytes >= 1_000
      ? `${Math.round(attachment.sizeBytes / 1_000)} KB`
      : `${attachment.sizeBytes} B`;
  return `${attachment.name} · ${size}`;
}

type CatalogEntry = {
  label: string;
  sublabel: string;
  kind: NodeKind;
  icon?: keyof typeof icons;
};
const businessCatalog: Array<
  CatalogEntry & { freeformType: FreeformType }
> = [
  {
    label: "Texto livre",
    sublabel: "Ideias, contexto e anotações",
    kind: "freeform",
    icon: "StickyNote",
    freeformType: "text",
  },
  {
    label: "Imagem",
    sublabel: "Referência visual ou mockup por URL",
    kind: "freeform",
    icon: "Image",
    freeformType: "image",
  },
  {
    label: "Arquivo",
    sublabel: "Documento, planilha ou anexo",
    kind: "freeform",
    icon: "Paperclip",
    freeformType: "file",
  },
  {
    label: "Link",
    sublabel: "Site, pesquisa ou fonte por URL",
    kind: "freeform",
    icon: "Globe2",
    freeformType: "link",
  },
];

const awsIconAliases: Record<string, AwsArchitectureIconKey> = {
  "Amazon Bedrock": "AmazonBedrock",
  "Amazon Bedrock AgentCore": "AmazonBedrockAgentCore",
  "Amazon Bedrock Knowledge Bases": "AmazonBedrock",
  "Knowledge Bases": "AmazonBedrock",
  "AWS Lambda": "AwsLambda",
  "Amazon S3": "AmazonSimpleStorageService",
  "Amazon S3 Glacier": "AmazonSimpleStorageServiceGlacier",
  "Amazon DynamoDB": "AmazonDynamoDb",
  "Amazon API Gateway": "AmazonApiGateway",
  "API Gateway": "AmazonApiGateway",
  "Amazon EventBridge": "AmazonEventBridge",
  "Amazon EC2": "AmazonEc2",
  "Amazon EC2 Auto Scaling": "AmazonEc2AutoScaling",
  "Amazon EC2 Image Builder": "AmazonEc2ImageBuilder",
  "Amazon ECS": "AmazonElasticContainerService",
  "Amazon ECR": "AmazonElasticContainerRegistry",
  "Amazon EKS": "AmazonElasticKubernetesService",
  "AWS Fargate": "AwsFargate",
  "AWS Elastic Beanstalk": "AwsElasticBeanstalk",
  "AWS App Runner": "AwsAppRunner",
  "Amazon RDS": "AmazonRds",
  "Amazon Aurora": "AmazonAurora",
  "Amazon OpenSearch Service": "AmazonOpenSearchService",
  "Amazon Simple Queue Service (SQS)": "AmazonSimpleQueueService",
  "Amazon Simple Notification Service (SNS)": "AmazonSimpleNotificationService",
  "AWS Step Functions": "AwsStepFunctions",
  "Amazon MQ": "AmazonMq",
  "Amazon CloudFront": "AmazonCloudFront",
  "Amazon Route 53": "AmazonRoute53",
  "Amazon Cognito": "AmazonCognito",
  "AWS Identity and Access Management (IAM)": "AwsIdentityAndAccessManagement",
  "IAM Identity Center": "AwsIamIdentityCenter",
  "AWS Key Management Service (KMS)": "AwsKeyManagementService",
  "AWS Secrets Manager": "AwsSecretsManager",
  "AWS WAF": "AwsWaf",
  "AWS Shield": "AwsShield",
  "Amazon GuardDuty": "AmazonGuardDuty",
  "Amazon CloudWatch": "AmazonCloudWatch",
  "AWS CloudFormation": "AwsCloudFormation",
  "AWS CloudTrail": "AwsCloudTrail",
  "Amazon SageMaker AI": "AmazonSageMakerAi",
  "Amazon SageMaker": "AmazonSageMaker",
  "AWS AppSync": "AwsAppSync",
};

const titleToAwsIconKey = (label: string) =>
  label
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("") as AwsArchitectureIconKey;

function AwsServiceIcon({
  label,
  size = 16,
}: {
  label: string;
  size?: number;
}) {
  const [icons, setIcons] = useState<typeof import("@aws-icons/react/architecture-service") | null>(null);
  useEffect(() => {
    let active = true;
    void import("@aws-icons/react/architecture-service").then((loaded) => {
      if (active) setIcons(loaded);
    });
    return () => { active = false; };
  }, []);
  const Icon =
    icons?.[awsIconAliases[label] || titleToAwsIconKey(label)];
  return Icon ? (
    <Icon width={size} height={size} aria-label={`Ícone ${label}`} />
  ) : (
    <Cloud size={size} aria-label={`AWS ${label}`} />
  );
}

const browserProjectKey = "graphflow-whiteboard-v2";
const apiBaseUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:5275").replace(
  /\/$/,
  "",
);
function attachmentUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    if (/^\/api\/attachments\/[0-9a-f-]{36}\/content$/i.test(parsed.pathname)) {
      return `${apiBaseUrl}${parsed.pathname}`;
    }
  } catch {
    return "";
  }
  return "";
}

type BranchVisibilityData = {
  hiddenByBranch?: string;
  hiddenByBranches?: string[];
};

function branchVisibilityOwners(data: BranchVisibilityData) {
  const owners = Array.isArray(data.hiddenByBranches)
    ? data.hiddenByBranches
    : data.hiddenByBranch ? [data.hiddenByBranch] : [];
  return [...new Set(owners)];
}

function updateBranchVisibility<T extends object>(data: T, sourceId: string, shouldCollapse: boolean) {
  const visibilityData = data as T & BranchVisibilityData;
  const currentOwners = branchVisibilityOwners(visibilityData);
  const owners = shouldCollapse
    ? [...new Set([...currentOwners, sourceId])]
    : currentOwners.filter((owner) => owner !== sourceId);
  const { hiddenByBranch: _legacyOwner, hiddenByBranches: _owners, ...cleanData } = visibilityData;
  return {
    data: {
      ...cleanData,
      ...(owners.length ? { hiddenByBranches: owners } : {}),
    } as T,
    hidden: owners.length > 0,
  };
}

function FlowNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const meta = getNodeMeta(data);
  const Icon = icons[data.icon] || icons[meta.icon];
  const freeformType = data.kind === "freeform" ? getFreeformType(data) : null;
  const isImageAttachment = Boolean(
    freeformType === "image" && data.attachment?.contentType.startsWith("image/"),
  );
  const attachmentInfo = attachmentDisplayName(data.attachment);
  const contentPreview =
    freeformType === "link"
      ? linkDisplayName(data.linkUrl)
      : freeformType === "file" && attachmentInfo
        ? attachmentInfo
        : data.sublabel;
  return (
    <div
      className={`flow-node ${selected ? "selected" : ""} ${freeformType ? `flow-node-${freeformType}` : ""} ${isImageAttachment ? "has-image-preview" : ""}`}
      style={{ "--node-color": meta.color } as React.CSSProperties}
    >
      {isImageAttachment && (
        <NodeResizer
          minWidth={260}
          minHeight={205}
          isVisible={selected}
          lineClassName="image-resize-line"
          handleClassName="image-resize-handle"
        />
      )}
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <div className="node-icon">
          {data.kind === "aws" ? (
            <AwsServiceIcon label={data.label} size={17} />
          ) : (
            <Icon size={17} />
          )}
        </div>
        <div className="node-copy">
          <strong>{data.label}</strong>
          {freeformType === "link" && safeExternalUrl(data.linkUrl) ? (
            <a
              className="node-link-preview"
              href={safeExternalUrl(data.linkUrl) || undefined}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              {contentPreview}
            </a>
          ) : (
            <span className={freeformType === "file" && attachmentInfo ? "node-file-preview" : ""}>
              {freeformType === "file" && attachmentInfo && <Paperclip size={9} />}
              {contentPreview}
            </span>
          )}
        </div>
        <MoreHorizontal size={15} className="node-more" />
      </div>
      {isImageAttachment && (
        <button
          type="button"
          className="node-image-preview"
          onClick={(event) => {
            event.stopPropagation();
            data.previewImage?.();
          }}
          title="Clique para ampliar"
        >
          <img src={attachmentUrl(data.attachment?.url || "")} alt={`Prévia: ${data.attachment?.name || data.label}`} />
          <span>Clique para ampliar</span>
        </button>
      )}
      {data.collapsedBranches && (
        <span className="branch-count">{data.collapsedBranchCount || 0}</span>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className={
          data.branchCount
            ? `branch-handle ${data.collapsedBranches ? "is-collapsed" : "is-open"}`
            : ""
        }
        title={
          data.branchCount
            ? data.collapsedBranches
              ? `Mostrar ${data.collapsedBranchCount || data.branchCount} ${(data.collapsedBranchCount || data.branchCount) === 1 ? "card" : "cards"}`
              : `Ocultar ${data.branchCount} ${data.branchCount === 1 ? "card conectado" : "cards conectados"}`
            : undefined
        }
        onClick={(event) => {
          if (!data.branchCount) return;
          event.stopPropagation();
          data.toggleBranches?.();
        }}
      />
    </div>
  );
}

function GroupNode({ data, selected }: NodeProps<Node<GroupData>>) {
  return (
    <div
      className={`group-node ${selected ? "selected" : ""} ${data.collapsed ? "collapsed" : ""}`}
      style={
        {
          "--group-tint": data.tint || "#5b55c7",
          "--group-opacity": `${data.opacity ?? 10}%`,
        } as React.CSSProperties
      }
    >
      <NodeResizer
        minWidth={280}
        minHeight={180}
        isVisible={selected}
        lineClassName="group-resize-line"
        handleClassName="group-resize-handle"
      />
      <div className="group-label">
        <span>{data.label}</span>
        <small>
          {data.collapsed
            ? `${data.memberCount || 0} cards compactados · duplo clique para abrir`
            : data.description}
        </small>
      </div>
    </div>
  );
}

type Account = { id: string; email: string };
type AuthMode = "login" | "register" | null;
type AuthSubmission = { fullName?: string; phone?: string; email: string; password: string; confirmPassword?: string };

function formatBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length < 3) return `(${digits}`;
  const area = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 4) return `(${area}) ${number}`;
  if (digits.length <= 10) return `(${area}) ${number.slice(0, 4)}-${number.slice(4)}`;
  return `(${area}) ${number.slice(0, 5)}-${number.slice(5)}`;
}

function passwordRequirementError(password: string) {
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^\w\s]/.test(password)) {
    return "Use pelo menos 12 caracteres, com letra maiúscula, minúscula, número e símbolo.";
  }
  return null;
}
type BoardSummary = {
  id: string;
  title: string;
  version: number;
  updatedAt: string;
};
type BoardPage = {
  items: BoardSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  ownedBoardCount: number;
  maxBoards: number;
};
type BoardFilters = {
  page?: number;
  query?: string;
  updatedFrom?: string;
  updatedTo?: string;
};

function boardDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function BoardLibrary({
  account,
  boards,
  page,
  loading,
  error,
  creating,
  onCreate,
  onOpen,
  onLoad,
  onRename,
  onDelete,
  onLogout,
}: {
  account: Account;
  boards: BoardSummary[];
  page: BoardPage;
  loading: boolean;
  error: string | null;
  creating: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onLoad: (filters?: BoardFilters) => void;
  onRename: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onLogout: () => void;
}) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [filters, setFilters] = useState<BoardFilters>({});
  const [dateFiltersOpen, setDateFiltersOpen] = useState(false);
  const [renaming, setRenaming] = useState<BoardSummary | null>(null);
  const [deleting, setDeleting] = useState<BoardSummary | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const searchTimer = useRef<number | null>(null);

  const requestBoards = (next: BoardFilters, nextPage = 1) => {
    const request = { ...next, page: nextPage };
    if (request.updatedFrom && request.updatedTo && request.updatedFrom > request.updatedTo) {
      setActionError("A data inicial não pode ser posterior à data final.");
      return;
    }
    setActionError(null);
    setFilters(request);
    onLoad(request);
  };
  const scheduleSearch = (value: string) => {
    setQuery(value);
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    const normalized = value.trim();
    if (normalized.length > 0 && normalized.length < 3) return;
    searchTimer.current = window.setTimeout(() => {
      requestBoards({ ...filters, query: normalized.length >= 3 ? normalized : undefined });
    }, normalized ? 1500 : 0);
  };
  const updateDateFilter = (field: "updatedFrom" | "updatedTo", value: string) => {
    if (field === "updatedFrom") setUpdatedFrom(value);
    else setUpdatedTo(value);
    requestBoards({ ...filters, [field]: value || undefined });
  };
  const clearDateFilters = () => {
    setUpdatedFrom("");
    setUpdatedTo("");
    setDateFiltersOpen(false);
    requestBoards({ ...filters, updatedFrom: undefined, updatedTo: undefined });
  };
  useEffect(() => () => {
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
  }, []);
  const saveRename = async () => {
    if (!renaming) return;
    const title = renameTitle.trim();
    if (!title) {
      setActionError("Dê um nome ao board antes de salvar.");
      return;
    }
    setActionBusy(`rename-${renaming.id}`);
    setActionError(null);
    const changed = await onRename(renaming.id, title);
    setActionBusy(null);
    if (changed) setRenaming(null);
  };
  const confirmDeleteBoard = async (board: BoardSummary) => {
    setActionBusy(`delete-${board.id}`);
    setActionError(null);
    const deleted = await onDelete(board.id);
    setActionBusy(null);
    if (deleted) {
      setDeleting(null);
      requestBoards(filters, page.items.length === 1 && page.page > 1 ? page.page - 1 : page.page);
    } else {
      setActionError("Não foi possível excluir este board. Tente novamente.");
    }
  };
  useEffect(() => {
    if (!deleting) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !actionBusy) setDeleting(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [actionBusy, deleting]);
  const boardLimitReached = page.ownedBoardCount >= page.maxBoards;
  return (
    <main className="board-library">
      <header className="board-library-header">
        <div className="library-brand">
          <span><Sparkles size={17} /></span>
          ligue<strong>os</strong>pontos
        </div>
        <div className="library-account">
          <span>{account.email}</span>
          <button onClick={onLogout}>Sair</button>
        </div>
      </header>
      <section className="board-library-main">
        <div className="library-intro">
          <div>
            <p>SEU ESPAÇO PRIVADO</p>
            <h1>Seus boards, <em>em contexto.</em></h1>
            <span>Todos os seus mapas ficam separados por conta e sincronizados com segurança.</span>
          </div>
          <button className="library-create" onClick={onCreate} disabled={creating || boardLimitReached} title={boardLimitReached ? `Limite de ${page.maxBoards} boards atingido` : undefined}>
            <Plus size={18} /> {creating ? "Criando…" : "Novo board"}
          </button>
        </div>
        <div className="library-board-controls">
          <label className="library-search">
            <Search size={16} />
            <input value={query} onChange={(event) => scheduleSearch(event.target.value)} placeholder="Busque por título" maxLength={120} aria-label="Busque boards por título" />
            {query ? <button type="button" onClick={() => scheduleSearch("")} aria-label="Limpar busca"><X size={14} /></button> : null}
          </label>
          <div className="library-date-filter">
            <button className={`library-date-trigger ${filters.updatedFrom || filters.updatedTo ? "active" : ""}`} type="button" onClick={() => setDateFiltersOpen((open) => !open)} aria-expanded={dateFiltersOpen} aria-controls="library-date-options"><CalendarDays size={15} /> Filtrar por data</button>
            {dateFiltersOpen ? <div className="library-date-options" id="library-date-options">
              <label>Atualizado de<input type="date" value={updatedFrom} onChange={(event) => updateDateFilter("updatedFrom", event.target.value)} aria-label="Atualizado a partir de" /></label>
              <label>até<input type="date" value={updatedTo} onChange={(event) => updateDateFilter("updatedTo", event.target.value)} aria-label="Atualizado até" /></label>
              {(filters.updatedFrom || filters.updatedTo) ? <button type="button" onClick={clearDateFilters}>Limpar datas</button> : null}
            </div> : null}
          </div>
        </div>
        <div className="library-toolbar">
          <span>{loading ? "Carregando boards…" : `${page.totalCount} ${page.totalCount === 1 ? "board encontrado" : "boards encontrados"} · ${page.ownedBoardCount}/${page.maxBoards} usados`}</span>
          <div className="library-view-toggle" aria-label="Visualização dos boards">
            <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Visualizar em blocos"><Layers2 size={16} /></button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="Visualizar em lista"><ListChecks size={17} /></button>
          </div>
        </div>
        {error || actionError ? <p className="library-error">{error || actionError}</p> : null}
        {boardLimitReached ? <p className="library-limit">Você alcançou o limite de {page.maxBoards} boards desta conta. Exclua um board para criar outro.</p> : null}
        {!loading && !error && boards.length === 0 ? (
          <button className="library-empty" onClick={onCreate} disabled={creating || boardLimitReached}>
            <span><Plus size={22} /></span>
            <strong>Comece o próximo mapa</strong>
            <small>Crie um board para conectar ideias, arquivos, links e decisões.</small>
          </button>
        ) : (
          <div className={`board-library-items ${view}`}>
            {boards.map((board, index) => (
              <article className="board-library-item" key={board.id}>
                <button className="board-library-item-open" onClick={() => onOpen(board.id)} aria-label={`Abrir ${board.title}`}>
                  <span className="board-item-index">{String((page.page - 1) * page.pageSize + index + 1).padStart(2, "0")}</span>
                  <span className="board-item-art"><i /><i /><i /></span>
                  <span className="board-item-copy">
                    <strong>{board.title}</strong>
                    <small>Atualizado {boardDate(board.updatedAt)}</small>
                  </span>
                  <ChevronRight className="board-item-arrow" size={18} />
                </button>
                {deleting?.id === board.id ? <span className="board-delete-confirm" aria-label={`Confirmar exclusão de ${board.title}`}>
                  <strong>Excluir?</strong>
                  <button type="button" onClick={() => setDeleting(null)} disabled={Boolean(actionBusy)} aria-label="Cancelar exclusão"><X size={14} /></button>
                  <button type="button" onClick={() => void confirmDeleteBoard(board)} disabled={Boolean(actionBusy)}>{actionBusy ? "…" : "Excluir"}</button>
                </span> : <span className="board-item-actions" aria-label={`Ações de ${board.title}`}>
                  <button type="button" onClick={() => { setRenaming(board); setRenameTitle(board.title); setActionError(null); }} aria-label={`Renomear ${board.title}`}><FileText size={15} /></button>
                  <button type="button" onClick={() => { setDeleting(board); setActionError(null); }} disabled={Boolean(actionBusy)} aria-label={`Excluir ${board.title}`}><Trash2 size={15} /></button>
                </span>}
              </article>
            ))}
          </div>
        )}
        {!loading && !error && page.totalPages > 1 ? <nav className="library-pagination" aria-label="Paginação de boards">
          <button type="button" disabled={page.page === 1} onClick={() => requestBoards(filters, page.page - 1)}>Anterior</button>
          <span>Página {page.page} de {page.totalPages}</span>
          <button type="button" disabled={page.page === page.totalPages} onClick={() => requestBoards(filters, page.page + 1)}>Próxima</button>
        </nav> : null}
      </section>
      {renaming ? <div className="library-dialog-backdrop" role="presentation" onMouseDown={() => !actionBusy && setRenaming(null)}>
        <form className="library-dialog" onSubmit={(event) => { event.preventDefault(); void saveRename(); }} onMouseDown={(event) => event.stopPropagation()}>
          <p>RENOMEAR BOARD</p>
          <h2>Escolha um nome claro.</h2>
          <label>Nome do board<input autoFocus value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} maxLength={160} /></label>
          <div><button type="button" onClick={() => setRenaming(null)} disabled={Boolean(actionBusy)}>Cancelar</button><button type="submit" disabled={Boolean(actionBusy)}>{actionBusy ? "Salvando…" : "Salvar nome"}</button></div>
        </form>
      </div> : null}
    </main>
  );
}

function LandingBoardPreview() {
  const [collapsed, setCollapsed] = useState(false);
  const [compactLayout, setCompactLayout] = useState(() => window.matchMedia("(max-width: 600px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 600px)");
    const syncLayout = () => setCompactLayout(query.matches);
    query.addEventListener("change", syncLayout);
    return () => query.removeEventListener("change", syncLayout);
  }, []);
  const demoNodes = useMemo<Node<FlowNodeData>[]>(
    () => [
      {
        id: "idea",
        type: "flowNode",
        position: compactLayout ? { x: 10, y: 155 } : { x: 185, y: 185 },
        data: {
          label: "Plano de lançamento",
          sublabel: "Ideias, contexto e anotações",
          kind: "freeform",
          freeformType: "text",
          icon: "StickyNote",
          branchCount: 2,
          collapsedBranches: collapsed,
          collapsedBranchCount: 3,
          toggleBranches: () => setCollapsed((value) => !value),
        },
      },
      ...(!collapsed
        ? [
            {
              id: "research",
              type: "flowNode",
              position: compactLayout ? { x: 250, y: 20 } : { x: 485, y: 82 },
              data: { label: "Pesquisa de mercado", sublabel: "Fonte e sinais do segmento", kind: "freeform", freeformType: "link", icon: "Globe2" },
            },
            {
              id: "references",
              type: "flowNode",
              position: compactLayout ? { x: 250, y: 155 } : { x: 485, y: 284 },
              data: { label: "Referências visuais", sublabel: "Direção e inspirações", kind: "freeform", freeformType: "image", icon: "Image" },
            },
            {
              id: "briefing",
              type: "flowNode",
              position: compactLayout ? { x: 250, y: 290 } : { x: 785, y: 185 },
              data: { label: "Briefing aprovado", sublabel: "Documento de contexto", kind: "freeform", freeformType: "file", icon: "Paperclip" },
            },
          ] as Node<FlowNodeData>[]
        : []),
    ],
    [collapsed, compactLayout],
  );
  const demoEdges = useMemo<Edge[]>(
    () =>
      collapsed
        ? []
        : compactLayout
          ? [
              { id: "idea-research", source: "idea", target: "research", animated: true },
              { id: "idea-references", source: "idea", target: "references", animated: true },
              { id: "idea-briefing", source: "idea", target: "briefing", animated: true },
            ]
          : [
            { id: "idea-research", source: "idea", target: "research", animated: true },
            { id: "idea-references", source: "idea", target: "references", animated: true },
            { id: "research-briefing", source: "research", target: "briefing", animated: true },
            { id: "references-briefing", source: "references", target: "briefing", animated: true },
          ],
    [collapsed, compactLayout],
  );

  return (
    <section className="landing-canvas-preview landing-board-demo" aria-label="Demonstração somente leitura do whiteboard">
      <header className="landing-demo-toolbar">
        <span className="landing-demo-menu"><Menu size={16} /></span>
        <span className="landing-demo-status"><i /> Exemplo de workspace</span>
        <span className="landing-demo-hint">Componente real · somente demonstração</span>
      </header>
      <aside className="landing-demo-catalog" aria-hidden="true">
        <strong>BLOCOS</strong>
        <span data-demo-type="text"><FileText size={14} /> Texto livre</span>
        <span data-demo-type="image"><Image size={14} /> Imagem</span>
        <span data-demo-type="file"><Paperclip size={14} /> Arquivo</span>
        <span data-demo-type="link"><Globe2 size={14} /> Link</span>
      </aside>
      <ReactFlow
        className="landing-demo-flow"
        nodes={demoNodes}
        edges={demoEdges}
        nodeTypes={{ flowNode: FlowNode }}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} color="#d7daf0" />
        <MiniMap pannable={false} zoomable={false} nodeColor={(node) => getNodeMeta(node.data as FlowNodeData).color} />
      </ReactFlow>
      <button className="landing-demo-toggle" type="button" onClick={() => setCollapsed((value) => !value)}>{collapsed ? "Mostrar conexões" : "Compactar conexões"} <span aria-hidden="true">{collapsed ? "+" : "−"}</span></button>
    </section>
  );
}

function LandingPage({
  mode,
  onModeChange,
  onSubmit,
  onExplore,
  busy,
  error,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (data: AuthSubmission, mode: Exclude<AuthMode, null>) => void;
  onExplore: () => void;
  busy: boolean;
  error: string | null;
}) {
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>(".landing-scroll-reveal");
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Navegação principal">
        <a className="landing-brand" href="#inicio" aria-label="ligueospontos, voltar ao início"><span className="landing-brand-mark"><Waypoints size={19} /></span>ligue<span>os</span>pontos</a>
        <div className="landing-nav-links"><a href="#produto">O produto</a><a href="#como-funciona">Como funciona</a><a href="#para-quem">Para quem é</a></div>
        <div className="landing-nav-actions">
          <button className="landing-login" onClick={() => onModeChange("login")}>Entrar</button>
          <button className="landing-cta-small" onClick={onExplore}>Começar agora <ChevronRight size={15} /></button>
        </div>
      </nav>
      <section className="landing-hero" id="inicio">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow"><span />Seu espaço para pensar com clareza</div>
          <h1>Quando tudo parece solto, <em>ligue os pontos.</em></h1>
          <p>Ideias, imagens, arquivos e links no mesmo mapa. Conecte o que importa, esconda o ruído e enxergue seu próximo passo.</p>
          <div className="landing-actions">
            <button className="landing-cta" onClick={onExplore}>Começar meu mapa <ChevronRight size={18} /></button>
            <a className="landing-explore" href="#produto">Ver a ferramenta em ação <ChevronRight size={16} /></a>
          </div>
          <div className="landing-hero-quiet"><span className="landing-hero-check">✓</span> Experimente sem criar conta. Comece em um clique.</div>
        </div>
        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-visual-grid" />
          <svg className="landing-visual-lines" viewBox="0 0 500 490" fill="none"><path d="M95 145 C150 145 135 232 210 232" /><path d="M381 109 C314 113 338 200 277 216" /><path d="M119 382 C190 378 151 285 222 268" /><path d="M383 359 C323 352 340 288 281 267" /></svg>
          <span className="landing-orbit landing-orbit-one"><Lightbulb size={15} /> ideia</span>
          <span className="landing-orbit landing-orbit-two"><Globe2 size={15} /> referência</span>
          <span className="landing-orbit landing-orbit-three"><Image size={15} /> inspiração</span>
          <span className="landing-orbit landing-orbit-four"><ListChecks size={15} /> próximo passo</span>
          <div className="landing-visual-core"><span className="landing-visual-core-icon"><Waypoints size={29} /></span><span className="landing-visual-core-label">O ponto de encontro</span><strong>Agora faz sentido.</strong><span className="landing-visual-core-sub">Uma visão do todo, sem perder os detalhes.</span></div>
          <span className="landing-visual-stamp">PENSAR MELHOR É CONECTAR MELHOR <span>✳</span></span>
        </div>
      </section>
      <div className="landing-value-line" aria-label="Benefícios principais"><span><Plus size={17} /> Comece sem cadastro</span><span><Network size={17} /> Conecte tudo em um mapa</span><span><ShieldCheck size={17} /> Crie uma conta para sincronizar</span></div>
      <section className="landing-product landing-scroll-reveal" id="produto">
        <div className="landing-section-heading"><div><p className="landing-eyebrow"><span /> Não é só anotar. É enxergar.</p><h2>Da primeira ideia<br />ao <em>panorama completo.</em></h2></div><p>Um quadro visual de verdade, com blocos que se conectam. O exemplo abaixo usa os mesmos componentes do seu workspace: experimente compactar e reabrir as conexões.</p></div>
        <LandingBoardPreview />
        <div className="landing-product-foot"><span><span className="landing-product-pulse" /> Demonstração interativa, sem alterar seus dados</span><button onClick={onExplore}>Criar o meu mapa <ChevronRight size={17} /></button></div>
      </section>
      <section className="landing-building-blocks landing-scroll-reveal" aria-labelledby="landing-blocks-title">
        <div className="landing-building-intro"><p className="landing-eyebrow"><span /> Menos ferramentas abertas. Mais contexto.</p><h2 id="landing-blocks-title">Tudo o que alimenta uma ideia, <em>lado a lado.</em></h2></div>
        <div className="landing-building-grid">
          <article><span className="landing-block-icon" data-type="text"><FileText size={22} /></span><small>01 / PENSAMENTO</small><h3>Texto livre</h3><p>Capture o raciocínio enquanto ele ainda está vivo.</p></article>
          <article><span className="landing-block-icon" data-type="image"><Image size={22} /></span><small>02 / REFERÊNCIA</small><h3>Imagens</h3><p>Dê forma ao que é difícil explicar só com palavras.</p></article>
          <article><span className="landing-block-icon" data-type="file"><Paperclip size={22} /></span><small>03 / EVIDÊNCIA</small><h3>Arquivos</h3><p>Mantenha documentos perto das decisões que eles apoiam.</p></article>
          <article><span className="landing-block-icon" data-type="link"><Globe2 size={22} /></span><small>04 / FONTE</small><h3>Links</h3><p>Guarde o caminho de volta para cada descoberta.</p></article>
        </div>
      </section>
      <section className="landing-method landing-scroll-reveal" id="como-funciona">
        <div className="landing-method-intro">
          <p className="landing-eyebrow"><span /> Um jeito mais leve de organizar o complexo</p>
          <h2>Do “tenho mil coisas na cabeça” ao <em>“agora eu sei por onde ir”.</em></h2>
          <p>Você não precisa começar com um plano perfeito. Comece com uma peça. O resto ganha forma quando as conexões aparecem.</p>
        </div>
        <div className="landing-method-steps">
          <article><b>01</b><div><strong>Jogue no mapa</strong><span>Uma anotação, um print, um documento ou aquele link que você não quer perder.</span></div><Plus size={20} /></article>
          <article><b>02</b><div><strong>Ligue os pontos</strong><span>Arraste, conecte e organize as relações do seu jeito — sem prender seu pensamento a uma lista.</span></div><Network size={20} /></article>
          <article><b>03</b><div><strong>Veja o que importa</strong><span>Compacte ramificações quando precisar de foco. Reabra quando quiser explorar.</span></div><Target size={20} /></article>
        </div>
      </section>
      <section className="landing-audience landing-scroll-reveal" id="para-quem"><div className="landing-audience-heading"><p className="landing-eyebrow"><span /> Seu pensamento não cabe em uma caixa</p><h2>Para quem está criando.<br /><em>Para quem está decidindo.</em></h2></div><div className="landing-audience-grid"><article><div className="landing-audience-number">01 — EXPLORAR</div><h3>Uma ideia merece espaço para crescer.</h3><p>Projetos pessoais, estudos, pesquisa, portfólio ou aquele plano que começou no bloco de notas. Dê um lugar para cada peça e descubra como elas se relacionam.</p><span>Comece simples. Expanda quando fizer sentido.</span></article><article><div className="landing-audience-number">02 — ESTRUTURAR</div><h3>Uma decisão precisa de contexto.</h3><p>Estratégias, oportunidades, reuniões e referências espalhadas deixam de competir pela sua atenção. Visualize dependências e alinhe os próximos passos.</p><span>Mais contexto visível. Menos retrabalho mental.</span></article></div></section>
      <section className="landing-final landing-scroll-reveal"><div className="landing-final-glow" aria-hidden="true" /><p className="landing-eyebrow"><span /> Comece de onde você está</p><h2>Sua próxima boa ideia pode estar <em>entre duas que você já teve.</em></h2><p>Abra um mapa, coloque as peças na mesa e veja o que acontece quando elas finalmente se encontram.</p><div className="landing-final-actions"><button className="landing-cta" onClick={onExplore}>Abrir meu workspace <ChevronRight size={18} /></button><button className="landing-final-account" onClick={() => onModeChange("register")}>Criar uma conta para sincronizar</button></div><p className="landing-local-notice"><strong>Transparência desde o início:</strong> sem conta, seus mapas ficam apenas neste navegador. Para sincronizar com a sua conta e acessar em outro dispositivo, registre-se.</p></section>
      <footer className="landing-footer"><div className="landing-brand"><span className="landing-brand-mark"><Waypoints size={17} /></span>ligue<span>os</span>pontos</div><p>Ideias mais claras. Próximos passos mais visíveis.</p><a href="#inicio">Voltar ao topo ↑</a></footer>
      {mode && <div className="auth-backdrop" role="presentation" onMouseDown={() => !busy && onModeChange(null)}>
        <section className="auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="auth-close" aria-label="Fechar" onClick={() => onModeChange(null)}><X size={19} /></button>
          <div className="auth-panel-mark"><KeyRound size={21} /></div>
          <p className="auth-kicker">SEU WORKSPACE PRIVADO</p>
          <h2 id="auth-title">{mode === "login" ? "Entre no seu workspace." : "Crie seu espaço privado."}</h2>
          <p className="auth-intro">{mode === "login" ? "Acesse seus boards e continue exatamente de onde parou." : "Seus boards e anexos ficam separados e protegidos por conta."}</p>
          <form onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onSubmit({
              fullName: String(data.get("fullName") || ""),
              phone: String(data.get("phone") || ""),
              email: String(data.get("email")),
              password: String(data.get("password")),
              confirmPassword: String(data.get("confirmPassword") || ""),
            }, mode);
          }}>
            {mode === "register" && <>
              <label>Nome completo<input name="fullName" type="text" autoComplete="name" required minLength={2} maxLength={120} placeholder="Como quer ser chamado" /></label>
              <label>Telefone<input name="phone" type="tel" autoComplete="tel" required inputMode="tel" maxLength={15} placeholder="(11) 99999-9999" onChange={(event) => { event.currentTarget.value = formatBrazilianPhone(event.currentTarget.value); }} /></label>
            </>}
            <label>E-mail<input name="email" type="email" autoComplete="email" required placeholder="voce@empresa.com" /></label>
            <label>Senha<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={12} required placeholder={mode === "register" ? "12+ caracteres, letras, número e símbolo" : "Sua senha"} /></label>
            {mode === "register" && <label>Confirmar senha<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required placeholder="Repita sua senha" /></label>}
            {mode === "register" && <p className="auth-password-note">Mínimo de 12 caracteres com maiúscula, minúscula, número e símbolo.</p>}
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-submit" disabled={busy}>{busy ? "Protegendo seu acesso…" : mode === "login" ? "Entrar no workspace" : "Criar meu workspace"}<ChevronRight size={17} /></button>
          </form>
          <p className="auth-switch">{mode === "login" ? "Ainda não tem conta?" : "Já possui uma conta?"} <button onClick={() => onModeChange(mode === "login" ? "register" : "login")}>{mode === "login" ? "Registrar-se" : "Entrar"}</button></p>
        </section>
      </div>}
    </main>
  );
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [hydrated, setHydrated] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [boardPage, setBoardPage] = useState<BoardPage>({ items: [], page: 1, pageSize: 12, totalCount: 0, totalPages: 1, ownedBoardCount: 0, maxBoards: 100 });
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [boardsError, setBoardsError] = useState<string | null>(null);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [editingBoardTitle, setEditingBoardTitle] = useState(false);
  const [boardTitleDraft, setBoardTitleDraft] = useState("");
  const [syncStatus, setSyncStatus] = useState<
    "loading" | "saving" | "synced" | "local"
  >("loading");
  const [query, setQuery] = useState("");
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(
    null,
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [uploadingAttachmentId, setUploadingAttachmentId] = useState<
    string | null
  >(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 760);
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth > 760);
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
    title: string;
  } | null>(null);
  const [boardMenu, setBoardMenu] = useState<{
    x: number;
    y: number;
    position: { x: number; y: number };
  } | null>(null);
  const [inspector, setInspector] = useState<{
    id?: string;
    type: "node" | "edge" | "group";
    title: string;
  } | null>(null);
  const copiedCards = useRef<Node[]>([]);
  const copiedConnections = useRef<Edge[]>([]);
  const pasteCount = useRef(0);
  const undoStack = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const previousState = useRef<{ nodes: Node[]; edges: Edge[] }>({
    nodes: [],
    edges: [],
  });
  const restoringUndo = useRef(false);
  const csrfToken = useRef<string>("");
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveRevision = useRef(0);
  const boardListRequest = useRef(0);
  const fetchCsrfToken = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/auth/csrf`, { credentials: "include" });
    if (!response.ok) throw new Error("Não foi possível preparar a sessão segura.");
    const payload = (await response.json()) as { token: string };
    csrfToken.current = payload.token;
    return payload.token;
  }, []);
  useEffect(() => {
    let active = true;
    const loadSession = async () => {
      try {
        await fetchCsrfToken();
        const response = await fetch(`${apiBaseUrl}/api/auth/me`, { credentials: "include" });
        if (response.ok && active) setAccount(await response.json() as Account);
      } catch {
        /* The landing stays available while the API starts. */
      } finally {
        if (active) setAuthReady(true);
      }
    };
    void loadSession();
    return () => { active = false; };
  }, [fetchCsrfToken]);
  const authenticate = async (data: AuthSubmission, mode: Exclude<AuthMode, null>) => {
    if (mode === "register") {
      if (!data.fullName?.trim()) {
        setAuthError("Informe seu nome completo.");
        return;
      }
      if ((data.phone ?? "").replace(/\D/g, "").length < 10) {
        setAuthError("Informe um telefone válido com DDD.");
        return;
      }
      if (data.password !== data.confirmPassword) {
        setAuthError("As senhas precisam ser iguais.");
        return;
      }
      const passwordError = passwordRequirementError(data.password);
      if (passwordError) {
        setAuthError(passwordError);
        return;
      }
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      const token = csrfToken.current || await fetchCsrfToken();
      const response = await fetch(`${apiBaseUrl}/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token },
        body: JSON.stringify(mode === "register"
          ? { fullName: data.fullName, phone: data.phone, email: data.email, password: data.password, confirmPassword: data.confirmPassword }
          : { email: data.email, password: data.password }),
      });
      const payload = await response.json().catch(() => ({})) as Account & { message?: string };
      if (!response.ok) {
        const fallback = response.status === 401 ? "E-mail ou senha inválidos." : response.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : "Não foi possível concluir seu acesso.";
        throw new Error(payload.message || fallback);
      }
      await fetchCsrfToken();
      setGuestMode(false);
      setActiveBoardId(null);
      setBoards([]);
      setBoardPage({ items: [], page: 1, pageSize: 12, totalCount: 0, totalPages: 1, ownedBoardCount: 0, maxBoards: 100 });
      setAccount({ id: payload.id, email: payload.email });
      setAuthMode(null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Não foi possível concluir seu acesso.");
    } finally {
      setAuthBusy(false);
    }
  };
  const logout = async () => {
    try {
      const token = csrfToken.current || await fetchCsrfToken();
      const response = await fetch(`${apiBaseUrl}/api/auth/logout`, { method: "POST", credentials: "include", headers: { "X-CSRF-TOKEN": token } });
      if (!response.ok) throw new Error("Não foi possível sair. Tente novamente.");
      saveRevision.current++;
      setNodes([]);
      setEdges([]);
      setHydrated(false);
      setBoards([]);
      setBoardPage({ items: [], page: 1, pageSize: 12, totalCount: 0, totalPages: 1, ownedBoardCount: 0, maxBoards: 100 });
      setActiveBoardId(null);
      setAccount(null);
    } catch (error) {
      setBoardsError(error instanceof Error ? error.message : "Não foi possível sair. Tente novamente.");
    }
  };
  const enterGuestMode = () => {
    setNodes([]);
    setEdges([]);
    setHydrated(false);
    setActiveBoardId(null);
    setAuthMode(null);
    setGuestMode(true);
  };
  const openRegistration = () => {
    setGuestMode(false);
    setAuthError(null);
    setAuthMode("register");
  };
  const loadBoards = useCallback(async (filters: BoardFilters = {}) => {
    if (!account) return;
    const requestId = ++boardListRequest.current;
    setBoardsLoading(true);
    setBoardsError(null);
    try {
      const parameters = new URLSearchParams({ page: String(filters.page ?? 1), pageSize: "12" });
      if (filters.query) parameters.set("query", filters.query);
      if (filters.updatedFrom) parameters.set("updatedFrom", filters.updatedFrom);
      if (filters.updatedTo) parameters.set("updatedTo", filters.updatedTo);
      if (filters.updatedFrom || filters.updatedTo) parameters.set("utcOffsetMinutes", String(new Date().getTimezoneOffset()));
      const response = await fetch(`${apiBaseUrl}/api/boards?${parameters}`, { credentials: "include" });
      const payload = await response.json().catch(() => ({})) as BoardPage & { message?: string };
      if (!response.ok) throw new Error(payload.message || "Não foi possível carregar seus boards.");
      if (requestId !== boardListRequest.current) return;
      setBoards(payload.items);
      setBoardPage(payload);
    } catch (error) {
      if (requestId !== boardListRequest.current) return;
      setBoardsError(error instanceof Error ? error.message : "Não foi possível carregar seus boards.");
    } finally {
      if (requestId === boardListRequest.current) setBoardsLoading(false);
    }
  }, [account]);
  useEffect(() => {
    if (!account) return;
    void loadBoards();
  }, [account, loadBoards]);
  const createBoard = async () => {
    setCreatingBoard(true);
    setBoardsError(null);
    try {
      const token = csrfToken.current || await fetchCsrfToken();
      const response = await fetch(`${apiBaseUrl}/api/boards`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token },
        body: JSON.stringify({ title: "Novo board" }),
      });
      const payload = await response.json().catch(() => ({})) as BoardSummary & { document: string; message?: string };
      if (!response.ok) throw new Error(payload.message || "Não foi possível criar o board.");
      const board = payload;
      setBoards((current) => [{ id: board.id, title: board.title, version: board.version, updatedAt: board.updatedAt }, ...current]);
      setBoardPage((current) => ({ ...current, ownedBoardCount: current.ownedBoardCount + 1, totalCount: current.totalCount + 1 }));
      setActiveBoardId(board.id);
    } catch (error) {
      setBoardsError(error instanceof Error ? error.message : "Não foi possível criar o board.");
    } finally {
      setCreatingBoard(false);
    }
  };
  const openBoard = (id: string) => {
    setNodes([]);
    setEdges([]);
    setHydrated(false);
    setActiveBoardId(id);
  };
  const renameLibraryBoard = async (boardId: string, title: string) => {
    try {
      const token = csrfToken.current || await fetchCsrfToken();
      const response = await fetch(`${apiBaseUrl}/api/boards/${boardId}/title`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token },
        body: JSON.stringify({ title }),
      });
      const payload = await response.json().catch(() => ({})) as BoardSummary & { message?: string };
      if (!response.ok) throw new Error(payload.message || "Não foi possível renomear o board.");
      setBoards((current) => current.map((board) => board.id === payload.id ? payload : board));
      return true;
    } catch (error) {
      setBoardsError(error instanceof Error ? error.message : "Não foi possível renomear o board.");
      return false;
    }
  };
  const deleteLibraryBoard = async (boardId: string) => {
    try {
      const token = csrfToken.current || await fetchCsrfToken();
      const response = await fetch(`${apiBaseUrl}/api/boards/${boardId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "X-CSRF-TOKEN": token },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(payload.message || "Não foi possível excluir o board.");
      }
      setBoards((current) => current.filter((board) => board.id !== boardId));
      return true;
    } catch (error) {
      setBoardsError(error instanceof Error ? error.message : "Não foi possível excluir o board.");
      return false;
    }
  };
  const startBoardTitleEdit = () => {
    if (!account || !activeBoard) return;
    setBoardTitleDraft(activeBoard.title);
    setEditingBoardTitle(true);
  };
  const saveBoardTitle = async () => {
    if (!account || !activeBoard) return;
    const title = boardTitleDraft.trim();
    setEditingBoardTitle(false);
    if (!title || title === activeBoard.title) return;
    try {
      const token = csrfToken.current || await fetchCsrfToken();
      const response = await fetch(`${apiBaseUrl}/api/boards/${activeBoard.id}/title`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error("Não foi possível renomear o board.");
      const renamed = await response.json() as BoardSummary;
      setBoards((current) => current.map((board) => board.id === renamed.id ? renamed : board));
    } catch {
      setSyncStatus("local");
    }
  };
  useEffect(() => {
    const workspaceScope = account && activeBoardId
      ? `${account.id}-${activeBoardId}`
      : guestMode ? "guest" : null;
    if (!workspaceScope) return;
    let mounted = true;
    const restoreLocalBoard = () => {
      const stored = localStorage.getItem(`${browserProjectKey}-${workspaceScope}`);
      if (!stored) return;
      try {
        const document = JSON.parse(stored);
        setNodes(document.nodes || []);
        setEdges(document.edges || []);
      } catch {
        /* start with an empty board */
      }
    };
    const hydrateBoard = async () => {
      setNodes([]);
      setEdges([]);
      setHydrated(false);
      if (!account) {
        restoreLocalBoard();
        if (mounted) {
          setSyncStatus("local");
          setHydrated(true);
        }
        return;
      }
      const id = activeBoardId;
      if (!id) return;
      try {
        const response = await fetch(`${apiBaseUrl}/api/boards/${id}`, { credentials: "include" });
        if (response.ok) {
          const board = (await response.json()) as { document: string };
          const document = JSON.parse(board.document);
          if (mounted) {
            setNodes(document.nodes || []);
            setEdges(document.edges || []);
            setSyncStatus("synced");
          }
        } else if (response.status === 404) {
          restoreLocalBoard();
          if (mounted) setSyncStatus("saving");
        } else {
          throw new Error("Não foi possível ler o board remoto.");
        }
      } catch {
        restoreLocalBoard();
        if (mounted) setSyncStatus("local");
      } finally {
        if (mounted) setHydrated(true);
      }
    };
    void hydrateBoard();
    return () => {
      mounted = false;
    };
  }, [account, activeBoardId, guestMode, setEdges, setNodes]);
  const saveRemoteBoard = useCallback((id: string, document: string, revision: number) => {
    const write = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/boards/${id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": csrfToken.current },
          body: JSON.stringify({ document }),
        });
        if (!response.ok) throw new Error("Não foi possível salvar o board.");
        if (revision === saveRevision.current) setSyncStatus("synced");
        return true;
      } catch {
        if (revision === saveRevision.current) setSyncStatus("local");
        return false;
      }
    };
    const result = saveQueue.current.then(write, write);
    saveQueue.current = result.then(() => undefined);
    return result;
  }, []);
  useEffect(() => {
    const workspaceScope = account && activeBoardId
      ? `${account.id}-${activeBoardId}`
      : guestMode ? "guest" : null;
    if (!hydrated || !workspaceScope) return;
    localStorage.setItem(`${browserProjectKey}-${workspaceScope}`, JSON.stringify({ nodes, edges }));
    if (!account) {
      setSyncStatus("local");
      return;
    }
    const revision = ++saveRevision.current;
    setSyncStatus("saving");
    const id = activeBoardId;
    const document = JSON.stringify({ nodes, edges });
    const syncTimer = window.setTimeout(() => {
      if (id) void saveRemoteBoard(id, document, revision);
    }, 650);
    return () => window.clearTimeout(syncTimer);
  }, [account, activeBoardId, edges, guestMode, hydrated, nodes, saveRemoteBoard]);
  useEffect(() => {
    if (restoringUndo.current) {
      previousState.current = { nodes, edges };
      restoringUndo.current = false;
      return;
    }
    if (
      previousState.current.nodes !== nodes ||
      previousState.current.edges !== edges
    ) {
      undoStack.current = [
        ...undoStack.current.slice(-29),
        previousState.current,
      ];
      previousState.current = { nodes, edges };
    }
  }, [nodes, edges]);
  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    restoringUndo.current = true;
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [setEdges, setNodes]);
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setNodes((current) =>
          current.map((node) => ({
            ...node,
            selected: node.type !== "groupNode",
          })),
        );
      }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [setNodes, undo]);
  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges],
  );
  const addNode = (
    entry: CatalogEntry,
    position?: { x: number; y: number },
  ) =>
    setNodes((ns) => [
      ...ns,
      {
        id: crypto.randomUUID(),
        type: "flowNode",
        position: position || {
          x: 280 + (ns.length % 3) * 80,
          y: 100 + (ns.length % 4) * 110,
        },
        data: { ...entry, icon: entry.icon || categoryMeta[entry.kind].icon },
      },
    ]);
  const startCatalogDrag = (
    event: DragEvent<HTMLButtonElement>,
    entry: CatalogEntry,
  ) => {
    event.dataTransfer.setData(
      "application/graphflow-node",
      JSON.stringify(entry),
    );
    event.dataTransfer.effectAllowed = "move";
  };
  const dropCatalogNode = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rawEntry = event.dataTransfer.getData("application/graphflow-node");
    if (!rawEntry || !flowInstance) return;
    try {
      const entry = JSON.parse(rawEntry) as CatalogEntry;
      addNode(
        entry,
        flowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      );
    } catch {
      // Ignore an unsupported drag payload.
    }
  };
  const removeGroupsPreservingCards = (current: Node[], groupIds: string[]) => {
    const removedGroups = new Map(
      current
        .filter((node) => groupIds.includes(node.id))
        .map((node) => [node.id, node]),
    );
    return current
      .filter((node) => !removedGroups.has(node.id))
      .map((node) => {
        const parent = node.parentId
          ? removedGroups.get(node.parentId)
          : undefined;
        return parent
          ? {
              ...node,
              parentId: undefined,
              extent: undefined,
              position: {
                x: parent.position.x + node.position.x,
                y: parent.position.y + node.position.y,
              },
              zIndex: 1,
              selected: false,
            }
          : node;
      });
  };
  const deleteGroup = () => {
    if (!inspector?.id) return;
    setNodes((current) =>
      removeGroupsPreservingCards(current, [inspector.id!]),
    );
    setInspector(null);
  };
  const toggleGroup = (groupId: string) => {
    const group = nodes.find((node) => node.id === groupId);
    if (!group) return;
    const groupData = group.data as GroupData;
    const shouldCollapse = !groupData.collapsed;
    const memberIds = nodes
      .filter((node) => node.parentId === groupId)
      .map((node) => node.id);
    setNodes(
      nodes.map((node) => {
        if (node.id === groupId) {
          const style = (node.style || {}) as Record<string, unknown>;
          const expandedWidth = Number(
            style.width || groupData.expandedWidth || 380,
          );
          const expandedHeight = Number(
            style.height || groupData.expandedHeight || 250,
          );
          return {
            ...node,
            style: shouldCollapse
              ? { ...style, width: 270, height: 76 }
              : {
                  ...style,
                  width: groupData.expandedWidth || expandedWidth,
                  height: groupData.expandedHeight || expandedHeight,
                },
            data: {
              ...groupData,
              collapsed: shouldCollapse,
              memberCount: memberIds.length,
              expandedWidth: shouldCollapse
                ? expandedWidth
                : groupData.expandedWidth,
              expandedHeight: shouldCollapse
                ? expandedHeight
                : groupData.expandedHeight,
            },
          };
        }
        return node.parentId === groupId
          ? { ...node, hidden: shouldCollapse, selected: false }
          : node;
      }),
    );
    setEdges((current) =>
      current.map((edge) =>
        memberIds.includes(edge.source) || memberIds.includes(edge.target)
          ? { ...edge, hidden: shouldCollapse }
          : edge,
      ),
    );
  };
  const toggleNodeBranches = (sourceId: string) => {
    const source = nodes.find((node) => node.id === sourceId);
    const outgoing = edges.filter((edge) => edge.source === sourceId);
    if (!source || !outgoing.length) return;
    const sourceData = source.data as FlowNodeData;
    const shouldCollapse = !sourceData.collapsedBranches;
    const descendants = new Set<string>();
    const pendingIds = outgoing.map((edge) => edge.target);
    while (pendingIds.length) {
      const currentId = pendingIds.shift()!;
      if (currentId === sourceId || descendants.has(currentId)) continue;
      descendants.add(currentId);
      edges
        .filter((edge) => edge.source === currentId)
        .forEach((edge) => pendingIds.push(edge.target));
    }
    const descendantIds = [...descendants];
    setNodes(
      nodes.map((node) => {
        if (node.id === sourceId)
          return {
            ...node,
            data: {
              ...sourceData,
              collapsedBranches: shouldCollapse,
              collapsedBranchCount: descendantIds.length,
            },
          };
        if (!descendantIds.includes(node.id)) return node;
        const visibility = updateBranchVisibility(node.data, sourceId, shouldCollapse);
        return { ...node, hidden: visibility.hidden, data: visibility.data };
      }),
    );
    setEdges(
      edges.map((edge) => {
        const touchesBranch =
          edge.source === sourceId ||
          descendantIds.includes(edge.source) ||
          descendantIds.includes(edge.target);
        if (!touchesBranch) return edge;
        const visibility = updateBranchVisibility(edge.data || {}, sourceId, shouldCollapse);
        return { ...edge, hidden: visibility.hidden, data: visibility.data };
      }),
    );
  };
  const onNodesChangeWithBranches = useCallback(
    (changes: NodeChange<Node>[]) => {
      const companionChanges: NodeChange<Node>[] = [];
      for (const change of changes) {
        if (change.type !== "position" || !change.position) continue;
        const source = nodes.find((node) => node.id === change.id);
        if (!source) continue;
        const sourceData = source.data as FlowNodeData;
        if (!sourceData.collapsedBranches) continue;
        const delta = {
          x: change.position.x - source.position.x,
          y: change.position.y - source.position.y,
        };
        if (!delta.x && !delta.y) continue;
        nodes
          .filter(
            (node) =>
              branchVisibilityOwners(node.data as FlowNodeData & BranchVisibilityData)
                .includes(source.id),
          )
          .forEach((node) =>
            companionChanges.push({
              type: "position",
              id: node.id,
              position: {
                x: node.position.x + delta.x,
                y: node.position.y + delta.y,
              },
              dragging: change.dragging,
            }),
          );
      }
      onNodesChange([...changes, ...companionChanges]);
    },
    [nodes, onNodesChange],
  );
  const duplicateCard = (id: string) => {
    setNodes((current) => {
      const source = current.find((node) => node.id === id);
      if (!source || source.type === "groupNode") return current;
      return [
        ...current.map((node) => ({ ...node, selected: false })),
        {
          ...source,
          id: crypto.randomUUID(),
          position: { x: source.position.x + 36, y: source.position.y + 36 },
          selected: true,
        },
      ];
    });
    setContextMenu(null);
  };
  const copySelectedCards = () => {
    const selected = nodes.filter(
      (node) => node.selected && node.type !== "groupNode",
    );
    if (!selected.length) return false;
    const ids = new Set(selected.map((node) => node.id));
    copiedCards.current = selected.map((node) => ({
      ...node,
      data: { ...node.data },
    }));
    copiedConnections.current = edges
      .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
      .map((edge) => ({
        ...edge,
        data: { ...edge.data },
        style: { ...edge.style },
      }));
    pasteCount.current = 0;
    return true;
  };
  const pasteCards = () => {
    if (!copiedCards.current.length) return false;
    pasteCount.current += 1;
    const offset = 32 * pasteCount.current;
    const ids = new Map(
      copiedCards.current.map((node) => [node.id, crypto.randomUUID()]),
    );
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      ...copiedCards.current.map((node) => ({
        ...node,
        id: ids.get(node.id)!,
        position: { x: node.position.x + offset, y: node.position.y + offset },
        selected: true,
      })),
    ]);
    setEdges((current) => [
      ...current,
      ...copiedConnections.current.map((edge) => ({
        ...edge,
        id: crypto.randomUUID(),
        source: ids.get(edge.source) || edge.source,
        target: ids.get(edge.target) || edge.target,
        selected: false,
      })),
    ]);
    return true;
  };
  const deleteCard = (id: string) => {
    setNodes((current) => current.filter((node) => node.id !== id));
    setEdges((current) =>
      current.filter((edge) => edge.source !== id && edge.target !== id),
    );
    setContextMenu(null);
    setInspector(null);
  };
  const activeNode =
    inspector?.type === "node"
      ? nodes.find((node) => node.id === inspector.id)
      : undefined;
  const nodeData = (activeNode?.data || {}) as FlowNodeData;
  const activeOutgoing = activeNode
    ? edges.filter((edge) => edge.source === activeNode.id)
    : [];
  const updateActiveNode = (change: (data: FlowNodeData) => FlowNodeData) => {
    if (!inspector?.id) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === inspector.id
          ? { ...node, data: change(node.data as FlowNodeData) }
          : node,
      ),
    );
  };
  const uploadAttachment = async (file: File) => {
    if (!activeNode) return;
    if (!account) {
      setAttachmentError("Anexos exigem uma conta para serem armazenados com segurança.");
      return;
    }
    setUploadingAttachmentId(activeNode.id);
    setAttachmentError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${apiBaseUrl}/api/attachments`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-TOKEN": csrfToken.current },
        body: form,
      });
      if (!response.ok) throw new Error("Não foi possível enviar o anexo.");
      const attachment = (await response.json()) as {
        id: string;
        name: string;
        contentType: string;
        sizeBytes: number;
        url: string;
      };
      const uploadedAttachment = attachment;
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== activeNode.id) return node;
          const data = node.data as FlowNodeData;
          const isImage =
            getFreeformType(data) === "image" &&
            uploadedAttachment.contentType.startsWith("image/");
          return {
            ...node,
            ...(isImage
              ? { style: { ...node.style, width: 286, height: 250 } }
              : {}),
            data: {
              ...data,
              sublabel: uploadedAttachment.name,
              attachment: uploadedAttachment,
            },
          };
        }),
      );
    } catch (error) {
      setAttachmentError(
        error instanceof Error ? error.message : "Falha ao enviar o anexo.",
      );
    } finally {
      setUploadingAttachmentId(null);
    }
  };
  const activeGroup =
    inspector?.type === "group"
      ? nodes.find((node) => node.id === inspector.id)
      : undefined;
  const groupData = (activeGroup?.data || {}) as GroupData;
  const updateActiveGroup = (change: (data: GroupData) => GroupData) => {
    if (!inspector?.id) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === inspector.id
          ? { ...node, data: change(node.data as GroupData) }
          : node,
      ),
    );
  };
  const activeEdge =
    inspector?.type === "edge"
      ? edges.find((edge) => edge.id === inspector.id)
      : undefined;
  const edgeData = (activeEdge?.data || {}) as {
    dataType?: string;
    lineStyle?: string;
  };
  const updateActiveEdge = (change: (edge: Edge) => Edge) => {
    if (!inspector?.id) return;
    setEdges((current) =>
      current.map((edge) => (edge.id === inspector.id ? change(edge) : edge)),
    );
  };
  const setEdgeDataType = (dataType: string) => {
    const colors: Record<string, string> = {
      text: "#5c51bd",
      json: "#1599a9",
      documents: "#23845e",
    };
    updateActiveEdge((edge) => ({
      ...edge,
      label: edge.label || dataType,
      data: { ...edge.data, dataType },
      style: { ...edge.style, stroke: colors[dataType] },
    }));
  };
  const setEdgeFormat = (format: "curve" | "orthogonal") =>
    updateActiveEdge((edge) => ({
      ...edge,
      type: format === "orthogonal" ? "smoothstep" : "default",
    }));
  const setEdgeLineStyle = (lineStyle: "solid" | "dashed" | "dotted") => {
    const dash = { solid: undefined, dashed: "8 5", dotted: "2 5" }[lineStyle];
    updateActiveEdge((edge) => ({
      ...edge,
      data: { ...edge.data, lineStyle },
      style: { ...edge.style, strokeDasharray: dash },
    }));
  };
  const deleteActiveEdge = () => {
    if (!inspector?.id) return;
    setEdges((current) => current.filter((edge) => edge.id !== inspector.id));
    setInspector(null);
  };
  useEffect(() => {
    const cardShortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        if (copySelectedCards()) event.preventDefault();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
        if (pasteCards()) event.preventDefault();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        const selected = nodes.find(
          (node) => node.selected && node.type !== "groupNode",
        );
        if (selected) {
          event.preventDefault();
          duplicateCard(selected.id);
        }
      }
      if (event.key === "Escape") {
        setContextMenu(null);
        setInspector(null);
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        const selectedIds = nodes
          .filter((node) => node.selected && node.type !== "groupNode")
          .map((node) => node.id);
        const selectedGroupIds = nodes
          .filter((node) => node.selected && node.type === "groupNode")
          .map((node) => node.id);
        if (selectedIds.length || selectedGroupIds.length) {
          event.preventDefault();
          setNodes((current) => {
            const ungrouped = removeGroupsPreservingCards(
              current,
              selectedGroupIds,
            );
            return ungrouped.filter((node) => !selectedIds.includes(node.id));
          });
          setEdges((current) =>
            current.filter(
              (edge) =>
                !selectedIds.includes(edge.source) &&
                !selectedIds.includes(edge.target),
            ),
          );
        }
      }
    };
    window.addEventListener("keydown", cardShortcuts);
    return () => window.removeEventListener("keydown", cardShortcuts);
  }, [edges, nodes, setEdges, setNodes]);
  const removeSelected = () =>
    setNodes((current) => {
      const selectedGroups = current
        .filter((node) => node.selected && node.type === "groupNode")
        .map((node) => node.id);
      const withoutGroups = removeGroupsPreservingCards(
        current,
        selectedGroups,
      );
      return withoutGroups.filter((node) => !node.selected);
    });
  const persist = async () => {
    const workspaceScope = account && activeBoardId
      ? `${account.id}-${activeBoardId}`
      : guestMode ? "guest" : null;
    if (!workspaceScope) return;
    localStorage.setItem(`${browserProjectKey}-${workspaceScope}`, JSON.stringify({ nodes, edges }));
    if (!account) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
      return;
    }
    if (!activeBoardId) return;
    const revision = ++saveRevision.current;
    setSyncStatus("saving");
    const success = await saveRemoteBoard(activeBoardId, JSON.stringify({ nodes, edges }), revision);
    if (!success || revision !== saveRevision.current) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };
  const groups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = (entry: { label: string; sublabel: string }) =>
      !normalizedQuery ||
      `${entry.label} ${entry.sublabel}`
        .toLowerCase()
        .includes(normalizedQuery);

    const entries = businessCatalog.filter(matches);
    return entries.length ? [{
      key: "universal-blocks",
      meta: { ...categoryMeta.freeform, name: "Blocos universais" },
      entries,
    }] : [];
  }, [query]);
  const outgoingBranchCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of edges) {
      counts.set(edge.source, (counts.get(edge.source) || 0) + 1);
    }
    return counts;
  }, [edges]);
  const canvasNodes = useMemo(
    () =>
      nodes.map((node) => {
        if (node.type === "groupNode") return node;
        const branchCount = outgoingBranchCounts.get(node.id) || 0;
        return {
          ...node,
          data: {
            ...node.data,
            branchCount,
            toggleBranches: () => toggleNodeBranches(node.id),
            previewImage: () => {
              const data = node.data as FlowNodeData;
              if (data.attachment?.contentType.startsWith("image/")) {
                setImagePreview({ url: attachmentUrl(data.attachment.url), name: data.attachment.name });
              }
            },
          },
        };
      }),
    [nodes, outgoingBranchCounts],
  );
  const activeBoard = boards.find((board) => board.id === activeBoardId);
  if (!authReady) return <main className="auth-loading"><div className="landing-brand-mark"><Waypoints size={20} /></div><span>Preparando seu workspace seguro…</span></main>;
  if (!account && !guestMode) return <LandingPage mode={authMode} onModeChange={(mode) => { setAuthError(null); setAuthMode(mode); }} onSubmit={authenticate} onExplore={enterGuestMode} busy={authBusy} error={authError} />;
  if (account && !activeBoardId) return <BoardLibrary account={account} boards={boards} page={boardPage} loading={boardsLoading} error={boardsError} creating={creatingBoard} onCreate={() => void createBoard()} onOpen={openBoard} onLoad={(filters) => void loadBoards(filters)} onRename={renameLibraryBoard} onDelete={deleteLibraryBoard} onLogout={() => void logout()} />;
  return (
    <main
      className={`app-shell ${leftOpen ? "" : "left-closed"} ${rightOpen ? "" : "right-closed"}`}
    >
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={18} />
          </div>
          <span>
            ligue<span>os</span>pontos
          </span>
        </div>
        <div className="project-name">
          {account ? (
            <button
              className="boards-breadcrumb"
              type="button"
              onClick={() => void persist().then(() => setActiveBoardId(null))}
              title="Voltar para seus boards"
            >
              Boards <ChevronDown size={14} />
            </button>
          ) : <span>Board local</span>}
          {editingBoardTitle ? (
            <input
              className="board-title-input"
              autoFocus
              maxLength={160}
              aria-label="Nome do board"
              value={boardTitleDraft}
              onChange={(event) => setBoardTitleDraft(event.target.value)}
              onBlur={() => void saveBoardTitle()}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); void saveBoardTitle(); }
                if (event.key === "Escape") { event.preventDefault(); setEditingBoardTitle(false); }
              }}
            />
          ) : (
            <b className={account ? "board-title-editable" : ""} onDoubleClick={startBoardTitleEdit} title={account ? "Clique duas vezes para renomear" : undefined}>{activeBoard?.title || (account ? "Seu board" : "Mapa livre")}</b>
          )}
        </div>
        <div className="header-actions">
          <small className={`autosave autosave-${syncStatus}`}>
            {syncStatus === "loading" && "Carregando workspace…"}
            {syncStatus === "saving" && "Sincronizando alterações…"}
            {syncStatus === "synced" && "Sincronizado com o workspace"}
            {syncStatus === "local" && (account ? "Salvo neste navegador · sincronização pendente" : "Modo visitante · salvo somente neste navegador")}
          </small>
          <button className="save-button" onClick={persist}>
            {saved ? "Salvo!" : "Salvar"}
          </button>
          {!account && <button className="text-button upgrade-button" onClick={openRegistration}>Criar conta</button>}
        </div>
      </header>
      {(leftOpen || rightOpen) && (
        <button
          className="mobile-scrim"
          aria-label="Fechar painéis"
          onClick={() => {
            setLeftOpen(false);
            setRightOpen(false);
          }}
        />
      )}
      <aside className="sidebar">
        <div className="sidebar-heading">
          <div>
            <span className="eyebrow">BLOCOS DO MAPA</span>
            <h2>Conteúdo e referências</h2>
          </div>
        </div>
        <label className="search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar blocos..."
          />
        </label>
        <div className="catalog">
          {groups.map(({ key, meta, entries }) => {
            const Icon = icons[meta.icon];
            return (
              <section className="catalog-group" key={key}>
                <button
                  className="group-title"
                  onClick={() =>
                    setCollapsed((x) => ({ ...x, [key]: !x[key] }))
                  }
                >
                  <span className="category-icon" style={{ color: meta.color }}>
                    <Icon size={15} />
                  </span>
                  {meta.name} ({entries.length})
                  <ChevronDown
                    size={15}
                    className={collapsed[key] ? "rotate" : ""}
                  />
                </button>
                {!collapsed[key] &&
                  entries.map((entry) => {
                    const ItemIcon = icons[entry.icon || meta.icon];
                    return (
                      <button
                        className="catalog-item"
                        key={entry.label}
                        draggable
                        onDragStart={(event) => startCatalogDrag(event, entry)}
                        onClick={() => addNode(entry)}
                      >
                        <GripVertical size={14} />
                        <span
                          className="item-icon"
                          style={{ color: getNodeMeta(entry).color }}
                        >
                          <ItemIcon size={16} />
                        </span>
                        <span>
                          <strong>{entry.label}</strong>
                          <small>{entry.sublabel}</small>
                        </span>
                        <Plus size={14} />
                      </button>
                    );
                  })}
              </section>
            );
          })}
        </div>
      </aside>
      <section className="canvas-area">
        <ReactFlow
          nodes={canvasNodes}
          edges={edges}
          nodeTypes={{ flowNode: FlowNode, groupNode: GroupNode }}
          onNodesChange={onNodesChangeWithBranches}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setFlowInstance}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={dropCatalogNode}
          multiSelectionKeyCode="Shift"
          onPaneClick={() => {
            setContextMenu(null);
            setBoardMenu(null);
          }}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            if (!flowInstance) return;
            setContextMenu(null);
            setBoardMenu({
              x: Math.max(8, Math.min(event.clientX, window.innerWidth - 272)),
              y: Math.max(8, Math.min(event.clientY, window.innerHeight - 188)),
              position: flowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
              }),
            });
          }}
          onNodeClick={(_, node) => {
            setRightOpen(true);
            setInspector({
              id: node.id,
              type: node.type === "groupNode" ? "group" : "node",
              title: String(node.data.label),
            });
          }}
          onNodeDoubleClick={(_, node) => {
            if (node.type === "groupNode") toggleGroup(node.id);
            else if (edges.some((edge) => edge.source === node.id))
              toggleNodeBranches(node.id);
          }}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            if (node.type === "groupNode") return;
            setBoardMenu(null);
            setContextMenu({
              id: node.id,
              x: event.clientX,
              y: event.clientY,
              title: String(node.data.label),
            });
          }}
          onEdgeClick={(_, edge) => {
            setRightOpen(true);
            setInspector({
              id: edge.id,
              type: "edge",
              title: String(edge.label || "Conexão"),
            });
          }}
          fitView
          fitViewOptions={{ padding: 0.28 }}
          defaultEdgeOptions={{
            style: { stroke: "#5c51bd", strokeWidth: 2 },
            labelStyle: { fill: "#696780", fontSize: 10 },
          }}
        >
          <Background gap={18} size={1} color="#e8eaf0" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable={false}
            zoomable={false}
            style={{ width: 178, height: 112, pointerEvents: "none" }}
            nodeColor={(n) =>
              categoryMeta[(n.data as FlowNodeData).kind]?.color || "#64748b"
            }
            maskColor="rgba(255,255,255,.75)"
          />
          <Panel position="top-left" className="canvas-left-control">
            <button
              className={`left-menu ${leftOpen ? "is-open" : ""}`}
              onClick={() => setLeftOpen(!leftOpen)}
              title={leftOpen ? "Ocultar catálogo" : "Abrir catálogo"}
              aria-label={leftOpen ? "Ocultar catálogo" : "Abrir catálogo"}
            >
              <Menu size={15} />
              {leftOpen ? (
                <ChevronLeft className="menu-direction" size={13} />
              ) : (
                <ChevronRight className="menu-direction" size={13} />
              )}
              <span>Catálogo</span>
            </button>
          </Panel>
          <Panel position="top-right" className="canvas-tip">
            <button
              className={`right-menu ${rightOpen ? "is-open" : ""}`}
              onClick={() => setRightOpen(!rightOpen)}
              title={rightOpen ? "Ocultar painel de propriedades" : "Abrir painel de propriedades"}
              aria-label={
                rightOpen
                  ? "Ocultar painel de propriedades"
                  : "Abrir painel de propriedades"
              }
            >
              <Menu size={15} />
              <span>{rightOpen ? "Ocultar painel" : "Propriedades"}</span>
              {rightOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
            </button>
          </Panel>
          <Panel position="bottom-center" className="canvas-toolbar">
            <button onClick={removeSelected}>
              <Trash2 size={14} /> Excluir selecionados
            </button>
            <span />
            <button
              onClick={() => {
                setNodes([]);
                setEdges([]);
              }}
            >
              Limpar whiteboard
            </button>
          </Panel>
        </ReactFlow>
        {imagePreview && (
          <div
            className="image-preview-backdrop"
            role="presentation"
            onMouseDown={() => setImagePreview(null)}
          >
            <figure
              className="image-preview-dialog"
              role="dialog"
              aria-modal="true"
              aria-label={`Visualização de ${imagePreview.name}`}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="image-preview-close"
                aria-label="Fechar imagem"
                onClick={() => setImagePreview(null)}
              >
                <X size={18} />
              </button>
              <img src={imagePreview.url} alt={imagePreview.name} />
              <figcaption>{imagePreview.name}</figcaption>
            </figure>
          </div>
        )}
        {contextMenu && (
          <nav
            className="card-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            aria-label={`Ações para ${contextMenu.title}`}
          >
            <span>{contextMenu.title}</span>
            <button
              onClick={() => {
                setRightOpen(true);
                setInspector({
                  id: contextMenu.id,
                  type: "node",
                  title: contextMenu.title,
                });
                setContextMenu(null);
              }}
            >
              <Settings2 size={14} /> Configurar
            </button>
            <button onClick={() => duplicateCard(contextMenu.id)}>
              <Copy size={14} /> Duplicar card <kbd>⌘D</kbd>
            </button>
            <button
              className="danger"
              onClick={() => deleteCard(contextMenu.id)}
            >
              <Trash2 size={14} /> Excluir card <kbd>⌫</kbd>
            </button>
          </nav>
        )}
        {boardMenu && (
          <nav
            className="board-create-menu"
            style={{ left: boardMenu.x, top: boardMenu.y }}
            aria-label="Criar bloco no mapa"
          >
            <span>CRIAR NO MAPA</span>
            <div className="board-create-grid">
              {businessCatalog.map((entry) => {
                const Icon = icons[entry.icon || "StickyNote"];
                return (
                  <button
                    key={entry.label}
                    style={{ "--block-color": getNodeMeta(entry).color } as React.CSSProperties}
                    onClick={() => {
                      addNode(entry, boardMenu.position);
                      setBoardMenu(null);
                    }}
                  >
                    <Icon size={18} /> <strong>{entry.label}</strong>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
        {inspector ? (
          <aside className="inspector">
            <button
              className="inspector-close"
              onClick={() => setInspector(null)}
            >
              <X size={17} />
            </button>
            <span className="eyebrow">
              CONFIGURAÇÃO{" "}
              {inspector.type === "node"
                ? "DO BLOCO"
                : inspector.type === "group"
                  ? "DO GRUPO"
                  : "DA CONEXÃO"}
            </span>
            <strong className="inspector-name">{inspector.title}</strong>
            {inspector.type === "node" ? (
              <>
                <button
                  className="duplicate"
                  onClick={() => inspector?.id && duplicateCard(inspector.id)}
                >
                  <Copy size={14} /> Duplicar bloco
                </button>
                {activeOutgoing.length > 0 && (
                  <button
                    className="duplicate"
                    onClick={() =>
                      activeNode && toggleNodeBranches(activeNode.id)
                    }
                  >
                    <Layers2 size={14} />
                    {nodeData.collapsedBranches
                      ? `Mostrar ${nodeData.collapsedBranchCount || activeOutgoing.length} ${(nodeData.collapsedBranchCount || activeOutgoing.length) === 1 ? "card" : "cards"}`
                      : `Ocultar ${activeOutgoing.length} ${activeOutgoing.length === 1 ? "card conectado" : "cards conectados"}`}
                  </button>
                )}
                <label>
                  Nome do bloco
                  <input
                    value={nodeData.label || ""}
                    onChange={(event) => {
                      updateActiveNode((data) => ({
                        ...data,
                        label: event.target.value,
                      }));
                      setInspector((current) =>
                        current
                          ? { ...current, title: event.target.value }
                          : current,
                      );
                    }}
                  />
                </label>
                <label>
                  Descrição curta
                  <input
                    value={nodeData.sublabel || ""}
                    onChange={(event) =>
                      updateActiveNode((data) => ({
                        ...data,
                        sublabel: event.target.value,
                      }))
                    }
                  />
                </label>
                {getFreeformType(nodeData) === "link" ? (
                  <label>
                    URL de referência
                    <input
                      type="url"
                      value={nodeData.linkUrl || ""}
                      placeholder="https://..."
                      onChange={(event) =>
                        updateActiveNode((data) => ({
                          ...data,
                          linkUrl: event.target.value,
                          sublabel:
                            event.target.value ||
                            "Site, pesquisa ou fonte por URL",
                        }))
                      }
                    />
                  </label>
                ) : (
                  <div className="attachment-field">
                    <span className="field-label">
                      {getFreeformType(nodeData) === "image" ? "Imagem do card" : "Anexar conteúdo"}
                    </span>
                    <input
                      id={`attachment-${activeNode?.id}`}
                      className="attachment-input"
                      type="file"
                      accept="image/*,audio/*,video/*,.pdf,.txt,.md,.docx,.xlsx,.csv"
                      disabled={uploadingAttachmentId === activeNode?.id}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadAttachment(file);
                      }}
                    />
                    <label
                      className={`attachment-picker attachment-picker-${getFreeformType(nodeData)}`}
                      htmlFor={`attachment-${activeNode?.id}`}
                    >
                      <span className="attachment-picker-icon">
                        {getFreeformType(nodeData) === "image" ? <Image size={16} /> : <FileInput size={16} />}
                      </span>
                      <span className="attachment-picker-copy">
                        <strong>
                          {nodeData.attachment
                            ? "Substituir conteúdo"
                            : getFreeformType(nodeData) === "image"
                              ? "Escolher imagem"
                              : "Escolher arquivo"}
                        </strong>
                        <small>
                          {getFreeformType(nodeData) === "image"
                            ? "PNG, JPG, GIF ou WEBP"
                            : "Documento, mídia ou planilha"}
                        </small>
                      </span>
                      <span className="attachment-picker-action">
                        {uploadingAttachmentId === activeNode?.id ? "Enviando…" : "Selecionar"}
                      </span>
                    </label>
                  </div>
                )}
                {uploadingAttachmentId === activeNode?.id && (
                  <p className="attachment-status">Enviando anexo…</p>
                )}
                {nodeData.attachment && (
                  <a
                    className="attachment-link"
                    href={attachmentUrl(nodeData.attachment.url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir {nodeData.attachment.name}
                  </a>
                )}
                {attachmentError && (
                  <p className="attachment-error">{attachmentError}</p>
                )}
                <label>
                  Notas
                  <textarea
                    value={nodeData.notes || ""}
                    onChange={(event) =>
                      updateActiveNode((data) => ({
                        ...data,
                        notes: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className="delete-item"
                  onClick={() => inspector?.id && deleteCard(inspector.id)}
                >
                  <Trash2 size={14} /> Excluir bloco
                </button>
              </>
            ) : inspector.type === "group" ? (
              <>
                <label>
                  Nome do grupo
                  <input
                    value={groupData.label || ""}
                    onChange={(event) => {
                      updateActiveGroup((data) => ({
                        ...data,
                        label: event.target.value,
                      }));
                      setInspector((current) =>
                        current
                          ? { ...current, title: event.target.value }
                          : current,
                      );
                    }}
                  />
                </label>
                <label>
                  Descrição
                  <input
                    value={groupData.description || ""}
                    placeholder="Descreva a etapa"
                    onChange={(event) =>
                      updateActiveGroup((data) => ({
                        ...data,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <h4>APARÊNCIA</h4>
                <label>
                  Cor da borda
                  <input
                    type="color"
                    value={groupData.tint || "#5b55c7"}
                    onChange={(event) =>
                      updateActiveGroup((data) => ({
                        ...data,
                        tint: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Transparência
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={groupData.opacity ?? 10}
                    onChange={(event) =>
                      updateActiveGroup((data) => ({
                        ...data,
                        opacity: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Notas
                  <textarea
                    value={groupData.notes || ""}
                    placeholder="Contexto adicional deste grupo"
                    onChange={(event) =>
                      updateActiveGroup((data) => ({
                        ...data,
                        notes: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className="duplicate"
                  onClick={() => activeGroup && toggleGroup(activeGroup.id)}
                >
                  <Layers2 size={14} />
                  {groupData.collapsed
                    ? "Expandir cards do grupo"
                    : "Compactar cards do grupo"}
                </button>
                <button className="delete-item" onClick={deleteGroup}>
                  <Trash2 size={14} /> Desagrupar e excluir caixa
                </button>
              </>
            ) : (
              <>
                <label>
                  Rótulo da conexão
                  <input
                    value={String(activeEdge?.label || "")}
                    placeholder="Ex.: contexto"
                    onChange={(event) =>
                      updateActiveEdge((edge) => ({
                        ...edge,
                        label: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Tipo da conexão
                  <select
                    value={edgeData.dataType || "text"}
                    onChange={(event) => setEdgeDataType(event.target.value)}
                  >
                    <option value="text">● Anotação</option>
                    <option value="json">● Referência</option>
                    <option value="documents">● Documento</option>
                  </select>
                </label>
                <h4>FORMATO DA LINHA</h4>
                <div className="style-pills">
                  <button
                    className={
                      activeEdge?.type !== "smoothstep" ? "active" : ""
                    }
                    onClick={() => setEdgeFormat("curve")}
                    title="Linha curva"
                  >
                    ⌒
                  </button>
                  <button
                    className={
                      activeEdge?.type === "smoothstep" ? "active" : ""
                    }
                    onClick={() => setEdgeFormat("orthogonal")}
                    title="Linha ortogonal"
                  >
                    ⌝
                  </button>
                </div>
                <h4>ESTILO DA LINHA</h4>
                <div className="style-pills">
                  <button
                    className={
                      (edgeData.lineStyle || "solid") === "solid"
                        ? "active"
                        : ""
                    }
                    onClick={() => setEdgeLineStyle("solid")}
                    title="Sólida"
                  >
                    ━
                  </button>
                  <button
                    className={edgeData.lineStyle === "dashed" ? "active" : ""}
                    onClick={() => setEdgeLineStyle("dashed")}
                    title="Tracejada"
                  >
                    ╌
                  </button>
                  <button
                    className={edgeData.lineStyle === "dotted" ? "active" : ""}
                    onClick={() => setEdgeLineStyle("dotted")}
                    title="Pontilhada"
                  >
                    ┈
                  </button>
                </div>
                <button className="delete-item" onClick={deleteActiveEdge}>
                  <Trash2 size={14} /> Excluir conexão
                </button>
              </>
            )}
          </aside>
        ) : (
          <aside className="inspector empty">
            <Code2 size={27} />
            <strong>Selecione um elemento</strong>
            <p>Configure um bloco, uma conexão ou um grupo do canvas.</p>
          </aside>
        )}
      </section>
    </main>
  );
}
