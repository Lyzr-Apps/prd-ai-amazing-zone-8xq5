'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { uploadAndTrainDocument, getDocuments, deleteDocuments, validateFile } from '@/lib/ragKnowledgeBase'
import parseLLMJson from '@/lib/jsonParser'
import { useLyzrAgentEvents } from '@/lib/lyzrAgentEvents'
import { AgentActivityPanel } from '@/components/AgentActivityPanel'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { FiFileText, FiUpload, FiPlus, FiTrash2, FiDownload, FiStar, FiSearch, FiClock, FiGrid, FiLayers, FiZap, FiEye, FiX, FiChevronRight, FiFile, FiActivity, FiExternalLink, FiCheck, FiAlertCircle } from 'react-icons/fi'
import { HiOutlineDocumentText, HiOutlineSparkles, HiOutlineCube, HiOutlineChartBar } from 'react-icons/hi'

// ─── Constants ───
const DOCUMENT_INGESTION_AGENT_ID = '699411cf23d48807fdee5100'
const PRD_GENERATION_AGENT_ID = '699411f09e6ec929d6775951'
const RAG_ID = '699411ac7049059138dd0e1f'

const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'E-commerce', 'Education', 'SaaS', 'Manufacturing', 'Retail', 'Other']
const PRODUCT_TYPES = ['B2B', 'B2C', 'Internal Tool']
const DETAIL_LEVELS = ['Lean', 'Standard', 'Comprehensive']
const EMPHASIS_OPTIONS = ['KPIs & Metrics', 'Risk Analysis', 'Technical Scope', 'User Stories', 'Requirements', 'Timeline', 'Market Analysis']

type ScreenType = 'dashboard' | 'library' | 'generate' | 'history'

// ─── Interfaces ───
interface SectionExtracted {
  heading: string
  level: number
  summary: string
}

interface SuggestedTags {
  industry: string
  product_type: string
  complexity: string
  structural_type: string
}

interface FormattingPatterns {
  tone: string
  style: string
}

interface UploadedDoc {
  id: string
  fileName: string
  documentTitle: string
  sectionsExtracted: SectionExtracted[]
  suggestedTags: SuggestedTags
  kpiFrameworks: string[]
  formattingPatterns: FormattingPatterns
  contentSummary: string
  uploadedAt: string
  starred: boolean
  customTags: string[]
}

interface PRDSection {
  title: string
  anchor: string
}

interface PRDMetadata {
  word_count: number
  emphasis_areas: string[]
  reference_documents_used: number
}

interface ArtifactFileItem {
  file_url: string
  name?: string
  format_type?: string
}

interface GeneratedPRD {
  id: string
  prdTitle: string
  industry: string
  productType: string
  detailLevel: string
  prdMarkdown: string
  sections: PRDSection[]
  metadata: PRDMetadata
  artifacts: ArtifactFileItem[]
  createdAt: string
}

interface ActivityItem {
  type: 'upload' | 'generation'
  title: string
  timestamp: string
}

// ─── Sample Data ───
const SAMPLE_DOCS: UploadedDoc[] = [
  {
    id: 'sample-1',
    fileName: 'marketplace-prd-v2.pdf',
    documentTitle: 'E-Commerce Marketplace Platform PRD',
    sectionsExtracted: [
      { heading: 'Executive Summary', level: 1, summary: 'High-level overview of the marketplace platform and its core value proposition.' },
      { heading: 'Problem Statement', level: 1, summary: 'Identifies fragmented seller experience and buyer discovery challenges.' },
      { heading: 'User Personas', level: 2, summary: 'Details three primary personas: Seller, Buyer, and Platform Admin.' },
      { heading: 'Feature Requirements', level: 1, summary: 'Comprehensive listing of P0 and P1 features with acceptance criteria.' },
      { heading: 'KPI Framework', level: 2, summary: 'GMV, take rate, NPS, and seller activation metrics.' },
    ],
    suggestedTags: { industry: 'E-commerce', product_type: 'B2C', complexity: 'High', structural_type: 'Full PRD' },
    kpiFrameworks: ['GMV Growth Rate', 'Take Rate Optimization', 'Net Promoter Score', 'Seller Activation Rate'],
    formattingPatterns: { tone: 'Professional', style: 'Structured' },
    contentSummary: 'A comprehensive product requirements document for a two-sided marketplace platform focusing on seller tools, buyer discovery, and transaction management.',
    uploadedAt: '2026-02-15T10:30:00Z',
    starred: true,
    customTags: [],
  },
  {
    id: 'sample-2',
    fileName: 'analytics-dashboard-spec.docx',
    documentTitle: 'Analytics Dashboard Product Specification',
    sectionsExtracted: [
      { heading: 'Overview', level: 1, summary: 'Real-time analytics dashboard for SaaS metrics.' },
      { heading: 'Technical Architecture', level: 1, summary: 'Event-driven architecture using streaming pipelines.' },
      { heading: 'Data Visualization Requirements', level: 2, summary: 'Chart types, refresh rates, and drill-down capabilities.' },
    ],
    suggestedTags: { industry: 'SaaS', product_type: 'B2B', complexity: 'Medium', structural_type: 'Technical Spec' },
    kpiFrameworks: ['Monthly Active Users', 'Dashboard Load Time', 'Data Freshness SLA'],
    formattingPatterns: { tone: 'Technical', style: 'Modular' },
    contentSummary: 'Technical product specification for a real-time analytics dashboard targeting SaaS companies, with emphasis on data pipeline architecture and visualization.',
    uploadedAt: '2026-02-14T14:15:00Z',
    starred: false,
    customTags: ['data-viz'],
  },
  {
    id: 'sample-3',
    fileName: 'patient-portal-lean-prd.txt',
    documentTitle: 'Patient Portal - Lean PRD',
    sectionsExtracted: [
      { heading: 'Problem', level: 1, summary: 'Patients lack a unified view of health records and appointments.' },
      { heading: 'Solution Hypothesis', level: 1, summary: 'Mobile-first portal with appointment scheduling and record access.' },
      { heading: 'Success Metrics', level: 2, summary: 'Appointment booking rate, patient satisfaction score.' },
    ],
    suggestedTags: { industry: 'Healthcare', product_type: 'B2C', complexity: 'Low', structural_type: 'Lean PRD' },
    kpiFrameworks: ['Appointment Booking Rate', 'Patient Satisfaction Score'],
    formattingPatterns: { tone: 'Empathetic', style: 'Lean' },
    contentSummary: 'A lean product requirements document for a patient-facing health portal focused on appointment scheduling and electronic health record access.',
    uploadedAt: '2026-02-13T09:00:00Z',
    starred: false,
    customTags: ['HIPAA'],
  },
]

