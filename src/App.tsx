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

// Legacy format (current GitHub structure)
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

// Intensity descriptions
const INTENSITY_LABELS: Record<number, string> = {
  1: 'Безобидно',
  2: 'Мягко', 
  3: 'Лёгкий намёк',
  4: 'Игриво',
  5: 'Пикантно',
  6: 'Откровенно',
  7: 'Дерзко',
  8: 'Жёстко',
  9: 'Экстрим',
  10: 'Табу',
}

// Modal component
function Modal({ isOpen, onClose, title, children, wide }: { 
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
}) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`bg-gray-800 rounded-lg ${wide ? 'max-w-4xl' : 'max-w-lg'} w-full max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// Convert legacy format to new format
function convertLegacyToNew(legacy: LegacyWordDatabase, variant: DictionaryVariant): DictionaryData {
  const defaultCats = variant === 'adult' ? DEFAULT_ADULT_CATEGORIES : DEFAULT_FAMILY_CATEGORIES
  const categories = [...defaultCats]
  const words: Record<string, Word[]> = {}
  
  // Get all category IDs from the data
  const allCatIds = new Set<string>()
  for (const lang of LANGUAGES) {
    Object.keys(legacy[lang.code] || {}).forEach(cat => allCatIds.add(cat))
  }
  
  // Add any missing categories
  allCatIds.forEach(catId => {
    if (!categories.find(c => c.id === catId)) {
      categories.push({
        id: catId,
        name: catId.charAt(0).toUpperCase() + catId.slice(1),
        emoji: '📁',
        intensityMin: 1,
        intensityMax: 10,
      })
    }
  })
  
  // Convert words
  for (const cat of categories) {
    const ruWords = legacy.ru?.[cat.id] || []
    const enWords = legacy.en?.[cat.id] || []
    const esWords = legacy.es?.[cat.id] || []
    const uaWords = legacy.ua?.[cat.id] || []
    
    const maxLen = Math.max(ruWords.length, enWords.length, esWords.length, uaWords.length)
    const catWords: Word[] = []
    
    for (let i = 0; i < maxLen; i++) {
      catWords.push({
        ru: ruWords[i] || '',
        en: enWords[i] || '',
        es: esWords[i] || '',
        ua: uaWords[i] || '',
        intensity: Math.floor(Math.random() * (cat.intensityMax - cat.intensityMin + 1)) + cat.intensityMin,
      })
    }
    
    words[cat.id] = catWords
  }
  
  return { categories, words }
}

// Convert new format back to legacy for GitHub
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

function App() {
  // State
  const [variant, setVariant] = useState<DictionaryVariant>('adult')
  const [data, setData] = useState<DictionaryData | null>(null)
  const [version, setVersion] = useState<VersionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('party')
  const [searchQuery, setSearchQuery] = useState('')
  const [intensityFilter, setIntensityFilter] = useState<[number, number]>([1, 10])
  const [hasChanges, setHasChanges] = useState(false)
  
  // Modal states
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [newCategory, setNewCategory] = useState<CategoryMeta>({
    id: '', name: '', emoji: '📁', intensityMin: 3, intensityMax: 7
  })
  const [addWordOpen, setAddWordOpen] = useState(false)
  const [newWord, setNewWord] = useState<Word>({ ru: '', en: '', es: '', ua: '', intensity: 5 })
  const [editingCell, setEditingCell] = useState<{ wordIdx: number; field: keyof Word } | null>(null)
  const [editValue, setEditValue] = useState('')
  
  // GitHub
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('github_token') || '')
  const [publishing, setPublishing] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)

  // Load dictionary
  useEffect(() => {
    loadDictionary()
  }, [variant])

  useEffect(() => {
    const cats = variant === 'adult' ? DEFAULT_ADULT_CATEGORIES : DEFAULT_FAMILY_CATEGORIES
    setSelectedCategory(cats[0].id)
  }, [variant])

  const loadDictionary = async () => {
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
        setData(convertLegacyToNew(legacy, variant))
        setVersion(ver)
        setHasChanges(false)
      }
    } catch (e) {
      console.error('Load error:', e)
    } finally {
      setLoading(false)
    }
  }

  // Current category
  const currentCategory = useMemo(() => {
    return data?.categories.find(c => c.id === selectedCategory)
  }, [data, selectedCategory])

  // Current words (filtered)
  const currentWords = useMemo(() => {
    if (!data) return []
    let words = data.words[selectedCategory] || []
    
    // Filter by intensity
    words = words.filter(w => w.intensity >= intensityFilter[0] && w.intensity <= intensityFilter[1])
    
    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      words = words.filter(w => 
        w.ru.toLowerCase().includes(q) ||
        w.en.toLowerCase().includes(q) ||
        w.es.toLowerCase().includes(q) ||
        w.ua.toLowerCase().includes(q)
      )
    }
    
    return words
  }, [data, selectedCategory, intensityFilter, searchQuery])

  // Stats
  const stats = useMemo(() => {
    if (!data) return null
    let total = 0
    const byLang = { ru: 0, en: 0, es: 0, ua: 0 }
    
    Object.values(data.words).forEach(words => {
      words.forEach(w => {
        total++
        if (w.ru) byLang.ru++
        if (w.en) byLang.en++
        if (w.es) byLang.es++
        if (w.ua) byLang.ua++
      })
    })
    
    return { total, byLang }
  }, [data])

  // Add category
  const handleAddCategory = () => {
    if (!data || !newCategory.name) return
    
    const id = newCategory.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (data.categories.find(c => c.id === id)) {
      alert('Категория с таким ID уже существует')
      return
    }
    
    const cat: CategoryMeta = { ...newCategory, id }
    setData({
      ...data,
      categories: [...data.categories, cat],
      words: { ...data.words, [id]: [] }
    })
    setSelectedCategory(id)
    setNewCategory({ id: '', name: '', emoji: '📁', intensityMin: 3, intensityMax: 7 })
    setAddCategoryOpen(false)
    setHasChanges(true)
  }

  // Delete category
  const handleDeleteCategory = (catId: string) => {
    if (!data) return
    if (!confirm(`Удалить категорию "${catId}" и все её слова?`)) return
    
    const { [catId]: _, ...restWords } = data.words
    setData({
      ...data,
      categories: data.categories.filter(c => c.id !== catId),
      words: restWords
    })
    
    const defaultCats = variant === 'adult' ? DEFAULT_ADULT_CATEGORIES : DEFAULT_FAMILY_CATEGORIES
    setSelectedCategory(defaultCats[0]?.id || '')
    setHasChanges(true)
  }

  // Add word
  const handleAddWord = () => {
    if (!data || !newWord.ru) return
    
    const catIntensity = currentCategory 
      ? Math.max(currentCategory.intensityMin, Math.min(currentCategory.intensityMax, newWord.intensity))
      : newWord.intensity
    
    setData({
      ...data,
      words: {
        ...data.words,
        [selectedCategory]: [...(data.words[selectedCategory] || []), { ...newWord, intensity: catIntensity }]
      }
    })
    setNewWord({ ru: '', en: '', es: '', ua: '', intensity: currentCategory?.intensityMin || 5 })
    setAddWordOpen(false)
    setHasChanges(true)
  }

  // Delete word
  const handleDeleteWord = (idx: number) => {
    if (!data) return
    
    const words = [...(data.words[selectedCategory] || [])]
    const actualIdx = data.words[selectedCategory]?.indexOf(currentWords[idx])
    if (actualIdx === undefined || actualIdx === -1) return
    
    words.splice(actualIdx, 1)
    setData({
      ...data,
      words: { ...data.words, [selectedCategory]: words }
    })
    setHasChanges(true)
  }

  // Edit cell
  const startEdit = (wordIdx: number, field: keyof Word) => {
    const word = currentWords[wordIdx]
    setEditingCell({ wordIdx, field })
    setEditValue(String(word[field]))
  }

  const saveEdit = () => {
    if (!editingCell || !data) return
    
    const word = currentWords[editingCell.wordIdx]
    const actualIdx = data.words[selectedCategory]?.indexOf(word)
    if (actualIdx === undefined || actualIdx === -1) return
    
    const words = [...(data.words[selectedCategory] || [])]
    const newValue = editingCell.field === 'intensity' ? Number(editValue) || 5 : editValue
    words[actualIdx] = { ...word, [editingCell.field]: newValue }
    
    setData({
      ...data,
      words: { ...data.words, [selectedCategory]: words }
    })
    setEditingCell(null)
    setEditValue('')
    setHasChanges(true)
  }

  // Export
  const exportJson = () => {
    if (!data) return
    const legacy = convertNewToLegacy(data)
    const blob = new Blob([JSON.stringify(legacy, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = variant === 'adult' ? 'words-adult.json' : 'words.json'
    a.click()
  }

  // Publish to GitHub
  const publishToGithub = async () => {
    if (!data || !githubToken) return
    
    setPublishing(true)
    try {
      const legacy = convertNewToLegacy(data)
      const currentVersion = version?.version || '1.0.0'
      const versionParts = currentVersion.split('.').map(Number)
      versionParts[2] = (versionParts[2] || 0) + 1
      const newVersion = versionParts.join('.')
      const today = new Date().toISOString().split('T')[0]
      const newVersionInfo = { version: newVersion, updatedAt: today }
      
      const wordsFile = variant === 'adult' ? 'words-adult.json' : 'words.json'
      const versionFile = variant === 'adult' ? 'version-adult.json' : 'version.json'
      
      const getFileSha = async (path: string): Promise<string | null> => {
        try {
          const res = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${path}`, {
            headers: { 'Authorization': `token ${githubToken}` }
          })
          if (res.ok) return (await res.json()).sha
        } catch {}
        return null
      }
      
      const wordsSha = await getFileSha(wordsFile)
      const versionSha = await getFileSha(versionFile)
      
      await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${wordsFile}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${githubToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Update ${wordsFile} to v${newVersion}`,
          content: btoa(unescape(encodeURIComponent(JSON.stringify(legacy, null, 2)))),
          sha: wordsSha
        })
      })
      
      await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${versionFile}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${githubToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Bump version to ${newVersion}`,
          content: btoa(unescape(encodeURIComponent(JSON.stringify(newVersionInfo, null, 2)))),
          sha: versionSha
        })
      })
      
      setVersion(newVersionInfo)
      setHasChanges(false)
      setPublishOpen(false)
      alert(`✅ Опубликовано! v${newVersion}`)
    } catch (err) {
      alert(`❌ Ошибка: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setPublishing(false)
    }
  }

  const saveToken = (t: string) => {
    setGithubToken(t)
    localStorage.setItem('github_token', t)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">⏳ Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Add Category Modal */}
      <Modal isOpen={addCategoryOpen} onClose={() => setAddCategoryOpen(false)} title="➕ Новая категория">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Название</label>
            <input
              value={newCategory.name}
              onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
              placeholder="Party Games"
              className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Emoji</label>
            <input
              value={newCategory.emoji}
              onChange={e => setNewCategory({ ...newCategory, emoji: e.target.value })}
              className="w-20 px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-center text-2xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Жесть от</label>
              <input
                type="number" min={1} max={10}
                value={newCategory.intensityMin}
                onChange={e => setNewCategory({ ...newCategory, intensityMin: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600"
              />
              <div className="text-xs text-gray-500 mt-1">{INTENSITY_LABELS[newCategory.intensityMin]}</div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Жесть до</label>
              <input
                type="number" min={1} max={10}
                value={newCategory.intensityMax}
                onChange={e => setNewCategory({ ...newCategory, intensityMax: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600"
              />
              <div className="text-xs text-gray-500 mt-1">{INTENSITY_LABELS[newCategory.intensityMax]}</div>
            </div>
          </div>
          <button
            onClick={handleAddCategory}
            disabled={!newCategory.name}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded font-medium"
          >
            Создать категорию
          </button>
        </div>
      </Modal>

      {/* Add Word Modal */}
      <Modal isOpen={addWordOpen} onClose={() => setAddWordOpen(false)} title="➕ Добавить слово">
        <div className="space-y-3">
          {LANGUAGES.map(lang => (
            <div key={lang.code}>
              <label className="block text-sm text-gray-400 mb-1">{lang.flag} {lang.name}</label>
              <input
                value={newWord[lang.code]}
                onChange={e => setNewWord({ ...newWord, [lang.code]: e.target.value })}
                placeholder={lang.code === 'ru' ? 'Обязательно' : 'Необязательно'}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Жесть (1-10)</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={1} max={10}
                value={newWord.intensity}
                onChange={e => setNewWord({ ...newWord, intensity: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="w-8 text-center font-bold">{newWord.intensity}</span>
            </div>
            <div className="text-xs text-gray-500">{INTENSITY_LABELS[newWord.intensity]}</div>
          </div>
          <button
            onClick={handleAddWord}
            disabled={!newWord.ru}
            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-medium"
          >
            Добавить
          </button>
        </div>
      </Modal>

      {/* Publish Modal */}
      <Modal isOpen={publishOpen} onClose={() => setPublishOpen(false)} title="📤 Опубликовать">
        <div className="space-y-4">
          <p className="text-gray-400">Обновить <strong>{variant === 'adult' ? 'Adult' : 'Family'}</strong> словарь</p>
          <div>
            <label className="block text-sm text-gray-400 mb-1">GitHub Token</label>
            <input
              type="password"
              value={githubToken}
              onChange={e => saveToken(e.target.value)}
              placeholder="ghp_..."
              className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">
              <a href="https://github.com/settings/tokens/new?scopes=repo" target="_blank" className="text-blue-400">Создать токен</a>
            </p>
          </div>
          {version && (
            <div className="bg-gray-700 p-3 rounded text-sm">
              <div>Текущая: <span className="font-mono">{version.version}</span></div>
              <div>Новая: <span className="font-mono text-green-400">
                {version.version.split('.').map((v, i) => i === 2 ? Number(v) + 1 : v).join('.')}
              </span></div>
            </div>
          )}
          <button
            onClick={publishToGithub}
            disabled={!githubToken || publishing}
            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-medium"
          >
            {publishing ? '⏳ Публикация...' : '🚀 Опубликовать'}
          </button>
        </div>
      </Modal>

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-3 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">🎯 GuessUs Editor</h1>
            {version && <span className="text-sm text-gray-400">v{version.version}</span>}
            {hasChanges && <span className="text-yellow-400 text-sm">● изменения</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadDictionary} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">
              🔄 Обновить
            </button>
            <button onClick={exportJson} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">
              💾 Скачать
            </button>
            <button 
              onClick={() => setPublishOpen(true)} 
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm"
            >
              📤 Опубликовать
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden flex-shrink-0">
          {/* Variant */}
          <div className="p-3 border-b border-gray-700">
            <div className="flex gap-2">
              <button
                onClick={() => setVariant('adult')}
                className={`flex-1 py-2 rounded text-sm font-medium ${variant === 'adult' ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                🔞 Adult
              </button>
              <button
                onClick={() => setVariant('family')}
                className={`flex-1 py-2 rounded text-sm font-medium ${variant === 'family' ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                👨‍👩‍👧 Family
              </button>
            </div>
          </div>

          {/* Categories */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400 font-medium">Категории</span>
              <button
                onClick={() => setAddCategoryOpen(true)}
                className="text-xs bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded"
              >
                + Новая
              </button>
            </div>
            <div className="space-y-1">
              {data?.categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex-1 py-2 px-3 rounded text-sm text-left flex items-center justify-between ${
                      selectedCategory === cat.id ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <span>{cat.emoji} {cat.name}</span>
                    <span className="text-xs opacity-60">
                      {data.words[cat.id]?.length || 0}
                    </span>
                  </button>
                  {!DEFAULT_ADULT_CATEGORIES.find(c => c.id === cat.id) && 
                   !DEFAULT_FAMILY_CATEGORIES.find(c => c.id === cat.id) && (
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-2 text-red-400 hover:bg-gray-700 rounded"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="p-3 border-t border-gray-700 text-sm">
              <div className="text-2xl font-bold text-blue-400 mb-1">{stats.total}</div>
              <div className="text-gray-400 text-xs">слов всего</div>
              <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-gray-500">
                {LANGUAGES.map(l => (
                  <div key={l.code}>{l.flag} {stats.byLang[l.code]}</div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="p-3 border-b border-gray-700 flex items-center gap-3 flex-wrap bg-gray-800/50">
            {currentCategory && (
              <div className="flex items-center gap-2">
                <span className="text-2xl">{currentCategory.emoji}</span>
                <div>
                  <div className="font-medium">{currentCategory.name}</div>
                  <div className="text-xs text-gray-400">
                    Жесть: {currentCategory.intensityMin}-{currentCategory.intensityMax}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex-1" />
            
            <input
              type="text"
              placeholder="🔍 Поиск..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 bg-gray-700 rounded border border-gray-600 text-sm w-48"
            />
            
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">Жесть:</span>
              <input
                type="number" min={1} max={10}
                value={intensityFilter[0]}
                onChange={e => setIntensityFilter([Number(e.target.value), intensityFilter[1]])}
                className="w-12 px-2 py-1 bg-gray-700 rounded border border-gray-600 text-center"
              />
              <span>-</span>
              <input
                type="number" min={1} max={10}
                value={intensityFilter[1]}
                onChange={e => setIntensityFilter([intensityFilter[0], Number(e.target.value)])}
                className="w-12 px-2 py-1 bg-gray-700 rounded border border-gray-600 text-center"
              />
            </div>
            
            <button
              onClick={() => {
                setNewWord({ ru: '', en: '', es: '', ua: '', intensity: currentCategory?.intensityMin || 5 })
                setAddWordOpen(true)
              }}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm"
            >
              ➕ Добавить слово
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto p-3">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-800">
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 w-12">#</th>
                  {LANGUAGES.map(l => (
                    <th key={l.code} className="text-left py-2 px-3">{l.flag} {l.name}</th>
                  ))}
                  <th className="text-center py-2 px-3 w-20">Жесть</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {currentWords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      {searchQuery ? 'Ничего не найдено' : 'Нет слов в категории'}
                      <div className="mt-2">
                        <button
                          onClick={() => setAddWordOpen(true)}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
                        >
                          ➕ Добавить слово
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentWords.map((word, idx) => (
                    <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                      <td className="py-1 px-3 text-gray-500">{idx + 1}</td>
                      {LANGUAGES.map(l => (
                        <td key={l.code} className="py-1 px-3">
                          {editingCell?.wordIdx === idx && editingCell?.field === l.code ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={saveEdit}
                              onKeyDown={e => e.key === 'Enter' && saveEdit()}
                              className="w-full px-2 py-1 bg-gray-700 rounded border border-blue-500"
                            />
                          ) : (
                            <span
                              onClick={() => startEdit(idx, l.code)}
                              className={`cursor-pointer hover:bg-gray-700 px-2 py-1 rounded block ${!word[l.code] ? 'text-gray-600 italic' : ''}`}
                            >
                              {word[l.code] || '—'}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="py-1 px-3 text-center">
                        {editingCell?.wordIdx === idx && editingCell?.field === 'intensity' ? (
                          <input
                            autoFocus
                            type="number" min={1} max={10}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={e => e.key === 'Enter' && saveEdit()}
                            className="w-12 px-2 py-1 bg-gray-700 rounded border border-blue-500 text-center"
                          />
                        ) : (
                          <span
                            onClick={() => startEdit(idx, 'intensity')}
                            className={`cursor-pointer hover:bg-gray-700 px-2 py-1 rounded inline-block ${
                              word.intensity >= 8 ? 'text-red-400' : 
                              word.intensity >= 5 ? 'text-yellow-400' : 'text-green-400'
                            }`}
                          >
                            {word.intensity}
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-3">
                        <button
                          onClick={() => handleDeleteWord(idx)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer info */}
          <div className="p-2 border-t border-gray-700 text-xs text-gray-500 text-center bg-gray-800/50">
            💡 Кликните на ячейку для редактирования • Напишите боту для генерации слов AI
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
