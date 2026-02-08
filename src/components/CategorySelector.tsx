"use client";

import { useState, useRef, useEffect } from "react";
import { getParentCategories, getChildCategories, searchCategories, getCategoryById, type NewsCategory } from "@/data/newsCategories";

type CategorySelectorProps = {
  value: string;
  onChange: (value: string) => void;
  language?: 'en' | 'fr';
};

export default function CategorySelector({ value, onChange, language = 'fr' }: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedParent, setExpandedParent] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCategory = getCategoryById(value);
  const parentCategories = getParentCategories();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setExpandedParent(null);
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

  const handleSelectChild = (categoryId: string) => {
    onChange(categoryId);
    setIsOpen(false);
    setSearchQuery("");
    setExpandedParent(null);
  };

  const handleParentClick = (parentId: string) => {
    // Toggle expand - click to show children
    if (expandedParent === parentId) {
      setExpandedParent(null);
    } else {
      setExpandedParent(parentId);
    }
  };

  const getSearchResults = (): NewsCategory[] => {
    if (!searchQuery.trim()) return [];
    return searchCategories(searchQuery, language);
  };

  const searchResults = getSearchResults();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Value Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
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
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
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
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'fr' ? "Rechercher une catégorie..." : "Search categories..."}
                className="w-full pl-10 pr-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-slate-400 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Content Area */}
          <div className="max-h-80 overflow-y-auto">
            {/* Search Results */}
            {searchQuery.trim() ? (
              searchResults.length > 0 ? (
                <div className="p-2 space-y-1">
                  {searchResults.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleSelectChild(category.id)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-orange-500/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{category.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-white text-sm">
                            {language === 'fr' ? category.labelFr : category.label}
                          </span>
                          {category.parent && (
                            <span className="ml-2 text-[10px] text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded">
                              {language === 'fr' 
                                ? getCategoryById(category.parent)?.labelFr 
                                : getCategoryById(category.parent)?.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  {language === 'fr' ? 'Aucune catégorie trouvée' : 'No categories found'}
                </div>
              )
            ) : (
              /* Parent Categories with Expandable Children */
              <div className="p-2 space-y-1">
                {parentCategories.map((parent) => {
                  const children = getChildCategories(parent.id);
                  const isExpanded = expandedParent === parent.id;
                  
                  return (
                    <div key={parent.id} className="rounded-lg overflow-hidden">
                      {/* Parent Category Header */}
                      <button
                        type="button"
                        onClick={() => handleParentClick(parent.id)}
                        className={`w-full text-left px-3 py-3 flex items-center justify-between transition-all duration-200 ${
                          isExpanded 
                            ? 'bg-orange-500/20 border-l-2 border-orange-500' 
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{parent.icon}</span>
                          <div>
                            <span className="font-medium text-white text-sm">
                              {language === 'fr' ? parent.labelFr : parent.label}
                            </span>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {children.length} {language === 'fr' ? 'sous-catégories' : 'subcategories'}
                            </p>
                          </div>
                        </div>
                        <svg 
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      
                      {/* Children - Expandable */}
                      {isExpanded && children.length > 0 && (
                        <div className="bg-slate-800/30 border-l-2 border-orange-500/30 ml-4 animate-in slide-in-from-top-2 duration-200">
                          {children.map((child) => (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => handleSelectChild(child.id)}
                              className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-orange-500/20 transition-colors border-b border-white/5 last:border-b-0"
                            >
                              <span className="text-lg">{child.icon}</span>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-white">
                                  {language === 'fr' ? child.labelFr : child.label}
                                </span>
                                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                                  {language === 'fr' ? child.descriptionFr : child.description}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-white/10 bg-slate-800/30">
            <p className="text-[10px] text-slate-400 text-center">
              {language === 'fr' 
                ? 'Cliquez sur une catégorie pour voir les options' 
                : 'Click a category to see options'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
