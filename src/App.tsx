import { useState, useEffect, useMemo } from 'react'

// Types
type Language = 'ru' | 'en' | 'es' | 'ua'
type AdultCategory = 'party' | 'dirty' | 'extreme'
type FamilyCategory = 'movies' | 'food' | 'animals' | 'sports' | 'travel' | 'professions'
type Category = AdultCategory | FamilyCategory | string
type DictionaryVariant = 'adult' | 'family'

type WordDatabase = Record<Language, Partial<Record<string, string[]>>>

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

const ADULT_CATEGORIES: { code: AdultCategory; name: string; emoji: string }[] = [
  { code: 'party', name: 'Party', emoji: '🎉' },
  { code: 'dirty', name: 'Dirty', emoji: '🔞' },
  { code: 'extreme', name: 'Extreme', emoji: '💀' },
]

const FAMILY_CATEGORIES: { code: FamilyCategory; name: string; emoji: string }[] = [
  { code: 'movies', name: 'Movies', emoji: '🎬' },
  { code: 'food', name: 'Food', emoji: '🍕' },
  { code: 'animals', name: 'Animals', emoji: '🐱' },
  { code: 'sports', name: 'Sports', emoji: '⚽' },
  { code: 'travel', name: 'Travel', emoji: '✈️' },
  { code: 'professions', name: 'Professions', emoji: '👨‍⚕️' },
]

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/Syrohub/guessus-dictionary/main'

// Modal component
function Modal({ isOpen, onClose, title, children }: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode 
}) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {children}
        </div>
      </div>
    </div>
  )
}

