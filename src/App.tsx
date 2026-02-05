import { useState, useEffect, useMemo } from 'react'

// Types
type Language = 'ru' | 'en' | 'es' | 'ua'
type DictionaryVariant = 'adult' | 'family'

interface Word {
  ru: string
  en: string
  es: string
  ua: string
  intensity: number
  _idx?: number
  _selected?: boolean
}

interface CategoryMeta {
  id: string
  name: string
  emoji: string
  intensityMin: number
  intensityMax: number
}

interface DictionaryData {
  categories: CategoryMeta[]
  words: Record<string, Word[]>
}

type LegacyWordDatabase = Record<Language, Partial<Record<string, string[]>>>

interface VersionInfo {
  version: string
  updatedAt: string
}

// Constants
const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ua', name: 'Українська', flag: '🇺🇦' },
]

const DEFAULT_ADULT_CATEGORIES: CategoryMeta[] = [
  { id: 'party', name: 'Party', emoji: '🎉', intensityMin: 2, intensityMax: 5 },
  { id: 'dirty', name: 'Dirty', emoji: '🔞', intensityMin: 5, intensityMax: 8 },
  { id: 'extreme', name: 'Extreme', emoji: '💀', intensityMin: 8, intensityMax: 10 },
]

const DEFAULT_FAMILY_CATEGORIES: CategoryMeta[] = [
  { id: 'movies', name: 'Movies', emoji: '🎬', intensityMin: 1, intensityMax: 2 },
  { id: 'food', name: 'Food', emoji: '🍕', intensityMin: 1, intensityMax: 2 },
  { id: 'animals', name: 'Animals', emoji: '🐱', intensityMin: 1, intensityMax: 2 },
  { id: 'sports', name: 'Sports', emoji: '⚽', intensityMin: 1, intensityMax: 2 },
  { id: 'travel', name: 'Travel', emoji: '✈️', intensityMin: 1, intensityMax: 2 },
  { id: 'professions', name: 'Professions', emoji: '👨‍⚕️', intensityMin: 1, intensityMax: 2 },
]

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/Syrohub/guessus-dictionary/main'
const GITHUB_REPO = 'Syrohub/guessus-dictionary'
const GITHUB_API_BASE = 'https://api.github.com'

const INTENSITY_LABELS: Record<number, string> = {
  1: 'Безобидно', 2: 'Мягко', 3: 'Лёгкий намёк', 4: 'Игриво', 5: 'Пикантно',
  6: 'Откровенно', 7: 'Дерзко', 8: 'Жёстко', 9: 'Экстрим', 10: 'Табу',
}

