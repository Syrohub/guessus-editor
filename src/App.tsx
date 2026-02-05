import { useState, useEffect, useMemo } from 'react'

// Types
type Language = 'ru' | 'en' | 'es' | 'ua'
type AdultCategory = 'party' | 'dirty' | 'extreme'
type FamilyCategory = 'movies' | 'food' | 'animals' | 'sports' | 'travel' | 'professions'
type Category = AdultCategory | FamilyCategory
type DictionaryVariant = 'adult' | 'family'

type WordDatabase = Record<Language, Partial<Record<Category, string[]>>>

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

  // Get categories based on variant
  const categories = variant === 'adult' ? ADULT_CATEGORIES : FAMILY_CATEGORIES

  // Load dictionary from GitHub
  useEffect(() => {
    loadDictionary()
  }, [variant])

  // Reset category when variant changes
  useEffect(() => {
    setCategory(variant === 'adult' ? 'party' : 'movies')
  }, [variant])

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
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">🎯 GuessUs Dictionary Editor</h1>
            {version && (
              <span className="text-sm text-gray-400">
                v{version.version} ({version.updatedAt})
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {hasChanges && (
              <span className="text-yellow-400 text-sm">● Есть несохранённые изменения</span>
            )}
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 bg-gray-700 rounded hover:bg-gray-600 text-sm"
            >
              📋 Копировать JSON
            </button>
            <button
              onClick={exportJson}
              className="px-3 py-1.5 bg-blue-600 rounded hover:bg-blue-700 text-sm"
            >
              💾 Скачать JSON
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 flex gap-4">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 space-y-4">
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
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Категория</h3>
            <div className="space-y-1">
              {categories.map(cat => (
                <button
                  key={cat.code}
                  onClick={() => setCategory(cat.code)}
                  className={`w-full py-2 px-3 rounded text-sm font-medium text-left transition flex items-center justify-between ${
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

          {/* Duplicates warning */}
          {duplicates.size > 0 && (
            <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-400 mb-1">⚠️ Дубликаты</h3>
              <p className="text-xs text-yellow-200">
                Найдено {duplicates.size} повторяющихся слов в этой категории
              </p>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1">
          {/* Search and add */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex gap-4">
              <div className="flex-1">
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
                  ➕ Добавить
                </button>
              </div>
            </div>
          </div>

          {/* Words header */}
          <div className="flex items-center justify-between mb-2 px-2">
            <h2 className="text-lg font-semibold">
              {LANGUAGES.find(l => l.code === language)?.flag}{' '}
              {categories.find(c => c.code === category)?.emoji}{' '}
              {categories.find(c => c.code === category)?.name}
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

          {/* Instructions */}
          <div className="mt-4 bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">
            <h3 className="font-semibold text-gray-300 mb-2">📝 Инструкция</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Выберите вариант (Adult/Family), язык и категорию</li>
              <li>Добавляйте слова через поле ввода + Enter</li>
              <li>Наведите на слово для редактирования или удаления</li>
              <li>Жёлтые слова — дубликаты</li>
              <li>После изменений скачайте JSON и загрузите в GitHub репозиторий</li>
              <li><strong>Репо:</strong> github.com/Syrohub/guessus-dictionary</li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