function App() {
  // State
  const [variant, setVariant] = useState<DictionaryVariant>('adult')
  const [language, setLanguage] = useState<Language>('ru')
  const [category, setCategory] = useState<Category>('party')
  const [dictionary, setDictionary] = useState<WordDatabase | null>(null)
  const [version, setVersion] = useState<VersionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [newWord, setNewWord] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  
  // Modal states
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [copyFromLangOpen, setCopyFromLangOpen] = useState(false)
  const [customCategories, setCustomCategories] = useState<string[]>([])

  // Get categories based on variant + custom
  const baseCategories = variant === 'adult' ? ADULT_CATEGORIES : FAMILY_CATEGORIES
  const allCategories = [
    ...baseCategories,
    ...customCategories.map(c => ({ code: c, name: c, emoji: '📁' }))
  ]

  // Load dictionary from GitHub
  useEffect(() => {
    loadDictionary()
  }, [variant])

  // Reset category when variant changes
  useEffect(() => {
    setCategory(variant === 'adult' ? 'party' : 'movies')
  }, [variant])

  // Detect custom categories from loaded dictionary
  useEffect(() => {
    if (!dictionary) return
    const baseCodes = new Set(baseCategories.map(c => c.code))
    const custom: string[] = []
    
    for (const lang of LANGUAGES) {
      const cats = Object.keys(dictionary[lang.code] || {})
      for (const cat of cats) {
        if (!baseCodes.has(cat as any) && !custom.includes(cat)) {
          custom.push(cat)
        }
      }
    }
    setCustomCategories(custom)
  }, [dictionary, variant])

  const loadDictionary = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const wordsFile = variant === 'adult' ? 'words-adult.json' : 'words.json'
      const versionFile = variant === 'adult' ? 'version-adult.json' : 'version.json'
      
      const [wordsRes, versionRes] = await Promise.all([
        fetch(`${GITHUB_RAW_BASE}/${wordsFile}`),
        fetch(`${GITHUB_RAW_BASE}/${versionFile}`)
      ])
      
      if (!wordsRes.ok || !versionRes.ok) {
        throw new Error('Failed to load dictionary')
      }
      
      const words = await wordsRes.json()
      const ver = await versionRes.json()
      
      setDictionary(words)
      setVersion(ver)
      setHasChanges(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Get current words
  const currentWords = useMemo(() => {
    if (!dictionary) return []
    return dictionary[language]?.[category] || []
  }, [dictionary, language, category])

  // Filtered words
  const filteredWords = useMemo(() => {
    if (!searchQuery) return currentWords
    const query = searchQuery.toLowerCase()
    return currentWords.filter(word => word.toLowerCase().includes(query))
  }, [currentWords, searchQuery])

  // Stats
  const stats = useMemo(() => {
    if (!dictionary) return null
    
    const total = Object.values(dictionary).reduce((langSum, cats) => 
      langSum + Object.values(cats).reduce((catSum, words) => 
        catSum + (words?.length || 0), 0), 0)
    
    const byLanguage = Object.fromEntries(
      LANGUAGES.map(lang => [
        lang.code,
        Object.values(dictionary[lang.code] || {}).reduce((sum, words) => sum + (words?.length || 0), 0)
      ])
    )
    
    return { total, byLanguage }
  }, [dictionary])

  // Find duplicates
  const duplicates = useMemo(() => {
    const seen = new Map<string, number[]>()
    currentWords.forEach((word, idx) => {
      const lower = word.toLowerCase()
      if (seen.has(lower)) {
        seen.get(lower)!.push(idx)
      } else {
        seen.set(lower, [idx])
      }
    })
    return new Set(
      Array.from(seen.values())
        .filter(indices => indices.length > 1)
        .flat()
    )
  }, [currentWords])

  // Remove duplicates
  const removeDuplicates = () => {
    if (!dictionary) return
    
    const seen = new Set<string>()
    const uniqueWords: string[] = []
    
    currentWords.forEach(word => {
      const lower = word.toLowerCase()
      if (!seen.has(lower)) {
        seen.add(lower)
        uniqueWords.push(word)
      }
    })
    
    const removed = currentWords.length - uniqueWords.length
    if (removed === 0) return
    
    setDictionary({
      ...dictionary,
      [language]: {
        ...dictionary[language],
        [category]: uniqueWords
      }
    })
    setHasChanges(true)
    alert(`Удалено ${removed} дубликатов!`)
  }

  // Remove ALL duplicates
  const removeAllDuplicates = () => {
    if (!dictionary) return
    
    let totalRemoved = 0
    const newDict = { ...dictionary }
    
    for (const lang of LANGUAGES) {
      for (const cat of allCategories) {
        const words = newDict[lang.code]?.[cat.code] || []
        const seen = new Set<string>()
        const uniqueWords: string[] = []
        
        words.forEach(word => {
          const lower = word.toLowerCase()
          if (!seen.has(lower)) {
            seen.add(lower)
            uniqueWords.push(word)
          }
        })
        
        totalRemoved += words.length - uniqueWords.length
        
        if (newDict[lang.code]) {
          newDict[lang.code] = {
            ...newDict[lang.code],
            [cat.code]: uniqueWords
          }
        }
      }
    }
    
    if (totalRemoved === 0) {
      alert('Дубликатов не найдено!')
      return
    }
    
    setDictionary(newDict)
    setHasChanges(true)
    alert(`Удалено ${totalRemoved} дубликатов во всех категориях!`)
  }

  // Add word
  const addWord = () => {
    if (!newWord.trim() || !dictionary) return
    
    const words = [...(dictionary[language]?.[category] || []), newWord.trim()]
    setDictionary({
      ...dictionary,
      [language]: {
        ...dictionary[language],
        [category]: words
      }
    })
    setNewWord('')
    setHasChanges(true)
  }

  // Bulk add words
  const bulkAddWords = () => {
    if (!bulkText.trim() || !dictionary) return
    
    const newWords = bulkText
      .split('\n')
      .map(w => w.trim())
      .filter(w => w.length > 0)
    
    if (newWords.length === 0) return
    
    const existingWords = dictionary[language]?.[category] || []
    const existingLower = new Set(existingWords.map(w => w.toLowerCase()))
    
    const uniqueNewWords = newWords.filter(w => !existingLower.has(w.toLowerCase()))
    
    setDictionary({
      ...dictionary,
      [language]: {
        ...dictionary[language],
        [category]: [...existingWords, ...uniqueNewWords]
      }
    })
    
    setBulkText('')
    setBulkAddOpen(false)
    setHasChanges(true)
    alert(`Добавлено ${uniqueNewWords.length} слов (пропущено ${newWords.length - uniqueNewWords.length} дубликатов)`)
  }

  // Add new category
  const addCategory = () => {
    if (!newCategoryName.trim() || !dictionary) return
    
    const catCode = newCategoryName.trim().toLowerCase().replace(/\s+/g, '_')
    
    // Add empty category to all languages
    const newDict = { ...dictionary }
    for (const lang of LANGUAGES) {
      newDict[lang.code] = {
        ...newDict[lang.code],
        [catCode]: []
      }
    }
    
    setDictionary(newDict)
    setCustomCategories([...customCategories, catCode])
    setCategory(catCode)
    setNewCategoryName('')
    setAddCategoryOpen(false)
    setHasChanges(true)
  }

  // Copy words from another language
  const copyFromLanguage = (sourceLang: Language) => {
    if (!dictionary || sourceLang === language) return
    
    const sourceWords = dictionary[sourceLang]?.[category] || []
    if (sourceWords.length === 0) {
      alert(`Нет слов в ${sourceLang.toUpperCase()} для этой категории`)
      return
    }
    
    const existingWords = dictionary[language]?.[category] || []
    const existingLower = new Set(existingWords.map(w => w.toLowerCase()))
    
    const newWords = sourceWords.filter(w => !existingLower.has(w.toLowerCase()))
    
    setDictionary({
      ...dictionary,
      [language]: {
        ...dictionary[language],
        [category]: [...existingWords, ...newWords]
      }
    })
    
    setCopyFromLangOpen(false)
    setHasChanges(true)
    alert(`Скопировано ${newWords.length} слов из ${sourceLang.toUpperCase()}`)
  }

  // Delete word
  const deleteWord = (index: number) => {
    if (!dictionary) return
    
    const words = [...(dictionary[language]?.[category] || [])]
    words.splice(index, 1)
    setDictionary({
      ...dictionary,
      [language]: {
        ...dictionary[language],
        [category]: words
      }
    })
    setHasChanges(true)
  }

  // Start editing
  const startEdit = (index: number) => {
    setEditingIndex(index)
    setEditingValue(currentWords[index])
  }

  // Save edit
  const saveEdit = () => {
    if (editingIndex === null || !dictionary || !editingValue.trim()) return
    
    const words = [...(dictionary[language]?.[category] || [])]
    words[editingIndex] = editingValue.trim()
    setDictionary({
      ...dictionary,
      [language]: {
        ...dictionary[language],
        [category]: words
      }
    })
    setEditingIndex(null)
    setEditingValue('')
    setHasChanges(true)
  }

  // Delete category
  const deleteCategory = (catCode: string) => {
    if (!dictionary) return
    if (!confirm(`Удалить категорию "${catCode}" из всех языков?`)) return
    
    const newDict = { ...dictionary }
    for (const lang of LANGUAGES) {
      if (newDict[lang.code]?.[catCode]) {
        const { [catCode]: _, ...rest } = newDict[lang.code]!
        newDict[lang.code] = rest
      }
    }
    
    setDictionary(newDict)
    setCustomCategories(customCategories.filter(c => c !== catCode))
    setCategory(baseCategories[0].code)
    setHasChanges(true)
  }

  // Export JSON
  const exportJson = () => {
    if (!dictionary) return
    
    const blob = new Blob([JSON.stringify(dictionary, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = variant === 'adult' ? 'words-adult.json' : 'words.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Copy to clipboard
  const copyToClipboard = () => {
    if (!dictionary) return
    navigator.clipboard.writeText(JSON.stringify(dictionary, null, 2))
    alert('JSON скопирован в буфер обмена!')
  }

  // Import from file
  const importFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        setDictionary(data)
        setHasChanges(true)
        alert('Словарь загружен!')
      } catch {
        alert('Ошибка: неверный формат JSON')
      }
    }
    reader.readAsText(file)
    e.target.value = '' // Reset input
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Загрузка словаря...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-4">
        <div className="text-xl text-red-400">Ошибка: {error}</div>
        <button 
          onClick={loadDictionary}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
        >
          Повторить
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Bulk Add Modal */}
      <Modal isOpen={bulkAddOpen} onClose={() => setBulkAddOpen(false)} title="📝 Массовое добавление">
        <p className="text-gray-400 mb-4">Вставьте слова (каждое с новой строки):</p>
        <textarea
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          placeholder="Слово 1&#10;Слово 2&#10;Слово 3&#10;..."
          className="w-full h-64 px-4 py-3 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
        />
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-gray-400">
            {bulkText.split('\n').filter(w => w.trim()).length} слов
          </span>
          <button
            onClick={bulkAddWords}
            className="px-6 py-2 bg-green-600 rounded hover:bg-green-700 font-medium"
          >
            ➕ Добавить все
          </button>
        </div>
      </Modal>

      {/* Add Category Modal */}
      <Modal isOpen={addCategoryOpen} onClose={() => setAddCategoryOpen(false)} title="📁 Новая категория">
        <p className="text-gray-400 mb-4">Введите название категории:</p>
        <input
          type="text"
          value={newCategoryName}
          onChange={e => setNewCategoryName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCategory()}
          placeholder="Название категории..."
          className="w-full px-4 py-3 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={addCategory}
          disabled={!newCategoryName.trim()}
          className="w-full mt-4 px-6 py-2 bg-purple-600 rounded hover:bg-purple-700 font-medium disabled:opacity-50"
        >
          ➕ Создать категорию
        </button>
      </Modal>

      {/* Copy From Language Modal */}
      <Modal isOpen={copyFromLangOpen} onClose={() => setCopyFromLangOpen(false)} title="🔄 Копировать из языка">
        <p className="text-gray-400 mb-4">Выберите язык-источник для копирования слов:</p>
        <div className="grid grid-cols-2 gap-3">
          {LANGUAGES.filter(l => l.code !== language).map(lang => {
            const wordCount = dictionary?.[lang.code]?.[category]?.length || 0
            return (
              <button
                key={lang.code}
                onClick={() => copyFromLanguage(lang.code)}
                disabled={wordCount === 0}
                className="p-4 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="text-2xl mb-1">{lang.flag}</div>
                <div className="font-medium">{lang.name}</div>
                <div className="text-sm text-gray-400">{wordCount} слов</div>
              </button>
            )
          })}
        </div>
      </Modal>

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">🎯 GuessUs Editor</h1>
            {version && (
              <span className="text-sm text-gray-400">
                v{version.version}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {hasChanges && (
              <span className="text-yellow-400 text-sm">● Изменения</span>
            )}
            <label className="px-3 py-1.5 bg-gray-700 rounded hover:bg-gray-600 text-sm cursor-pointer">
              📁 Импорт
              <input type="file" accept=".json" onChange={importFromFile} className="hidden" />
            </label>
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 bg-gray-700 rounded hover:bg-gray-600 text-sm"
            >
              📋 Копировать
            </button>
            <button
              onClick={exportJson}
              className="px-3 py-1.5 bg-blue-600 rounded hover:bg-blue-700 text-sm"
            >
              💾 Скачать
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 flex gap-4 flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="lg:w-64 flex-shrink-0 space-y-4">
          {/* Variant selector */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Вариант</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setVariant('adult')}
                className={`flex-1 py-2 rounded text-sm font-medium transition ${
                  variant === 'adult' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                🔞 Adult
              </button>
              <button
                onClick={() => setVariant('family')}
                className={`flex-1 py-2 rounded text-sm font-medium transition ${
                  variant === 'family' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                👨‍👩‍👧 Family
              </button>
            </div>
          </div>

          {/* Language selector */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Язык</h3>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`py-2 rounded text-sm font-medium transition ${
                    language === lang.code
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {lang.flag} {lang.code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Category selector */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-400">Категория</h3>
              <button
                onClick={() => setAddCategoryOpen(true)}
                className="text-xs bg-purple-600 px-2 py-1 rounded hover:bg-purple-700"
              >
                + Новая
              </button>
            </div>
            <div className="space-y-1">
              {allCategories.map(cat => (
                <div key={cat.code} className="flex items-center gap-1">
                  <button
                    onClick={() => setCategory(cat.code)}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium text-left transition flex items-center justify-between ${
                      category === cat.code
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <span>{cat.emoji} {cat.name}</span>
                    <span className="text-xs opacity-75">
                      {dictionary?.[language]?.[cat.code]?.length || 0}
                    </span>
                  </button>
                  {customCategories.includes(cat.code) && (
                    <button
                      onClick={() => deleteCategory(cat.code)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded"
                      title="Удалить категорию"
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
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Статистика</h3>
              <div className="text-2xl font-bold text-blue-400 mb-2">{stats.total} слов</div>
              <div className="space-y-1 text-sm">
                {LANGUAGES.map(lang => (
                  <div key={lang.code} className="flex justify-between text-gray-400">
                    <span>{lang.flag} {lang.name}</span>
                    <span>{stats.byLanguage[lang.code]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Magic buttons */}
          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">🪄 Волшебные кнопки</h3>
            
            <button
              onClick={() => setBulkAddOpen(true)}
              className="w-full py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium"
            >
              📝 Массовое добавление
            </button>
            
            <button
              onClick={() => setCopyFromLangOpen(true)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
            >
              🔄 Копировать из языка
            </button>
            
            {duplicates.size > 0 && (
              <button
                onClick={removeDuplicates}
                className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-medium"
              >
                🗑️ Удалить дубликаты ({duplicates.size})
              </button>
            )}
            
            <button
              onClick={removeAllDuplicates}
              className="w-full py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium"
            >
              🧹 Удалить ВСЕ дубликаты
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1">
          {/* Search and add */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="🔍 Поиск слов..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Новое слово..."
                  value={newWord}
                  onChange={e => setNewWord(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addWord()}
                  className="px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                />
                <button
                  onClick={addWord}
                  disabled={!newWord.trim()}
                  className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ➕
                </button>
              </div>
            </div>
          </div>

          {/* Words header */}
          <div className="flex items-center justify-between mb-2 px-2">
            <h2 className="text-lg font-semibold">
              {LANGUAGES.find(l => l.code === language)?.flag}{' '}
              {allCategories.find(c => c.code === category)?.emoji}{' '}
              {allCategories.find(c => c.code === category)?.name}
            </h2>
            <span className="text-gray-400 text-sm">
              {filteredWords.length} из {currentWords.length} слов
            </span>
          </div>

          {/* Words grid */}
          <div className="bg-gray-800 rounded-lg p-4">
            {filteredWords.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                {searchQuery ? 'Ничего не найдено' : 'Нет слов в этой категории'}
                <div className="mt-4">
                  <button
                    onClick={() => setBulkAddOpen(true)}
                    className="px-4 py-2 bg-green-600 rounded hover:bg-green-700"
                  >
                    📝 Добавить слова
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {filteredWords.map((word, idx) => {
                  const realIndex = currentWords.indexOf(word)
                  const isDuplicate = duplicates.has(realIndex)
                  
                  return (
                    <div
                      key={`${word}-${idx}`}
                      className={`group relative p-2 rounded text-sm transition ${
                        isDuplicate 
                          ? 'bg-yellow-900/50 border border-yellow-600' 
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {editingIndex === realIndex ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit()
                              if (e.key === 'Escape') setEditingIndex(null)
                            }}
                            autoFocus
                            className="flex-1 px-2 py-1 bg-gray-800 rounded text-sm border border-blue-500 focus:outline-none"
                          />
                          <button
                            onClick={saveEdit}
                            className="px-2 py-1 bg-green-600 rounded text-xs hover:bg-green-700"
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="block truncate pr-12">{word}</span>
                          <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 flex gap-1">
                            <button
                              onClick={() => startEdit(realIndex)}
                              className="p-1 bg-blue-600 rounded text-xs hover:bg-blue-700"
                              title="Редактировать"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deleteWord(realIndex)}
                              className="p-1 bg-red-600 rounded text-xs hover:bg-red-700"
                              title="Удалить"
                            >
                              🗑️
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