// Modal
function Modal({ isOpen, onClose, title, children, wide }: { 
  isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean 
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`bg-gray-800 rounded-lg ${wide ? 'max-w-4xl' : 'max-w-lg'} w-full max-h-[90vh] overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

// Convert formats
function convertLegacyToNew(legacy: LegacyWordDatabase, variant: DictionaryVariant): DictionaryData {
  const defaultCats = variant === 'adult' ? DEFAULT_ADULT_CATEGORIES : DEFAULT_FAMILY_CATEGORIES
  const categories = [...defaultCats]
  const words: Record<string, Word[]> = {}
  
  const allCatIds = new Set<string>()
  for (const lang of LANGUAGES) {
    Object.keys(legacy[lang.code] || {}).forEach(cat => allCatIds.add(cat))
  }
  
  allCatIds.forEach(catId => {
    if (!categories.find(c => c.id === catId)) {
      categories.push({ id: catId, name: catId.charAt(0).toUpperCase() + catId.slice(1), emoji: '📁', intensityMin: 1, intensityMax: 10 })
    }
  })
  
  for (const cat of categories) {
    const ruWords = legacy.ru?.[cat.id] || []
    const enWords = legacy.en?.[cat.id] || []
    const esWords = legacy.es?.[cat.id] || []
    const uaWords = legacy.ua?.[cat.id] || []
    const maxLen = Math.max(ruWords.length, enWords.length, esWords.length, uaWords.length)
    const catWords: Word[] = []
    
    for (let i = 0; i < maxLen; i++) {
      catWords.push({
        ru: ruWords[i] || '', en: enWords[i] || '', es: esWords[i] || '', ua: uaWords[i] || '',
        intensity: Math.floor(Math.random() * (cat.intensityMax - cat.intensityMin + 1)) + cat.intensityMin,
      })
    }
    words[cat.id] = catWords
  }
  
  return { categories, words }
}

function convertNewToLegacy(data: DictionaryData): LegacyWordDatabase {
  const legacy: LegacyWordDatabase = { ru: {}, en: {}, es: {}, ua: {} }
  for (const cat of data.categories) {
    const catWords = data.words[cat.id] || []
    legacy.ru[cat.id] = catWords.map(w => w.ru).filter(Boolean)
    legacy.en[cat.id] = catWords.map(w => w.en).filter(Boolean)
    legacy.es[cat.id] = catWords.map(w => w.es).filter(Boolean)
    legacy.ua[cat.id] = catWords.map(w => w.ua).filter(Boolean)
  }
  return legacy
}

// Cache helpers
const CACHE_KEY_ADULT = 'guessus_editor_adult'
const CACHE_KEY_FAMILY = 'guessus_editor_family'

function saveToCache(variant: DictionaryVariant, data: DictionaryData) {
  const key = variant === 'adult' ? CACHE_KEY_ADULT : CACHE_KEY_FAMILY
  localStorage.setItem(key, JSON.stringify(data))
}

function loadFromCache(variant: DictionaryVariant): DictionaryData | null {
  const key = variant === 'adult' ? CACHE_KEY_ADULT : CACHE_KEY_FAMILY
  const cached = localStorage.getItem(key)
  if (cached) {
    try { return JSON.parse(cached) } catch { return null }
  }
  return null
}

function clearCache(variant: DictionaryVariant) {
  const key = variant === 'adult' ? CACHE_KEY_ADULT : CACHE_KEY_FAMILY
  localStorage.removeItem(key)
}

// OpenAI API
async function generateWordsWithAI(
  apiKey: string,
  category: string,
  intensityMin: number,
  intensityMax: number,
  count: number,
  variant: DictionaryVariant
): Promise<Word[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `You are a word generator for a party guessing game. Generate words for the "${category}" category.
The game is ${variant === 'adult' ? 'for adults (18+)' : 'family-friendly'}.
Intensity scale: 1=innocent, 5=spicy, 10=extreme taboo.
Generate words with intensity between ${intensityMin} and ${intensityMax}.
Return ONLY a JSON array of objects with format:
[{"ru":"Russian word","en":"English equivalent","es":"Spanish equivalent","ua":"Ukrainian equivalent","intensity":number}]
Important: translations should be SEMANTIC equivalents (same meaning in that culture), not literal translations.
Generate exactly ${count} unique, interesting words good for a guessing game.`
      }, {
        role: 'user',
        content: `Generate ${count} words for "${category}" category, intensity ${intensityMin}-${intensityMax}. Return only JSON array.`
      }],
      temperature: 0.9,
      max_tokens: 4000
    })
  })
  
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'API error')
  }
  
  const data = await response.json()
  const content = data.choices[0]?.message?.content || '[]'
  
  // Extract JSON from response
  const jsonMatch = content.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('No JSON in response')
  
  return JSON.parse(jsonMatch[0])
}

function App() {
  const [variant, setVariant] = useState<DictionaryVariant>('adult')
  const [data, setData] = useState<DictionaryData | null>(null)
  const [version, setVersion] = useState<VersionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('party')
  const [searchQuery, setSearchQuery] = useState('')
  const [intensityFilter, setIntensityFilter] = useState<[number, number]>([1, 10])
  const [hasChanges, setHasChanges] = useState(false)
  const [sortByIntensity, setSortByIntensity] = useState<'asc' | 'desc' | null>(null)
  
  // Modals
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [newCatIntensity, setNewCatIntensity] = useState<[number, number]>([3, 7])
  const [addWordsOpen, setAddWordsOpen] = useState(false)
  const [addWordsCount, setAddWordsCount] = useState(10)
  const [editingCell, setEditingCell] = useState<{ wordIdx: number; field: keyof Word } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)
  const [moveToCategory, setMoveToCategory] = useState<string | null>(null)
  const [selectedWords, setSelectedWords] = useState<Set<number>>(new Set())
  
  // AI Generation
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openai_key') || '')
  const [generating, setGenerating] = useState(false)
  const [generatedWords, setGeneratedWords] = useState<Word[]>([])
  const [generatedSelection, setGeneratedSelection] = useState<Set<number>>(new Set())
  
  // GitHub
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('github_token') || '')
  const [publishing, setPublishing] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)

  // Load dictionary - first from cache, then from GitHub
  useEffect(() => {
    const cached = loadFromCache(variant)
    if (cached) {
      setData(cached)
      setLoading(false)
      // Still load version from GitHub
      loadVersion()
    } else {
      loadDictionary()
    }
  }, [variant])

  useEffect(() => {
    const cats = variant === 'adult' ? DEFAULT_ADULT_CATEGORIES : DEFAULT_FAMILY_CATEGORIES
    setSelectedCategory(cats[0].id)
  }, [variant])

  // Save to cache whenever data changes
  useEffect(() => {
    if (data && hasChanges) {
      saveToCache(variant, data)
    }
  }, [data, hasChanges, variant])

  const loadVersion = async () => {
    try {
      const versionFile = variant === 'adult' ? 'version-adult.json' : 'version.json'
      const res = await fetch(`${GITHUB_RAW_BASE}/${versionFile}?t=${Date.now()}`)
      if (res.ok) setVersion(await res.json())
    } catch {}
  }

  const loadDictionary = async (forceRefresh = false) => {
    if (forceRefresh) clearCache(variant)
    setLoading(true)
    try {
      const wordsFile = variant === 'adult' ? 'words-adult.json' : 'words.json'
      const versionFile = variant === 'adult' ? 'version-adult.json' : 'version.json'
      const [wordsRes, versionRes] = await Promise.all([
        fetch(`${GITHUB_RAW_BASE}/${wordsFile}?t=${Date.now()}`),
        fetch(`${GITHUB_RAW_BASE}/${versionFile}?t=${Date.now()}`)
      ])
      if (wordsRes.ok && versionRes.ok) {
        const legacy = await wordsRes.json()
        const ver = await versionRes.json()
        const newData = convertLegacyToNew(legacy, variant)
        setData(newData)
        setVersion(ver)
        setHasChanges(false)
        saveToCache(variant, newData)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // Current category & words
  const currentCategory = useMemo(() => data?.categories.find(c => c.id === selectedCategory), [data, selectedCategory])
  
  const currentWords = useMemo(() => {
    if (!data) return []
    let words = (data.words[selectedCategory] || []).map((w, i) => ({ ...w, _idx: i }))
    words = words.filter(w => w.intensity >= intensityFilter[0] && w.intensity <= intensityFilter[1])
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      words = words.filter(w => w.ru.toLowerCase().includes(q) || w.en.toLowerCase().includes(q) || w.es.toLowerCase().includes(q) || w.ua.toLowerCase().includes(q))
    }
    if (sortByIntensity) {
      words.sort((a, b) => sortByIntensity === 'asc' ? a.intensity - b.intensity : b.intensity - a.intensity)
    }
    return words
  }, [data, selectedCategory, intensityFilter, searchQuery, sortByIntensity])

  // Stats
  const stats = useMemo(() => {
    if (!data) return null
    let total = 0, missing = 0
    const byLang = { ru: 0, en: 0, es: 0, ua: 0 }
    Object.values(data.words).forEach(words => {
      words.forEach(w => {
        total++
        if (w.ru) byLang.ru++
        if (w.en) byLang.en++; else if (w.ru) missing++
        if (w.es) byLang.es++; else if (w.ru) missing++
        if (w.ua) byLang.ua++; else if (w.ru) missing++
      })
    })
    return { total, byLang, missing }
  }, [data])

  // Find duplicates across ALL categories
  const duplicates = useMemo(() => {
    if (!data) return []
    const found: { word: string; lang: Language; locations: { cat: string; idx: number }[] }[] = []
    const seen: Record<Language, Map<string, { cat: string; idx: number }[]>> = {
      ru: new Map(), en: new Map(), es: new Map(), ua: new Map()
    }
    
    for (const cat of data.categories) {
      const words = data.words[cat.id] || []
      words.forEach((w, idx) => {
        LANGUAGES.forEach(l => {
          const val = w[l.code]?.toLowerCase().trim()
          if (val) {
            if (!seen[l.code].has(val)) seen[l.code].set(val, [])
            seen[l.code].get(val)!.push({ cat: cat.id, idx })
          }
        })
      })
    }
    
    LANGUAGES.forEach(l => {
      seen[l.code].forEach((locations, word) => {
        if (locations.length > 1) {
          found.push({ word, lang: l.code, locations })
        }
      })
    })
    
    return found
  }, [data])

  // Actions
  const handleAddCategory = (name: string, emoji: string) => {
    if (!data || !name) return
    const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_а-яё]/gi, '')
    if (data.categories.find(c => c.id === id)) { alert('Категория уже существует'); return }
    const cat: CategoryMeta = { id, name, emoji, intensityMin: newCatIntensity[0], intensityMax: newCatIntensity[1] }
    setData({ ...data, categories: [...data.categories, cat], words: { ...data.words, [id]: [] } })
    setSelectedCategory(id)
    setAddCategoryOpen(false)
    setHasChanges(true)
  }

  const handleDeleteCategory = (catId: string) => {
    if (!data || !confirm(`Удалить "${catId}"?`)) return
    const { [catId]: _, ...restWords } = data.words
    setData({ ...data, categories: data.categories.filter(c => c.id !== catId), words: restWords })
    setSelectedCategory(data.categories[0]?.id || '')
    setHasChanges(true)
  }

  const handleDeleteWord = (idx: number) => {
    if (!data) return
    const words = [...(data.words[selectedCategory] || [])]
    words.splice(idx, 1)
    setData({ ...data, words: { ...data.words, [selectedCategory]: words } })
    setHasChanges(true)
  }

  const handleBulkDelete = () => {
    if (!data || selectedWords.size === 0) return
    if (!confirm(`Удалить ${selectedWords.size} слов?`)) return
    const words = (data.words[selectedCategory] || []).filter((_, i) => !selectedWords.has(i))
    setData({ ...data, words: { ...data.words, [selectedCategory]: words } })
    setSelectedWords(new Set())
    setHasChanges(true)
  }

  const startEdit = (wordIdx: number, field: keyof Word) => {
    const word = currentWords[wordIdx]
    setEditingCell({ wordIdx, field })
    setEditValue(String(word[field]))
  }

  const saveEdit = () => {
    if (!editingCell || !data) return
    const word = currentWords[editingCell.wordIdx]
    const actualIdx = word._idx!
    const words = [...(data.words[selectedCategory] || [])]
    const newValue = editingCell.field === 'intensity' ? Math.min(10, Math.max(1, Number(editValue) || 5)) : editValue
    words[actualIdx] = { ...words[actualIdx], [editingCell.field]: newValue }
    setData({ ...data, words: { ...data.words, [selectedCategory]: words } })
    setEditingCell(null)
    setEditValue('')
    setHasChanges(true)
  }

  const moveSelectedToCategory = (targetCat: string) => {
    if (!data || selectedWords.size === 0) return
    const sourceWords = data.words[selectedCategory] || []
    const targetWords = [...(data.words[targetCat] || [])]
    const toMove: Word[] = []
    const remaining: Word[] = []
    sourceWords.forEach((w, i) => {
      if (selectedWords.has(i)) toMove.push(w)
      else remaining.push(w)
    })
    setData({ ...data, words: { ...data.words, [selectedCategory]: remaining, [targetCat]: [...targetWords, ...toMove] } })
    setSelectedWords(new Set())
    setMoveToCategory(null)
    setHasChanges(true)
  }

  const removeDuplicates = () => {
    if (!data || duplicates.length === 0) return
    const newWords = { ...data.words }
    const toRemove: Record<string, Set<number>> = {}
    data.categories.forEach(c => { toRemove[c.id] = new Set() })
    
    duplicates.forEach(dup => {
      const [, ...remove] = dup.locations
      remove.forEach(loc => toRemove[loc.cat].add(loc.idx))
    })
    
    data.categories.forEach(cat => {
      const words = newWords[cat.id] || []
      newWords[cat.id] = words.filter((_, i) => !toRemove[cat.id].has(i))
    })
    
    setData({ ...data, words: newWords })
    setDuplicatesOpen(false)
    setHasChanges(true)
    alert(`Удалено дубликатов: ${duplicates.length}`)
  }

  // AI Generation
  const handleGenerateWords = async () => {
    if (!openaiKey || !currentCategory) return
    localStorage.setItem('openai_key', openaiKey)
    
    setGenerating(true)
    try {
      const words = await generateWordsWithAI(
        openaiKey,
        currentCategory.name,
        currentCategory.intensityMin,
        currentCategory.intensityMax,
        addWordsCount,
        variant
      )
      setGeneratedWords(words)
      setGeneratedSelection(new Set(words.map((_, i) => i))) // All selected by default
    } catch (err) {
      alert(`Ошибка: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleAddGeneratedWords = () => {
    if (!data || generatedWords.length === 0) return
    const toAdd = generatedWords.filter((_, i) => generatedSelection.has(i))
    const existingWords = data.words[selectedCategory] || []
    setData({
      ...data,
      words: { ...data.words, [selectedCategory]: [...existingWords, ...toAdd] }
    })
    setGeneratedWords([])
    setGeneratedSelection(new Set())
    setAddWordsOpen(false)
    setHasChanges(true)
  }

  // Export & Publish
  const exportJson = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(convertNewToLegacy(data), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = variant === 'adult' ? 'words-adult.json' : 'words.json'
    a.click()
  }

  const saveGithubToken = (t: string) => { setGithubToken(t); localStorage.setItem('github_token', t) }

  const publishToGithub = async () => {
    if (!data || !githubToken) return
    setPublishing(true)
    try {
      const legacy = convertNewToLegacy(data)
      const currentVersion = version?.version || '1.0.0'
      const versionParts = currentVersion.split('.').map(Number)
      versionParts[2]++
      const newVersion = versionParts.join('.')
      const newVersionInfo = { version: newVersion, updatedAt: new Date().toISOString().split('T')[0] }
      
      const wordsFile = variant === 'adult' ? 'words-adult.json' : 'words.json'
      const versionFile = variant === 'adult' ? 'version-adult.json' : 'version.json'
      
      const getFileSha = async (path: string) => {
        try {
          const res = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${path}`, {
            headers: { 'Authorization': `token ${githubToken}` }
          })
          if (res.ok) return (await res.json()).sha
        } catch {}
        return null
      }
      
      const [wordsSha, versionSha] = await Promise.all([getFileSha(wordsFile), getFileSha(versionFile)])
      
      await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${wordsFile}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${githubToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Update ${wordsFile} v${newVersion}`, content: btoa(unescape(encodeURIComponent(JSON.stringify(legacy, null, 2)))), sha: wordsSha })
      })
      
      await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${versionFile}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${githubToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `v${newVersion}`, content: btoa(unescape(encodeURIComponent(JSON.stringify(newVersionInfo, null, 2)))), sha: versionSha })
      })
      
      setVersion(newVersionInfo)
      setHasChanges(false)
      clearCache(variant) // Clear cache after successful publish
      setPublishOpen(false)
      alert(`✅ v${newVersion}`)
    } catch (err) {
      alert(`❌ ${err}`)
    } finally {
      setPublishing(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">⏳</div>

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Add Category Modal */}
      <Modal isOpen={addCategoryOpen} onClose={() => setAddCategoryOpen(false)} title="➕ Новая категория">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Уровень жести</label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-500">От</label>
                <input type="range" min={1} max={10} value={newCatIntensity[0]} 
                  onChange={e => setNewCatIntensity([Number(e.target.value), Math.max(Number(e.target.value), newCatIntensity[1])])} className="w-full" />
                <div className="text-center font-bold">{newCatIntensity[0]} <span className="text-xs font-normal text-gray-400">{INTENSITY_LABELS[newCatIntensity[0]]}</span></div>
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">До</label>
                <input type="range" min={1} max={10} value={newCatIntensity[1]}
                  onChange={e => setNewCatIntensity([Math.min(newCatIntensity[0], Number(e.target.value)), Number(e.target.value)])} className="w-full" />
                <div className="text-center font-bold">{newCatIntensity[1]} <span className="text-xs font-normal text-gray-400">{INTENSITY_LABELS[newCatIntensity[1]]}</span></div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-4">
            <div className="flex gap-2">
              <input id="manualCatName" placeholder="Название категории" className="flex-1 px-3 py-2 bg-gray-700 rounded border border-gray-600" />
              <input id="manualCatEmoji" placeholder="📁" defaultValue="📁" className="w-16 px-3 py-2 bg-gray-700 rounded border border-gray-600 text-center" />
              <button onClick={() => {
                const name = (document.getElementById('manualCatName') as HTMLInputElement)?.value
                const emoji = (document.getElementById('manualCatEmoji') as HTMLInputElement)?.value || '📁'
                handleAddCategory(name, emoji)
              }} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded">✓</button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Add Words Modal with AI Generation */}
      <Modal isOpen={addWordsOpen} onClose={() => { setAddWordsOpen(false); setGeneratedWords([]); setGeneratedSelection(new Set()) }} title="✨ Добавить слова" wide>
        <div className="space-y-4">
          <div className="bg-gray-700 rounded p-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-medium">{currentCategory?.emoji} {currentCategory?.name}</div>
              <div className="text-sm text-gray-400">Жесть: {currentCategory?.intensityMin}-{currentCategory?.intensityMax}</div>
            </div>
            <div className="text-right">
              <label className="text-xs text-gray-500">Количество</label>
              <input type="number" min={5} max={50} value={addWordsCount} onChange={e => setAddWordsCount(Number(e.target.value))}
                className="w-20 px-2 py-1 bg-gray-600 rounded ml-2 text-center" />
            </div>
          </div>
          
          {/* OpenAI Key */}
          <div>
            <label className="text-xs text-gray-500">OpenAI API Key</label>
            <input type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)}
              placeholder="sk-..." className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 mt-1" />
          </div>
          
          {/* Generate Button */}
          {generatedWords.length === 0 ? (
            <button onClick={handleGenerateWords} disabled={!openaiKey || generating}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-medium">
              {generating ? '⏳ Генерация...' : `🤖 Сгенерировать ${addWordsCount} слов`}
            </button>
          ) : (
            <>
              {/* Generated words preview */}
              <div className="max-h-64 overflow-y-auto border border-gray-600 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-700 sticky top-0">
                    <tr>
                      <th className="py-1 px-2 w-8">
                        <input type="checkbox" checked={generatedSelection.size === generatedWords.length}
                          onChange={e => setGeneratedSelection(e.target.checked ? new Set(generatedWords.map((_, i) => i)) : new Set())} />
                      </th>
                      <th className="py-1 px-2 text-left">🇷🇺</th>
                      <th className="py-1 px-2 text-left">🇺🇸</th>
                      <th className="py-1 px-2 text-left">🇪🇸</th>
                      <th className="py-1 px-2 text-left">🇺🇦</th>
                      <th className="py-1 px-2 w-12">⚖️</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedWords.map((w, i) => (
                      <tr key={i} className={`border-t border-gray-700 ${generatedSelection.has(i) ? '' : 'opacity-40'}`}>
                        <td className="py-1 px-2">
                          <input type="checkbox" checked={generatedSelection.has(i)}
                            onChange={e => {
                              const newSet = new Set(generatedSelection)
                              if (e.target.checked) newSet.add(i); else newSet.delete(i)
                              setGeneratedSelection(newSet)
                            }} />
                        </td>
                        <td className="py-1 px-2">{w.ru}</td>
                        <td className="py-1 px-2">{w.en}</td>
                        <td className="py-1 px-2">{w.es}</td>
                        <td className="py-1 px-2">{w.ua}</td>
                        <td className="py-1 px-2 text-center">{w.intensity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => { setGeneratedWords([]); setGeneratedSelection(new Set()) }}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 rounded">
                  🔄 Заново
                </button>
                <button onClick={handleAddGeneratedWords} disabled={generatedSelection.size === 0}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-medium">
                  ✅ Добавить ({generatedSelection.size})
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Duplicates Modal */}
      <Modal isOpen={duplicatesOpen} onClose={() => setDuplicatesOpen(false)} title="⚠️ Дубликаты" wide>
        <div className="space-y-4">
          <p className="text-gray-400">Найдено {duplicates.length} дубликатов во ВСЕХ категориях:</p>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {duplicates.slice(0, 30).map((d, i) => (
              <div key={i} className="bg-gray-700 rounded p-2 text-sm flex items-center justify-between">
                <span>{LANGUAGES.find(l => l.code === d.lang)?.flag} <strong>{d.word}</strong></span>
                <span className="text-gray-400 text-xs">в: {d.locations.map(l => l.cat).join(', ')}</span>
              </div>
            ))}
            {duplicates.length > 30 && <div className="text-gray-500 text-sm text-center">...и ещё {duplicates.length - 30}</div>}
          </div>
          <button onClick={removeDuplicates} className="w-full py-2 bg-red-600 hover:bg-red-700 rounded font-medium">
            🗑️ Удалить все дубликаты (оставить первое)
          </button>
        </div>
      </Modal>

      {/* Move to Category Modal */}
      <Modal isOpen={!!moveToCategory} onClose={() => setMoveToCategory(null)} title="📦 Переместить">
        <div className="space-y-2">
          {data?.categories.filter(c => c.id !== selectedCategory).map(cat => (
            <button key={cat.id} onClick={() => moveSelectedToCategory(cat.id)}
              className="w-full py-2 px-3 bg-gray-700 hover:bg-gray-600 rounded text-left">
              {cat.emoji} {cat.name} ({data.words[cat.id]?.length || 0})
            </button>
          ))}
        </div>
      </Modal>

      {/* Publish Modal */}
      <Modal isOpen={publishOpen} onClose={() => setPublishOpen(false)} title="📤 Опубликовать">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">GitHub Token</label>
            <input type="password" value={githubToken} onChange={e => saveGithubToken(e.target.value)}
              placeholder="ghp_..." className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600" />
          </div>
          <button onClick={publishToGithub} disabled={!githubToken || publishing}
            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-medium">
            {publishing ? '⏳...' : '🚀 Опубликовать'}
          </button>
        </div>
      </Modal>

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-3">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">🎯 GuessUs Editor</h1>
            {version && <span className="text-sm text-gray-500">v{version.version}</span>}
            {hasChanges && <span className="text-yellow-400 text-sm animate-pulse">● несохранено</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => loadDictionary(true)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm" title="Загрузить с GitHub (сбросит изменения)">🔄</button>
            <button onClick={exportJson} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">💾</button>
            <button onClick={() => setPublishOpen(true)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm">📤</button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col">
          {/* Variant */}
          <div className="p-2 border-b border-gray-700 flex gap-1">
            <button onClick={() => setVariant('adult')} className={`flex-1 py-1.5 rounded text-sm ${variant === 'adult' ? 'bg-red-600' : 'bg-gray-700'}`}>🔞</button>
            <button onClick={() => setVariant('family')} className={`flex-1 py-1.5 rounded text-sm ${variant === 'family' ? 'bg-green-600' : 'bg-gray-700'}`}>👨‍👩‍👧</button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="p-3 border-b border-gray-700 bg-gray-800/50">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-blue-400">{stats.total}</span>
                <span className="text-sm text-gray-400">слов</span>
              </div>
              <div className="flex gap-2 mt-1 text-xs text-gray-500">
                {LANGUAGES.map(l => <span key={l.code}>{l.flag}{stats.byLang[l.code]}</span>)}
              </div>
              {stats.missing > 0 && <div className="text-xs text-yellow-400 mt-1">⚠️ {stats.missing} без перевода</div>}
            </div>
          )}

          {/* Alerts */}
          {duplicates.length > 0 && (
            <button onClick={() => setDuplicatesOpen(true)} className="mx-2 mt-2 p-2 bg-red-900/50 border border-red-600 rounded text-sm text-red-400 text-left">
              ⚠️ {duplicates.length} дубликатов
            </button>
          )}

          {/* Categories */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 uppercase">Категории</span>
              <button onClick={() => setAddCategoryOpen(true)} className="text-xs bg-purple-600 hover:bg-purple-700 px-2 py-0.5 rounded">+</button>
            </div>
            {data?.categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-1 mb-1">
                <button onClick={() => { setSelectedCategory(cat.id); setSelectedWords(new Set()) }}
                  className={`flex-1 py-1.5 px-2 rounded text-sm text-left ${selectedCategory === cat.id ? 'bg-purple-600' : 'bg-gray-700/50 hover:bg-gray-700'}`}>
                  <div className="flex items-center justify-between">
                    <span className="truncate">{cat.emoji} {cat.name}</span>
                    <span className="text-xs opacity-50">{data.words[cat.id]?.length || 0}</span>
                  </div>
                  <div className="text-xs opacity-50">
                    <span className={cat.intensityMax >= 8 ? 'text-red-400' : cat.intensityMax >= 5 ? 'text-yellow-400' : 'text-green-400'}>
                      {cat.intensityMin}-{cat.intensityMax}
                    </span>
                  </div>
                </button>
                {!DEFAULT_ADULT_CATEGORIES.find(c => c.id === cat.id) && !DEFAULT_FAMILY_CATEGORIES.find(c => c.id === cat.id) && (
                  <button onClick={() => handleDeleteCategory(cat.id)} className="p-1 text-red-400/50 hover:text-red-400 text-xs">×</button>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="p-2 border-b border-gray-700 flex items-center gap-2 flex-wrap bg-gray-800/30">
            {currentCategory && (
              <div className="flex items-center gap-2 mr-4">
                <span className="text-xl">{currentCategory.emoji}</span>
                <div>
                  <div className="font-medium text-sm">{currentCategory.name}</div>
                  <div className="text-xs text-gray-500">{currentCategory.intensityMin}-{currentCategory.intensityMax}</div>
                </div>
              </div>
            )}
            
            <input type="text" placeholder="🔍" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm w-32" />
            
            <div className="flex items-center gap-1 text-xs">
              <input type="number" min={1} max={10} value={intensityFilter[0]} onChange={e => setIntensityFilter([Number(e.target.value), intensityFilter[1]])}
                className="w-10 px-1 py-1 bg-gray-700 rounded text-center" />
              <span>-</span>
              <input type="number" min={1} max={10} value={intensityFilter[1]} onChange={e => setIntensityFilter([intensityFilter[0], Number(e.target.value)])}
                className="w-10 px-1 py-1 bg-gray-700 rounded text-center" />
            </div>

            <button onClick={() => setSortByIntensity(s => s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc')}
              className={`px-2 py-1 rounded text-xs ${sortByIntensity ? 'bg-blue-600' : 'bg-gray-700'}`}>
              ⚖️ {sortByIntensity === 'asc' ? '↑' : sortByIntensity === 'desc' ? '↓' : ''}
            </button>
            
            <div className="flex-1" />
            
            {selectedWords.size > 0 && (
              <>
                <button onClick={() => setMoveToCategory('_')} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                  📦 ({selectedWords.size})
                </button>
                <button onClick={handleBulkDelete} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">
                  🗑️ ({selectedWords.size})
                </button>
              </>
            )}
            
            <button onClick={() => setAddWordsOpen(true)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm">
              ✨ Добавить слова
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-800 z-10">
                <tr className="border-b border-gray-700">
                  <th className="py-2 px-2 w-8">
                    <input type="checkbox" onChange={e => {
                      if (e.target.checked) setSelectedWords(new Set(currentWords.map(w => w._idx!)))
                      else setSelectedWords(new Set())
                    }} checked={selectedWords.size > 0 && selectedWords.size === currentWords.length} />
                  </th>
                  <th className="text-left py-2 px-2 w-10">#</th>
                  {LANGUAGES.map(l => <th key={l.code} className="text-left py-2 px-2">{l.flag}</th>)}
                  <th className="text-center py-2 px-2 w-16 cursor-pointer hover:text-blue-400" onClick={() => setSortByIntensity(s => s === 'asc' ? 'desc' : 'asc')}>⚖️</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {currentWords.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-500">
                    {searchQuery ? 'Ничего не найдено' : 'Нет слов'} • 
                    <button onClick={() => setAddWordsOpen(true)} className="text-green-400 hover:underline ml-1">Добавить</button>
                  </td></tr>
                ) : currentWords.map((word, idx) => (
                  <tr key={word._idx} className={`border-b border-gray-700/30 hover:bg-gray-800/50 ${selectedWords.has(word._idx!) ? 'bg-blue-900/20' : ''}`}>
                    <td className="py-1 px-2">
                      <input type="checkbox" checked={selectedWords.has(word._idx!)}
                        onChange={e => {
                          const newSet = new Set(selectedWords)
                          if (e.target.checked) newSet.add(word._idx!); else newSet.delete(word._idx!)
                          setSelectedWords(newSet)
                        }} />
                    </td>
                    <td className="py-1 px-2 text-gray-600 text-xs">{idx + 1}</td>
                    {LANGUAGES.map(l => (
                      <td key={l.code} className="py-1 px-2">
                        {editingCell?.wordIdx === idx && editingCell?.field === l.code ? (
                          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                            onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()}
                            className="w-full px-1 py-0.5 bg-gray-700 rounded border border-blue-500 text-sm" />
                        ) : (
                          <span onClick={() => startEdit(idx, l.code)}
                            className={`cursor-pointer hover:bg-gray-700/50 px-1 py-0.5 rounded block truncate ${!word[l.code] ? 'text-red-400/50 italic' : ''}`}>
                            {word[l.code] || '—'}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="py-1 px-2 text-center">
                      {editingCell?.wordIdx === idx && editingCell?.field === 'intensity' ? (
                        <input autoFocus type="number" min={1} max={10} value={editValue}
                          onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()}
                          className="w-10 px-1 py-0.5 bg-gray-700 rounded border border-blue-500 text-center text-sm" />
                      ) : (
                        <span onClick={() => startEdit(idx, 'intensity')}
                          className={`cursor-pointer px-2 py-0.5 rounded text-xs font-medium ${
                            word.intensity >= 8 ? 'bg-red-900/50 text-red-400' : word.intensity >= 5 ? 'bg-yellow-900/50 text-yellow-400' : 'bg-green-900/50 text-green-400'
                          }`}>{word.intensity}</span>
                      )}
                    </td>
                    <td className="py-1 px-2">
                      <button onClick={() => handleDeleteWord(word._idx!)} className="text-red-400/50 hover:text-red-400">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