const SAMPLE_PRDS: GeneratedPRD[] = [
  {
    id: 'gen-1',
    prdTitle: 'AI-Powered Inventory Management System',
    industry: 'Retail',
    productType: 'B2B',
    detailLevel: 'Comprehensive',
    prdMarkdown: '# AI-Powered Inventory Management System\n\n## Executive Summary\n\nThis PRD outlines the requirements for an AI-powered inventory management system designed for mid-to-large retail operations. The system leverages machine learning to predict demand, optimize stock levels, and reduce waste.\n\n## Problem Statement\n\nRetailers lose approximately 8% of revenue annually due to inventory mismanagement, including overstocking, stockouts, and perishable goods waste. Current solutions rely on manual forecasting and lack real-time adaptation.\n\n## Target Users\n\n- **Inventory Managers**: Primary users who monitor and adjust stock levels daily\n- **Store Managers**: Need visibility into store-level inventory health\n- **Supply Chain Directors**: Require cross-location analytics and forecasting\n\n## Key Features\n\n### P0 - Must Have\n- Real-time inventory tracking across all locations\n- AI demand forecasting with 90%+ accuracy target\n- Automated reorder point calculations\n- Low-stock and overstock alerts\n\n### P1 - Should Have\n- Perishable goods expiry tracking\n- Supplier lead time optimization\n- Seasonal trend analysis\n- Integration with POS systems\n\n## KPIs & Metrics\n\n| Metric | Target | Measurement |\n|--------|--------|-------------|\n| Forecast Accuracy | >90% | Weekly |\n| Stockout Rate | <2% | Daily |\n| Inventory Turnover | +25% improvement | Monthly |\n| Waste Reduction | -40% | Quarterly |\n\n## Timeline\n\n1. **Phase 1 (Q1)**: Core tracking and alerting\n2. **Phase 2 (Q2)**: AI forecasting engine\n3. **Phase 3 (Q3)**: Supplier integration and optimization\n\n## Risk Analysis\n\n- **Data Quality**: Legacy systems may produce inconsistent data\n- **Model Accuracy**: Initial forecasting may underperform until sufficient training data is collected\n- **Change Management**: Staff adoption may require dedicated training programs',
    sections: [
      { title: 'Executive Summary', anchor: 'executive-summary' },
      { title: 'Problem Statement', anchor: 'problem-statement' },
      { title: 'Target Users', anchor: 'target-users' },
      { title: 'Key Features', anchor: 'key-features' },
      { title: 'KPIs & Metrics', anchor: 'kpis--metrics' },
      { title: 'Timeline', anchor: 'timeline' },
      { title: 'Risk Analysis', anchor: 'risk-analysis' },
    ],
    metadata: { word_count: 287, emphasis_areas: ['KPIs & Metrics', 'Risk Analysis', 'Timeline'], reference_documents_used: 2 },
    artifacts: [],
    createdAt: '2026-02-16T16:45:00Z',
  },
]

const SAMPLE_ACTIVITY: ActivityItem[] = [
  { type: 'generation', title: 'AI-Powered Inventory Management System', timestamp: '2026-02-16T16:45:00Z' },
  { type: 'upload', title: 'E-Commerce Marketplace Platform PRD', timestamp: '2026-02-15T10:30:00Z' },
  { type: 'upload', title: 'Analytics Dashboard Product Specification', timestamp: '2026-02-14T14:15:00Z' },
  { type: 'upload', title: 'Patient Portal - Lean PRD', timestamp: '2026-02-13T09:00:00Z' },
]

// ─── Agent Response Extraction ───
// Robustly extract structured data from any agent response shape.
// Handles: direct JSON objects, stringified JSON, nested wrappers,
// plain text/markdown fallbacks, and parseLLMJson failure objects.
function extractAgentData(result: any): Record<string, any> | null {
  // 1. Try the standard path: result.response.result (object with schema fields)
  const responseResult = result?.response?.result
  if (responseResult && typeof responseResult === 'object' && !Array.isArray(responseResult)) {
    // Check if this looks like actual schema data (has known keys, not a wrapper)
    const keys = Object.keys(responseResult)
    const hasSchemaKeys = keys.some(k =>
      ['prd_title', 'prd_markdown', 'document_title', 'sections_extracted',
       'content_summary', 'suggested_tags', 'kpi_frameworks', 'formatting_patterns',
       'industry', 'product_type', 'detail_level', 'sections', 'metadata'].includes(k)
    )
    if (hasSchemaKeys) return responseResult
  }

  // 2. If result.response.result is a string, try parsing it
  if (typeof responseResult === 'string' && responseResult.trim().length > 0) {
    const parsed = parseLLMJson(responseResult)
    if (parsed && typeof parsed === 'object' && !parsed.error) return parsed
  }

  // 3. Try parseLLMJson on the full response object
  const fromResponse = parseLLMJson(result?.response?.result || result?.response)
  if (fromResponse && typeof fromResponse === 'object' && !fromResponse.error) {
    // Verify it's not just the failure sentinel
    if (!('success' in fromResponse && fromResponse.success === false && fromResponse.data === null)) {
      return fromResponse
    }
  }

  // 4. Try raw_response if available
  if (typeof result?.raw_response === 'string') {
    const fromRaw = parseLLMJson(result.raw_response)
    if (fromRaw && typeof fromRaw === 'object' && !fromRaw.error) {
      if (!('success' in fromRaw && fromRaw.success === false && fromRaw.data === null)) {
        return fromRaw
      }
    }
  }

  // 5. Try result.response.message as potential JSON
  if (typeof result?.response?.message === 'string' && result.response.message.trim().length > 0) {
    const fromMsg = parseLLMJson(result.response.message)
    if (fromMsg && typeof fromMsg === 'object' && !fromMsg.error) {
      if (!('success' in fromMsg && fromMsg.success === false && fromMsg.data === null)) {
        return fromMsg
      }
    }
  }

  return null
}

// Extract plain text content from agent response for markdown fallback
function extractAgentText(result: any): string {
  const resp = result?.response
  if (!resp) return ''
  // result field might be a string of markdown
  if (typeof resp.result === 'string') return resp.result
  // message field
  if (typeof resp.message === 'string') return resp.message
  // text field inside result
  if (typeof resp.result?.text === 'string') return resp.result.text
  if (typeof resp.result?.message === 'string') return resp.result.message
  if (typeof resp.result?.content === 'string') return resp.result.content
  if (typeof resp.result?.prd_markdown === 'string') return resp.result.prd_markdown
  // raw_response
  if (typeof result?.raw_response === 'string') return result.raw_response
  return ''
}

// ─── Reconstruct Markdown from structured PRD data ───
function reconstructMarkdownFromPRD(prd: { prdTitle?: string; industry?: string; productType?: string; detailLevel?: string; sections?: { title: string; anchor?: string }[]; metadata?: { word_count?: number; emphasis_areas?: string[]; reference_documents_used?: number } }): string {
  const lines: string[] = []
  if (prd.prdTitle) lines.push(`# ${prd.prdTitle}`, '')
  const meta: string[] = []
  if (prd.industry) meta.push(`**Industry:** ${prd.industry}`)
  if (prd.productType) meta.push(`**Product Type:** ${prd.productType}`)
  if (prd.detailLevel) meta.push(`**Detail Level:** ${prd.detailLevel}`)
  if (meta.length > 0) lines.push(meta.join(' | '), '')
  if (Array.isArray(prd.metadata?.emphasis_areas) && prd.metadata!.emphasis_areas.length > 0) {
    lines.push(`**Emphasis Areas:** ${prd.metadata!.emphasis_areas.join(', ')}`, '')
  }
  if (Array.isArray(prd.sections) && prd.sections.length > 0) {
    lines.push('## Table of Contents', '')
    prd.sections.forEach((sec, i) => {
      lines.push(`${i + 1}. ${sec.title}`)
    })
    lines.push('')
    prd.sections.forEach(sec => {
      lines.push(`## ${sec.title}`, '', '*(Content generated by AI — section details were not captured in markdown format)*', '')
    })
  }
  return lines.join('\n')
}

