"use client";

import { useState, useRef, useEffect } from "react";
import { NEWS_CATEGORIES, getParentCategories, getChildCategories, searchCategories, getCategoryById, type NewsCategory } from "@/data/newsCategories";

type CategorySelectorProps = {
  value: string;
  onChange: (value: string) => void;
  language?: 'en' | 'fr';
};

export default function CategorySelector({ value, onChange, language = 'fr' }: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCategory = getCategoryById(value);
  const parentCategories = getParentCategories();
  
  // Get filtered results based on search or parent selection
  const getFilteredCategories = (): NewsCategory[] => {
    if (searchQuery.trim()) {
      return searchCategories(searchQuery, language);
    }
    if (selectedParent) {
      return getChildCategories(selectedParent);
    }
    return [];
  };

  const filteredCategories = getFilteredCategories();

  // Update display when value prop changes
  useEffect(() => {
    // Force re-render when value changes to ensure display updates
    if (value && !isOpen) {
      const category = getCategoryById(value);
      if (category) {
        // Display is already updated via selectedCategory
        // This effect ensures any edge cases are handled
      }
    }
  }, [value, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setSelectedParent(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Reset highlighted index when filtered categories change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, selectedParent]);

  const handleSelectCategory = (categoryId: string) => {
    onChange(categoryId);
    setIsOpen(false);
    setSearchQuery("");
    setSelectedParent(null);
  };

  const handleParentClick = (parentId: string) => {
    // Always select the category when clicking on the card
    handleSelectCategory(parentId);
  };

  const handleViewChildren = (e: React.MouseEvent, parentId: string) => {
    e.stopPropagation();
    const children = getChildCategories(parentId);
    if (children.length > 0) {
      setSelectedParent(parentId);
      setSearchQuery("");
    }
  };

  const handleBackToParents = () => {
    setSelectedParent(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => 
          Math.min(prev + 1, (searchQuery || selectedParent ? filteredCategories : parentCategories).length - 1)
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (searchQuery || selectedParent) {
          const target = filteredCategories[highlightedIndex];
          if (target) {
            handleSelectCategory(target.id);
          }
        } else {
          const target = parentCategories[highlightedIndex];
          if (target) {
            handleParentClick(target.id);
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        if (selectedParent) {
          handleBackToParents();
        } else {
          setIsOpen(false);
          setSearchQuery("");
        }
        break;
      case "Backspace":
        if (!searchQuery && selectedParent) {
          e.preventDefault();
          handleBackToParents();
        }
        break;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Value Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm text-white hover:border-orange-500/50 focus:border-orange-500 focus:outline-none transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedCategory ? (
            <>
              <span className="text-lg">{selectedCategory.icon}</span>
              <span className="truncate">{language === 'fr' ? selectedCategory.labelFr : selectedCategory.label}</span>
            </>
          ) : (
            <span className="text-slate-400">
              {language === 'fr' ? 'Sélectionner une catégorie...' : 'Select a category...'}
            </span>
          )}
        </div>
        <svg 
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-white/20 bg-slate-900 shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <svg 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedParent(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder={language === 'fr' ? "Rechercher..." : "Search..."}
                className="w-full pl-10 pr-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-slate-400 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Breadcrumb */}
          {selectedParent && !searchQuery && (
            <div className="px-3 py-2 border-b border-white/10 bg-slate-800/30">
              <button
                type="button"
                onClick={handleBackToParents}
                className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {language === 'fr' ? 'Retour aux catégories' : 'Back to categories'}
              </button>
              <div className="mt-1 text-xs text-slate-400">
                {getCategoryById(selectedParent) && (
                  <span>
                    {language === 'fr' 
                      ? getCategoryById(selectedParent)?.labelFr 
                      : getCategoryById(selectedParent)?.label}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Categories List */}
          <div className="max-h-96 overflow-y-auto">
            {/* Search Results or Child Categories */}
            {(searchQuery || selectedParent) ? (
              filteredCategories.length > 0 ? (
                <div className="p-2 space-y-1">
                  {filteredCategories.map((category, index) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleSelectCategory(category.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                        highlightedIndex === index
                          ? 'bg-orange-500/20 border border-orange-500/30'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{category.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white text-sm">
                              {language === 'fr' ? category.labelFr : category.label}
                            </span>
                            {category.parent && (
                              <span className="text-[10px] text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded">
                                {language === 'fr' 
                                  ? getCategoryById(category.parent)?.labelFr 
                                  : getCategoryById(category.parent)?.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {language === 'fr' ? category.descriptionFr : category.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  {language === 'fr' 
                    ? 'Aucune catégorie trouvée' 
                    : 'No categories found'}
                </div>
              )
            ) : (
              /* Parent Categories Grid */
              <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {parentCategories.map((category, index) => {
                  const childCount = getChildCategories(category.id).length;
                  return (
                    <div
                      key={category.id}
                      className={`relative text-left px-3 py-3 rounded-lg transition-colors ${
                        highlightedIndex === index
                          ? 'bg-orange-500/20 border border-orange-500/30'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleParentClick(category.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-xl">{category.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white text-sm truncate">
                                {language === 'fr' ? category.labelFr : category.label}
                              </span>
                              {childCount > 0 && (
                                <span className="flex-shrink-0 text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                                  {childCount}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                              {language === 'fr' ? category.descriptionFr : category.description}
                            </p>
                          </div>
                        </div>
                      </button>
                      {childCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => handleViewChildren(e, category.id)}
                          className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-orange-500/20 transition-colors"
                          title={language === 'fr' ? 'Voir les sous-catégories' : 'View subcategories'}
                        >
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
                })}
              </div>
            )}
          </div>

          {/* Footer Hint */}
          <div className="px-3 py-2 border-t border-white/10 bg-slate-800/30">
            <p className="text-[10px] text-slate-400 text-center">
              {language === 'fr' 
                ? '↑↓ Naviguer • Entrée Sélectionner • Échap Fermer' 
                : '↑↓ Navigate • Enter Select • Esc Close'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