// Helper to get downloadable markdown content for a PRD, with fallback reconstruction
function getDownloadableMarkdown(prd: GeneratedPRD): string {
  if (prd.prdMarkdown && prd.prdMarkdown.trim().length > 0) return prd.prdMarkdown
  return reconstructMarkdownFromPRD(prd)
}

// ─── Markdown Renderer ───
function convertMarkdownToHtml(md: string): string {
  if (!md) return ''
  let html = md
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre class="bg-secondary p-4 overflow-x-auto text-sm font-mono my-4 border border-border"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
  })
  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)*)/gm, (_m, header, _sep, body) => {
    const headerCells = header.split('|').filter((c: string) => c.trim())
    const rows = body.trim().split('\n').filter((r: string) => r.trim())
    let table = '<table class="w-full my-4 text-sm border-collapse"><thead><tr>'
    headerCells.forEach((c: string) => { table += `<th class="border border-border px-3 py-2 text-left font-medium bg-secondary">${c.trim()}</th>` })
    table += '</tr></thead><tbody>'
    rows.forEach((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim())
      table += '<tr>'
      cells.forEach((c: string) => { table += `<td class="border border-border px-3 py-2">${c.trim()}</td>` })
      table += '</tr>'
    })
    table += '</tbody></table>'
    return table
  })
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-medium mt-6 mb-2 font-serif tracking-wider">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-medium mt-8 mb-3 font-serif tracking-wider border-b border-border pb-2">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-medium mt-8 mb-4 font-serif tracking-wider">$1</h1>')
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-primary pl-4 my-3 text-muted-foreground italic">$1</blockquote>')
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-6 border-border" />')
  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-medium">$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-secondary px-1.5 py-0.5 text-sm font-mono">$1</code>')
  // Ordered lists
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-6 list-decimal text-sm leading-relaxed">$2</li>')
  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li class="ml-6 list-disc text-sm leading-relaxed">$1</li>')
  // Paragraphs (lines that aren't tags)
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p class="text-sm leading-relaxed mb-2">$1</p>')
  // Clean up excess whitespace
  html = html.replace(/\n{2,}/g, '\n')
  return html
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-medium text-sm mt-4 mb-1 font-serif tracking-wider">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-medium text-base mt-5 mb-2 font-serif tracking-wider">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-medium text-lg mt-6 mb-2 font-serif tracking-wider">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-5 list-disc text-sm leading-relaxed">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-5 list-decimal text-sm leading-relaxed">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-primary pl-4 text-muted-foreground italic text-sm">{line.slice(2)}</blockquote>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm leading-relaxed">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-medium">{part}</strong> : part
  )
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts
  }
}

function formatDateShort(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ts
  }
}

// ─── Sidebar Nav Item ───
function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-sm tracking-wider transition-all duration-200 text-left',
        active
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground font-light'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ─── Inline Status Message ───
function StatusMessage({ message, type, onDismiss }: { message: string; type: 'success' | 'error' | 'info'; onDismiss?: () => void }) {
  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-3 text-sm tracking-wide border',
      type === 'success' && 'bg-green-50 text-green-800 border-green-200',
      type === 'error' && 'bg-red-50 text-red-800 border-red-200',
      type === 'info' && 'bg-blue-50 text-blue-800 border-blue-200'
    )}>
      {type === 'success' && <FiCheck className="w-4 h-4 flex-shrink-0" />}
      {type === 'error' && <FiAlertCircle className="w-4 h-4 flex-shrink-0" />}
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="ml-2 hover:opacity-70">
          <FiX className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── Metric Card ───
function MetricCard({ icon, label, value, sublabel }: { icon: React.ReactNode; label: string; value: string | number; sublabel?: string }) {
  return (
    <Card className="border border-border shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs tracking-widest uppercase text-muted-foreground font-light mb-2">{label}</p>
            <p className="text-3xl font-light font-serif tracking-wider">{value}</p>
            {sublabel && <p className="text-xs text-muted-foreground mt-1 tracking-wide">{sublabel}</p>}
          </div>
          <div className="p-2 bg-secondary text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Dashboard Screen ───
function DashboardScreen({
  uploadedDocs,
  generatedPRDs,
  recentActivity,
  onNavigate,
}: {
  uploadedDocs: UploadedDoc[]
  generatedPRDs: GeneratedPRD[]
  recentActivity: ActivityItem[]
  onNavigate: (screen: ScreenType) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-light font-serif tracking-wider mb-1">Dashboard</h1>
        <p className="text-sm text-muted-foreground tracking-wide font-light">Overview of your PRD workspace</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard icon={<FiFileText className="w-5 h-5" />} label="Uploaded PRDs" value={uploadedDocs.length} sublabel="In knowledge base" />
        <MetricCard icon={<HiOutlineSparkles className="w-5 h-5" />} label="Generated PRDs" value={generatedPRDs.length} sublabel="AI-generated documents" />
        <MetricCard icon={<HiOutlineChartBar className="w-5 h-5" />} label="Avg. Relevance" value={generatedPRDs.length > 0 ? `${Math.round(generatedPRDs.reduce((acc, p) => acc + (p.metadata?.reference_documents_used ?? 0), 0) / generatedPRDs.length)}` : '---'} sublabel="Ref. documents used" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => onNavigate('library')}>
          <CardContent className="p-8 flex items-center gap-6">
            <div className="p-4 bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <FiUpload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-serif tracking-wider font-medium mb-1">Upload New PRD</h3>
              <p className="text-sm text-muted-foreground font-light tracking-wide">Add reference documents to your knowledge base</p>
            </div>
            <FiChevronRight className="w-5 h-5 text-muted-foreground ml-auto group-hover:text-foreground transition-colors" />
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => onNavigate('generate')}>
          <CardContent className="p-8 flex items-center gap-6">
            <div className="p-4 bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <HiOutlineSparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-serif tracking-wider font-medium mb-1">Generate PRD</h3>
              <p className="text-sm text-muted-foreground font-light tracking-wide">Create a new PRD with AI assistance</p>
            </div>
            <FiChevronRight className="w-5 h-5 text-muted-foreground ml-auto group-hover:text-foreground transition-colors" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm tracking-widest uppercase font-light text-muted-foreground">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground font-light tracking-wide py-4 text-center">No recent activity. Upload a PRD or generate one to get started.</p>
          ) : (
            <div className="space-y-0">
              {recentActivity.slice(0, 8).map((item, i) => (
                <div key={`activity-${i}`} className="flex items-center gap-4 py-3 border-b border-border last:border-b-0">
                  <div className={cn('p-1.5', item.type === 'upload' ? 'text-blue-600' : 'text-amber-600')}>
                    {item.type === 'upload' ? <FiUpload className="w-4 h-4" /> : <HiOutlineSparkles className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-light tracking-wide truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground tracking-wide">{item.type === 'upload' ? 'Uploaded to knowledge base' : 'Generated via AI'}</p>
                  </div>
                  <p className="text-xs text-muted-foreground tracking-wide flex-shrink-0">{formatDateShort(item.timestamp)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Library Screen ───
function LibraryScreen({
  uploadedDocs,
  setUploadedDocs,
  recentActivity,
  setRecentActivity,
  activeAgentId,
  setActiveAgentId,
  sessionId,
  setSessionId,
  agentActivity,
}: {
  uploadedDocs: UploadedDoc[]
  setUploadedDocs: React.Dispatch<React.SetStateAction<UploadedDoc[]>>
  recentActivity: ActivityItem[]
  setRecentActivity: React.Dispatch<React.SetStateAction<ActivityItem[]>>
  activeAgentId: string | null
  setActiveAgentId: React.Dispatch<React.SetStateAction<string | null>>
  sessionId: string | null
  setSessionId: React.Dispatch<React.SetStateAction<string | null>>
  agentActivity: ReturnType<typeof useLyzrAgentEvents>
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<UploadedDoc | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showStatus = useCallback((text: string, type: 'success' | 'error' | 'info') => {
    setStatusMsg({ text, type })
    if (type === 'success') {
      setTimeout(() => setStatusMsg(null), 4000)
    }
  }, [])

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]

    const validation = validateFile(file)
    if (!validation.valid) {
      showStatus(validation.error || 'Unsupported file type. Use PDF, DOCX, or TXT.', 'error')
      return
    }

    setUploading(true)
    showStatus(`Uploading ${file.name} to knowledge base...`, 'info')

    try {
      const uploadResult = await uploadAndTrainDocument(RAG_ID, file)

      if (!uploadResult.success) {
        showStatus(uploadResult.error || 'Upload failed', 'error')
        setUploading(false)
        return
      }

      showStatus(`Analyzing document structure...`, 'info')
      setAnalyzing(true)
      setActiveAgentId(DOCUMENT_INGESTION_AGENT_ID)
      agentActivity.setProcessing(true)

      const agentResult = await callAIAgent(
        `Analyze this uploaded PRD document: ${file.name}. Extract structural patterns, sections, metadata tags, and KPI frameworks.`,
        DOCUMENT_INGESTION_AGENT_ID
      )

      if (agentResult.session_id) {
        setSessionId(agentResult.session_id)
      }

      agentActivity.setProcessing(false)

      if (agentResult.success) {
        const parsed = extractAgentData(agentResult)

        const newDoc: UploadedDoc = {
          id: Date.now().toString(),
          fileName: file.name,
          documentTitle: parsed?.document_title || file.name.replace(/\.[^/.]+$/, ''),
          sectionsExtracted: Array.isArray(parsed?.sections_extracted) ? parsed.sections_extracted : [],
          suggestedTags: parsed?.suggested_tags || { industry: '', product_type: '', complexity: '', structural_type: '' },
          kpiFrameworks: Array.isArray(parsed?.kpi_frameworks) ? parsed.kpi_frameworks : [],
          formattingPatterns: parsed?.formatting_patterns || { tone: '', style: '' },
          contentSummary: parsed?.content_summary || extractAgentText(agentResult).slice(0, 500) || '',
          uploadedAt: new Date().toISOString(),
          starred: false,
          customTags: [],
        }

        setUploadedDocs(prev => [newDoc, ...prev])
        setRecentActivity(prev => [{ type: 'upload', title: newDoc.documentTitle, timestamp: newDoc.uploadedAt }, ...prev])
        showStatus(`Successfully uploaded and analyzed "${newDoc.documentTitle}"`, 'success')
      } else {
        // Still add the doc even if analysis failed
        const fallbackDoc: UploadedDoc = {
          id: Date.now().toString(),
          fileName: file.name,
          documentTitle: file.name.replace(/\.[^/.]+$/, ''),
          sectionsExtracted: [],
          suggestedTags: { industry: '', product_type: '', complexity: '', structural_type: '' },
          kpiFrameworks: [],
          formattingPatterns: { tone: '', style: '' },
          contentSummary: '',
          uploadedAt: new Date().toISOString(),
          starred: false,
          customTags: [],
        }
        setUploadedDocs(prev => [fallbackDoc, ...prev])
        setRecentActivity(prev => [{ type: 'upload', title: fallbackDoc.documentTitle, timestamp: fallbackDoc.uploadedAt }, ...prev])
        showStatus('Document uploaded but analysis failed. Metadata may be incomplete.', 'error')
      }
    } catch (err) {
      showStatus(err instanceof Error ? err.message : 'An error occurred during upload', 'error')
      agentActivity.setProcessing(false)
    }

    setUploading(false)
    setAnalyzing(false)
    setActiveAgentId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDelete = async (docId: string) => {
    const doc = uploadedDocs.find(d => d.id === docId)
    if (!doc) return

    try {
      await deleteDocuments(RAG_ID, [doc.fileName])
    } catch {
      // Continue with local delete even if KB delete fails
    }
    setUploadedDocs(prev => prev.filter(d => d.id !== docId))
    setDeleteConfirm(null)
    showStatus(`"${doc.documentTitle}" removed`, 'success')
  }

  const toggleStar = (docId: string) => {
    setUploadedDocs(prev => prev.map(d => d.id === docId ? { ...d, starred: !d.starred } : d))
  }

  const filteredDocs = uploadedDocs.filter(doc => {
    const matchesSearch = !searchQuery || doc.documentTitle.toLowerCase().includes(searchQuery.toLowerCase()) || doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesIndustry = industryFilter === 'all' || (doc.suggestedTags?.industry || '').toLowerCase() === industryFilter.toLowerCase()
    return matchesSearch && matchesIndustry
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light font-serif tracking-wider mb-1">PRD Library</h1>
        <p className="text-sm text-muted-foreground tracking-wide font-light">Upload and manage reference PRD documents</p>
      </div>

      {statusMsg && <StatusMessage message={statusMsg.text} type={statusMsg.type} onDismiss={() => setStatusMsg(null)} />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search documents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 font-light tracking-wide" />
        </div>
        <Select value={industryFilter} onValueChange={setIndustryFilter}>
          <SelectTrigger className="w-full sm:w-48 font-light tracking-wide">
            <SelectValue placeholder="All Industries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Industries</SelectItem>
            {INDUSTRIES.map(ind => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-200',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/50',
          (uploading || analyzing) && 'pointer-events-none opacity-60'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={e => handleFileSelect(e.target.files)}
        />
        {uploading || analyzing ? (
          <div className="space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground tracking-wide font-light">{analyzing ? 'Analyzing document structure...' : 'Uploading to knowledge base...'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <FiUpload className="w-8 h-8 mx-auto text-muted-foreground" />
            <div>
              <p className="text-sm font-light tracking-wide">Drop a file here or click to browse</p>
              <p className="text-xs text-muted-foreground tracking-wide mt-1">Accepts PDF, DOCX, TXT</p>
            </div>
          </div>
        )}
      </div>

      {/* Document Grid */}
      {filteredDocs.length === 0 ? (
        <div className="text-center py-16">
          <FiFileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground font-light tracking-wide">No documents found. Upload your first PRD to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocs.map(doc => (
            <Card key={doc.id} className="border border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedDoc(doc); setDetailOpen(true) }}>
                    <h3 className="text-sm font-medium font-serif tracking-wider truncate">{doc.documentTitle}</h3>
                    <p className="text-xs text-muted-foreground tracking-wide mt-0.5">{doc.fileName}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button onClick={() => toggleStar(doc.id)} className="p-1 hover:bg-secondary transition-colors">
                      <FiStar className={cn('w-4 h-4', doc.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
                    </button>
                    <button onClick={() => setDeleteConfirm(doc.id)} className="p-1 hover:bg-secondary transition-colors text-muted-foreground hover:text-destructive">
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {doc.contentSummary && (
                  <p className="text-xs text-muted-foreground font-light leading-relaxed mb-3 line-clamp-2">{doc.contentSummary}</p>
                )}

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {doc.suggestedTags?.industry && <Badge variant="secondary" className="text-xs font-light tracking-wide">{doc.suggestedTags.industry}</Badge>}
                  {doc.suggestedTags?.product_type && <Badge variant="secondary" className="text-xs font-light tracking-wide">{doc.suggestedTags.product_type}</Badge>}
                  {doc.suggestedTags?.complexity && <Badge variant="outline" className="text-xs font-light tracking-wide">{doc.suggestedTags.complexity}</Badge>}
                  {doc.suggestedTags?.structural_type && <Badge variant="outline" className="text-xs font-light tracking-wide">{doc.suggestedTags.structural_type}</Badge>}
                  {Array.isArray(doc.customTags) && doc.customTags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs font-light tracking-wide bg-primary/10 text-primary">{tag}</Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground tracking-wide">{formatDateShort(doc.uploadedAt)}</p>
                  <p className="text-xs text-muted-foreground tracking-wide">{(doc.sectionsExtracted?.length ?? 0)} sections</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif tracking-wider font-medium">{selectedDoc?.documentTitle}</DialogTitle>
            <DialogDescription className="tracking-wide font-light">{selectedDoc?.fileName}</DialogDescription>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-5 mt-2">
              {selectedDoc.contentSummary && (
                <div>
                  <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2 font-light">Summary</p>
                  <p className="text-sm leading-relaxed font-light">{selectedDoc.contentSummary}</p>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2 font-light">Metadata Tags</p>
                <div className="flex flex-wrap gap-2">
                  {selectedDoc.suggestedTags?.industry && <Badge variant="secondary" className="font-light tracking-wide">{selectedDoc.suggestedTags.industry}</Badge>}
                  {selectedDoc.suggestedTags?.product_type && <Badge variant="secondary" className="font-light tracking-wide">{selectedDoc.suggestedTags.product_type}</Badge>}
                  {selectedDoc.suggestedTags?.complexity && <Badge variant="outline" className="font-light tracking-wide">{selectedDoc.suggestedTags.complexity}</Badge>}
                  {selectedDoc.suggestedTags?.structural_type && <Badge variant="outline" className="font-light tracking-wide">{selectedDoc.suggestedTags.structural_type}</Badge>}
                </div>
              </div>

              {Array.isArray(selectedDoc.sectionsExtracted) && selectedDoc.sectionsExtracted.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3 font-light">Section Breakdown</p>
                    <div className="space-y-2">
                      {selectedDoc.sectionsExtracted.map((sec, i) => (
                        <div key={i} className="p-3 bg-secondary/50 border border-border">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs font-light">H{sec.level ?? 1}</Badge>
                            <span className="text-sm font-medium tracking-wide">{sec.heading}</span>
                          </div>
                          {sec.summary && <p className="text-xs text-muted-foreground font-light leading-relaxed ml-10">{sec.summary}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {Array.isArray(selectedDoc.kpiFrameworks) && selectedDoc.kpiFrameworks.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2 font-light">KPI Frameworks</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDoc.kpiFrameworks.map((kpi, i) => (
                        <Badge key={i} variant="secondary" className="font-light tracking-wide">{kpi}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedDoc.formattingPatterns && (selectedDoc.formattingPatterns.tone || selectedDoc.formattingPatterns.style) && (
                <>
                  <Separator />
                  <div className="flex gap-6">
                    {selectedDoc.formattingPatterns.tone && (
                      <div>
                        <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1 font-light">Tone</p>
                        <p className="text-sm font-light">{selectedDoc.formattingPatterns.tone}</p>
                      </div>
                    )}
                    {selectedDoc.formattingPatterns.style && (
                      <div>
                        <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1 font-light">Style</p>
                        <p className="text-sm font-light">{selectedDoc.formattingPatterns.style}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif tracking-wider font-medium">Remove Document</DialogTitle>
            <DialogDescription className="tracking-wide font-light">This will remove the document from your library and knowledge base. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="font-light tracking-wider">Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="font-light tracking-wider">Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Generate Screen ───
function GenerateScreen({
  generatedPRDs,
  setGeneratedPRDs,
  recentActivity,
  setRecentActivity,
  activeAgentId,
  setActiveAgentId,
  sessionId,
  setSessionId,
  agentActivity,
}: {
  generatedPRDs: GeneratedPRD[]
  setGeneratedPRDs: React.Dispatch<React.SetStateAction<GeneratedPRD[]>>
  recentActivity: ActivityItem[]
  setRecentActivity: React.Dispatch<React.SetStateAction<ActivityItem[]>>
  activeAgentId: string | null
  setActiveAgentId: React.Dispatch<React.SetStateAction<string | null>>
  sessionId: string | null
  setSessionId: React.Dispatch<React.SetStateAction<string | null>>
  agentActivity: ReturnType<typeof useLyzrAgentEvents>
}) {
  const [industry, setIndustry] = useState('')
  const [productType, setProductType] = useState('B2B')
  const [detailLevel, setDetailLevel] = useState('Standard')
  const [emphasis, setEmphasis] = useState<string[]>([])
  const [productName, setProductName] = useState('')
  const [problemStatement, setProblemStatement] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [currentPRD, setCurrentPRD] = useState<GeneratedPRD | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  const toggleEmphasis = (item: string) => {
    setEmphasis(prev => prev.includes(item) ? prev.filter(e => e !== item) : [...prev, item])
  }

  const handleGenerate = async () => {
    if (!productName.trim()) {
      setStatusMsg({ text: 'Please provide a product name.', type: 'error' })
      return
    }
    if (!industry) {
      setStatusMsg({ text: 'Please select an industry.', type: 'error' })
      return
    }

    setGenerating(true)
    setGenerateError(null)
    setStatusMsg({ text: 'Generating your PRD...', type: 'info' })
    setActiveAgentId(PRD_GENERATION_AGENT_ID)
    agentActivity.setProcessing(true)

    const prompt = `Generate a ${detailLevel} PRD for a ${productType} product in the ${industry} industry.
Product Name: ${productName}
Problem Statement: ${problemStatement || 'Not specified'}
Emphasize these sections: ${emphasis.length > 0 ? emphasis.join(', ') : 'Standard coverage'}
Output the PRD in well-structured Markdown format with clear section headings.`

    try {
      const result = await callAIAgent(prompt, PRD_GENERATION_AGENT_ID)

      if (result.session_id) {
        setSessionId(result.session_id)
      }

      agentActivity.setProcessing(false)

      if (result.success) {
        // Try structured JSON extraction first, then fall back to text/markdown
        const parsed = extractAgentData(result)
        const fallbackText = extractAgentText(result)

        if (parsed && (parsed.prd_title || parsed.prd_markdown || parsed.sections)) {
          // Structured JSON response — map schema fields
          const newPRD: GeneratedPRD = {
            id: Date.now().toString(),
            prdTitle: parsed.prd_title || productName || 'Untitled PRD',
            industry: parsed.industry || industry,
            productType: parsed.product_type || productType,
            detailLevel: parsed.detail_level || detailLevel,
            prdMarkdown: parsed.prd_markdown || fallbackText || '',
            sections: Array.isArray(parsed.sections) ? parsed.sections : [],
            metadata: {
              word_count: parsed.metadata?.word_count ?? 0,
              emphasis_areas: Array.isArray(parsed.metadata?.emphasis_areas) ? parsed.metadata.emphasis_areas : [],
              reference_documents_used: parsed.metadata?.reference_documents_used ?? 0,
            },
            artifacts: Array.isArray(result.module_outputs?.artifact_files) ? result.module_outputs.artifact_files : [],
            createdAt: new Date().toISOString(),
          }

          setCurrentPRD(newPRD)
          setGeneratedPRDs(prev => [newPRD, ...prev])
          setRecentActivity(prev => [{ type: 'generation', title: newPRD.prdTitle, timestamp: newPRD.createdAt }, ...prev])
          setStatusMsg({ text: `"${newPRD.prdTitle}" generated successfully`, type: 'success' })
          setTimeout(() => setStatusMsg(null), 4000)
        } else if (fallbackText.trim().length > 50) {
          // Agent returned plain text or markdown — use it directly as the PRD content
          const titleMatch = fallbackText.match(/^#\s+(.+)$/m)
          const inferredTitle = titleMatch ? titleMatch[1].trim() : productName || 'Untitled PRD'

          // Extract section headings from markdown
          const headingMatches = [...fallbackText.matchAll(/^##\s+(.+)$/gm)]
          const inferredSections: PRDSection[] = headingMatches.map(m => ({
            title: m[1].trim(),
            anchor: m[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          }))

          const wordCount = fallbackText.split(/\s+/).filter(Boolean).length

          const newPRD: GeneratedPRD = {
            id: Date.now().toString(),
            prdTitle: inferredTitle,
            industry: industry,
            productType: productType,
            detailLevel: detailLevel,
            prdMarkdown: fallbackText,
            sections: inferredSections,
            metadata: {
              word_count: wordCount,
              emphasis_areas: emphasis.length > 0 ? emphasis : [],
              reference_documents_used: 0,
            },
            artifacts: Array.isArray(result.module_outputs?.artifact_files) ? result.module_outputs.artifact_files : [],
            createdAt: new Date().toISOString(),
          }

          setCurrentPRD(newPRD)
          setGeneratedPRDs(prev => [newPRD, ...prev])
          setRecentActivity(prev => [{ type: 'generation', title: newPRD.prdTitle, timestamp: newPRD.createdAt }, ...prev])
          setStatusMsg({ text: `"${newPRD.prdTitle}" generated successfully`, type: 'success' })
          setTimeout(() => setStatusMsg(null), 4000)
        } else {
          setGenerateError('Failed to parse PRD response. Please try again.')
          setStatusMsg({ text: 'Failed to parse PRD response', type: 'error' })
        }
      } else {
        setGenerateError(result.error || 'Failed to generate PRD')
        setStatusMsg({ text: result.error || 'Generation failed', type: 'error' })
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'An error occurred')
      setStatusMsg({ text: err instanceof Error ? err.message : 'An error occurred', type: 'error' })
      agentActivity.setProcessing(false)
    }

    setGenerating(false)
    setActiveAgentId(null)
  }

  const downloadMarkdown = () => {
    if (!currentPRD) {
      setStatusMsg({ text: 'No PRD available to download.', type: 'error' })
      return
    }
    const content = getDownloadableMarkdown(currentPRD)
    if (!content || content.trim().length === 0) {
      setStatusMsg({ text: 'PRD content is empty. Try generating again.', type: 'error' })
      return
    }
    try {
      const blob = new Blob([content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(currentPRD.prdTitle || 'prd').replace(/\s+/g, '-').toLowerCase()}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setStatusMsg({ text: 'Download failed. Try copying the content manually.', type: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light font-serif tracking-wider mb-1">Generate PRD</h1>
        <p className="text-sm text-muted-foreground tracking-wide font-light">Configure and generate a new product requirements document</p>
      </div>

      {statusMsg && <StatusMessage message={statusMsg.text} type={statusMsg.type} onDismiss={() => setStatusMsg(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Configuration Form */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm tracking-widest uppercase font-light text-muted-foreground">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="text-xs tracking-widest uppercase text-muted-foreground font-light mb-2 block">Product Name *</Label>
              <Input placeholder="e.g., Smart Inventory Hub" value={productName} onChange={e => setProductName(e.target.value)} className="font-light tracking-wide" />
            </div>

            <div>
              <Label className="text-xs tracking-widest uppercase text-muted-foreground font-light mb-2 block">Industry *</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="font-light tracking-wide">
                  <SelectValue placeholder="Select an industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(ind => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs tracking-widest uppercase text-muted-foreground font-light mb-2 block">Product Type</Label>
              <ToggleGroup type="single" value={productType} onValueChange={val => { if (val) setProductType(val) }} className="justify-start">
                {PRODUCT_TYPES.map(pt => (
                  <ToggleGroupItem key={pt} value={pt} className="text-xs tracking-wider font-light px-4">{pt}</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div>
              <Label className="text-xs tracking-widest uppercase text-muted-foreground font-light mb-2 block">Detail Level</Label>
              <ToggleGroup type="single" value={detailLevel} onValueChange={val => { if (val) setDetailLevel(val) }} className="justify-start">
                {DETAIL_LEVELS.map(dl => (
                  <ToggleGroupItem key={dl} value={dl} className="text-xs tracking-wider font-light px-4">{dl}</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div>
              <Label className="text-xs tracking-widest uppercase text-muted-foreground font-light mb-2 block">Problem Statement</Label>
              <Textarea placeholder="Describe the core problem your product aims to solve..." value={problemStatement} onChange={e => setProblemStatement(e.target.value)} rows={4} className="font-light tracking-wide leading-relaxed" />
            </div>

            <div>
              <Label className="text-xs tracking-widest uppercase text-muted-foreground font-light mb-3 block">Section Emphasis</Label>
              <div className="grid grid-cols-2 gap-2">
                {EMPHASIS_OPTIONS.map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer py-1.5">
                    <Checkbox checked={emphasis.includes(opt)} onCheckedChange={() => toggleEmphasis(opt)} />
                    <span className="text-xs tracking-wide font-light">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            <Button onClick={handleGenerate} disabled={generating || !productName.trim() || !industry} className="w-full tracking-widest uppercase text-xs font-light py-5">
              {generating ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Generating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <HiOutlineSparkles className="w-4 h-4" />
                  Generate PRD
                </span>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right: Preview */}
        <div className="space-y-4">
          {generating ? (
            <Card className="border border-border shadow-sm">
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ) : currentPRD ? (
            <>
              {/* PRD Header & Actions */}
              <Card className="border border-border shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h2 className="text-lg font-serif tracking-wider font-medium">{currentPRD.prdTitle}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs font-light tracking-wide">{currentPRD.industry}</Badge>
                        <Badge variant="secondary" className="text-xs font-light tracking-wide">{currentPRD.productType}</Badge>
                        <Badge variant="outline" className="text-xs font-light tracking-wide">{currentPRD.detailLevel}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={downloadMarkdown} className="text-xs tracking-wider font-light">
                        <FiDownload className="w-3.5 h-3.5 mr-1.5" />
                        Markdown
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground tracking-wide">
                    {(currentPRD.metadata?.word_count ?? 0) > 0 && <span>{currentPRD.metadata.word_count} words</span>}
                    {(currentPRD.metadata?.reference_documents_used ?? 0) > 0 && <span>{currentPRD.metadata.reference_documents_used} reference docs used</span>}
                    {Array.isArray(currentPRD.metadata?.emphasis_areas) && currentPRD.metadata.emphasis_areas.length > 0 && (
                      <span>Focus: {currentPRD.metadata.emphasis_areas.join(', ')}</span>
                    )}
                  </div>
                  {Array.isArray(currentPRD.artifacts) && currentPRD.artifacts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs tracking-widest uppercase text-muted-foreground font-light mb-2">Downloadable Files</p>
                      <div className="flex flex-wrap gap-2">
                        {currentPRD.artifacts.map((art, i) => (
                          <a key={i} href={art.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline tracking-wide">
                            <FiExternalLink className="w-3 h-3" />
                            {art.name || `File ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Section Navigation */}
              {Array.isArray(currentPRD.sections) && currentPRD.sections.length > 0 && (
                <Card className="border border-border shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs tracking-widest uppercase text-muted-foreground font-light mb-2">Sections</p>
                    <div className="flex flex-wrap gap-1.5">
                      {currentPRD.sections.map((sec, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-light tracking-wide cursor-pointer hover:bg-secondary transition-colors">{sec.title}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Markdown Content */}
              <Card className="border border-border shadow-sm">
                <CardContent className="p-6">
                  <ScrollArea className="max-h-[60vh]">
                    <div className="prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(currentPRD.prdMarkdown) }} />
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border border-border shadow-sm">
              <CardContent className="p-16 text-center">
                <HiOutlineDocumentText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-base font-serif tracking-wider font-medium mb-2">PRD Preview</h3>
                <p className="text-sm text-muted-foreground font-light tracking-wide leading-relaxed max-w-sm mx-auto">
                  Configure your PRD parameters on the left and click Generate to create a new product requirements document powered by your knowledge base.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── History Screen ───
function HistoryScreen({
  generatedPRDs,
  setGeneratedPRDs,
}: {
  generatedPRDs: GeneratedPRD[]
  setGeneratedPRDs: React.Dispatch<React.SetStateAction<GeneratedPRD[]>>
}) {
  const [viewPRD, setViewPRD] = useState<GeneratedPRD | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  const handleDelete = (id: string) => {
    setGeneratedPRDs(prev => prev.filter(p => p.id !== id))
  }

  const downloadMarkdown = (prd: GeneratedPRD) => {
    const content = getDownloadableMarkdown(prd)
    if (!content || content.trim().length === 0) {
      setStatusMsg({ text: 'PRD content is empty. Cannot download.', type: 'error' })
      return
    }
    try {
      const blob = new Blob([content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(prd.prdTitle || 'prd').replace(/\s+/g, '-').toLowerCase()}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setStatusMsg({ text: 'Download failed. Try copying the content manually.', type: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light font-serif tracking-wider mb-1">Generation History</h1>
        <p className="text-sm text-muted-foreground tracking-wide font-light">Review and manage previously generated PRDs</p>
      </div>

      {statusMsg && <StatusMessage message={statusMsg.text} type={statusMsg.type} onDismiss={() => setStatusMsg(null)} />}

      {generatedPRDs.length === 0 ? (
        <Card className="border border-border shadow-sm">
          <CardContent className="p-16 text-center">
            <FiClock className="w-10 h-10 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-serif tracking-wider font-medium mb-2">No PRDs Generated Yet</h3>
            <p className="text-sm text-muted-foreground font-light tracking-wide max-w-sm mx-auto">
              Once you generate your first PRD, it will appear here for easy reference and export.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-5 py-3 text-xs tracking-widest uppercase text-muted-foreground font-light">PRD Name</th>
                  <th className="text-left px-5 py-3 text-xs tracking-widest uppercase text-muted-foreground font-light hidden md:table-cell">Industry</th>
                  <th className="text-left px-5 py-3 text-xs tracking-widest uppercase text-muted-foreground font-light hidden md:table-cell">Detail Level</th>
                  <th className="text-left px-5 py-3 text-xs tracking-widest uppercase text-muted-foreground font-light hidden sm:table-cell">Date</th>
                  <th className="text-right px-5 py-3 text-xs tracking-widest uppercase text-muted-foreground font-light">Actions</th>
                </tr>
              </thead>
              <tbody>
                {generatedPRDs.map(prd => (
                  <tr key={prd.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => { setViewPRD(prd); setViewOpen(true) }}>
                    <td className="px-5 py-4">
                      <p className="font-medium font-serif tracking-wide text-sm">{prd.prdTitle}</p>
                      <p className="text-xs text-muted-foreground tracking-wide mt-0.5">{prd.productType}</p>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <Badge variant="secondary" className="text-xs font-light tracking-wide">{prd.industry}</Badge>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-xs tracking-wide font-light">{prd.detailLevel}</span>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground tracking-wide">{formatDateShort(prd.createdAt)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setViewPRD(prd); setViewOpen(true) }} className="p-1.5 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                          <FiEye className="w-4 h-4" />
                        </button>
                        <button onClick={() => downloadMarkdown(prd)} className="p-1.5 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                          <FiDownload className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(prd.id)} className="p-1.5 hover:bg-secondary transition-colors text-muted-foreground hover:text-destructive">
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* View PRD Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif tracking-wider font-medium">{viewPRD?.prdTitle}</DialogTitle>
            <DialogDescription className="tracking-wide font-light">
              {viewPRD?.industry} | {viewPRD?.productType} | {viewPRD?.detailLevel}
              {(viewPRD?.metadata?.word_count ?? 0) > 0 && ` | ${viewPRD?.metadata?.word_count} words`}
            </DialogDescription>
          </DialogHeader>
          {viewPRD && (
            <div className="mt-2">
              {Array.isArray(viewPRD.metadata?.emphasis_areas) && viewPRD.metadata.emphasis_areas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {viewPRD.metadata.emphasis_areas.map((area, i) => (
                    <Badge key={i} variant="outline" className="text-xs font-light tracking-wide">{area}</Badge>
                  ))}
                </div>
              )}
              <Separator className="mb-4" />
              <ScrollArea className="max-h-[55vh]">
                <div className="prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(viewPRD.prdMarkdown) }} />
              </ScrollArea>
              {Array.isArray(viewPRD.artifacts) && viewPRD.artifacts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs tracking-widest uppercase text-muted-foreground font-light mb-2">Artifact Files</p>
                  <div className="flex flex-wrap gap-2">
                    {viewPRD.artifacts.map((art, i) => (
                      <a key={i} href={art.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline tracking-wide">
                        <FiExternalLink className="w-3 h-3" />
                        {art.name || `File ${i + 1}`}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Page ───
export default function Page() {
  const [activeScreen, setActiveScreen] = useState<ScreenType>('dashboard')
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])
  const [generatedPRDs, setGeneratedPRDs] = useState<GeneratedPRD[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [sampleData, setSampleData] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showActivityPanel, setShowActivityPanel] = useState(false)

  const agentActivity = useLyzrAgentEvents(sessionId)

  // Toggle sample data
  useEffect(() => {
    if (sampleData) {
      setUploadedDocs(SAMPLE_DOCS)
      setGeneratedPRDs(SAMPLE_PRDS)
      setRecentActivity(SAMPLE_ACTIVITY)
    } else {
      setUploadedDocs([])
      setGeneratedPRDs([])
      setRecentActivity([])
    }
  }, [sampleData])

  const NAV_ITEMS: { key: ScreenType; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <FiGrid className="w-4 h-4" /> },
    { key: 'library', label: 'PRD Library', icon: <FiLayers className="w-4 h-4" /> },
    { key: 'generate', label: 'Generate PRD', icon: <HiOutlineSparkles className="w-4 h-4" /> },
    { key: 'history', label: 'History', icon: <FiClock className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-60 border-r border-border bg-card flex-shrink-0 flex flex-col fixed left-0 top-0 bottom-0 z-30">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <h1 className="text-lg font-serif tracking-[0.2em] font-medium text-foreground">PRD AI</h1>
          <p className="text-xs text-muted-foreground tracking-widest uppercase mt-0.5 font-light">Document Intelligence</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map(item => (
            <NavItem key={item.key} icon={item.icon} label={item.label} active={activeScreen === item.key} onClick={() => setActiveScreen(item.key)} />
          ))}
        </nav>

        {/* Agent Info */}
        <div className="p-4 border-t border-border">
          <p className="text-xs tracking-widest uppercase text-muted-foreground font-light mb-3">Agents</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn('w-1.5 h-1.5 rounded-full', activeAgentId === DOCUMENT_INGESTION_AGENT_ID ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30')} />
              <span className="text-xs font-light tracking-wide truncate">Document Ingestion</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn('w-1.5 h-1.5 rounded-full', activeAgentId === PRD_GENERATION_AGENT_ID ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30')} />
              <span className="text-xs font-light tracking-wide truncate">PRD Generation</span>
            </div>
          </div>

          <button onClick={() => setShowActivityPanel(prev => !prev)} className="mt-3 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors tracking-wide font-light w-full">
            <FiActivity className="w-3.5 h-3.5" />
            <span>Agent Activity</span>
            {agentActivity.isProcessing && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-auto" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-sm border-b border-border px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-serif tracking-wider font-medium capitalize">{activeScreen === 'generate' ? 'Generate PRD' : activeScreen === 'library' ? 'PRD Library' : activeScreen}</h2>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="sample-toggle" className="text-xs tracking-wider text-muted-foreground font-light cursor-pointer">Sample Data</Label>
            <Switch id="sample-toggle" checked={sampleData} onCheckedChange={setSampleData} />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          {activeScreen === 'dashboard' && (
            <DashboardScreen
              uploadedDocs={uploadedDocs}
              generatedPRDs={generatedPRDs}
              recentActivity={recentActivity}
              onNavigate={setActiveScreen}
            />
          )}
          {activeScreen === 'library' && (
            <LibraryScreen
              uploadedDocs={uploadedDocs}
              setUploadedDocs={setUploadedDocs}
              recentActivity={recentActivity}
              setRecentActivity={setRecentActivity}
              activeAgentId={activeAgentId}
              setActiveAgentId={setActiveAgentId}
              sessionId={sessionId}
              setSessionId={setSessionId}
              agentActivity={agentActivity}
            />
          )}
          {activeScreen === 'generate' && (
            <GenerateScreen
              generatedPRDs={generatedPRDs}
              setGeneratedPRDs={setGeneratedPRDs}
              recentActivity={recentActivity}
              setRecentActivity={setRecentActivity}
              activeAgentId={activeAgentId}
              setActiveAgentId={setActiveAgentId}
              sessionId={sessionId}
              setSessionId={setSessionId}
              agentActivity={agentActivity}
            />
          )}
          {activeScreen === 'history' && (
            <HistoryScreen
              generatedPRDs={generatedPRDs}
              setGeneratedPRDs={setGeneratedPRDs}
            />
          )}
        </main>
      </div>

      {/* Agent Activity Panel (Slide-in from right) */}
      {showActivityPanel && (
        <div className="fixed right-0 top-0 bottom-0 w-80 border-l border-border bg-card z-40 shadow-lg flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="text-xs tracking-widest uppercase text-muted-foreground font-light">Agent Activity</span>
            <button onClick={() => setShowActivityPanel(false)} className="p-1 hover:bg-secondary transition-colors">
              <FiX className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <AgentActivityPanel
              isConnected={agentActivity.isConnected}
              events={agentActivity.events}
              thinkingEvents={agentActivity.thinkingEvents}
              lastThinkingMessage={agentActivity.lastThinkingMessage}
              activeAgentId={agentActivity.activeAgentId}
              activeAgentName={agentActivity.activeAgentName}
              isProcessing={agentActivity.isProcessing}
              className="h-full border-0 shadow-none rounded-none"
            />
          </div>
        </div>
      )}
    </div>
  )
}
